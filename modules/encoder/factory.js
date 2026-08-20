// factory.js — the Encoder's realized instance.
//
// The CV seam is the one every video module uses; see coordinate-field for the full account. The
// shader is the shortest in the set — three samples, three gains, one output — and that is the
// point: everything interesting happened in the three chains before it.
//
// NOTE: no backticks anywhere inside the GLSL string. It is a JavaScript template literal, and a
// backtick in a comment closes it.

'use strict';

const WINDOW = 32;
const CV_PARAMS = ['gainR', 'gainG', 'gainB'];

const GLSL = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform sampler2D u_rIn; uniform int has_rIn;
uniform sampler2D u_gIn; uniform int has_gIn;
uniform sampler2D u_bIn; uniform int has_bIn;
uniform float u_gainR, u_gainG, u_gainB;
out vec4 o;

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;

  // AN UNPATCHED CHANNEL IS BLACK, and here that is the only honest reading: black is what a
  // colour channel with nothing in it contains. So one cable into RED gives a red picture, which
  // is both what you would expect and a useful way to check a chain on its own.
  float r = has_rIn == 1 ? texture(u_rIn, uv).r : 0.0;
  float g = has_gIn == 1 ? texture(u_gIn, uv).r : 0.0;
  float b = has_bIn == 1 ? texture(u_bIn, uv).r : 0.0;

  vec3 c = vec3(r * u_gainR, g * u_gainG, b * u_gainB);
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

  function videoPass() { return { glsl: GLSL, inputs: ['rIn', 'gIn', 'bIn'] }; }
  function videoUniforms() {
    const out = {};
    for (const id of CV_PARAMS) {
      const n = nodes.get(id);
      n.tap.getFloatTimeDomainData(n.buf);
      let s = 0;
      for (let i = 0; i < n.buf.length; i++) s += n.buf[i];
      out[id] = clampTo(id, s / n.buf.length);
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
