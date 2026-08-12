// descriptor.js — Marbles, Wcoast module.
//
// A random source with a memory. Two halves that mirror each other: T makes RHYTHM — three streams of
// gates whose timing is random within a shape you choose — and X makes PITCH, three streams of
// voltages drawn from a distribution you shape. DÉJÀ VU, down the middle, belongs to both: it decides
// how much of what just happened happens again, so the module runs from "different every time" through
// "a loop that drifts" to "locked".
//
// Modelled on Émilie Gillet's Marbles, by way of the Audible Instruments port. Her DSP in `eurorack/`
// is MIT — the panel graphics are not ours to copy, and are not copied: this is her control complement
// arranged in our own language.
//
// WHAT THE PANEL SAYS ABOUT THE MODULE. Left is time, right is voltage, and the two columns are
// deliberately mirror images: the same knob in the same place does the analogous thing to the other
// half. Anything that broke that symmetry would cost more than it bought, which is why the shared
// controls run down the centre rather than being given to one side.
//
// WHERE IT DEPARTS FROM THE ORIGINAL. Four of its controls are buttons you press repeatedly to walk a
// row of coloured LEDs through three states — the T model, the X model, and each side's range. On
// hardware that is a reasonable trade for panel space. Here they are radios: three named options, the
// current one lit, no counting and no remembering what amber meant.
//
// THE CV INPUTS FOLD INTO THEIR KNOBS. Seven of the nine inputs modulate a knob that is right there on
// the panel, so they become knAcks — jack in the middle of the knob it drives — and the bottom of the
// panel gets a row of its own back. Only the two clock inputs stay as plain jacks, because a clock
// drives nothing on the panel; it drives the whole side.

export const LOOP_LENGTHS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16];

const onoff = () => ({ curve: 'stepped', steps: [{ value: 'off' }, { value: 'on' }] });

export default {
  apiVersion: 1,
  id: 'wcoast.marbles',
  name: 'Marbles',
  category: 'random',
  abbreviation: 'MRB',
  scope: 'voice',
  hp: 15,
  ports: [
    // The two clocks. Each side can run from its own, or from T's internal one.
    { id: 'tClockIn', name: 'T clock', role: 'clock', section: 't', domain: 'control', dir: 'in' },
    { id: 'xClockIn', name: 'X clock', role: 'clock', section: 'x', domain: 'control', dir: 'in' },
    // ...and the seven that live in the middle of the knob they modulate.
    { id: 'tRateIn', name: 'T rate CV', section: 't', domain: 'control', dir: 'in', target: 'tRate' },
    { id: 'tBiasIn', name: 'T bias CV', section: 't', domain: 'control', dir: 'in', target: 'tBias' },
    { id: 'tJitterIn', name: 'T jitter CV', section: 't', domain: 'control', dir: 'in', target: 'tJitter' },
    { id: 'dejaVuIn', name: 'Déjà vu CV', section: 'dejavu', domain: 'control', dir: 'in', target: 'dejaVu' },
    { id: 'xSpreadIn', name: 'X spread CV', section: 'x', domain: 'control', dir: 'in', target: 'xSpread' },
    { id: 'xBiasIn', name: 'X bias CV', section: 'x', domain: 'control', dir: 'in', target: 'xBias' },
    { id: 'xStepsIn', name: 'X steps CV', section: 'x', domain: 'control', dir: 'in', target: 'xSteps' },

    { id: 't1Out', name: 'T1', role: 'gate', section: 'out', domain: 'control', dir: 'out' },
    { id: 't2Out', name: 'T2', role: 'gate', section: 'out', domain: 'control', dir: 'out' },
    { id: 't3Out', name: 'T3', role: 'gate', section: 'out', domain: 'control', dir: 'out' },
    { id: 'yOut', name: 'Y', section: 'out', domain: 'control', dir: 'out' },
    { id: 'x1Out', name: 'X1', role: 'pitch', section: 'out', domain: 'control', dir: 'out' },
    { id: 'x2Out', name: 'X2', role: 'pitch', section: 'out', domain: 'control', dir: 'out' },
    { id: 'x3Out', name: 'X3', role: 'pitch', section: 'out', domain: 'control', dir: 'out' },
  ],
  params: [
    // ---- the spine: shared by both halves ----
    // How much of the last loop comes back. Below the middle it reshuffles, above it locks, and the
    // interesting settings are the ones either side of centre where it almost repeats.
    { id: 'dejaVu', name: 'Déjà vu', section: 'dejavu', min: 0, max: 1, default: 0.5, glideMs: 12 },
    // THE LOOP LENGTH IS A LIST, NOT A SWEEP. Her knob smears twelve distinct lengths across thirty-six
    // positions — 1 1 1 2 2 2 2 2 3 3 3 3 4 4 4 … — which a pointer cannot report and a number can. It is
    // a readout: the value you can see is the value it is on.
    { id: 'dejaVuLength', name: 'Loop length', section: 'dejavu', curve: 'detent', min: 0, max: 11, default: 0,
      readoutText: (i) => String(LOOP_LENGTHS[Math.max(0, Math.min(11, Math.round(i)))]), glideMs: 0 },
    // Which half déjà vu applies to — either, both, or neither. Two latches rather than one control,
    // because they are independent and the original treats them so.
    { id: 'tDejaVu', name: 'T déjà vu', section: 't', ...onoff(), default: 'off' },
    { id: 'xDejaVu', name: 'X déjà vu', section: 'x', ...onoff(), default: 'off' },
    // Process an external signal instead of the internal generator.
    { id: 'external', name: 'External', section: 'dejavu', ...onoff(), default: 'off' },

    // ---- T: the rhythm half ----
    { id: 'tRate', name: 'T rate', section: 't', min: -1, max: 1, default: 0, glideMs: 12 },
    { id: 'tBias', name: 'T bias', section: 't', min: 0, max: 1, default: 0.5, glideMs: 12 },
    { id: 'tJitter', name: 'T jitter', section: 't', min: 0, max: 1, default: 0, glideMs: 12 },
    // Her three T models, named rather than counted.
    { id: 'tMode', name: 'T model', section: 't', curve: 'stepped', default: 'bernoulli',
      steps: [{ value: 'bernoulli', name: 'Complementary Bernoulli' }, { value: 'clusters', name: 'Clusters' }, { value: 'drums', name: 'Drums' }] },
    { id: 'tRange', name: 'T range', section: 't', curve: 'stepped', default: 'x1',
      steps: [{ value: 'div4', name: '÷4' }, { value: 'x1', name: '×1' }, { value: 'x4', name: '×4' }] },

    // ---- X: the pitch half ----
    { id: 'xSpread', name: 'X spread', section: 'x', min: 0, max: 1, default: 0.5, glideMs: 12 },
    { id: 'xBias', name: 'X bias', section: 'x', min: 0, max: 1, default: 0.5, glideMs: 12 },
    { id: 'xSteps', name: 'X steps', section: 'x', min: 0, max: 1, default: 0.5, glideMs: 12 },
    { id: 'xMode', name: 'X model', section: 'x', curve: 'stepped', default: 'identical',
      steps: [{ value: 'identical', name: 'Identical' }, { value: 'bump', name: 'Bump' }, { value: 'tilt', name: 'Tilt' }] },
    { id: 'xRange', name: 'X range', section: 'x', curve: 'stepped', default: 'full',
      steps: [{ value: 'narrow', name: '±2V' }, { value: 'positive', name: '+5V' }, { value: 'full', name: '±5V' }] },
  ],
};
