// descriptor.js — Sequencer/Programmer Eight.
//
// An eight-stage sequential voltage programmer in the Serge tradition: two rows of
// stored voltages stepped by an external clock, with per-stage select inputs and
// pulse outputs, a directed loop window, and a per-stage ratchet count.
// Full design: design/cv-sequencer.md.
//
// Descriptor and DSP are both COMPLETE. The playhead, Clock in, Rows A and B out with
// A−B, the full transport ((P)Reset with its mode switch, Hold, Up/Down), the loop
// window as two one-of-eight selectors, the eight per-stage select inputs and pulse
// outputs, All Gate, Trigger, the play buttons as a keyboard, and per-stage ratchets.
// The engine lights the active stage; the window's own lamps are lit from its params.
//
// Remaining work is the shared trigger-detector extraction (spec, requirement 7).

'use strict';

const N = 8;                                   // stages
const STAGES = [1, 2, 3, 4, 5, 6, 7, 8];

// ONE standard position for every stage control, so a column of knobs resets to a
// straight line of identical pointers. Reset and double-click both restore a param's
// `default`, so this is the position both of them mean.
//
// These used to be an authored pattern — an arch in A, a falling contour in B, a few
// scattered ratchets — which made a freshly placed module play a tune straight away.
// It also meant "reset" left eight knobs pointing eight different ways, with no way to
// tell a deliberate setting from a default one. A flat default is the readable choice;
// the cost is that a new module holds a steady voltage until you turn something.
const A_DEFAULT = 0.5;      // mid-travel
const B_DEFAULT = 0.5;
const RPT_DEFAULT = 1;      // an ordinary one-trigger stage

const onoff = () => ({ curve: 'stepped', steps: [{ value: 'off' }, { value: 'on' }] });

const params = [];
const ports = [];

// --- per stage --------------------------------------------------------------
// Two voltage knobs, the play button, and the ratchet count. The loop-window
// selectors are module-level params, below, not per-stage ones.
for (const s of STAGES) {
  params.push({
    id: `a${s}`, name: `A ${s}`, section: 'stage',
    curve: 'linear', min: 0, max: 1, default: A_DEFAULT, glideMs: 0,
  });
  params.push({
    id: `b${s}`, name: `B ${s}`, section: 'stage',
    curve: 'linear', min: 0, max: 1, default: B_DEFAULT, glideMs: 0,
  });
  // Play — momentary. Jumps the playhead here and holds All Gate high while pressed.
  // Its lamp is ALSO the active-stage indication (see design/cv-sequencer.md).
  params.push({ id: `play${s}`, name: `Play ${s}`, section: 'stage', ...onoff(), default: 'off', momentary: true });
  // Ratchet count 0..4. 0 = this stage's Trigger stays silent (the stage still
  // happens); 1 = one trigger at stage start; 2..4 = that many extra even repeats.
  // DETENT, not stepped. Both give whole-number values, but they are different control
  // kinds to the host: a `stepped` param is a SWITCH, operated by clicking one of its
  // lamps, while a `detent` param is a KNOB you turn that clicks to integers. This is
  // drawn as a knob with a printed 0..4 scale, so it has no lamps to click — declared
  // `stepped` it rendered correctly and could not be turned at all. Same declaration as
  // the LPG's clock-ratio knob.
  params.push({
    id: `rpt${s}`, signal: 'trigger', name: `Repeat ${s}`, section: 'stage',
    curve: 'detent', min: 0, max: 4, default: RPT_DEFAULT, glideMs: 0,
  });
}

// --- module-wide controls ---------------------------------------------------
// The loop window: which stage the phrase starts on and which it ends on, each a
// one-of-eight selector shown as a column of lamps beside the stages.
//
// This replaced eight momentary marker buttons whose window was the lower and higher
// of the last two presses. Two independent selectors say plainly which end you are
// setting, and being ordinary stepped PARAMS rather than engine state they save and
// restore with the patch for free — the old marker history did not.
//
// END BEFORE START IS NOT AN ERROR: it runs the range backwards. Start 6 with end 2
// plays 6, 5, 4, 3, 2 and repeats. Start equal to end is a single repeating stage.
const stage1to8 = () => ({ curve: 'stepped', steps: [1, 2, 3, 4, 5, 6, 7, 8].map((v) => ({ value: v })) });
params.push({ id: 'start', name: 'Start stage', section: 'transport', ...stage1to8(), default: 1 });
params.push({ id: 'end', name: 'End stage', section: 'transport', ...stage1to8(), default: 8 });

params.push({ id: 'run', name: 'Run', section: 'transport', ...onoff(), default: 'off' });
// Reset or Preset: on hardware a solder jumper, here a panel toggle. Reset runs the
// sequencer while the input is low; Preset is the inverse.
params.push({ id: 'presetMode', name: 'Preset mode', section: 'transport', ...onoff(), default: 'off' });

// --- ports ------------------------------------------------------------------
// Module inputs.
ports.push({ id: 'clock', name: 'Clock', section: 'transport', domain: 'trigger', dir: 'in' });
ports.push({ id: 'reset', name: 'Reset', section: 'transport', domain: 'trigger', dir: 'in' });
ports.push({ id: 'updown', name: 'Up/Down', section: 'transport', domain: 'trigger', dir: 'in' });
ports.push({ id: 'hold', name: 'Hold', section: 'transport', domain: 'trigger', dir: 'in' });
// Per-stage select inputs — a pulse jumps the playhead to that stage.
for (const s of STAGES) ports.push({ id: `sel${s}`, name: `Select ${s}`, section: 'stage', domain: 'trigger', dir: 'in' });
// Module outputs.
ports.push({ id: 'outA', name: 'A', section: 'out', domain: 'control', dir: 'out' });
ports.push({ id: 'outB', name: 'B', section: 'out', domain: 'control', dir: 'out' });
ports.push({ id: 'outAB', name: 'A minus B', section: 'out', domain: 'control', dir: 'out', polarity: 'bipolar' });
ports.push({ id: 'allGate', name: 'All Gate', section: 'out', domain: 'trigger', dir: 'out' });
ports.push({ id: 'trig', name: 'Trigger', section: 'out', domain: 'trigger', dir: 'out' });
// Per-stage pulse outputs — fire when that stage becomes active, by any means.
for (const s of STAGES) ports.push({ id: `pulse${s}`, name: `Pulse ${s}`, section: 'stage', domain: 'trigger', dir: 'out' });

export default {
  id: 'programmer-8',
  apiVersion: 1,
  name: 'Sequencer / Programmer Eight',
  category: 'sequencing',   // module library grouping
  abbreviation: 'SQ8',
  hp: 16,
  stages: N,
  scope: 'shared',        // one playhead for the whole patch, not one per voice
  worklets: ['modules/programmer-8/programmer-8-processor.js'],
  ports,
  params,
};
