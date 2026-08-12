// descriptor.js — Oscillator, Wcoast module.
//
// A plain voltage-controlled oscillator of the East Coast kind, to sit beside the Complex Oscillator
// rather than compete with it. The 259t is a two-oscillator instrument with a wavefolder and its own
// internal routing; this one does the ordinary job — one oscillator, four shapes, and the inputs you
// need to drive it from somewhere else. It's the module you reach for when you want a second voice,
// a modulator, or a signal to set a level against.
//
// WHY IT EARNS ITS PLACE. Two things here the 259t doesn't offer:
//
//   THROUGH-ZERO LINEAR FM. Exponential FM detunes as you turn the depth up — the pitch rises with
//   the modulation because the exponent is asymmetric. Linear FM adds a signed offset in Hz instead,
//   so the pitch stays centred, and letting that offset pass through zero (the oscillator running
//   backwards for part of the cycle) is what makes real FM timbres possible rather than vibrato.
//
//   FEEDBACK. The oscillator's own output modulating its own phase. One oscillator, harmonics that
//   move — a sine bends towards a saw and then past it. It costs one knob and no patch cord.
//
// PARAMETERS vs PORTS, as everywhere: a knob whose value can also be voltage-controlled is one
// modulatable param, and its jack is a port with `target` naming it. LIN FM and EXP FM are the other
// shape — the knob is the DEPTH and the jack is the signal — which is exactly what a knAck is for, so
// both are knAcks whose ring sets how much and whose centre takes the cable.
//
// SIGNAL DOMAINS. The four outputs are audio. 1V/oct is control. Sync is audio (it's an edge, and it
// usually comes from another oscillator's output). Lin FM and Exp FM are audio, since they're
// expected to run at audio rate — that is the point of them.

const ports = [
  // dir="in" order fixes the worklet's input indices; the factory asserts it.
  // role 'pitch' is what turns the jack green and styles a cord landing on it as a pitch cable —
  // the host looks for the role, not the label, so the panel text can say whatever reads best.
  { id: 'pitchIn', name: '1V/oct', role: 'pitch', section: 'freq', domain: 'control', dir: 'in' },
  { id: 'linFmIn', name: 'Linear FM in', section: 'mod', domain: 'audio', dir: 'in' },
  { id: 'expFmIn', name: 'Exponential FM in', section: 'mod', domain: 'audio', dir: 'in' },
  { id: 'syncIn', name: 'Sync', section: 'freq', domain: 'audio', dir: 'in' },
  // Pulse width's CV is LINEAR, so it goes to the AudioParam rather than a worklet input —
  // same treatment as the 259t's folder CVs. It is still a real jack: the knAck's centre.
  { id: 'pwIn', name: 'Pulse width CV', section: 'shape', domain: 'control', dir: 'in', target: 'pulseWidth' },
  // dir="out" order fixes the worklet's output indices.
  { id: 'sineOut', name: 'Sine out', section: 'out', domain: 'audio', dir: 'out' },
  { id: 'triOut', name: 'Triangle out', section: 'out', domain: 'audio', dir: 'out' },
  { id: 'sawOut', name: 'Sawtooth out', section: 'out', domain: 'audio', dir: 'out' },
  { id: 'pulseOut', name: 'Pulse out', section: 'out', domain: 'audio', dir: 'out' },
];

const params = [
  // Coarse spans nine octaves, low enough to be an LFO and high enough to be a modulator. Exponential,
  // so the knob moves in musical steps rather than crowding every note into its last few degrees.
  { id: 'coarse', signal: 'audio', name: 'Coarse', section: 'freq', curve: 'exp', min: 8, max: 8000, default: 220, unit: 'Hz' },
  // Fine is ±3.5 semitones, matching the 259t's, so tuning two oscillators together feels the same
  // whichever one you are holding.
  { id: 'fine', signal: 'audio', name: 'Fine', section: 'freq', curve: 'linear', min: -3.5, max: 3.5, default: 0, unit: 'semitones' },

  // The two FM depths. Both are the knAck's ring; both are a-rate so they can themselves be moved
  // quickly without stepping.
  { id: 'linFm', name: 'Linear FM depth', section: 'mod', curve: 'linear', min: 0, max: 1, default: 0 },
  { id: 'expFm', name: 'Exponential FM depth', section: 'mod', curve: 'linear', min: 0, max: 1, default: 0 },

  { id: 'pulseWidth', name: 'Pulse width', section: 'shape', curve: 'linear', min: 0.05, max: 0.95, default: 0.5 },
  // The knAck's attenuverter ring for the pulse-width CV. Default 1 = plain knAck, CV at full
  // strength. subControl: driven by the knob's AV ring, not its own SVG element.
  { id: 'pwDepth', name: 'Pulse width CV depth', section: 'shape', curve: 'linear', min: -1, max: 1, default: 1, glideMs: 10, subControl: true },

  { id: 'feedback', name: 'Feedback', section: 'shape', curve: 'linear', min: 0, max: 1, default: 0 },

  // Hard sync restarts the cycle on every rising edge. Soft sync reverses direction instead, which
  // keeps some of the oscillator's own pitch audible under the one it is locked to.
  { id: 'syncMode', name: 'Sync', section: 'freq', curve: 'stepped', default: 'soft', modulatable: false,
    steps: [{ value: 'soft', name: 'Soft (reverse)' }, { value: 'hard', name: 'Hard (reset)' }] },
];

export default {
  apiVersion: 1,
  id: 'wcoast.oscillator',
  name: 'VCO',
  category: 'source',   // module library grouping
  abbreviation: 'VCO',
  scope: 'voice',
  hp: 10,
  worklets: ['modules/oscillator/oscillator-processor.js'],
  menuSectionOrder: ['freq', 'mod', 'shape', 'out'],
  ports,
  params,
};
