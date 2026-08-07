// panel.layout.js — the VCA faceplate, in the panel grammar.
//
// 6 HP, and most of it is the knob: a VCA is a knob with a voltage on it, so the knob gets the room
// and everything else is a jack. 5 HP was 0.6mm too narrow for the knob at this size, and a smaller
// knob on a module that is only a knob was the wrong economy.

'use strict';

import { panel, band, row, knack, jack, lamps, outputs } from '../../panel/grammar.js';

export default panel({ hp: 6 }, [
  band('VCA', [
    row([knack('level', 'LEVEL', 'levelCv', { depth: 'levelDepth', size: 'big' })]),
    row([lamps('response', [['lin', 'lin'], ['exp', 'exp']])]),
    row([jack('audioIn', 'in')]),
  ]),
  outputs([jack('out', 'out')]),
]);
