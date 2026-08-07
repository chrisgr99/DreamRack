// descriptor.js — Octave, Wcoast module.
//
// Takes a 1V/oct pitch signal and moves it whole octaves up or down. That is all it does, and it is
// worth 3 HP because the alternative is retuning an oscillator by hand every time and losing whatever
// you had.
//
// NO WORKLET. On a 1V/oct signal an octave is exactly one, so the whole module is an addition: the
// input passes through and a constant is summed onto it. Reaching for a processor here would cost a
// thread's worth of scheduling to do a sum the audio graph does for free.
//
// The knob is DETENTED rather than stepped-with-lamps: nine positions is too many for a lamp row on a
// 3 HP panel, and an octave shifter is something you turn rather than something you select.

export default {
  apiVersion: 1,
  id: 'wcoast.octave',
  name: 'Octave',
  category: 'utility',
  abbreviation: 'OCT',
  scope: 'voice',
  hp: 4,
  ports: [
    { id: 'pitchIn', name: '1V/oct in', role: 'pitch', section: 'io', domain: 'control', dir: 'in' },
    { id: 'pitchOut', name: '1V/oct out', role: 'pitch', section: 'out', domain: 'control', dir: 'out' },
  ],
  params: [
    { id: 'octave', signal: 'pitch', name: 'Octave', section: 'io', curve: 'detent', min: -4, max: 4, default: 0, glideMs: 0 },
  ],
};
