// descriptor.js — Clock, Wcoast module.
//
// A master clock and three sub-clocks, each locked to the master by a whole-number ratio and each able
// to multiply as well as divide. Modelled on Clkd, from Marc Boulé's Impromptu Modular (GPL-3.0),
// which is why this project is GPL-3.0.
//
// WHAT IS WORTH TAKING FROM IT is not the counting — it is the sync discipline. A sub-clock runs a
// whole number of its own periods and then WAITS in a guard region for the master to come round, so a
// multiplied clock never drifts out of phase with its parent, and changing tempo mid-run stretches the
// running period rather than restarting it. That is the difference between a clock you can play with
// and one you have to stop before you touch.
//
// WHERE THIS PANEL DEPARTS FROM THE ORIGINAL. Clkd has a seven-segment display and four buttons that
// page through it — two to choose what it shows and two to walk the BPM input's meaning through seven
// states. That is a hardware compromise: one display, so everything has to queue for it. Here the BPM
// input's meaning is a radio you can read at a glance, its pulses-per-quarter-note is a detented knob
// with its values printed, and the display shows the tempo and nothing else because nothing else needs
// to borrow it.
//
// THE RATIO KNOBS ARE DETENTED across 69 positions: 34 divisions, unity, 34 multiplications, from the
// same table the original uses — 1, 1.5, 2, 2.5, 3, 4 … 64, 96 — so a musical ratio is a detent rather
// than a number you have to land on.

export const PPQN_VALUES = [2, 4, 8, 12, 16, 24];

export const RATIOS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 23,
  24, 29, 31, 32, 37, 41, 43, 47, 48, 53, 59, 61, 64, 96];

// A ratio knob's value is an INDEX, negative for division: −2 is ÷2, 0 is unity, +2 is ×2.
export const ratioAt = (i) => (i < 0 ? -RATIOS[Math.min(RATIOS.length - 1, -i)] : RATIOS[Math.min(RATIOS.length - 1, i)]);

// What a ratio knob is pointing at, in the words a musician would use.
export const ratioText = (i) => {
  const n = Math.round(i);
  const v = RATIOS[Math.min(RATIOS.length - 1, Math.abs(n))];
  return n === 0 ? '×1' : (n < 0 ? '÷' + v : '×' + v);
};

// The delay knob's eight positions, in the words a musician would use.
export const DELAYS = [0, 1 / 16, 1 / 8, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4];
export const DELAY_LABELS = ['0', '1/16', '1/8', '1/4', '1/3', '1/2', '2/3', '3/4'];
export const delayText = (i) => DELAY_LABELS[Math.max(0, Math.min(7, Math.round(i)))];

