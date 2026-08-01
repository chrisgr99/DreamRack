// factory.js — Shapes' realized instance.
//
// The CV seam is the one every video module uses; see coordinate-field for the full account.
// The shader is the shortest in the set, which is the point: a window comparator, and all the
// variety comes from what is patched into it.

'use strict';

const WINDOW = 32;
const CV_PARAMS = ['centre', 'width', 'soft'];

const GLSL = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform sampler2D u_fieldIn; uniform int has_fieldIn;
uniform float u_centre, u_width, u_soft, u_mode, u_invert;
out vec4 o;

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  // With nothing patched the module shows its window against a plain horizontal ramp, so the
  // controls can be learned before it is wired into anything. An unpatched module that shows
  // black teaches nothing about what its knobs do.
  float v = has_fieldIn == 1 ? texture(u_fieldIn, uv).r : uv.x;

  // The softness is a distance in the FIELD'S OWN UNITS, so the edge looks the same whatever is
  // feeding it — a ring's edge and a bar's edge blur by the same amount for the same knob.
  float e = max(0.0005, u_soft);
  float s;
  int mode = int(u_mode + 0.5);
  if (mode == 0) {
    // WINDOW: keep the band of values within half a width either side of centre. Widen it far
    // enough and a ring fills in to a disc — one control, both shapes.
    float d = abs(v - u_centre);
    float edge = u_width * 0.5;          // not half: a reserved word in GLSL, and the compiler
    s = 1.0 - smoothstep(edge, edge + e, d);   // says so only once the shader is built
  } else if (mode == 1) {
    s = smoothstep(u_centre - e, u_centre + e, v);          // ABOVE
  } else {
    s = 1.0 - smoothstep(u_centre - e, u_centre + e, v);    // BELOW
  }

  if (u_invert > 0.5) s = 1.0 - s;
  o = vec4(vec3(clamp(s, 0.0, 1.0)), 1.0);
}`;

const MODE_STEPS = ['window', 'above', 'below'];

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

  function videoPass() { return { glsl: GLSL, inputs: ['fieldIn'] }; }
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
    out.invert = String(values.get('invert')) === 'on' ? 1 : 0;
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
