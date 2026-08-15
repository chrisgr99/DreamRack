// panel.layout.js — the Voice faceplate, in the panel grammar.
//
// The note arrives at the top and comes apart below it, which is the direction the signal runs and
// the order the parts are wanted in: level, duration and pan across the middle, and the two almost
// every patch starts with — the gate and the pitch — on the output rail at the foot.
//
// THE OUT RAIL TAKES TWO OF THE FIVE. It is one pinned row by definition (see panel/grammar.js), and
// five jacks will not fit across 8 HP. Gate and 1V/oct are the pair that belong there: they are what
// a voice is patched from first, and the rail is where a hand goes looking.

'use strict';

import { panel, band, row, knob, jack, lamps, outputs } from '../../panel/grammar.js';

// The count printed round the knob, one to eight. A detented knob shows its position by where it
// points, which tells you it has moved; a gauge tells you WHAT IT SAYS, and how many voices a page is
// running is a number you want to read rather than infer.
// Plain strings: a scale entry that is an ARRAY is two printed lines, which is how the frequency
// knobs show hertz above a note name. A count wants one line.
const COUNT = ['1', '2', '3', '4', '5', '6', '7', '8'];

export default panel({ hp: 12 }, [
  band('NOTE', [
    row([jack('noteIn', 'note'), knob('poly', 'POLY', { size: 6.6, scale: COUNT })]),
  ]),
  // Its own band, so the word sits above the lamps at header size. Printed lamps rather than a list:
  // how many voices there are and what happens when they run out are settings you want to read from
  // across the room, not open a menu to find.
  band('ROLLOVER', [
    // TWO COLUMNS. Five lamps in a single column is 26mm of panel, which pushed the audio band clean
    // off the bottom of the face — where its jacks were still drawn, and cables ran down to them
    // through empty rack. The gap between the columns is 8mm: at 13 the block was wider than the
    // panel and hung over its left border.
    row([lamps('rollover', [['oldest', 'OLDEST'], ['quietest', 'QUIET'], ['ignore', 'IGNORE'],
      ['glide', 'GLIDE'], ['legato', 'LEGATO']], { columns: 2, colGap: 8 }),
      // One knob for both: the pitch's travel time in GLIDE, the notes' overlap in LEGATO.
      knob('time', 'TIME', { size: 'small' })]),
  ]),
  // ONE ROW OF FOUR, not two of two: the second row was ten millimetres this panel does not have, and
  // it pushed the audio band's labels off the bottom of the face. Bend sits among these rather than on
  // the out rail because it is an orange control signal, not a second pitch.
  band(null, [
    row([jack('levelOut', 'level'), jack('durOut', 'dur'), jack('panOut', 'pan'), jack('bendOut', 'bend')]),
  ]),
  band('AUDIO', [
    row([jack('audioIn', 'in'), jack('audioL', 'L'), jack('audioR', 'R')]),
  ]),
  outputs([jack('gateOut', 'gate'), jack('pitchOut', 'v/oct')]),
]);
