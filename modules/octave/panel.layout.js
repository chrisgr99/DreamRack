// panel.layout.js — the Octave faceplate, in the panel grammar.
//
// 4 HP: a knob, an input and an output. No scale ring — at this width there is no room for one, and a
// detented knob shows its position by where it points.

'use strict';

import { panel, band, row, knob, jack, outputs } from '../../panel/grammar.js';

export default panel({ hp: 4 }, [
  band('OCT', [
    // No letter either: it is the only control on the panel and the header already names the module.
    row([knob('octave', null, { size: 'small' })]),
    row([jack('pitchIn', 'in')]),
  ]),
  outputs([jack('pitchOut', 'out')]),
]);
