// factory.js — Symmetry's realized instance.
//
// The CV seam is the one every video module uses; see coordinate-field for the full account.
//
// NOTE: no backticks anywhere inside the GLSL string. It is a JavaScript template literal, and a
// backtick in a comment closes it.

'use strict';

const WINDOW = 32;
const CV_PARAMS = ['sectors', 'rotate', 'spread'];
const PLAIN = ['zoom', 'mode'];
const MODE_STEPS = ['mirror', 'repeat'];

const GLSL = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform sampler2D u_imageIn; uniform int has_imageIn;
uniform float u_sectors, u_rotate, u_spread, u_zoom, u_mode;
out vec4 o;

const float TAU = 6.28318530718;

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

  float r = length(p);
  float a = atan(p.y, p.x) + u_rotate * TAU;
  float n = max(1.0, floor(clamp(u_sectors, 1.0, 16.0) + 0.5));
  float seg = TAU / n;

  float f = mod(a, seg);
  // MIRROR folds the sector back on itself, so the seam between sectors is a reflection and the
  // figure closes. REPEAT leaves the sector as it is, which spins copies round the centre and shows
  // the seam — a different look, and the one that suits a picture with writing or an arrow in it.
  if (int(u_mode + 0.5) == 0) f = abs(f - seg * 0.5);

  // SPREAD keeps the middle of the frame unfolded. Blending the folded angle back towards the
  // original near the centre stops a shape sitting there from being shattered into slivers.
  float hold = smoothstep(0.0, 0.35, r) * clamp(u_spread, 0.0, 1.0);
  float ang = mix(a, f, hold);

  vec2 q = vec2(cos(ang), sin(ang)) * r / max(0.05, u_zoom);
  vec2 src = q / vec2(aspect, 1.0) + 0.5;

  // Outside the frame there is nothing to sample, and stretching the edge pixel across it would draw
  // long smears that read as a fault. Black is the honest answer.
  float inside = step(0.0, src.x) * step(src.x, 1.0) * step(0.0, src.y) * step(src.y, 1.0);
  float v = has_imageIn == 1 ? texture(u_imageIn, clamp(src, 0.0, 1.0)).r * inside : 0.0;
  o = vec4(vec3(clamp(v, 0.0, 1.0)), 1.0);
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
      out[id] = clampTo(id, s / n.buf.length);
    }
    out.zoom = Number(values.get('zoom'));
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
