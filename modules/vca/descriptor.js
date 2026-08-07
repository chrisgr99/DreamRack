// descriptor.js — VCA, Wcoast module.
//
// A voltage-controlled amplifier: one signal in, one out, and a knob that says how much of it gets
// through. The Quad Low Pass Gate can do this in VCA mode, but a gate is four channels of an opinion —
// this is the plain version you reach for when you want one thing turned down by one control.
//
// The LEVEL knob is a knAck, so its CV arrives in the knob itself and the ring meters it. That is the
// whole module: a VCA is a knob with a voltage on it.

const ports = [
  { id: 'audioIn', name: 'In', section: 'io', domain: 'audio', dir: 'in' },
  { id: 'levelCv', name: 'Level CV', section: 'io', domain: 'control', dir: 'in', target: 'level' },
  { id: 'out', name: 'Out', section: 'out', domain: 'audio', dir: 'out' },
];

const params = [
  { id: 'level', signal: 'audio', name: 'Level', section: 'io', curve: 'linear', min: 0, max: 1, default: 0, glideMs: 8 },
  { id: 'levelDepth', name: 'Level CV depth', section: 'io', curve: 'linear', min: -1, max: 1, default: 1, glideMs: 10, subControl: true },
  // Linear for shaping a sound, exponential for riding a level you are listening to — see the
  // processor for why both are worth having.
  { id: 'response', name: 'Response', section: 'io', curve: 'stepped', default: 'lin', modulatable: false,
    steps: [{ value: 'lin', name: 'Linear' }, { value: 'exp', name: 'Exponential' }] },
];

export default {
  apiVersion: 1,
  id: 'wcoast.vca',
  name: 'VCA',
  category: 'processor',
  abbreviation: 'VCA',
  scope: 'voice',
  hp: 6,
  worklets: ['modules/vca/vca-processor.js'],
  menuSectionOrder: ['io', 'out'],
  ports,
  params,
};
