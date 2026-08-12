// panel.layout.js — the drClckd faceplate, in the panel grammar.
//
// CLOCKED'S OWN ARRANGEMENT, not a compression of it. See design/clocked-layout.md for the reading of
// the original this is built from and for every place it departs. In short:
//
//   THE MASTER IS A GRID, two rows. The upper row is the three inputs — reset, run, BPM — then the
//   tempo knob and the tempo display. The lower row is what each of those inputs also has as a panel
//   control, in the same column: a button under the reset jack, a button under the run jack, the mode
//   radio under the BPM jack. A column says "these are the same thing, by hand and by cable".
//
//   THE THREE CLOCK ROWS ARE IDENTICAL AND SELF-CONTAINED: ratio knob, ratio display, lamp, then that
//   clock's swing, pulse width and delay. Everything about clock 2 is in the row that says 2. The
//   labels repeat on all three rows, as they do on the original, so a row reads without counting down
//   from the top — which is what the fourteen-hp version could not afford and is most of why it did
//   not look like the module it is.
//
//   COLOUR CODES FUNCTION across every row: blue is time (tempo, ratios), orange is swing, green is
//   pulse width, purple is delay. You can find every swing on the panel without reading a word.
//
//   NO RULES BETWEEN THE BANDS. Colour and column do the grouping, exactly as they do on the original,
//   which draws no lines at all. The only rule is the one above the outputs, which is the rack's.
//
// FIFTEEN HP. It was sixteen, matching the original, and the three knobs the value lists replaced left
// a margin of empty face down each side — so it comes in by one HP, which is 2.54mm a side. A panel is
// authored in whole HP because that is what a rack counts in; 2.54 is the nearest the unit allows to
// the two millimetres the air actually measured.

'use strict';

import { panel, band, row, knob, jack, button, lamps, readout, outputs } from '../../panel/grammar.js';

// One clock's row. THE RATIO IS THE WINDOW, and nothing else. It was a knob and a window — the
// original's arrangement — but a knob is a poor way to reach one of sixty-nine values: it is sixty
// notches from ÷32 to ×32 and the number under your hand is never the one you want on the way. So the
// window lists them. Click it or scroll it and every ratio is one click away, which is what the knob
// beside it was there to approximate. Three knobs came off the panel with it.
//
// RATIO UNDER ALL THREE. Naming a column once is right when the rows below it are unlabelled too;
// here they carry SWING 2 and PW 2, so a single unnamed pair of windows read as an omission rather
// than as economy.
//
// THE ROW ENDS WITH WHAT IT MAKES. A clock's ratio, lamp, swing, pulse width and delay, and then its
// output jack — so a row is a whole clock from the setting to the socket, and the rail along the
// bottom is left to the transport, which is the one group that was never per-clock.
const KNOB_R = 5.7;   // the house 'tiny', three millimetres wider across
const clockRow = (n) => row([
  readout('ratio' + n, n === 1 ? 'RATIO' : null, { chars: 3, value: '×1', menu: true }),
  button('lamp' + n, null, { r: 1.15, kind: 'orange' }),
  knob('swing' + n, 'SWING ' + n, { size: KNOB_R, tint: 'orange' }),
  knob('pw' + n, 'PW ' + n, { size: KNOB_R, tint: 'green' }),
  knob('delay' + n, 'DELAY ' + n, { size: KNOB_R, tint: 'purple' }),
  jack('clk' + n + 'Out', 'CLK ' + n),
]);

const LAYOUT = panel({ hp: 15, pad: 1.2, pack: true }, [
  // ONE BAND, five rows, no rules — see above. A band per section would draw the lines the original
  // deliberately does not have.
  band(null, [
    // The inputs, then the tempo. Labels ABOVE, because these three name the column beneath them as
    // much as the jack they sit on.
    //
    // THE TEMPO IS THE WINDOW. There was a knob for it and a fine trim beside the knob, which between
    // them were two controls and a display for one number you can simply read — and neither could land
    // on a tempo without being watched. Scroll the window and every tempo from thirty to three hundred
    // stands over it a row apart. The lamp goes with the master's output jack, beside the
    // socket the pulses it is showing come out of. BPM is named underneath, at the size every other
    // label on the panel is set in — beside the number at digit size it was as loud as the tempo.
    row([jack('resetIn', 'RESET', { above: true }), jack('runIn', 'RUN', { above: true }),
      jack('bpmIn', 'BPM', { above: true }),
      readout('bpm', 'BPM', { chars: 3, value: '120', menu: true }),
      button('lamp', null, { r: 1.15, kind: 'orange' }),
      jack('clkOut', 'CLK')]),
    // Each button under its own jack; the BPM input's meaning under the BPM jack. Then ppqn — which
    // the original hides inside the mode paging and we put on the panel — and the master's own swing
    // and pulse width, in the colours their three children use.
    row([button('reset', 'RESET'), button('run', 'RUN'),
      lamps('bpmMode', [['cv', 'CV'], ['clock', 'CLK']], { dir: 'h' }),
      readout('ppqn', 'PPQN', { chars: 2, value: '4', menu: true }),
      knob('swing', 'SWING', { size: KNOB_R, tint: 'orange' }),
      knob('pw', 'PW', { size: KNOB_R, tint: 'green' })]),
    clockRow(1), clockRow(2), clockRow(3),
  ]),
  // WHAT PASSES THROUGH, and only that. The four clock outputs moved into the rows that set them, so
  // the rail is the transport: run, reset and the tempo, the three things you chain to the next module
  // rather than listen to.
  outputs([jack('runOut', 'run'), jack('resetOut', 'rst'), jack('bpmOut', 'bpm')], null),
]);

export default LAYOUT;
