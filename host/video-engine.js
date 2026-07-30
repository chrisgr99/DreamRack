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
uniform sampler2D uTex; uniform vec2 uRes;
out vec4 o;
void main() { o = vec4(texture(uTex, gl_FragCoord.xy / uRes).rgb, 1.0); }`;

export class VideoEngine {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.gl = this.canvas.getContext('webgl2', { antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
    this.ok = !!this.gl;
    if (!this.ok) { console.warn('[wcoast] no WebGL2 — video is unavailable'); return; }
    const gl = this.gl;
    gl.bindVertexArray(gl.createVertexArray());
    this._test = this._program(TEST);
    this._show = this._program(SHOW);
    this._fbo = null; this._tex = null;
    this._w = 0; this._h = 0;
    this._views = [];                    // { canvas, ctx } — thumbnails blitting this canvas
    this._sources = [];                  // per-frame parameter samplers — see addParamSource
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
    const showTest = this.params.test === 'on';

    gl.viewport(0, 0, this._w, this._h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo);
    if (showTest) {
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

  dispose() {
    this.stop();
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
