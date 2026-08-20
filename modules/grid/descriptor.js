// descriptor.js — Grid. One picture becomes a screen of cells.
//
// DISTINCT FROM TILE ON THE COORDINATE FIELD, which repeats the SPACE: the field is read more than
// once across the frame, so the result is continuous and still reads as one drifting surface. This
// repeats CELLS — each one a copy of the whole input picture, with a gap of black between them — so
// what you get has edges, rows and columns, which is the structure a swirling field can never have.
//
// BRICK offsets alternate rows, which is the difference between a grid and a wall, and VARY makes
// the cells differ from one another instead of being one image stamped many times. Without that last
// control a grid of sixteen identical cells reads as a texture rather than as sixteen things.
//
// luma in, luma out.

'use strict';

const params = [];
const ports = [];

const knack = (id, name, min, max, def) => {
  params.push({ id, name, section: 'grid', curve: 'linear', min, max, default: def, glideMs: 0 });
  ports.push({ id: `${id}Cv`, name, section: 'grid', domain: 'control', dir: 'in', target: id });
};

// COLUMNS AND ROWS ARE SEPARATE, not one "count". A row of eight and a column of two are different
// pictures, and a single control would make the second unreachable.
knack('cols', 'Columns', 1, 12, 3);
knack('rows', 'Rows', 1, 12, 3);
// The offset of every other row, in cells. At 0.5 it is a brick wall.
knack('brick', 'Brick', 0, 1, 0);

// The black between the cells, as a fraction of a cell. At 0 the cells touch and the grid reads as
// one surface again, which is occasionally what you want.
params.push({ id: 'gap', name: 'Gap', section: 'grid', curve: 'linear', min: 0, max: 0.45, default: 0.08, glideMs: 0 });
// How much the cells differ from each other in brightness. Ordered by cell, not random per frame —
// a grid that flickers is a fault, not a variation.
params.push({ id: 'vary', name: 'Vary', section: 'grid', curve: 'linear', min: 0, max: 1, default: 0, glideMs: 0 });

ports.push({ id: 'imageIn', name: 'Image', section: 'grid', domain: 'luma', dir: 'in' });
ports.push({ id: 'imageOut', name: 'Out', section: 'grid', domain: 'luma', dir: 'out' });

export default {
  id: 'grid',
  apiVersion: 1,
  name: 'Grid',
  abbreviation: 'Grid',
  worklets: [],
  category: 'video',   // module library grouping
  signalIdentity: ['luma'],
  ports,
  params,
};
