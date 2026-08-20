// descriptor.js — Symmetry. A kaleidoscope: one sector, repeated round the frame.
//
// The structure a swirling field cannot produce on its own. Folding the coordinate space into N
// sectors and reflecting within each one turns any picture into a figure with a centre — a mandala,
// a snowflake, a rosette — because the eye reads repetition about a point as an object rather than
// as a texture.
//
// DISTINCT FROM MIRROR ON THE COORDINATE FIELD, which reflects about an axis: two-fold symmetry
// reads as a reflection of a scene, and six- or twelve-fold reads as a thing in its own right.
//
// ROTATE turns what is folded rather than what is drawn, so sweeping it walks new parts of the input
// into the sector and the figure changes shape rather than merely spinning. That is the control to
// put an LFO on, and it is the reason this is not just a mirror with a count.
//
// luma in, luma out.

'use strict';

const params = [];
const ports = [];

const knack = (id, name, min, max, def) => {
  params.push({ id, name, section: 'fold', curve: 'linear', min, max, default: def, glideMs: 0 });
  ports.push({ id: `${id}Cv`, name, section: 'fold', domain: 'control', dir: 'in', target: id });
};

// Two is a mirror; six and twelve are where it starts to read as a figure. It quantises in the
// shader, so a swept CV steps cleanly from one count to the next.
knack('sectors', 'Sectors', 1, 16, 6);
knack('rotate', 'Rotate', -1, 1, 0);
// How far out from the centre the fold reaches. Below 1 the middle of the frame is left alone, which
// keeps a shape at the centre whole instead of shattering it.
knack('spread', 'Spread', 0, 1, 1);

params.push({ id: 'mode', name: 'Mode', section: 'fold', curve: 'stepped', default: 'mirror',
  steps: [{ value: 'mirror' }, { value: 'repeat' }] });
// A zoom on the folded space: bringing more or less of the input into each sector.
params.push({ id: 'zoom', name: 'Zoom', section: 'fold', curve: 'linear', min: 0.25, max: 4, default: 1, glideMs: 0 });

ports.push({ id: 'imageIn', name: 'Image', section: 'fold', domain: 'luma', dir: 'in' });
ports.push({ id: 'imageOut', name: 'Out', section: 'fold', domain: 'luma', dir: 'out' });

export default {
  id: 'symmetry',
  apiVersion: 1,
  name: 'Symmetry',
  abbreviation: 'Sym',
  worklets: [],
  category: 'video',   // module library grouping
  signalIdentity: ['luma'],
  ports,
  params,
};
