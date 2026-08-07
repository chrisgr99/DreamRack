// panel.layout.js — the Sine Source faceplate, in the panel grammar.
//
// 5 HP. The smallest useful thing in the rack: one sine, one knob, one jack — and a 1V/oct input, so
// it can be played rather than only tuned. It exists as a known-good test signal, which is worth
// keeping now that the Oscillator is here to do the real work.
//
// Its previous panel was the artefact the panel editor was proved with: 8.7 HP for a single control,
// and the knob was labelled "knob".

'use strict';

import { panel, band, row, knob, jack, outputs } from '../../panel/grammar.js';

export default panel({ hp: 5 }, [
  band('SINE', [
    // A medium knob and no scale ring: at 5 HP the panel is 25.4mm across and a big knob with a scale
    // reaches 23.4mm before its margins, which is 7mm more than there is.
    row([knob('freq', 'FREQ', { size: 'medium' })]),
    row([jack('pitchIn', '1V/oct')]),
  ]),
  outputs([jack('out', 'out')]),
]);
