// descriptor.js — ADSR, Wcoast module.
//
// The ordinary four-stage envelope, which DreamRack did not have. The Quad Function Generator does
// attack and decay and is the West Coast answer — you strike it and it makes a shape. This one is
// the East Coast answer: it is HELD. A gate opens it, it sustains for as long as the gate lasts, and
// it releases when the gate falls. That difference is the whole reason both are worth having.
//
// THE GRAPH. The panel draws the envelope's own shape, and the stage that is running is drawn
// brighter and thicker. Four numbers are hard to picture, and the distinction people actually trip
// over — decay against release — is obvious the moment you see the curve and invisible when you are
// looking at four knob positions.
//
// It is a picture of the SHAPE, not a timeline. Sustain is a level and has no duration, so it is
// drawn as a fixed plateau; the other three take their widths from their times, compressed so that a
// 1ms attack beside a 10s release still leaves both visible. A true timeline would be unreadable at
// the ends of the knobs, which is why no ADSR display has ever been one.
//
// The stage is reported by the DSP on change — four messages an envelope, capped at twenty a second —
// rather than a position every frame. Nothing here animates.

const ports = [
  // dir="in" order fixes the worklet's input indices; the factory asserts it.
  { id: 'gateIn', name: 'Gate', section: 'in', domain: 'trigger', dir: 'in' },
  { id: 'retrigIn', name: 'Retrigger', section: 'in', domain: 'trigger', dir: 'in' },
  // The four CV inputs are the knAcks' centres. Linear, so they drive the AudioParams rather than
  // being worklet inputs — the same rule the Oscillator's pulse width follows.
  { id: 'attackCv', name: 'Attack CV', section: 'shape', domain: 'control', dir: 'in', target: 'attack' },
  { id: 'decayCv', name: 'Decay CV', section: 'shape', domain: 'control', dir: 'in', target: 'decay' },
  { id: 'sustainCv', name: 'Sustain CV', section: 'shape', domain: 'control', dir: 'in', target: 'sustain' },
  { id: 'releaseCv', name: 'Release CV', section: 'shape', domain: 'control', dir: 'in', target: 'release' },
  // dir="out" order fixes the worklet's output indices.
  { id: 'envOut', name: 'Envelope out', section: 'out', domain: 'control', dir: 'out' },
  { id: 'invOut', name: 'Inverted out', section: 'out', domain: 'control', dir: 'out' },
  { id: 'eocOut', name: 'End of cycle', section: 'out', domain: 'trigger', dir: 'out' },
];

const params = [
  // Exponential times: 0.5ms to 10s. A linear time knob spends most of its travel on durations too
  // long to be musical and crowds every short one into the first few degrees.
  { id: 'attack', name: 'Attack', section: 'shape', curve: 'exp', min: 0.0005, max: 10, default: 0.01, unit: 's', glideMs: 0 },
  { id: 'decay', name: 'Decay', section: 'shape', curve: 'exp', min: 0.0005, max: 10, default: 0.2, unit: 's', glideMs: 0 },
  { id: 'sustain', name: 'Sustain', section: 'shape', curve: 'linear', min: 0, max: 1, default: 0.6, glideMs: 10 },
  { id: 'release', name: 'Release', section: 'shape', curve: 'exp', min: 0.0005, max: 10, default: 0.4, unit: 's', glideMs: 0 },

  // knAck attenuverter rings, one per time knob. Default 1 = the plain knAck, CV at full strength.
  { id: 'attackDepth', name: 'Attack CV depth', section: 'shape', curve: 'linear', min: -1, max: 1, default: 1, glideMs: 10, subControl: true },
  { id: 'decayDepth', name: 'Decay CV depth', section: 'shape', curve: 'linear', min: -1, max: 1, default: 1, glideMs: 10, subControl: true },
  { id: 'sustainDepth', name: 'Sustain CV depth', section: 'shape', curve: 'linear', min: -1, max: 1, default: 1, glideMs: 10, subControl: true },
  { id: 'releaseDepth', name: 'Release CV depth', section: 'shape', curve: 'linear', min: -1, max: 1, default: 1, glideMs: 10, subControl: true },

  // A momentary gate you can press by hand — the way to hear an envelope with nothing patched in.
  { id: 'gateBtn', name: 'Gate', section: 'in', curve: 'stepped', default: 'off', momentary: true,
    steps: [{ value: 'off' }, { value: 'on' }] },
];

export default {
  apiVersion: 1,
  id: 'wcoast.envelope',
  name: 'ADSR',
  category: 'modulation',
  abbreviation: 'ADSR',
  scope: 'voice',
  hp: 10,
  worklets: ['modules/envelope/envelope-processor.js'],
  menuSectionOrder: ['in', 'shape', 'out'],
  // This module's panel carries a drawn display; the host fills it (rack._attachGraph). Where and how
  // big is the PANEL's business — the host reads the box off the drawing rather than from a second
  // copy of the numbers here, which would drift the first time the layout moved.
  graph: true,
  ports,
  params,
};
