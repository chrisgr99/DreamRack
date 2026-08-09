// descriptor.js — Coordinate Field. The workhorse of the video set.
//
// It owns a coordinate space and does both halves of one job: it MOVES that space (PLACE and
// WARP) and it READS a value out of it (FIELD). With nothing patched it emits the field itself
// as brightness; with an image patched in, the same moved space resamples that image. One
// mechanism, two uses, which is why warping and generating are not two modules.
//
// EVERY CONTINUOUS CONTROL IS A knАck. Ten parameters that all deserve CV would otherwise mean
// ten more jacks and a panel twice the width; folding the jack into the knob is what keeps this
// at 16 HP. Each one therefore declares the same trio the mixer's pan knАcks do: the value, a
// depth, and a control-domain port whose `target` is the value and whose `via` is the depth.
//
// The two stepped controls are switches. MIRROR and FIELD choose between KINDS, not degrees;
// neither means anything swept, and neither takes CV.

'use strict';

const params = [];
const ports = [];

// A knАck: value, depth, and the CV port that lands on it. Ranges are the shader's own units —
// offsets in fractions of the frame, rotation in turns — so that a full-scale CV means something
// legible rather than something arbitrary.
// NO DEPTH PARAM. Every CV input here used to carry an attenuverter that came free with this
// helper rather than because anyone asked for one. They all defaulted to unity, so they never
// did anything; and once the knAck lost its attenuverter there was no way to set them either.
// The CV lands on its target at full strength. Where one genuinely needs taming, that is an
// insert's job — see design/inserts.md.
const knack = (id, name, min, max, def) => {
  params.push({ id, name, section: 'field', curve: 'linear', min, max, default: def, glideMs: 0 });
  ports.push({ id: `${id}Cv`, name, section: 'field', domain: 'control', dir: 'in',
    target: id });
};

// ---- PLACE — the space moved. Translate first, then rotate and scale about the origin, so X
// and Y also decide what ROTATE and SCALE pivot about: no separate centre control is needed.
knack('offsetX', 'X', -1, 1, 0);          // ±1 frame width
knack('offsetY', 'Y', -1, 1, 0);
knack('rotate', 'Rotate', -1, 1, 0);      // turns, so ±1 is a full revolution either way
knack('scale', 'Scale', 0.05, 8, 1);      // zoom; 1 is the frame as it is

// ---- WARP — the space bent.
knack('polar', 'Polar', 0, 1, 0);         // a MORPH, not a switch: cartesian at 0, polar at 1,
                                          // and everything between, so it can be swept under CV
knack('twist', 'Twist', -2, 2, 0);        // rotation proportional to radius
knack('tile', 'Tile', 1, 16, 1);          // repeats across the frame
knack('quantise', 'Quantise', 0, 32, 0);  // 0 = smooth; otherwise the field posterises to bands

// ---- FIELD — what is read out of the space.
knack('scroll', 'Scroll', -4, 4, 0);      // readout drift, in frames per second
knack('phase', 'Phase', 0, 1, 0);         // a fixed offset on the same readout

// INVERT flips the field: what was black is white. One lamp, and while there is no Video maths
// module it is the only way to get a field's opposite at all.
params.push({ id: 'invert', name: 'Invert', section: 'field', curve: 'stepped',
  steps: [{ value: 'off' }, { value: 'on' }], default: 'off' });

params.push({ id: 'mirror', name: 'Mirror', section: 'field', curve: 'stepped',
  steps: [{ value: 'off' }, { value: 'x' }, { value: 'y' }, { value: 'both' }], default: 'off' });

params.push({ id: 'field', name: 'Field', section: 'field', curve: 'stepped',
  steps: [{ value: 'x' }, { value: 'y' }, { value: 'diag' }, { value: 'radius' }, { value: 'angle' }],
  default: 'x' });

// The image in is OPTIONAL and it is what switches the module's mode: unpatched it generates,
// patched it warps. luma in and luma out — the whole first set is monochrome, and phase 0
// measured a luma pass at about half the cost of an rgb one, so a mono chain runs twice as deep.
ports.push({ id: 'imageIn', name: 'Image', section: 'field', domain: 'luma', dir: 'in' });
ports.push({ id: 'fieldOut', name: 'Field', section: 'field', domain: 'luma', dir: 'out' });

export default {
  id: 'coordinate-field',
  apiVersion: 1,
  name: 'Coordinate Field',
  category: 'video',   // module library grouping
  abbreviation: 'CF',
  worklets: [],
  signalIdentity: ['luma'],
  ports,
  params,
};
