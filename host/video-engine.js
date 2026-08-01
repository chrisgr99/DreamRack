// video-engine.js — the one WebGL context, and the per-frame render of the video graph.
//
// Owned by the RACK, not by the Video Output module, and created LAZILY the first time any
// video module exists — the same pattern the monitor bus uses. Two reasons it is not the
// module's: a monitor probe should be able to look at a video chain before anything has been
// committed to a screen, and a patch with no video at all should not pay for a GL context.
//
// ONE CONTEXT, ALWAYS. Textures cannot be shared between WebGL contexts, so two contexts
// could not pass an image from one module to the next at all, and a browser caps a page at
// around sixteen. Every module's pass, every preview thumbnail and the output all live here.
//
// Previews are 2-D canvas BLITS of this one canvas (see addView), not extra contexts. A
// thumbnail on a faceplate and the eventual monitor probes are the same mechanism.
//
// Cost was measured before any of this was designed around a guess (design/video-synthesis.md,
// phase 0): about 0.20 ms per full-screen RGBA8 pass at 1080p on an M4, linear in passes, so
// roughly 80 passes fit in a 60 Hz frame. Pass count is not the thing to worry about; the
// internal render resolution is the dial that buys headroom on weaker hardware.

'use strict';

// Internal render size, as a fraction of 1080p. The default is deliberately BELOW native:
// the aesthetic tolerates it, feedback positively benefits from a softer buffer, and it
// leaves headroom on hardware that is not an M4.
export const RES_STEPS = { qtr: 0.25, half: 0.5, threeQ: 0.75, full: 1 };
const BASE_W = 1920, BASE_H = 1080;

// Framings, as width over height. Square and vertical are here because that is what the
// places these clips get posted actually want, and deciding it at render time costs nothing.
// How many frames of history a module that asks for it gets — about half a second at 60Hz,
// which is where delay, trails and slit-scan all have their useful settings.
export const HIST_LEN = 32;

export const FRAMES = { '16:9': 16 / 9, '1:1': 1, '9:16': 9 / 16 };

const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// The test pattern. It has a job beyond "something to look at": bars to judge colour, a
// centre cross to judge framing, a grey ramp to judge banding and where the limit bites, and
// one moving element so that "is it live?" is answerable at a glance rather than by waiting.
const TEST = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform float uBright; uniform float uLimit;
out vec4 o;

