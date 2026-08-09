// descriptor.js — Time. The module a hardware video synth cannot have.
//
// Everything else in the set works on the frame in front of it. This one keeps the last half
// second and reads out of that, which makes three effects one module:
//
//   DELAY  — the image, but from a moment ago. Patch it beside the live one and you have echo.
//   TRAILS — every past frame summed with a decay, so movement smears behind itself.
//   SLIT   — each ROW of the output taken from a different depth in the history. The scanline
//            at the top is now and the one at the bottom is half a second ago, so a moving
//            object is drawn as a diagonal streak through time. This is the one that needs a
//            genuine ring of frames rather than a single feedback buffer, and it is the reason
//            the engine grew one.
//
// luma, like the rest of the first set: the history is the module's whole memory cost, and a
// monochrome ring is a quarter of a colour one.

'use strict';

const params = [];
const ports = [];

// NO DEPTH PARAM. Every CV input here used to carry an attenuverter that came free with this
// helper rather than because anyone asked for one. They all defaulted to unity, so they never
// did anything; and once the knAck lost its attenuverter there was no way to set them either.
// The CV lands on its target at full strength. Where one genuinely needs taming, that is an
// insert's job — see design/inserts.md.
const knack = (id, name, min, max, def) => {
  params.push({ id, name, section: 'time', curve: 'linear', min, max, default: def, glideMs: 0 });
  ports.push({ id: `${id}Cv`, name, section: 'time', domain: 'control', dir: 'in',
    target: id });
};

// How far back to read, as a fraction of the ring. Left at 0 the module is a wire — which is
// what you want when you are patching it in and do not yet know what you want from it.
knack('depth', 'Depth', 0, 1, 0.5);
// TRAILS decay, and the SLIT spread. One knob, two jobs, because in both modes it asks the same
// question: how much of the past reaches the output.
knack('spread', 'Spread', 0, 1, 0.6);
// The live image mixed back against the effect, so any of the three can be dialled in rather
// than switched to.
knack('mix', 'Mix', 0, 1, 1);

params.push({ id: 'mode', name: 'Mode', section: 'time', curve: 'stepped', default: 'delay',
  steps: [{ value: 'delay' }, { value: 'trails' }, { value: 'slit' }] });

// Which way the slit runs. Down the frame is the classic, across it is stranger and worth having.
params.push({ id: 'axis', name: 'Axis', section: 'time', curve: 'stepped', default: 'y',
  steps: [{ value: 'y' }, { value: 'x' }] });

ports.push({ id: 'imageIn', name: 'Image', section: 'time', domain: 'luma', dir: 'in' });
ports.push({ id: 'imageOut', name: 'Out', section: 'time', domain: 'luma', dir: 'out' });

export default {
  id: 'time-machine',
  apiVersion: 1,
  name: 'Time',
  category: 'video',   // module library grouping
  abbreviation: 'TM',
  worklets: [],
  signalIdentity: ['luma'],
  ports,
  params,
};
