// factory.js — Polygon's realized instance.
//
// The CV seam is the one every video module uses; see coordinate-field for the full account.
//
// NOTE: no backticks anywhere inside the GLSL string. It is a JavaScript template literal, and a
// backtick in a comment closes it.

'use strict';

const WINDOW = 32;
const CV_PARAMS = ['size', 'rotate', 'star', 'sides'];
const PLAIN = ['round', 'outline', 'soft', 'posX', 'posY'];

const GLSL = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float u_size, u_rotate, u_star, u_sides, u_round, u_outline, u_soft, u_posX, u_posY;
out vec4 o;

const float TAU = 6.28318530718;

void main() {
  // SQUARE UNITS, NOT PIXELS. Working in the frame's own 0..1 would make a square come out as a
  // rectangle on a 16:9 output, so x is scaled by the aspect and every distance below is in units of
  // frame HEIGHT. A size of 0.5 is therefore half the height, whatever shape the frame is.
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0) - vec2(u_posX, u_posY);

  float rot = u_rotate * TAU;
  float c = cos(rot), s = sin(rot);
  p = mat2(c, -s, s, c) * p;

  float r = length(p);
  // A QUARTER TURN OFF, so a triangle points UP with a flat edge beneath it. The maths puts an edge
  // on the +x axis and therefore a vertex at the left, which is correct and looks like a mistake:
  // every drawn triangle anyone has seen points up.
  float a = atan(p.y, p.x) + 1.57079632679;
  float n = floor(clamp(u_sides, 2.0, 12.0) + 0.5);

  float d;
  if (n < 2.5) {
    // Two sides is a BAR — a polygon with two sides has no area, so the honest reading of "2" is the
    // shape you get as the count falls: a straight band across the frame.
    d = abs(p.y) / max(0.0005, u_size);
  } else {
    float seg = TAU / n;
    float corner = floor(0.5 + a / seg) * seg - a;
    // SIZE IS THE DISTANCE TO A CORNER, not to an edge. Measured to the edge, a triangle of "size
    // 0.4" puts its corners 0.8 out and runs off the frame while a square of the same size fits —
    // so the knob would mean something different for every side count, which is not a knob.
    float poly = cos(seg * 0.5) / max(0.15, cos(corner));
    // STAR pulls the EDGE MIDPOINTS in towards the centre and leaves the corners where they are,
    // which is what makes a point. At 0 it is exactly the polygon above.
    float t = abs(corner) / (seg * 0.5);            // 0 at the middle of an edge, 1 at a corner
    float star = mix(poly, 0.28 + 0.72 * t, clamp(u_star, 0.0, 1.0));
    d = r / max(0.0005, u_size * star);
  }

  // ROUNDING blends the polygon's own distance towards a circle's. At 1 a square IS a circle, which
  // is the honest end of that travel rather than an arbitrary stop.
  float sdf = (mix(d, r / max(0.0005, u_size), clamp(u_round, 0.0, 1.0)) - 1.0) * u_size;

  // OUTLINE is the same distance folded about zero: what was inside becomes a band along the edge.
  float e = max(u_soft, 0.0015);
  float v = (u_outline > 0.0005)
    ? smoothstep(e, -e, abs(sdf) - u_outline)
    : smoothstep(e, -e, sdf);

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

  function videoPass() { return { glsl: GLSL, inputs: [] }; }
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