vec3 bar(float i) {
  if (i < 1.0) return vec3(1.0);
  if (i < 2.0) return vec3(1.0, 1.0, 0.0);
  if (i < 3.0) return vec3(0.0, 1.0, 1.0);
  if (i < 4.0) return vec3(0.0, 1.0, 0.0);
  if (i < 5.0) return vec3(1.0, 0.0, 1.0);
  if (i < 6.0) return vec3(1.0, 0.0, 0.0);
  return vec3(0.0, 0.0, 1.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  uv.y = 1.0 - uv.y;                                  // top-down, so "upper band" means upper
  vec3 c;
  if (uv.y < 0.62) {
    c = bar(floor(uv.x * 7.0));                       // colour bars
  } else if (uv.y < 0.74) {
    c = vec3(floor(uv.x * 12.0) / 11.0);              // stepped grey ramp — banding and limit
  } else {
    // A bar sweeping left to right, so motion is unmistakable, over a dark field.
    float sweep = fract(uTime * 0.25);
    float d = abs(uv.x - sweep);
    c = vec3(smoothstep(0.06, 0.0, d)) * vec3(1.0, 0.55, 0.1);
  }
  // Centre cross, drawn over everything: the framing reference.
  vec2 p = abs(uv - 0.5);
  if ((p.x < 0.0015 && p.y < 0.08) || (p.y < 0.0027 && p.x < 0.045)) c = vec3(1.0);
  c *= uBright;
  o = vec4(min(c, vec3(uLimit)), 1.0);
}`;

// Final pass to the visible canvas. Separate from the pattern so that when real modules
// arrive, this is the only thing that changes: it samples whatever texture the graph ended on.
const SHOW = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 uRes; uniform float uBright; uniform float uLimit;
out vec4 o;
void main() {
  vec3 c = texture(uTex, gl_FragCoord.xy / uRes).rgb * uBright;
  o = vec4(min(c, vec3(uLimit)), 1.0);
}`;

export class VideoEngine {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.gl = this.canvas.getContext('webgl2', { antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
    this.ok = !!this.gl;
    if (!this.ok) { console.warn('[wcoast] no WebGL2 — video is unavailable'); return; }
    const gl = this.gl;
    // Shader compilation and linking can fail on a driver we have never met. Failing here must
    // cost the picture, not the module: `ok` false is the same state as no WebGL2 at all, which
    // every caller already handles.
    try {
      gl.bindVertexArray(gl.createVertexArray());
      this._test = this._program(TEST);
      this._show = this._program(SHOW);
    } catch (e) {
      console.warn('[wcoast] video shaders failed to build —', e && e.message);
      this.ok = false;
      return;
    }
    this._fbo = null; this._tex = null;
    this._w = 0; this._h = 0;
    this._views = [];                    // { canvas, ctx } — thumbnails blitting this canvas
    this._nodeViews = [];                // { canvas, ctx, key, port } — monitors on one graph point
    this._sources = [];                  // per-frame parameter samplers — see addParamSource
    this._nodes = new Map();             // key -> { glsl, prog, fbo, tex, inputs, uniforms }
    this._edges = [];                    // { from, to, port } — the video wiring, from the rack
    this._order = [];                    // node keys, feeders first
    this._terminal = null;               // { key, port } — whose input the SHOW pass displays
    this._histHead = 0;                  // which ring layer this frame is being written to
    this._raf = 0;
    this._t0 = performance.now();
    // Uniform state, written by the module and read at the top of each frame. Deliberately
    // plain numbers: CV reaches video as a per-frame SAMPLE, never as an audio connection.
    this.params = { bright: 1, limit: 1, res: 'half', frame: '16:9', test: 'on' };
    this.setSize();
  }

  _shader(type, src) {
    const gl = this.gl, sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }
  _program(fs) {
    const gl = this.gl, p = gl.createProgram();
    gl.attachShader(p, this._shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, this._shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) {
      const n = gl.getActiveUniform(p, i).name;
      u[n] = gl.getUniformLocation(p, n);
    }
    return { p, u };
  }

  // Allocate the render target for the current resolution and framing. Called on a change
  // rather than per frame: reallocating a framebuffer is not something to do at 60 Hz, which
  // is why RES and FRAME are switches and not knobs.
  setSize() {
    if (!this.ok) return;
    const gl = this.gl;
    const scale = RES_STEPS[this.params.res] ?? 0.5;
    const aspect = FRAMES[this.params.frame] ?? 16 / 9;
    const h = Math.max(64, Math.round(BASE_H * scale));
    const w = Math.max(64, Math.round(h * aspect));
    if (w === this._w && h === this._h) return;
    this._w = w; this._h = h;
    this.canvas.width = w; this.canvas.height = h;
    if (this._tex) gl.deleteTexture(this._tex);
    if (this._fbo) gl.deleteFramebuffer(this._fbo);
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this._tex = t; this._fbo = f;
    this._resizeTargets();               // every module's own target follows the render size
  }

  // ---- the video graph ----
  //
  // A module hands over SHADER SOURCE and a per-frame uniform block; the engine owns every
  // scrap of GL. That split is what keeps thirteen planned modules from each growing their own
  // WebGL code, and it is why a module never sees a texture, a framebuffer or a program.
  //
  // setGraph is called by the rack whenever the video wiring changes — not per frame. It
  // compiles what is new, allocates a framebuffer per node, and topologically sorts the nodes so
  // that a module is always drawn after everything feeding it.
  //
  // nodes: [{ key, glsl, inputs: [portName], uniforms() }]
  // edges: [{ from: key, to: key, port: portName }]
  setGraph(nodes, edges) {
    if (!this.ok) return;
    const gl = this.gl;
    const wanted = new Set(nodes.map((n) => n.key));
    for (const [key, n] of this._nodes) {                    // modules that have gone
      if (!wanted.has(key)) { this._freeTarget(n); this._nodes.delete(key); }
    }
    for (const spec of nodes) {
      let n = this._nodes.get(spec.key);
      if (!n) { n = { key: spec.key }; this._nodes.set(spec.key, n); }
      n.uniforms = spec.uniforms;
      n.inputs = spec.inputs || [];
      if (!!spec.history !== !!n.wantsHistory) { n.wantsHistory = !!spec.history; this._freeTarget(n); }
      if (n.glsl !== spec.glsl) {                            // a shader only compiles on a change
        n.glsl = spec.glsl;
        try { n.prog = this._program(spec.glsl); }
        catch (e) { console.warn('[wcoast] video shader failed for', spec.key, '—', e && e.message); n.prog = null; }
      }
      if (!n.fbo) this._makeTarget(n);
    }
    this._edges = edges.slice();
    this._order = this._topoSort();
  }

  // Depth-first, with a seen set that also catches a cycle: video FEEDBACK is a real technique
  // and a later module owns it deliberately (ping-pong buffers, one frame of delay). An
  // accidental cycle here would simply hang, so the edge that closes it is dropped and said so.
  _topoSort() {
    const out = [], mark = new Map();
    const feeders = (key) => this._edges.filter((e) => e.to === key).map((e) => e.from);
    const visit = (key, stack) => {
      if (mark.get(key) === 'done') return;
      if (mark.get(key) === 'open') {
        console.warn('[wcoast] video graph has a loop through', key, '— that edge is ignored');
        return;
      }
      mark.set(key, 'open');
      for (const f of feeders(key)) if (this._nodes.has(f)) visit(f, stack);
      mark.set(key, 'done');
      out.push(key);
    };
    for (const key of this._nodes.keys()) visit(key, []);
    return out;
  }

  // The texture a module's input port is fed by, or null. Used both to bind samplers and to
  // decide what the terminal shows.
  sourceTexture(key, port) {
    const e = this._edges.find((x) => x.to === key && x.port === port);
    const n = e && this._nodes.get(e.from);
    return n ? n.tex : null;
  }

  // The FRAME HISTORY: a ring of past frames, as a 2D TEXTURE ARRAY.
  //
  // An array rather than a list of samplers, and that is the whole trick. GLSL will not let a
  // fragment shader pick between separate samplers per pixel, but it will sample an array at a
  // layer computed per pixel — which is exactly what slit-scan needs: every row of the output
  // taken from a different moment. Sampler arrays would give delay and trails and stop there.
  //
  // A module asks for history by declaring it; the engine writes that module's INPUT into the
  // ring once per frame and hands the whole ring to its shader. Cost is one extra pass, and
  // memory: HIST_LEN frames at the render size. 32 is roughly half a second at 60Hz, which is
  // where the interesting settings are, and it is allocated only for a module that asks.
  _makeHistory(n) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, this._w, this._h, HIST_LEN);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    n.hist = t;
    n.histFbo = gl.createFramebuffer();
  }

  // Write this frame's input into the ring at `head`.
  _writeHistory(n, head) {
    const gl = this.gl;
    const src = this.sourceTexture(n.key, n.inputs[0]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, n.histFbo);
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, n.hist, 0, head);
    gl.useProgram(this._show.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src || this._blankTex());
    gl.uniform1i(this._show.u.uTex, 0);
    gl.uniform2f(this._show.u.uRes, this._w, this._h);
    if (this._show.u.uBright) gl.uniform1f(this._show.u.uBright, 1);
    if (this._show.u.uLimit) gl.uniform1f(this._show.u.uLimit, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  _makeTarget(n) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, this._w, this._h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    n.tex = t; n.fbo = f;
    if (n.wantsHistory) this._makeHistory(n);
    // RGBA8 for every node in this phase, luma included. Phase 0 measured an R8 pass at about
    // half the cost, so a monochrome chain should eventually allocate R8 and save it; doing that
    // now would mean two texture formats and two sampler idioms before there is a chain long
    // enough to notice. The measurement is recorded; the optimisation waits for a reason.
  }

  _freeTarget(n) {
    const gl = this.gl;
    if (n.tex) gl.deleteTexture(n.tex);
    if (n.fbo) gl.deleteFramebuffer(n.fbo);
    if (n.hist) gl.deleteTexture(n.hist);
    if (n.histFbo) gl.deleteFramebuffer(n.histFbo);
    n.tex = null; n.fbo = null; n.hist = null; n.histFbo = null;
  }

  // Every node's target follows the render size, so a RES or FRAME change reallocates them all.
  _resizeTargets() {
    for (const n of this._nodes.values()) { this._freeTarget(n); this._makeTarget(n); }
  }

  // Draw one module into its own framebuffer, with its feeders bound as samplers.
  _drawNode(n, time) {
    const gl = this.gl;
    if (!n.prog || !n.fbo) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, n.fbo);
    gl.useProgram(n.prog.p);
    if (n.prog.u.uRes) gl.uniform2f(n.prog.u.uRes, this._w, this._h);
    if (n.prog.u.uTime) gl.uniform1f(n.prog.u.uTime, time);
    let unit = 0;
    for (const port of n.inputs) {
      const tex = this.sourceTexture(n.key, port);
      const loc = n.prog.u['u_' + port];
      const has = n.prog.u['has_' + port];
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex || this._blankTex());
      if (loc) gl.uniform1i(loc, unit);
      if (has) gl.uniform1i(has, tex ? 1 : 0);
      unit++;
    }
    if (n.hist) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, n.hist);
      if (n.prog.u.u_history) gl.uniform1i(n.prog.u.u_history, unit);
      if (n.prog.u.u_histLen) gl.uniform1f(n.prog.u.u_histLen, HIST_LEN);
      if (n.prog.u.u_histHead) gl.uniform1f(n.prog.u.u_histHead, this._histHead);
      unit++;
    }
    const vals = (typeof n.uniforms === 'function' && n.uniforms()) || {};
    for (const k of Object.keys(vals)) {
      const loc = n.prog.u['u_' + k];
      if (loc) gl.uniform1f(loc, Number(vals[k]) || 0);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // One black pixel, for an input port with nothing patched into it.
  _blankTex() {
    if (this._blank) return this._blank;
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    this._blank = t;
    return t;
  }

  // ---- the video monitor: a view of ONE POINT in the graph ----
  //
  // The design rates this above any module, and the reason is arithmetic: a patch of eight video
  // modules has one output, so without it you cannot see what the third module in a chain emits
  // except by unplugging the chain. It is the same object the audio side already has — clip it
  // anywhere, as many as you like.
  //
  // `port` null means "this module's own output"; naming an INPUT port means "whatever is feeding
  // that input", which is what you want when you clip one to a compositor's A and B.
  //
  // Cost is one pass and one blit per monitor, in a context that is already rendering. The passes
  // happen BEFORE the terminal's, so the canvas is left holding the terminal image for the window
  // and the pointer follower to blit — the monitors borrow the canvas and give it back.
  addNodeView(key, port, canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return () => {};
    const view = { canvas, ctx, key, port, frozen: false };
    this._nodeViews.push(view);
    return {
      remove: () => { const i = this._nodeViews.indexOf(view); if (i >= 0) this._nodeViews.splice(i, 1); },
      // FREEZE holds the last picture: the view stops being drawn, so whatever is in its canvas
      // stays there. Nothing is copied and nothing is stored — the canvas already IS the frame.
      setFrozen: (f) => { view.frozen = !!f; },
      frozen: () => view.frozen,
    };
  }

  _drawNodeViews() {
    if (!this._nodeViews.length) return;
    const gl = this.gl;
    for (const v of this._nodeViews) {
      if (!v.canvas.isConnected || v.frozen) continue;
      const tex = v.port ? this.sourceTexture(v.key, v.port) : (this._nodes.get(v.key) || {}).tex;
      const { canvas: c, ctx } = v;
      const cw = c.width, ch = c.height;
      if (!tex) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cw, ch); continue; }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(this._show.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(this._show.u.uTex, 0);
      gl.uniform2f(this._show.u.uRes, this._w, this._h);
      // A monitor reports what is THERE, untouched: BRIGHT and LIMIT are the terminal's treatment
      // of the final image, and applying them here would make the monitor lie about its point.
      if (this._show.u.uBright) gl.uniform1f(this._show.u.uBright, 1);
      if (this._show.u.uLimit) gl.uniform1f(this._show.u.uLimit, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const s = Math.min(cw / this._w, ch / this._h);
      const dw = this._w * s, dh = this._h * s;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(this.canvas, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    }
  }

  // Register a canvas that should show the output. A THUMBNAIL, the eventual monitor probes
  // and any other preview are all this: a 2-D context that gets the engine's canvas drawn
  // into it, scaled. Not a second WebGL context, which could not see these textures.
  addView(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return () => {};
    const view = { canvas, ctx };
    this._views.push(view);
    return () => { const i = this._views.indexOf(view); if (i >= 0) this._views.splice(i, 1); };
  }

  // Register a function called ONCE PER FRAME, before anything is drawn, to write current
  // values into `params`. This is where the rate rule is enforced in code: a module hands over
  // a sampler rather than a connection, so a 48 kHz control signal is read at 60 Hz and cannot
  // pretend to be video-rate. What the sampler reads is a module's business — for Video Output
  // it is an AnalyserNode on the summed knob-plus-CV value.
  addParamSource(fn) {
    this._sources.push(fn);
    return () => { const i = this._sources.indexOf(fn); if (i >= 0) this._sources.splice(i, 1); };
  }

  start() { if (this.ok && !this._raf) this._raf = requestAnimationFrame((t) => this._frame(t)); }
  stop() { if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; } }

  _frame(now) {
    this._raf = requestAnimationFrame((t) => this._frame(t));
    if (!this.ok) return;
    const gl = this.gl;
    const time = (now - this._t0) / 1000;
    // Sample every module's parameters first, so one frame is drawn from one consistent set of
    // values rather than from values that changed halfway through it.
    for (const fn of this._sources) { try { fn(this.params); } catch (_e) { /* a bad sampler must not stop the frame */ } }
    gl.viewport(0, 0, this._w, this._h);

    // THE GRAPH, feeders first. Each module draws into its own framebuffer, sampling the
    // textures of whatever feeds it; nothing is read back to the CPU at any point.
    // The ring is written BEFORE anything is drawn, so every history module sees the same head
    // and a shader reading "one frame ago" means the same thing across the whole graph.
    this._histHead = (this._histHead + 1) % HIST_LEN;
    for (const n of this._nodes.values()) if (n.hist) this._writeHistory(n, this._histHead);
    gl.viewport(0, 0, this._w, this._h);

    for (const key of this._order) {
      const n = this._nodes.get(key);
      if (n) this._drawNode(n, time);
    }

    // The monitors first, each borrowing the canvas for one pass — see _drawNodeViews. They go
    // before the terminal so the canvas is left holding the terminal's image afterwards.
    this._drawNodeViews();

    // What the terminal is looking at: the texture of whatever is patched into its image input.
    // A patched chain wins over the test pattern — the pattern is scaffolding, and the moment
    // there is a real image the module should be showing it.
    const patched = this._terminal ? this.sourceTexture(this._terminal.key, this._terminal.port) : null;
    const showTest = !patched && this.params.test === 'on';

    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo);
    if (patched) {
      // Straight through the show shader's own sampler, then treated by BRIGHT and LIMIT below.
      gl.useProgram(this._show.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, patched);
      gl.uniform1i(this._show.u.uTex, 0);
      gl.uniform2f(this._show.u.uRes, this._w, this._h);
      if (this._show.u.uBright) gl.uniform1f(this._show.u.uBright, this.params.bright);
      if (this._show.u.uLimit) gl.uniform1f(this._show.u.uLimit, this.params.limit);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else if (showTest) {
      gl.useProgram(this._test.p);
      gl.uniform2f(this._test.u.uRes, this._w, this._h);
      gl.uniform1f(this._test.u.uTime, time);
      gl.uniform1f(this._test.u.uBright, this.params.bright);
      gl.uniform1f(this._test.u.uLimit, this.params.limit);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else {
      // Nothing patched and the test pattern off: black, honestly, rather than a stale frame.
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(this._show.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this._tex);
    gl.uniform1i(this._show.u.uTex, 0);
    gl.uniform2f(this._show.u.uRes, this._w, this._h);
    // Unity here: BRIGHT and LIMIT were already applied when the image was written into _tex,
    // and applying them twice would square the fade.
    if (this._show.u.uBright) gl.uniform1f(this._show.u.uBright, 1);
    if (this._show.u.uLimit) gl.uniform1f(this._show.u.uLimit, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    for (const v of this._views) {
      const { canvas: c, ctx } = v;
      if (!c.isConnected) continue;
      // Fit the image inside the view, letterboxed in black — the framing is the engine's,
      // and a thumbnail must not lie about the aspect the output is actually producing.
      const cw = c.width, ch = c.height;
      const s = Math.min(cw / this._w, ch / this._h);
      const dw = this._w * s, dh = this._h * s;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(this.canvas, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    }
  }

  // ---- the output window ----
  //
  // The window shows a VIEW of the engine canvas — a 2-D blit, the same mechanism the module's
  // thumbnail uses — rather than the engine canvas itself.
  //
  // Moving the real canvas into the window was the original design and it is wrong here. It works
  // only if the window is genuinely displayed: Electron accepts requestWindow and then may never
  // show anything, and the canvas is left in a document nobody is compositing. The picture stops
  // — including the module's own preview — with no error and no window, which is exactly what it
  // looked like from the outside. A view cannot fail that way: the engine canvas never leaves this
  // document, so whatever happens to the window, the rack keeps drawing.
  //
  // The cost is one drawImage per frame, GPU-composited, of a canvas that is already on the GPU.
  // Still one WebGL context, still no IPC, no encode and no latency.
  async openWindow(onClose) {
    if (!this.ok || this.windowOpen()) return false;
    this._onWinClose = onClose || null;
    const size = this._savedWindowSize();
    // Document Picture-in-Picture, but NOT under Electron. Electron exposes the API and resolves
    // requestWindow, then shows nothing: the request succeeds, the code takes the window branch,
    // and the user gets no window at all with no error to explain it. The in-app pane is the
    // honest choice there — it appears, it moves, it resizes. (A real second-monitor window in
    // Electron means a second renderer and a stream between them, which the design places with
    // fullscreen capture in a later phase, not here.)
    const pip = window.wcoast ? null : window.documentPictureInPicture;
    if (pip && typeof pip.requestWindow === 'function') {
      try {
        const w = await pip.requestWindow({ width: size.w, height: size.h });
        w.document.body.style.cssText = 'margin:0;background:#000;overflow:hidden';
        this._winView = this._addOutputCanvas(w.document, w.document.body, w);
        // The user can close it from the OS chrome, so the module's lamp cannot be the only
        // record of whether it is open — the close has to travel back.
        w.addEventListener('pagehide', () => this._windowGone());
        this._win = w;
        return true;
      } catch (_e) { /* refused, or no gesture left — fall through to the in-app pane */ }
    }
    return this._openPane(size);
  }

  // A canvas in `doc`, kept sized to its box, showing the engine's output.
  _addOutputCanvas(doc, parent, win) {
    const c = doc.createElement('canvas');
    c.style.cssText = 'display:block;width:100%;height:100%;background:#000';
    parent.appendChild(c);
    const fit = () => {
      const w = Math.max(16, c.clientWidth || (win ? win.innerWidth : 640));
      const h = Math.max(16, c.clientHeight || (win ? win.innerHeight : 360));
      const dpr = (win && win.devicePixelRatio) || window.devicePixelRatio || 1;
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    };
    fit();
    const ro = (win && win.ResizeObserver) ? new win.ResizeObserver(fit) : new ResizeObserver(fit);
    ro.observe(c);
    const drop = this.addView(c);
    this._winCanvas = c;
    return () => { try { ro.disconnect(); } catch (_e) { /* gone */ } drop(); c.remove(); };
  }

  // The in-app fallback: a floating pane, draggable by its bar, showing the same view.
  _openPane(size) {
    const d = document.createElement('div');
    d.className = 'video-window';
    d.style.width = size.w + 'px';
    d.style.height = size.h + 'px';
    const bar = document.createElement('div');
    bar.className = 'video-window-bar';
    const title = document.createElement('span');
    title.textContent = 'Video Output';
    const close = document.createElement('button');
    close.className = 'video-window-close';
    close.type = 'button';
    close.textContent = '×';
    close.addEventListener('click', () => this._windowGone());
    bar.append(title, close);
    const body = document.createElement('div');
    body.style.cssText = 'flex:1 1 auto;min-height:0';
    d.append(bar, body);
    document.body.appendChild(d);
    this._winView = this._addOutputCanvas(document, body, window);
    bar.addEventListener('pointerdown', (e) => {
      if (e.target === close) return;
      const r = d.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
      const move = (ev) => { d.style.left = (ev.clientX - ox) + 'px'; d.style.top = (ev.clientY - oy) + 'px'; d.style.right = 'auto'; };
      const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    });
    this._pane = d;
    return true;
  }

  closeWindow() {
    if (this._win) { const w = this._win; this._win = null; try { w.close(); } catch (_e) { /* already gone */ } }
    this._teardownWindow();
  }

  // The window went away — by its own close button, by the OS chrome, or by closeWindow above.
  _windowGone() {
    const cb = this._onWinClose;
    this._win = null;
    this._teardownWindow();
    if (cb) { this._onWinClose = null; cb(); }
  }

  _teardownWindow() {
    this._rememberWindowSize();
    if (this._winView) { this._winView(); this._winView = null; }
    this._winCanvas = null;
    if (this._pane) { this._pane.remove(); this._pane = null; }
  }

  windowOpen() { return !!(this._win || this._pane); }

  // ---- the pointer follower ----
  //
  // A small live picture that tracks the cursor. It exists for SCREEN MAGNIFICATION: magnified,
  // you see a small region around the pointer, so a picture anywhere else on the desktop — in a
  // module's thumbnail, or in the output window — is simply not visible while you are working a
  // control. Adjusting a knob and seeing what it does to the image is otherwise two operations
  // that cannot happen at once.
  //
  // It is a VIEW, like every other preview: the same blit of the same canvas, so it costs one
  // drawImage and cannot affect what the engine renders.
  //
  // Placed BELOW AND RIGHT of the hotspot, far enough to clear the arrow itself — the cursor is
  // drawn down-right from its hotspot, so a closer offset would put the picture under the pointer
  // and you would be looking through the thing you are aiming with.
  setFollowPointer(on) {
    if (!this.ok) return false;
    if (!on) {
      if (this._followOff) { this._followOff(); this._followOff = null; }
      if (this._follow) { this._follow.remove(); this._follow = null; }
      return false;
    }
    if (this._follow) return true;
    const c = document.createElement('canvas');
    c.className = 'video-follow';
    c.width = 192; c.height = 108;                 // 16:9, two device pixels per CSS pixel on a retina panel
    document.body.appendChild(c);
    // CLOSE. Magnified, the useful area around the pointer is small, so a picture held at arm's
    // length is off the edge of what you can see — which defeats the whole point. It sits just
    // below the arrow's tail, straddling the pointer: a THIRD of its width to the left, two
    // thirds to the right, so it reads as belonging to the cursor rather than trailing it.
    const TAIL = 16;              // just clear of the arrow's tail, almost touching it
    const EDGE = 6;
    const place = (e) => {
      const w = c.offsetWidth, h = c.offsetHeight;
      let x = e.clientX - w / 3, y = e.clientY + TAIL;
      // No room to the right: the straddle mirrors — a third to the RIGHT of the pointer and two
      // thirds to the left — rather than the picture being clipped or shoved bodily off the
      // cursor. Same object, same relationship, other hand.
      if (x + w > window.innerWidth - EDGE) x = e.clientX - (w * 2) / 3;
      if (y + h > window.innerHeight - EDGE) y = e.clientY - h - 6;
      c.style.left = Math.round(Math.max(EDGE, Math.min(window.innerWidth - w - EDGE, x))) + 'px';
      c.style.top = Math.round(Math.max(EDGE, y)) + 'px';
    };
    const move = (e) => place(e);
    document.addEventListener('pointermove', move, { passive: true });
    const dropView = this.addView(c);
    this._followOff = () => { document.removeEventListener('pointermove', move); dropView(); };
    this._follow = c;
    return true;
  }
  followsPointer() { return !!this._follow; }

  // The terminal declares which of its inputs the screen follows. One per rack, like the mixer.
  setTerminal(key, port) { this._terminal = key ? { key, port } : null; }

  // Size is remembered; POSITION is not, because Document Picture-in-Picture does not accept one
  // — the browser places the window. Storing a position we could never honour would be a lie.
  _savedWindowSize() {
    try {
      const v = JSON.parse(localStorage.getItem('wcoast.videoWindow') || 'null');
      if (v && v.w > 120 && v.h > 80) return { w: Math.round(v.w), h: Math.round(v.h) };
    } catch (_e) { /* no storage */ }
    return { w: 640, h: 360 };
  }
  _rememberWindowSize() {
    // offsetWidth, not clientWidth: the pane's border is inside the size we SET, so measuring the
    // content box and setting it back as the border-box size shrinks the pane by the border on
    // every open-close cycle. Two pixels a time is invisible once and obvious after twenty.
    const w = this._win ? this._win.innerWidth : (this._pane ? this._pane.offsetWidth : 0);
    const h = this._win ? this._win.innerHeight : (this._pane ? this._pane.offsetHeight : 0);
    if (!(w > 120 && h > 80)) return;
    try { localStorage.setItem('wcoast.videoWindow', JSON.stringify({ w, h })); } catch (_e) { /* no storage */ }
  }

  dispose() {
    this.stop();
    this.setFollowPointer(false);
    this.closeWindow();
    this._views.length = 0;
    this._sources.length = 0;
    if (!this.ok) return;
    const gl = this.gl;
    if (this._tex) gl.deleteTexture(this._tex);
    if (this._fbo) gl.deleteFramebuffer(this._fbo);
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  }
}
