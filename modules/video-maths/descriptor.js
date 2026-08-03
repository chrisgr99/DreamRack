// descriptor.js — Video Maths. Two images, one arithmetic.
//
// The smallest shader in the set and the largest change to what the rack can do, because until
// this module exists a patch has ONE image however many modules it passes through. A gradient
// is a gradient however you warp it; two gradients met against each other are a plaid, a
// lattice, or moiré — and none of those can be produced by a single chain.
//
// DISTINCT FROM THE COMPOSITOR, which combines PICTURES with blend modes and a key. This one
// combines CHANNELS arithmetically: no alpha, no key, no per-pixel steering. The difference
// matters in use — you reach for maths when you want interference, and for the compositor when
// you want one image over another.
//
// luma in and out. Interference is a monochrome idea; colour happens later, at the colorizer.

'use strict';

const params = [];
const ports = [];

const knack = (id, name, min, max, def) => {
  params.push({ id, name, section: 'maths', curve: 'linear', min, max, default: def, glideMs: 0 });
  params.push({ id: `${id}Depth`, name: `${name} depth`, section: 'maths', curve: 'linear',
    min: -1, max: 1, default: 1, glideMs: 0, subControl: true });
  ports.push({ id: `${id}Cv`, name, section: 'maths', domain: 'control', dir: 'in',
    target: id, via: `${id}Depth` });
};

// GAIN on each input BEFORE the operation, not after. Where the two images sit relative to each
// other is most of what decides whether a difference is a thin bright edge or a broad wash, and
// scaling afterwards cannot recover that — the information has already been combined.
knack('gainA', 'Gain A', 0, 2, 1);
knack('gainB', 'Gain B', 0, 2, 1);
// The result against input A, so any operation can be dialled in rather than switched to. At 0
// the module is a wire carrying A, which is what you want while patching.
knack('amount', 'Amount', 0, 1, 1);

params.push({ id: 'op', name: 'Operation', section: 'maths', curve: 'stepped', default: 'mult',
  steps: [{ value: 'mult' }, { value: 'diff' }, { value: 'add' },
    { value: 'min' }, { value: 'max' }, { value: 'mean' }] });

ports.push({ id: 'aIn', name: 'A', section: 'maths', domain: 'luma', dir: 'in' });
ports.push({ id: 'bIn', name: 'B', section: 'maths', domain: 'luma', dir: 'in' });
ports.push({ id: 'outImage', name: 'Out', section: 'maths', domain: 'luma', dir: 'out' });

export default {
  id: 'video-maths',
  apiVersion: 1,
  name: 'Video Maths',
  abbreviation: 'VdM',
  worklets: [],
  signalIdentity: ['luma'],
  ports,
  params,
};