export default {
  apiVersion: 1,
  id: 'wcoast.clock',
  name: 'drClckd',
  category: 'utility',
  abbreviation: 'CLK',
  // A numeric readout in the panel's display box: the tempo the engine is actually running at.
  graph: 'readout',
  scope: 'voice',
  hp: 15,
  worklets: ['modules/clock/clock-processor.js'],
  ports: [
    // THE TRANSPORT IS THIS MODULE'S, NOT THE RACK'S. VCV Rack has no global transport and no global
    // tempo — its engine knows a sample rate and nothing else — because in a modular, running is a gate
    // and tempo is a voltage, and an application that knew either would know something the patch did
    // not. We follow it: run and reset are a button, an input and an output on this panel, and a rack
    // of clocks is started together by patching them together.
    { id: 'runIn', name: 'Run', role: 'gate', section: 'transport', domain: 'trigger', dir: 'in' },
    { id: 'resetIn', name: 'Reset', role: 'trigger', section: 'transport', domain: 'trigger', dir: 'in' },
    // ONE INPUT, TWO MEANINGS, chosen by the BPM mode radio: a voltage that sets the tempo, or a clock
    // to lock onto. Kept as one jack because they are alternatives, never both at once.
    { id: 'bpmIn', name: 'BPM CV / external clock', section: 'transport', domain: 'control', dir: 'in' },

    { id: 'clkOut', name: 'Master clock', role: 'clock', section: 'out', domain: 'trigger', dir: 'out' },
    { id: 'clk1Out', name: 'Clock 1', role: 'clock', section: 'out', domain: 'trigger', dir: 'out' },
    { id: 'clk2Out', name: 'Clock 2', role: 'clock', section: 'out', domain: 'trigger', dir: 'out' },
    { id: 'clk3Out', name: 'Clock 3', role: 'clock', section: 'out', domain: 'trigger', dir: 'out' },
    { id: 'runOut', name: 'Run', role: 'gate', section: 'out', domain: 'trigger', dir: 'out' },
    { id: 'resetOut', name: 'Reset', role: 'trigger', section: 'out', domain: 'trigger', dir: 'out' },
    { id: 'bpmOut', name: 'BPM CV thru', section: 'out', domain: 'control', dir: 'out' },
  ],
  params: [
    // Snapped to whole BPM: the original relies on reading a rounded value back from this knob when it
    // chains to another clock, and a tempo of 119.6 is nobody's intention anyway.
    // THE TEMPO IS A LIST, one BPM a row — see the panel. It was a coarse knob of ten BPM a notch with a
    // fine trim beside it to reach the units: two controls and a display for one number, neither of
    // which could land on a tempo without being watched. listRate is how many rows one notch of the
    // wheel is worth — the ratios move six at a time because sixty-nine of them is a long walk, and a
    // tempo moves one, because landing on a hundred and twenty-one has to be possible.
    //
    // overriddenBy names the input that takes the setting away. With a cable in the BPM input the tempo
    // is the cable's and the engine reports what it actually is, so the window goes back to being
    // something you are told rather than something you set, and the list will not open.
    { id: 'bpm', name: 'Tempo', section: 'master', curve: 'detent', min: 30, max: 300, default: 120, unit: 'BPM',
      listRate: 4, overriddenBy: 'bpmIn', glideMs: 0,
      // listStep: the wheel nudges this one as well as listing it — see attachControlInteraction.
      listStep: 4,
      // The window and its list print the NUMBER; the unit is painted once on the panel beside them.
      readoutText: (v) => String(Math.round(v)) },
    // A RATIO KNOB HOLDS AN INDEX AND MEANS A MUSICAL FACT. Reading '12' off it tells you nothing —
    // reading '×11' tells you everything — so each one formats its own readout from the table.
    ...[1, 2, 3].map((n) => ({ id: 'ratio' + n, name: 'Clock ' + n + ' ratio', section: 'ratios',
      // listStep/listRate: six values a notch, the same rate the open list slides at, so the wheel
      // feels identical whether the list happens to be up or not. Sixty-nine ratios is a dozen notches
      // end to end, which is a flick.
      curve: 'detent', min: -34, max: 34, default: 0, glideMs: 0, readoutText: ratioText,
      listStep: 6, listRate: 6 })),
    // SWING displaces every second beat: negative drags it early, positive late, zero is straight.
    // Expressed as a fraction of the pair of beats it shifts between, which is what makes the same
    // number mean the same feel at any tempo and any ratio.
    { id: 'swing', name: 'Swing', section: 'master', min: -1, max: 1, default: 0, glideMs: 0 },
    ...[1, 2, 3].map((n) => ({ id: 'swing' + n, name: 'Clock ' + n + ' swing', section: 'clocks', min: -1, max: 1, default: 0, glideMs: 0 })),
    // PULSE WIDTH, as a fraction of the period the gate stays high. Clamped away from both ends by the
    // engine: a gate of zero width is not a gate, and one of full width never falls.
    { id: 'pw', name: 'Pulse width', section: 'master', min: 0.02, max: 0.98, default: 0.5, glideMs: 0 },
    ...[1, 2, 3].map((n) => ({ id: 'pw' + n, name: 'Clock ' + n + ' pulse width', section: 'clocks', min: 0.02, max: 0.98, default: 0.5, glideMs: 0 })),
    // DELAY, in the original's eight fractions of a beat — 0, 1/16, 1/8, 1/4, 1/3, 1/2, 2/3, 3/4 — so
    // a clock can be pushed off the beat by a musical amount rather than an arbitrary one.
    ...[1, 2, 3].map((n) => ({ id: 'delay' + n, name: 'Clock ' + n + ' delay', section: 'clocks',
      curve: 'detent', min: 0, max: 7, default: 0, glideMs: 0, readoutText: delayText,
      listStep: 1, listRate: 1 })),
    // RUN LATCHES, RESET DOES NOT. Running is a state you can see; resetting is a thing that happens.
    { id: 'run', name: 'Run', section: 'transport', curve: 'stepped', default: 'off', modulatable: false,
      steps: [{ value: 'off' }, { value: 'on' }] },
    { id: 'reset', name: 'Reset', section: 'transport', curve: 'stepped', default: 'off', momentary: true, modulatable: false,
      steps: [{ value: 'off' }, { value: 'on' }] },
    { id: 'bpmMode', name: 'BPM input', section: 'transport', curve: 'stepped', default: 'cv', modulatable: false,
      steps: [{ value: 'cv', name: 'BPM voltage' }, { value: 'clock', name: 'External clock' }] },
    // Only meaningful in clock mode: how many pulses the incoming clock sends per quarter note.
    // THE FOUR LAMPS ARE THE ENGINE'S, NOT YOURS. Declared as params because that is the vocabulary
    // the host paints in — a param id and a value — but nothing on the panel makes them clickable and
    // nothing but the clock ever sets them. The Sequencer's play lamp works the same way.
    ...['', '1', '2', '3'].map((n) => ({ id: 'lamp' + n, name: 'Clock ' + (n || 'master') + ' lamp',
      section: 'lamps', curve: 'stepped', steps: [{ value: 'off' }, { value: 'on' }], default: 'off',
      readOnly: true })),
    { id: 'ppqn', name: 'Pulses per quarter note', section: 'transport', curve: 'detent', min: 0, max: 5, default: 1,
      readoutText: (i) => String(PPQN_VALUES[Math.max(0, Math.min(5, Math.round(i)))]), glideMs: 0,
      listStep: 1, listRate: 1 },
  ],
};
