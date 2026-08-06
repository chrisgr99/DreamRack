// descriptor.js — Compositor. Two pictures into one.
//
// Distinct from Video maths, which combines single CHANNELS arithmetically. This one composites
// PICTURES: it is what turns a rack full of sources into one image, and it is where backgrounds
// live — which is why Video Output has no background input of its own.
//
// rgb in and out, so it sits at the colour end of a chain. A luma source drops straight in: the
// connection rules broadcast one channel to all three, so a monochrome chain needs no encoder to
// reach it.
//
// THE KEY INPUT is what makes it a compositor rather than a crossfader. With nothing patched
// there, MIX is one number for the whole frame. Patch a luma image into KEY and the mix becomes
// PER PIXEL — bright where the key is bright — which is luma keying, and with a shape or a field
// as the key it is every wipe and every matte.

'use strict';

const params = [];
const ports = [];

const knack = (id, name, min, max, def) => {
  params.push({ id, name, section: 'mix', curve: 'linear', min, max, default: def, glideMs: 0 });
  params.push({ id: `${id}Depth`, name: `${name} depth`, section: 'mix', curve: 'linear',
    min: -1, max: 1, default: 1, glideMs: 0, subControl: true });
  ports.push({ id: `${id}Cv`, name, section: 'mix', domain: 'control', dir: 'in',
    target: id, via: `${id}Depth` });
};

// MIX is the crossfade position, and the parameter most worth automating in the whole video set:
// an envelope on it is a dissolve, an LFO is a throb, a sequencer is a cut.
knack('mix', 'Mix', 0, 1, 0.5);
// KEY scales what the key input does. At 0 the key is ignored however bright it is, so a patched
// key can be faded in without unplugging it — the same reason every CV input has a depth.
knack('key', 'Key', 0, 1, 1);

// The blend. Eight kinds, not eight degrees — a switch, and nothing here means anything swept.
// The order runs from gentlest to most violent, which is how you hunt through them.
params.push({ id: 'mode', name: 'Blend', section: 'mix', curve: 'stepped', default: 'mix',
  steps: [{ value: 'mix' }, { value: 'add' }, { value: 'mult' }, { value: 'screen' },
    { value: 'diff' }, { value: 'light' }, { value: 'dark' }, { value: 'over' }] });

ports.push({ id: 'aIn', name: 'A', section: 'mix', domain: 'rgb', dir: 'in' });
ports.push({ id: 'bIn', name: 'B', section: 'mix', domain: 'rgb', dir: 'in' });
ports.push({ id: 'keyIn', name: 'Key', section: 'mix', domain: 'luma', dir: 'in' });
ports.push({ id: 'imageOut', name: 'Out', section: 'mix', domain: 'rgb', dir: 'out' });

export default {
  id: 'compositor',
  apiVersion: 1,
  name: 'Compositor',
  abbreviation: 'Comp',
  worklets: [],
  signalIdentity: ['rgb'],
  ports,
  params,
};
