// factory.js — Chroma's realized instance.
//
// The CV seam is the one every video module uses; see coordinate-field for the full account.
//
// NOTE: no backticks anywhere inside the GLSL string. It is a JavaScript template literal, and a
// backtick in a comment closes it.

'use strict';

const WINDOW = 32;
const CV_PARAMS = ['hue', 'sat', 'level', 'contrast'];

const GLSL = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform sampler2D u_imageIn; uniform int has_imageIn;
uniform float u_hue, u_sat, u_level, u_contrast;
out vec4 o;

// The standard branchless conversions. They cost a handful of instructions and keep the module
// honest: rotating a hue by mixing the three channels arithmetically is not the same operation and
// does not survive a saturated colour.
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Broadcast luminance weights. SAT is done against this rather than by zeroing HSV's saturation,
// which was the first version and was wrong in a way only a measurement caught: HSV value is the
// LARGEST channel, so draining a saturated cyan gave WHITE — full value, no colour — and every
// bright colour in the frame collapsed to the same paper. Against luminance a cyan drains to a
// light grey and a deep blue to a dark one, so turning SAT down leaves the picture standing and
// only takes the colour out of it, which is what the knob claims to do.
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;

  // Nothing patched is black, and every operation below leaves black alone — so an unpatched
  // module is a dark frame rather than a coloured one, and a cable can be found by plugging it in
  // rather than by first understanding the settings.
  vec3 c = has_imageIn == 1 ? texture(u_imageIn, uv).rgb : vec3(0.0);

  // HUE in HSV, because rotating a hue is the one operation the three channels cannot express
  // between them. Only the hue is taken from the round trip; saturation and level are done below
  // on the rgb it returns.
  vec3 h = rgb2hsv(c);
  h.x = fract(h.x + u_hue);                          // wraps, so a ramp cycles
  c = hsv2rgb(h);

  // SAT against luminance: 0 is the picture in grey, 1 is untouched, and past 1 it exaggerates
  // colour by pushing away from grey rather than by clipping a channel.
  c = mix(vec3(luma(c)), c, u_sat);
  c = c * u_level;

  // Contrast last, about mid grey, on the three channels together. Doing it in HSV on the value
  // alone would leave saturated colours untouched at exactly the settings where the picture most
  // needs pulling apart.
  c = (c - 0.5) * u_contrast + 0.5;

  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

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

  function videoPass() { return { glsl: GLSL, inputs: ['imageIn'] }; }
  function videoUniforms() {
    const out = {};
    for (const id of CV_PARAMS) {
      const n = nodes.get(id);
      n.tap.getFloatTimeDomainData(n.buf);
      let s = 0;
      for (let i = 0; i < n.buf.length; i++) s += n.buf[i];
      // HUE is the one parameter here that must NOT clamp: it wraps in the shader, so a CV that
      // runs past the top of the knob's range should keep turning the colour rather than stopping
      // at red. Everything else is clamped to its declared range as usual.
      out[id] = id === 'hue' ? (s / n.buf.length) : clampTo(id, s / n.buf.length);
    }
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
