// factory.js — Coordinate Field's realized instance.
//
// There is no audio graph here in any meaningful sense. What little exists is the CV SEAM, and
// it is the same one Video Output uses — generalised, because this module has ten CV-able
// parameters where that one had a single BRIGHT.
//
// THE PROBLEM. The patchbay's only mechanism for "a cable modulates this parameter" is to
// connect a node to an AudioParam. A video parameter is not one — it is a number written into a
// shader uniform once per frame — so without this every knАck here would refuse every cable.
//
// THE SEAM. One ConstantSourceNode per parameter, whose `offset` IS that parameter. The knob
// writes offset; the patchbay connects the CV through the depth gain it already owns; Web Audio
// sums them. An AnalyserNode on each output reads the sum once per frame. With nothing patched
// the analyser reads exactly the knob's own offset, so there is no special case.
//
// THE RATE RULE, made structural. The engine is handed a SAMPLER, not a connection: a 48 kHz
// control signal is read at 60 Hz and cannot pretend to be video-rate. Rack CV supplies
// PARAMETERS; video-rate signal is generated per pixel inside the shader and never leaves the
// GPU. Getting this backwards produces a slideshow, so the code is shaped to make it hard.
//
// Contract notes:
//   getOutput -> null    the field is a LOGICAL video edge the engine reads, not an audio node
//   getInput  -> null    likewise the image in
//   getParam  -> the AudioParam for a CV-able parameter, else null

'use strict';

// The analyser's window. 32 is the smallest Web Audio allows; at 48 kHz that is two thirds of a
// millisecond, so averaging it is effectively an instantaneous read while still shrugging off
// ripple from an audio-rate source someone insists on patching in.
const WINDOW = 32;

// The parameters that carry a knАck, and so need a node of their own. Everything else here is a
// switch, which the engine reads straight from `values`.

// THE SHADER. The module's whole visible behaviour, and the only thing it hands the engine
// besides numbers. Read it in the order the panel is laid out: place, warp, then read.
//
// Uniform naming is the contract: `u_<paramId>` for a value, `u_<portId>` for an input sampler
// and `has_<portId>` for whether anything is patched into it. The engine binds them by name, so
// adding a parameter here means adding it to the descriptor and nothing else.
const GLSL = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTime;
uniform sampler2D u_imageIn; uniform int has_imageIn;
uniform float u_offsetX, u_offsetY, u_rotate, u_scale;
uniform float u_polar, u_twist, u_tile, u_quantise;
uniform float u_scroll, u_phase, u_mirror, u_field, u_invert;
out vec4 o;

const float TAU = 6.28318530718;

