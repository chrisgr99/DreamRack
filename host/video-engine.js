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
