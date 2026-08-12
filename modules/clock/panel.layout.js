// panel.layout.js — the drClckd faceplate, in the panel grammar.
//
// 14 HP, following Clocked's arrangement because that arrangement is right: the master across the top,
// then ONE ROW PER CLOCK, each row carrying everything that clock owns — its ratio, its readout, its
// swing, its pulse width, its delay. Three identical rows read left to right, and the output jacks run
// in the same order along the bottom. Nothing about clock 2 is anywhere except in the row that says 2.
//
// The alternative — grouping by CONTROL rather than by clock, all three swings together — is how a
// panel ends up with SWING 1, SWING 2 and SWING 3 as three separate labels, and it makes you read the
// number rather than the position. A row is the cheaper index.
//
// WHERE IT DEPARTS FROM THE ORIGINAL, and both departures are the same one. Clocked walks the BPM
// input's meaning through seven states with a `- MODE +` pair of buttons and a single yellow LED, and
// pages one display through four readings with four more buttons. Both are one display being rationed.
// Here the mode is a radio you can read, and every display shows one thing and keeps showing it.
//
// THE RATIOS AND DELAYS ARE READOUTS, NOT KNOBS. Each was a knob and a separate window saying what the
// knob meant — two controls to read one setting. A readout is both: the number is the control, you
// scroll it, and three knobs and three windows became three windows. That is what bought the room for
// PPQN, which until now had no place on the panel at all.
//
// The tempo window stays a DISPLAY rather than a readout, because it is not what you set: with a cable
// in the BPM input the tempo is the cable's, and the engine tells the panel what it actually is. Ink,
// not green — green here means the wheel does something.
//
// THE MODE RADIO IS VERTICAL, which is the house default: a list of named options reads down. Across
// is for a scale you sweep, which this is not.
//
// PACKED, not spread. Left to itself a row shares all its spare width out between its controls, which
// on a panel this dense pushes each display away from the knob it reports on and makes the module
// wider than its contents. Packing caps the gaps — three millimetres between knobs, two between jacks
// — and gives the width back: this began at 20 HP and holds the same controls in 14.

'use strict';

import { panel, band, row, knob, jack, button, lamps, display, readout, outputs, placed } from '../../panel/grammar.js';

// One clock's row: what it is, what it reads, and the three things that shape its pulse.
//
// ONLY THE FIRST ROW IS LABELLED. Three identical rows need their columns named once — repeating
// SWING, PW and DELAY under every row says nothing the position has not already said, and costs three
// millimetres a row, which is exactly what the third row had run out of.
const clockRow = (n) => row([
  readout('ratio' + n, n === 1 ? 'RATIO' : null, { chars: 3, value: '×1' }),
  knob('swing' + n, n === 1 ? 'SWING' : null, { size: 'tiny' }),
  knob('pw' + n, n === 1 ? 'PW' : null, { size: 'tiny' }),
  readout('delay' + n, n === 1 ? 'DELAY' : null, { chars: 4, value: '0' }),
]);

const LAYOUT = panel({ hp: 14, tight: true, pad: 1.2, pack: true }, [
  band('MASTER', [
    // The tempo and its readout, with the master's own swing and pulse width beside them: they shape
    // the beat everything else is measured against, so they belong with it rather than in the rows.
    // The tempo, its fine trim, and the number — then the master's own swing and pulse width, which
    // shape the beat everything else is measured against.
    row([knob('bpm', null, { size: 'small', trim: 'bpmFine' }), display('bpm', 14, 8),
      knob('swing', 'SWING', { size: 'small' }), knob('pw', 'PW', { size: 'small' })]),
  ]),
  band('TRANSPORT', [
    // Each button beside its own jack, then what the BPM input means and the jack it means it about.
    row([button('run', 'RUN'), jack('runIn', null), button('reset', 'RESET'), jack('resetIn', null),
      lamps('bpmMode', [['cv', 'CV'], ['clock', 'CLK']]), readout('ppqn', 'PPQN', { chars: 2, value: '4' }), jack('bpmIn', 'bpm')]),
  ]),
  band('CLOCKS', [clockRow(1), clockRow(2), clockRow(3)]),
  // The master first, then its three children in the order their rows sit above; the transport passing
  // through last and set apart, because it is a different kind of thing from a clock.
  outputs([jack('clkOut', 'CLK'), jack('clk1Out', '1'), jack('clk2Out', '2'), jack('clk3Out', '3'),
    jack('runOut', 'run'), jack('resetOut', 'rst'), jack('bpmOut', 'bpm')]),
]);

// A LAMP UNDER EACH DISPLAY, blinking at that clock's rate. Placed afterwards, from the display boxes
// themselves rather than from a second copy of their coordinates: a lamp belongs to the number above
// it, so it should be positioned by that number and move if the number ever moves.
//
// It costs no panel height. Each display is shorter than the row it sits in — the knobs beside it set
// that — so there is already clear space beneath, and the lamp goes in it.
const LAMP_GAP = 2.6;      // from the display's lower edge to the lamp's centre
for (const [id, param] of [['bpm', 'lamp'], ['ratio1', 'lamp1'], ['ratio2', 'lamp2'], ['ratio3', 'lamp3']]) {
  const box = LAYOUT.items.find((it) => it.t === 'raw' && String(it.svg).includes('data-wcoast-display="' + id + '"'));
  if (!box) continue;
  const m = String(box.svg);
  const x = +m.match(/data-x="([0-9.]+)"/)[1], y = +m.match(/data-y="([0-9.]+)"/)[1];
  const w = +m.match(/data-w="([0-9.]+)"/)[1], h = +m.match(/data-h="([0-9.]+)"/)[1];
  LAYOUT.items.push({ t: 'button', id: param, x: +(x + w / 2).toFixed(2), y: +(y + h + LAMP_GAP).toFixed(2),
    opts: { r: 1.15, kind: 'orange' } });
}

export default LAYOUT;