void main() {
  // Start centred, and square: without the aspect correction a radial field is an ellipse on a
  // 16:9 frame, and every rotation shears.
  vec2 p = (gl_FragCoord.xy / uRes - 0.5) * vec2(uRes.x / uRes.y, 1.0);

  // ---- PLACE. Translate FIRST, so X and Y also decide what ROTATE and SCALE turn about; that
  // is what makes a separate centre control unnecessary rather than merely missing.
  p -= vec2(u_offsetX, u_offsetY);
  float a = u_rotate * TAU;
  p = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;
  p /= max(0.05, u_scale);

  // ---- WARP.
  // MIRROR folds the space: an absolute value on an axis makes the two halves reflections.
  int mir = int(u_mirror + 0.5);
  if (mir == 1 || mir == 3) p.x = abs(p.x);
  if (mir == 2 || mir == 3) p.y = abs(p.y);

  // TWIST rotates by an amount proportional to radius, which is what turns straight bars into
  // a spiral. Applied before POLAR so it bends the space rather than the readout.
  float r = length(p);
  float tw = u_twist * r * TAU;
  p = mat2(cos(tw), -sin(tw), sin(tw), cos(tw)) * p;

  // POLAR is a MORPH, not a switch: at 0 the space is cartesian, at 1 the x axis is angle and
  // the y axis is radius, and between them it is genuinely part-way — which is why it can be
  // swept under CV and a switch could not.
  vec2 pol = vec2(atan(p.y, p.x) / TAU, length(p));
  p = mix(p, pol, clamp(u_polar, 0.0, 1.0));

  // TILE repeats the space. fract() after scaling gives hard repeats; the -0.5 keeps each tile
  // centred on its own origin so radial fields tile as discs rather than quarter-circles.
  float tiles = max(1.0, u_tile);
  if (tiles > 1.0) p = fract(p * tiles) - 0.5;

  // ---- READ. One value out of the space, in 0..1.
  int f = int(u_field + 0.5);
  float v;
  if (f == 0) v = p.x + 0.5;                       // X
  else if (f == 1) v = p.y + 0.5;                  // Y
  else if (f == 2) v = (p.x + p.y) * 0.5 + 0.5;    // DIAG
  else if (f == 3) v = length(p);                  // RADIUS
  else v = atan(p.y, p.x) / TAU + 0.5;             // ANGLE

  // SCROLL drifts the readout, PHASE offsets it. Both wrap, so a gradient becomes a repeating
  // ramp rather than clipping at the ends.
  v = fract(v + u_phase + uTime * u_scroll);

  // QUANTISE posterises into bands. 0 leaves it smooth.
  float q = floor(u_quantise + 0.5);
  if (q >= 1.0) v = floor(v * q) / max(1.0, q - 1.0);

  // INVERT, applied to the READOUT and not to the resampled image: inverting a picture is the
  // maths module's job, and doing it here too would be the same operation in two places.
  if (u_invert > 0.5) v = 1.0 - v;

  // With an image patched in, the space RESAMPLES it instead: the same coordinates, used to
  // look up rather than to read out. That is the module's second half, and it is one line.
  vec3 c = vec3(clamp(v, 0.0, 1.0));
  if (has_imageIn == 1) c = texture(u_imageIn, clamp(p + 0.5, 0.0, 1.0)).rgb;
  o = vec4(c, 1.0);
}`;

// The switches reach the shader as numbers, since a uniform cannot be a string. The order here
// IS the descriptor's step order, and the two must not drift.
const MIRROR_STEPS = ['off', 'x', 'y', 'both'];
const FIELD_STEPS = ['x', 'y', 'diag', 'radius', 'angle'];

const CV_PARAMS = ['offsetX', 'offsetY', 'rotate', 'scale',
  'polar', 'twist', 'tile', 'quantise', 'scroll', 'phase'];

export function create(ctx, services) {
  const { descriptor } = services;
  const meta = new Map(descriptor.params.map((p) => [p.id, p]));
  const values = new Map(descriptor.params.map((p) => [p.id, p.default]));
  let engine = null;

  // One silent gain to the destination for the whole module, not one per parameter: an
  // AnalyserNode is only guaranteed to be pulled if its chain reaches the destination, and ten
  // separate paths would be ten times the bookkeeping for the same nothing.
  const mute = ctx.createGain();
  mute.gain.value = 0;
  mute.connect(ctx.destination);

  const nodes = new Map();          // id -> { src, tap, buf }
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

  // Called by the rack once the (lazily created) engine exists. Everything set so far is
  // replayed, so a restored patch's settings survive whichever order the two arrive in.
  function attachEngine(e) {
    engine = e;
    for (const [id, v] of values) push(id, v);
    // No addParamSource here: this module's per-frame values go out through videoUniforms, which
    // the engine calls while drawing this node. One path, and it cannot disagree with itself.
  }

  function push(id, value) {
    const n = nodes.get(id);
    if (n) { n.src.offset.value = Number(value); return; }   // sampled per frame, not pushed
    // The switches are read from `values` by the sampler above, so there is nothing to push.
  }

  // The video contract: shader source plus the names of the input ports the engine should bind,
  // and a per-frame block of uniform values. The engine owns all the GL; this owns the picture.
  function videoPass() { return { glsl: GLSL, inputs: ['imageIn'] }; }
  function videoUniforms() {
    const out = {};
    for (const id of CV_PARAMS) {
      const n = nodes.get(id);
      n.tap.getFloatTimeDomainData(n.buf);
      let sum = 0;
      for (let i = 0; i < n.buf.length; i++) sum += n.buf[i];
      out[id] = clampTo(id, sum / n.buf.length);
    }
    out.invert = String(values.get('invert')) === 'on' ? 1 : 0;
    out.mirror = Math.max(0, MIRROR_STEPS.indexOf(String(values.get('mirror'))));
    out.field = Math.max(0, FIELD_STEPS.indexOf(String(values.get('field'))));
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
