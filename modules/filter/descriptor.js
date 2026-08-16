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
  // `via` is what MAKES the depth work: the patchbay puts the cord through an attenuator gain it
  // owns and drives from that param. Without it the depth was declared, drawn and inert — which is
  // what it was here until the trim knob gave it a control.
  // A NODE INPUT, not a parameter target: the worklet reads it and applies it EXPONENTIALLY, so a
  // normalised source opens the filter by octaves instead of by hertz. The depth knob still says how
  // far and in which direction, but it is read inside rather than being a gain on the cord.
  { id: 'cutoffCv', name: 'Cutoff CV', section: 'shape', domain: 'control', dir: 'in' },
  // NO DEPTH on these two. Three trims do not fit across 8 HP — the resonance/drive row overflowed by
  // 6mm — and of the three, cutoff is the one you reach for while playing. Res and drive take an
  // insert if they ever need taming (design/inserts.md).
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
  // The TRIM in the cutoff knob's lower right. Not a subControl: it has its own element on the
  // faceplate, so the panel-coverage check should hold it to the same standard as any knob.
  { id: 'cutoffDepth', name: 'Cutoff CV depth', section: 'shape', curve: 'linear', min: -1, max: 1, default: 1, glideMs: 10 },
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
