// descriptor.js — Filter, Wcoast module.
//
// The one module that most changes what this instrument can do. DreamRack had no filter at all: the
// Quad Low Pass Gate darkens as it closes, which is a West Coast idea and not the same thing as a
// cutoff you can put your hand on and sweep.
//
// THREE OUTPUTS FROM ONE FILTER. A state-variable topology computes low, band and high pass from the
// same integrators, so all three are live at once and cost nothing extra — patch low and high from one
// module and you have a crossover.
//
// CUTOFF, RESONANCE and DRIVE are knAcks: their CV arrives in the knob and the ring meters it. Cutoff
// is the one you will patch most, so it gets the largest knob on the panel.

const ports = [
  { id: 'audioIn', name: 'In', section: 'in', domain: 'audio', dir: 'in' },
  { id: 'cutoffCv', name: 'Cutoff CV', section: 'shape', domain: 'control', dir: 'in', target: 'cutoff' },
  { id: 'resCv', name: 'Resonance CV', section: 'shape', domain: 'control', dir: 'in', target: 'resonance' },
  { id: 'driveCv', name: 'Drive CV', section: 'shape', domain: 'control', dir: 'in', target: 'drive' },
  { id: 'lowOut', name: 'Low pass out', section: 'out', domain: 'audio', dir: 'out' },
  { id: 'bandOut', name: 'Band pass out', section: 'out', domain: 'audio', dir: 'out' },
  { id: 'highOut', name: 'High pass out', section: 'out', domain: 'audio', dir: 'out' },
];

const params = [
  // Exponential, and the full audible range: a linear cutoff knob spends three quarters of its travel
  // above where anything interesting happens.
  { id: 'cutoff', signal: 'audio', name: 'Cutoff', section: 'shape', curve: 'exp', min: 20, max: 20000, default: 1000, unit: 'Hz' },
  { id: 'resonance', name: 'Resonance', section: 'shape', curve: 'linear', min: 0, max: 1, default: 0, glideMs: 8 },
  { id: 'drive', name: 'Drive', section: 'shape', curve: 'linear', min: 0, max: 1, default: 0, glideMs: 8 },
  { id: 'cutoffDepth', name: 'Cutoff CV depth', section: 'shape', curve: 'linear', min: -1, max: 1, default: 1, glideMs: 10, subControl: true },
  { id: 'resDepth', name: 'Resonance CV depth', section: 'shape', curve: 'linear', min: -1, max: 1, default: 1, glideMs: 10, subControl: true },
  { id: 'driveDepth', name: 'Drive CV depth', section: 'shape', curve: 'linear', min: -1, max: 1, default: 1, glideMs: 10, subControl: true },
  // Two poles keeps some of what it removes; four is the sound most people mean by a filter sweep.
  { id: 'poles', name: 'Slope', section: 'shape', curve: 'stepped', default: '4', modulatable: false,
    steps: [{ value: '2', name: '12 dB/oct' }, { value: '4', name: '24 dB/oct' }] },
];

export default {
  apiVersion: 1,
  id: 'wcoast.filter',
  name: 'Filter',
  category: 'processor',
  abbreviation: 'VCF',
  scope: 'voice',
  hp: 8,
  worklets: ['modules/filter/filter-processor.js'],
  menuSectionOrder: ['in', 'shape', 'out'],
  ports,
  params,
};
