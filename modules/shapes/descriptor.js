// descriptor.js — Shapes. Where a gradient becomes an object.
//
// ONE COMPARATOR, EVERY SHAPE. The module does not know what a disc is. It takes a field and
// keeps the part of it whose VALUE falls inside a window — and which shape that produces is
// decided entirely by which field you feed it:
//
//   RADIUS in  →  a disc, or a ring once the window narrows
//   X or Y in  →  a bar
//   ANGLE in   →  a wedge
//   DIAG in    →  a diagonal band
//
// and the Coordinate Field's own MIRROR, TILE and POLAR then multiply that by everything they
// do. Five shapes and their kaleidoscopes out of three knobs, because the variety lives in the
// patching rather than in a list of shapes on a switch.
//
// This is also why the module has no size or position of its own: SCALE and X and Y upstream
// already move the field, and a second set of them here would be two controls for one thing.

'use strict';

const params = [];
const ports = [];

// NO DEPTH PARAM. Every CV input here used to carry an attenuverter that came free with this
// helper rather than because anyone asked for one. They all defaulted to unity, so they never
// did anything; and once the knAck lost its attenuverter there was no way to set them either.
// The CV lands on its target at full strength. Where one genuinely needs taming, that is an
// insert's job — see design/inserts.md.
const knack = (id, name, min, max, def) => {
  params.push({ id, name, section: 'shape', curve: 'linear', min, max, default: def, glideMs: 0 });
  ports.push({ id: `${id}Cv`, name, section: 'shape', domain: 'control', dir: 'in',
    target: id });
};

// Where in the field's range the window sits. On a radius field this is the ring's radius; on an
// angle field it is which way the wedge points. The most worth automating of the three.
knack('centre', 'Centre', 0, 1, 0.5);
// How wide the window is. Wide enough and a ring fills in to a disc — the same control gives
// both, which is why there is no shape switch.
knack('width', 'Width', 0, 1, 0.25);
// The edge. Zero is a hard cut; open it up and the shape becomes a soft blob, which is what you
// want when it is going to be multiplied against something else rather than looked at.
knack('soft', 'Soft', 0, 0.5, 0.02);

// What to keep. WINDOW is the shape-maker; ABOVE and BELOW are half-planes, and they are what
// you use when the shape is a mask for something downstream rather than the picture itself.
params.push({ id: 'mode', name: 'Mode', section: 'shape', curve: 'stepped', default: 'window',
  steps: [{ value: 'window' }, { value: 'above' }, { value: 'below' }] });

params.push({ id: 'invert', name: 'Invert', section: 'shape', curve: 'stepped',
  steps: [{ value: 'off' }, { value: 'on' }], default: 'off' });

ports.push({ id: 'fieldIn', name: 'Field', section: 'shape', domain: 'luma', dir: 'in' });
ports.push({ id: 'shapeOut', name: 'Shape', section: 'shape', domain: 'luma', dir: 'out' });

export default {
  id: 'shapes',
  apiVersion: 1,
  name: 'Shapes',
  category: 'video',   // module library grouping
  abbreviation: 'Shp',
  worklets: [],
  signalIdentity: ['luma'],
  ports,
  params,
};
