// factory.js — the Compositor's realized instance.
//
// The CV seam is the one every video module uses; see coordinate-field for the full account.
//
// NOTE: no backticks anywhere inside the GLSL string. It is a JavaScript template literal, and a
// backtick in a comment closes it.

'use strict';

const WINDOW = 32;
const CV_PARAMS = ['mix', 'key'];

const GLSL = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform sampler2D u_aIn; uniform int has_aIn;
uniform sampler2D u_bIn; uniform int has_bIn;
uniform sampler2D u_keyIn; uniform int has_keyIn;
uniform float u_mix, u_key, u_mode;
out vec4 o;

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;

  vec3 a = has_aIn == 1 ? texture(u_aIn, uv).rgb : vec3(0.0);
  vec3 b = has_bIn == 1 ? texture(u_bIn, uv).rgb : vec3(0.0);
  // ONE CABLE PASSES THROUGH. With only one picture patched the other socket reads as a COPY of it
  // rather than as black, so the module is transparent until there are genuinely two things to
  // combine. Black in the empty socket would mean the first cable you plug in comes up half dark and
  // the blend list does nothing, which reads as a broken module rather than an unfinished patch.
  if (has_aIn == 1 && has_bIn == 0) b = a;
  if (has_bIn == 1 && has_aIn == 0) a = b;

  // What B becomes when it meets A. Every mode is "A something B", and each returns the FULL effect;
  // how much of it you get is the crossfade below, which is the same for all of them.
  int mode = int(u_mode + 0.5);
  vec3 f;
  if (mode == 0) f = b;                                       // MIX    — a plain dissolve
  else if (mode == 1) f = mix(b, a, luma(a));                 // OVER   — A over B, keyed on itself
  else if (mode == 2) f = a + b;                              // ADD    — light on light, and it clips
  else if (mode == 3) f = 1.0 - (1.0 - a) * (1.0 - b);        // SCREEN — add without the clipping
  else if (mode == 4) f = a * b;                              // MULT   — light only where BOTH are
  else if (mode == 5) f = min(a, b);                          // DARK   — the darker of the two
  else if (mode == 6) f = max(a, b);                          // LIGHT  — the brighter
  else f = abs(a - b);                                        // DIFF   — light where they DISAGREE

  // WHERE the crossfade sits is what makes this a compositor rather than a crossfader. With no key
  // patched it is the knob, one number for the whole frame. Patch a key and KEY AMT walks the
  // position from the knob's value towards the key's own brightness, pixel by pixel — bright key
  // shows B, dark key shows A — so a shape becomes a matte and a ramp becomes a wipe. AMT at 0
  // ignores a patched key entirely, which is why it is a knob and not the mere presence of a cable.
  float t = clamp(u_mix, 0.0, 1.0);
  if (has_keyIn == 1) t = mix(t, luma(texture(u_keyIn, uv).rgb), clamp(u_key, 0.0, 1.0));

  vec3 v = mix(a, f, t);
  o = vec4(clamp(v, 0.0, 1.0), 1.0);
}`;

const MODE_STEPS = ['mix', 'over', 'add', 'screen', 'mult', 'dark', 'light', 'diff'];

export function create(ctx, services) {
  const { descriptor } = services;
  const meta = new Map(descriptor.params.map((p) => [p.id, p]));
  const values = new Map(descriptor.params.map((p) => [p.id, p.default]));
  let engine = null;

  const mute = ctx.createGain();
  mute.gain.value = 0;
  mute.connect(ctx.destination);

  const nodes = new Map();
  for (const id of CV_PARAMS) {
    const src = ctx.createConstantSource();
    src.offset.value = Number(values.get(id));
    const tap = ctx.createAnalyser();
    tap.fftSize = WINDOW;
    src.connect(tap);
    tap.connect(mute);
    src.start();
    nodes.set(id, { src, tap, buf: new Float32Array(WINDOW) });
  }

  function clampTo(id, v) {
    const m = meta.get(id) || {};
    const lo = m.min != null ? m.min : 0, hi = m.max != null ? m.max : 1;
    return Math.max(lo, Math.min(hi, v));
  }

  function attachEngine(e) { engine = e; for (const [id, v] of values) push(id, v); }
  function push(id, value) { const n = nodes.get(id); if (n) n.src.offset.value = Number(value); }

  function videoPass() { return { glsl: GLSL, inputs: ['aIn', 'bIn', 'keyIn'] }; }
  function videoUniforms() {
    const out = {};
    for (const id of CV_PARAMS) {
      const n = nodes.get(id);
      n.tap.getFloatTimeDomainData(n.buf);
      let s = 0;
      for (let i = 0; i < n.buf.length; i++) s += n.buf[i];
      out[id] = clampTo(id, s / n.buf.length);
    }
    out.mode = Math.max(0, MODE_STEPS.indexOf(String(values.get('mode'))));
    return out;
  }

  function getOutput() { return null; }
  function getInput() { return null; }
  function getParam(id) { const n = nodes.get(id); return n ? n.src.offset : null; }
  function supports() { return true; }
  function setParam(id, value) { values.set(id, value); push(id, value); }
  function dispose() {
    for (const n of nodes.values()) {
      try { n.src.stop(); } catch (_e) { /* already stopped */ }
      try { n.src.disconnect(); n.tap.disconnect(); } catch (_e) { /* gone */ }
    }
    nodes.clear();
    try { mute.disconnect(); } catch (_e) { /* gone */ }
    engine = null;
  }

  return { getOutput, getInput, getParam, setParam, supports, dispose, attachEngine, videoPass, videoUniforms };
}
