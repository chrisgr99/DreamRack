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

export default panel({ hp: 10 }, [
  band('NOTE', [
    row([jack('noteIn', 'note'), knob('poly', 'POLY', { size: 6.6, scale: COUNT })]),
  ]),
  // Its own band, so the word sits above the lamps at header size. Printed lamps rather than a list:
  // how many voices there are and what happens when they run out are settings you want to read from
  // across the room, not open a menu to find.
  band('ROLLOVER', [
    row([lamps('rollover', [['oldest', 'OLDEST'], ['quietest', 'QUIET'], ['ignore', 'IGNORE'],
      ['glide', 'GLIDE'], ['legato', 'LEGATO']]),
      // One knob for both: the pitch's travel time in GLIDE, the notes' overlap in LEGATO.
      knob('time', 'TIME', { size: 'small' })]),
  ]),
  band(null, [
    row([jack('levelOut', 'level'), jack('durOut', 'dur')]),
    // Bend sits beside pan, among the other modulation outputs: it is an orange control signal, not a
    // second pitch, and putting it on the rail beside the green v/oct would say the opposite.
    row([jack('panOut', 'pan'), jack('bendOut', 'bend')]),
  ]),
  outputs([jack('gateOut', 'gate'), jack('pitchOut', 'v/oct')]),
]);
