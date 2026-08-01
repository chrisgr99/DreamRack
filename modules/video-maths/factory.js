// factory.js — Video Maths' realized instance.
//
// The CV seam is the one every video module uses; see coordinate-field for the full account.
// The shader is six operations and a mix, and it is deliberately the shortest in the set: the
// value is in what it lets you PATCH, not in what it computes.
//
// NOTE FOR THE NEXT SHADER: no backticks anywhere inside the GLSL string. It is a JavaScript
// template literal, and a backtick in a comment closes it — which has now cost two rounds.

'use strict';

const WINDOW = 32;
const CV_PARAMS = ['gainA', 'gainB', 'amount'];

const GLSL = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform sampler2D u_aIn; uniform int has_aIn;
uniform sampler2D u_bIn; uniform int has_bIn;
uniform float u_gainA, u_gainB, u_amount, u_op;
out vec4 o;

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;

  // An UNPATCHED input reads as BLACK for A and WHITE for B, and the asymmetry is deliberate.
  // Black is the identity for add, and white is the identity for multiply and min — so with one
  // cable in either socket the module passes that image through unchanged whichever operation is
  // selected, instead of annihilating it. You can patch A first and hear nothing break.
  float a = has_aIn == 1 ? texture(u_aIn, uv).r : 0.0;
  float b = has_bIn == 1 ? texture(u_bIn, uv).r : 1.0;
  a *= u_gainA;
  b *= u_gainB;

  int op = int(u_op + 0.5);
  float v;
  if (op == 0) v = a * b;                    // MULT — light only where BOTH are light: lattices
  else if (op == 1) v = abs(a - b);          // DIFF — light where they DISAGREE: moire, edges
  else if (op == 2) v = a + b;               // ADD — brightest, and the one that clips
  else if (op == 3) v = min(a, b);           // MIN — the darker of the two, a soft intersection
  else if (op == 4) v = max(a, b);           // MAX — the brighter, a soft union
  else v = (a + b) * 0.5;                    // MEAN — add without the clipping

  // Against A rather than against black, so AMOUNT at 0 is a wire carrying A and turning it up
  // brings the operation in. Clamped last: every operation above can leave the range, and a
  // value over one would be a silent brightness the next module could not see or correct.
  v = mix(a, v, clamp(u_amount, 0.0, 1.0));
  o = vec4(vec3(clamp(v, 0.0, 1.0)), 1.0);
}`;

const OP_STEPS = ['mult', 'diff', 'add', 'min', 'max', 'mean'];

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

  function videoPass() { return { glsl: GLSL, inputs: ['aIn', 'bIn'] }; }
  function videoUniforms() {
    const out = {};
    for (const id of CV_PARAMS) {
      const n = nodes.get(id);
      n.tap.getFloatTimeDomainData(n.buf);
      let s = 0;
      for (let i = 0; i < n.buf.length; i++) s += n.buf[i];
      out[id] = clampTo(id, s / n.buf.length);
    }
    out.op = Math.max(0, OP_STEPS.indexOf(String(values.get('op'))));
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
