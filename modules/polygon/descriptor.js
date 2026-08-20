// descriptor.js — Polygon. A shape with corners, drawn rather than sliced.
//
// WHY THE SET NEEDED THIS. Every image the video modules could make came down one path: Coordinate
// Field produces a smooth continuous field, and Shapes keeps a slice of it. A slice of a smooth
// field is a band, a ring or a blob — warp the space and those bend into swirls, which is why every
// patch ended up looking like every other patch. Nothing in the chain could draw an edge that was
// not a level set of a gradient.
//
// This draws distance to an actual shape. Two sides is a bar, three a triangle, four a square you
// can round into a squircle, six a hexagon, twelve near enough a circle — and the star control pulls
// any of them into spikes. The Coordinate Field still applies underneath, through its image input, so
// a square in a twisted space is a twisted square; it just starts as a square.
//
// luma out. It takes no image: it is a source, like a coordinate field.

'use strict';

const params = [];
const ports = [];

// The CV seam every video module uses: a knob, a control input aimed at it, and no depth — see
// video-maths for why the attenuverters went.
const knack = (id, name, min, max, def) => {
  params.push({ id, name, section: 'shape', curve: 'linear', min, max, default: def, glideMs: 0 });
  ports.push({ id: `${id}Cv`, name, section: 'shape', domain: 'control', dir: 'in', target: id });
};

// THE THREE WORTH AUTOMATING, and the set's convention says not to give every knob a jack. Size is
// the one an envelope belongs on, rotation the one an LFO belongs on, and star is the one that
// changes what the shape IS rather than where it sits.
knack('size', 'Size', 0, 1, 0.35);
knack('rotate', 'Rotate', -1, 1, 0);        // turns, so ±1 is a full revolution either way
knack('star', 'Star', 0, 1, 0);             // 0 is the plain polygon; up pulls the corners into points

// SIDES IS A KNOB AND NOT A LIST. Twelve lamps down a panel to choose a triangle is a lot of ink for
// a number, and a swept CV through the count — triangle to square to pentagon — is a real gesture
// that a stepped switch would refuse. It quantises inside the shader, so between two settings there
// is no half-polygon.
params.push({ id: 'sides', name: 'Sides', section: 'shape', curve: 'linear', min: 2, max: 12, default: 4, step: 1, glideMs: 0 });
ports.push({ id: 'sidesCv', name: 'Sides', section: 'shape', domain: 'control', dir: 'in', target: 'sides' });

// Corner radius, as a fraction of the size. At 1 a square is a circle, which is the honest end of
// that travel rather than an arbitrary stop.
params.push({ id: 'round', name: 'Round', section: 'shape', curve: 'linear', min: 0, max: 1, default: 0, glideMs: 0 });
// OUTLINE AT ZERO IS A FILLED SHAPE, and that is the useful default: an outline is the special case.
params.push({ id: 'outline', name: 'Outline', section: 'shape', curve: 'linear', min: 0, max: 0.5, default: 0, glideMs: 0 });
// Edge softness, in the same units and with the same meaning as the Shapes module's SOFT.
params.push({ id: 'soft', name: 'Soft', section: 'shape', curve: 'linear', min: 0, max: 0.3, default: 0.01, glideMs: 0 });
// Where it sits. Zero is the middle of the frame; ±1 is a frame's width or height away.
params.push({ id: 'posX', name: 'X', section: 'shape', curve: 'linear', min: -1, max: 1, default: 0, glideMs: 0 });
params.push({ id: 'posY', name: 'Y', section: 'shape', curve: 'linear', min: -1, max: 1, default: 0, glideMs: 0 });

ports.push({ id: 'shapeOut', name: 'Shape', section: 'shape', domain: 'luma', dir: 'out' });

export default {
  id: 'polygon',
  apiVersion: 1,
  name: 'Polygon',
  abbreviation: 'Poly',
  worklets: [],
  category: 'video',   // module library grouping
  signalIdentity: ['luma'],
  ports,
  params,
};
