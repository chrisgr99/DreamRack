// factory.js — Time's realized instance.
//
// The CV seam is the same one every video module uses: a ConstantSourceNode per parameter whose
// offset IS that parameter, read once per frame through an analyser. See coordinate-field for
// the full account of why.
//
// What is new here is one word in videoPass: `history: true`. That makes the engine keep a ring
// of this module's INPUT — thirty-two frames, in a 2D texture array — and hand the whole ring to
// the shader. Everything below is what you can do once you have that.

'use strict';

const WINDOW = 32;
const CV_PARAMS = ['depth', 'spread', 'mix'];

// The ring's length. The engine owns the number; this copy exists so the shader can be written
// against it, and the two are checked against each other by the module failing visibly if they
// ever disagree — a delay that reads the wrong layer looks wrong immediately.
const HIST_LEN = 32;

const GLSL = `#version 300 es
precision highp float;
// A sampler2DArray gets NO default precision in GLSL ES 3.00. The float line above covers floats
// and sampler2D and nothing else, so without this one the shader fails to compile with
// "No precision specified". Every history module will need it.
// (No backticks in here: this whole shader is a JS template literal.)
precision highp sampler2DArray;
uniform vec2 uRes; uniform float uTime;
uniform sampler2D u_imageIn; uniform int has_imageIn;
uniform sampler2DArray u_history; uniform float u_histLen; uniform float u_histHead;
uniform float u_depth, u_spread, u_mix, u_mode, u_axis;
out vec4 o;

// Layer back frames before the current head, wrapped. The ring is written newest-first, so
// going back in time means going DOWN from the head and round.
vec3 past(vec2 uv, float back) {
  float layer = mod(u_histHead - back + u_histLen * 2.0, u_histLen);
  return texture(u_history, vec3(uv, layer)).rgb;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 live = has_imageIn == 1 ? texture(u_imageIn, uv).rgb : vec3(0.0);
  float maxBack = u_histLen - 1.0;
  int mode = int(u_mode + 0.5);
  vec3 c;

  if (mode == 0) {
    // DELAY — one frame, from u_depth of the way back.
    c = past(uv, floor(u_depth * maxBack));

  } else if (mode == 1) {
    // TRAILS — every frame in the window, weighted so the past fades. SPREAD is the decay: at 0
    // only the newest frame survives and the module is a wire, at 1 the whole window contributes
    // almost equally and movement smears the full half second.
    //
    // Summed with normalising weights rather than fed back into itself: a feedback buffer loses
    // the individual frames, so its trail cannot be re-shaped once written. Here SPREAD can be
    // swept under CV and the smear changes length as you move it, which feedback cannot do.
    float span = max(1.0, floor(u_depth * maxBack));
    float k = mix(12.0, 0.6, clamp(u_spread, 0.0, 1.0));   // decay rate: steep to gentle
    float wsum = 0.0;
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 32; i++) {
      float fi = float(i);
      if (fi > span) break;
      float w = exp(-k * fi / max(1.0, span));
      acc += past(uv, fi) * w;
      wsum += w;
    }
    c = acc / max(0.0001, wsum);

  } else {
    // SLIT — the depth read varies ACROSS THE FRAME, so each line comes from a different moment.
    // This is the one that needs a real ring: a per-pixel layer index is exactly what a texture
    // array allows and a set of separate samplers does not.
    //
    // SPREAD is how much of the window the frame covers: at 0 every line is the same instant and
    // the picture is live, at 1 the top line is now and the bottom is the far end of the ring.
    float along = u_axis > 0.5 ? uv.x : 1.0 - uv.y;
    float back = floor(along * u_spread * u_depth * maxBack);
    c = past(uv, back);
  }

  // MIX against the live image, so any of the three can be dialled in rather than switched to.
  o = vec4(mix(live, c, clamp(u_mix, 0.0, 1.0)), 1.0);
}`;

const MODE_STEPS = ['delay', 'trails', 'slit'];
const AXIS_STEPS = ['y', 'x'];

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

  // `history: true` is the whole difference between this module and every other one.
  function videoPass() { return { glsl: GLSL, inputs: ['imageIn'], history: true }; }
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
    out.axis = Math.max(0, AXIS_STEPS.indexOf(String(values.get('axis'))));
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
