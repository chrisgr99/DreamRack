// descriptor.js — Formula. Four images, four knobs, one expression.
//
// WHY THIS EXISTS BESIDE Video Maths rather than replacing it. Maths is one cable and one
// switch and no typing, and that is the right thing to reach for most of the time. Formula is
// for when a patch would otherwise be three or four Maths modules chained together — because
// then the arithmetic is spread across the rack, and reading it means navigating to each module
// in turn. Written as one line on one faceplate it can be read at a glance, which matters most
// to anyone working magnified, where "look at the whole patch" is not an option.
//
// The expression is a `text` param: saved with the patch, length-capped, and compiled by the
// module's own whitelist grammar (see expr.js) — never passed to the driver unchecked.

'use strict';

const params = [];
const ports = [];

const knack = (id, name, def) => {
  params.push({ id, name, section: 'formula', curve: 'linear', min: 0, max: 1, default: def, glideMs: 0 });
  params.push({ id: `${id}Depth`, name: `${name} depth`, section: 'formula', curve: 'linear',
    min: -1, max: 1, default: 1, glideMs: 0, subControl: true });
  ports.push({ id: `${id}Cv`, name, section: 'formula', domain: 'control', dir: 'in',
    target: id, via: `${id}Depth` });
};

// Four knobs, named as they are written in the expression. They are not "amount" or "depth" —
// they are K1 to K4, because what they mean is decided by the expression and naming them
// anything else would be the panel guessing.
knack('k1', 'K1', 0.5);
knack('k2', 'K2', 0.5);
knack('k3', 'K3', 0.5);
knack('k4', 'K4', 0.5);

params.push({ id: 'expr', name: 'Expression', section: 'formula', curve: 'text', default: 'A * B' });

ports.push({ id: 'aIn', name: 'A', section: 'formula', domain: 'luma', dir: 'in' });
ports.push({ id: 'bIn', name: 'B', section: 'formula', domain: 'luma', dir: 'in' });
ports.push({ id: 'cIn', name: 'C', section: 'formula', domain: 'luma', dir: 'in' });
ports.push({ id: 'dIn', name: 'D', section: 'formula', domain: 'luma', dir: 'in' });
ports.push({ id: 'outImage', name: 'Out', section: 'formula', domain: 'luma', dir: 'out' });

export default {
  id: 'formula',
  apiVersion: 1,
  name: 'Formula',
  abbreviation: 'Form',
  worklets: [],
  signalIdentity: ['luma'],
  // The expression, shown on the faceplate. The rack places a text element here — the whole
  // point of the module is that you can read what it does without opening anything.
  readout: { x: 3, y: 8, w: 32, h: 20 },
  ports,
  params,
};
