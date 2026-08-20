// factory.js — Grid's realized instance.
//
// The CV seam is the one every video module uses; see coordinate-field for the full account.
//
// NOTE: no backticks anywhere inside the GLSL string. It is a JavaScript template literal, and a
// backtick in a comment closes it.

'use strict';

const WINDOW = 32;
const CV_PARAMS = ['cols', 'rows', 'brick'];
const PLAIN = ['gap', 'vary'];

const GLSL = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform sampler2D u_imageIn; uniform int has_imageIn;
uniform float u_cols, u_rows, u_brick, u_gap, u_vary;
out vec4 o;

// An ordered value per cell, from its own coordinates. Not random per frame: a grid whose cells
// flicker is a fault. The same cell gets the same number for as long as it is that cell.
float cellValue(vec2 idx) {
  return fract(sin(dot(idx + 0.5, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float cols = max(1.0, floor(u_cols + 0.5));
  float rows = max(1.0, floor(u_rows + 0.5));

  vec2 t = uv * vec2(cols, rows);
  float row = floor(t.y);
  // BRICK offsets alternate rows only. Offsetting every row would slide the whole picture sideways,
  // which is a pan and not a bond.
  t.x += mod(row, 2.0) * u_brick;
  vec2 idx = floor(t);
  vec2 cell = fract(t);

  // The gap is taken off every side of the cell, so what is left is the picture drawn smaller with
  // black around it rather than the picture cropped.
  float g = clamp(u_gap, 0.0, 0.45);
  vec2 inner = (cell - g) / max(0.0001, 1.0 - 2.0 * g);
  float onCell = step(0.0, inner.x) * step(inner.x, 1.0) * step(0.0, inner.y) * step(inner.y, 1.0);

  float v = has_imageIn == 1 ? texture(u_imageIn, clamp(inner, 0.0, 1.0)).r : 0.0;
  // With nothing patched a grid of nothing is nothing, so the cell itself is drawn: the module shows
  // what its rows, columns, gap and brick are doing before there is an image to put in them.
  if (has_imageIn == 0) v = 1.0;

  v *= mix(1.0, 0.35 + 0.65 * cellValue(idx), clamp(u_vary, 0.0, 1.0));
  o = vec4(vec3(clamp(v * onCell, 0.0, 1.0)), 1.0);
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
    for (const id of PLAIN) out[id] = Number(values.get(id));
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
