// panel.layout.js — the Sequencer faceplate, in the panel grammar.
//
// Read down the panel: the three things a note carries besides its pitch are set by knob, each with
// its own jack under it in the same column, so a column says "this value, by hand or by cable". Then
// the two that are only ever cables — the gate and the pitch — and then the note itself leaving.
//
// THE GATE AND THE PITCH SIT TOGETHER, above the outputs rather than in the columns, because neither
// has a knob and putting them in a column would leave two gaps that read as missing controls.

'use strict';

import { panel, band, row, knob, jack, lamps, outputs } from '../../panel/grammar.js';

export default panel({ hp: 8 }, [
  band('NOTE', [
    row([knob('level', 'LEVEL', { size: 'small' }), knob('duration', 'DUR', { size: 'small' })]),
    row([jack('levelIn', 'level'), jack('durIn', 'dur')]),
    row([knob('pan', 'PAN', { size: 'small' }), knob('bendRange', 'BEND', { size: 'small' })]),
    row([jack('panIn', 'pan')]),
    // WHAT ENDS A NOTE, and it has to be on the panel: nothing else can say whether a step's length
    // is the gate's or the duration's, and only HOLD lets notes overlap at all.
    // Spaced at 8mm rather than the house 5.6: the two labels are 5.7mm wide and were touching.
    row([lamps('ends', [['gate', 'GATE'], ['hold', 'HOLD']], { dir: 'h', spacing: 8 })]),
    row([jack('gateIn', 'gate'), jack('pitchIn', 'v/oct')]),
  ]),
  outputs([jack('noteOut', 'note')]),
]);
