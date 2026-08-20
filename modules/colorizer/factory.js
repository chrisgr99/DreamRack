// factory.js — the Colorizer's realized instance.
//
// The CV seam is the one every video module uses; see coordinate-field for the full account.
//
// NOTE: no backticks anywhere inside the GLSL string. It is a JavaScript template literal, and a
// backtick in a comment closes it.

'use strict';

const WINDOW = 32;
const CV_PARAMS = ['spread', 'shift', 'cycle'];

const GLSL = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform sampler2D u_imageIn; uniform int has_imageIn;
uniform float u_spread, u_shift, u_cycle, u_palette;
out vec4 o;

vec3 hue(float h) {
  // Hue to rgb without a full HSV conversion: three ramps 120 degrees apart, clamped.
  vec3 p = abs(fract(vec3(h) + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return clamp(p - 1.0, 0.0, 1.0);
}

// HEAT — black through dark red, orange and yellow to white. The one that reads as light rather
// than as colour, and the reason it is first: a shape colorized with it still looks lit.
vec3 pHeat(float t) {
  vec3 c = mix(vec3(0.0), vec3(0.55, 0.0, 0.06), smoothstep(0.0, 0.30, t));
  c = mix(c, vec3(1.0, 0.34, 0.0), smoothstep(0.30, 0.58, t));
  c = mix(c, vec3(1.0, 0.86, 0.22), smoothstep(0.58, 0.84, t));
  return mix(c, vec3(1.0), smoothstep(0.84, 1.0, t));
}

// ICE — the same shape of ramp in the other half of the spectrum, so a patch can put two chains
// side by side and have them read as opposites without any further work.
vec3 pIce(float t) {
  vec3 c = mix(vec3(0.0), vec3(0.0, 0.10, 0.45), smoothstep(0.0, 0.30, t));
  c = mix(c, vec3(0.0, 0.62, 0.88), smoothstep(0.30, 0.60, t));
  c = mix(c, vec3(0.55, 0.94, 1.0), smoothstep(0.60, 0.86, t));
  return mix(c, vec3(1.0), smoothstep(0.86, 1.0, t));
}

// SPECTRUM — every hue at full saturation. It wraps exactly, so CYCLE turns it without a seam,
// which makes it the palette to reach for when the colour is meant to move rather than to sit.
vec3 pSpectrum(float t) { return hue(t); }

// DUO — one ramp between two colours, deep blue to warm amber. Two colours is what most images
// want: a picture in six hues is a test card, and a picture in two is a photograph.
vec3 pDuo(float t) { return mix(vec3(0.04, 0.08, 0.32), vec3(1.0, 0.72, 0.25), t); }

// STEPS — the spectrum in six hard bands. Posterising is the one operation that turns a smooth
// gradient into DRAWING: bands are edges, and edges are what a shape module would have had to be
// patched to produce.
vec3 pSteps(float t) { return hue(floor(clamp(t, 0.0, 0.9999) * 6.0) / 6.0); }

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;

  // Nothing patched reads as black, which lands on the palette at whatever CYCLE says — so an
  // unpatched module fills the frame with one colour and turning CYCLE sweeps the palette across
  // it. That is how to see what a palette contains before committing a cable to it.
  float v = has_imageIn == 1 ? texture(u_imageIn, uv).r : 0.0;

  // Spread first, then shift: scaling about black and then sliding is what lets a dim image reach
  // the whole palette. The clamp is before the wrap, so out-of-range brightness parks at the end
  // of the palette rather than reappearing at the other end of it.
  v = clamp(v * u_spread + u_shift, 0.0, 1.0);
  float t = fract(v + u_cycle);

  int p = int(u_palette + 0.5);
  vec3 c;
  if (p == 0) c = pHeat(t);
  else if (p == 1) c = pIce(t);
  else if (p == 2) c = pSpectrum(t);
  else if (p == 3) c = pDuo(t);
  else c = pSteps(t);

  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

const PALETTE_STEPS = ['heat', 'ice', 'spectrum', 'duo', 'steps'];

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
      out[id] = clampTo(id, s / n.buf.length);
    }
    out.palette = Math.max(0, PALETTE_STEPS.indexOf(String(values.get('palette'))));
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
