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

import { panel, band, row, jack, outputs } from '../../panel/grammar.js';

export default panel({ hp: 8 }, [
  band('NOTE', [
    row([jack('noteIn', 'note')]),
  ]),
  band(null, [
    row([jack('levelOut', 'level'), jack('durOut', 'dur')]),
    // Bend sits beside pan, among the other modulation outputs: it is an orange control signal, not a
    // second pitch, and putting it on the rail beside the green v/oct would say the opposite.
    row([jack('panOut', 'pan'), jack('bendOut', 'bend')]),
  ]),
  outputs([jack('gateOut', 'gate'), jack('pitchOut', 'v/oct')]),
]);
