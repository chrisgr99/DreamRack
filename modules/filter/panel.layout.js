// panel.layout.js — the Filter faceplate, in the panel grammar.
//
// 8 HP. CUTOFF is the largest thing on the panel and sits alone with its own scale, because it is the
// control your hand goes to and the one most often under a cable. RESONANCE and DRIVE share the row
// beneath it. The slope lamps ride on the header line, where they cost no height.

'use strict';

import { panel, band, row, knack, jack, lamps, outputs } from '../../panel/grammar.js';

// NOT `tight`. The knob band was starved while 35 mm of panel sat empty between the input jack and
// the outputs: `tight` collects all the leftover height at the BOTTOM, which is right when one
// element is meant to fill the panel and wrong here, where three bands all want a little air. Let
// go of it and the rule above the input drops to where the space actually is, which is the room
// the cutoff knob's scale and its trim both needed.
// `pad` is tighter than the house default. The trim under CUTOFF costs about 11mm more height than
// the same trim in a knob's corner would — the label has to clear the scale first, and the trim has
// to clear the label — and on a 3U panel that height comes out of somewhere. It comes out of the
// band padding, which had the most to give.
export default panel({ hp: 8, pad: 1.2 }, [
  band('FILTER', [
    // CUTOFF is 'big', not 'large'. Measured honestly — numerals at the sides reach a whole half-width
    // past their ring, and the trim has to clear their corners — the largest knob plus its scale plus
    // its trim came to 0.95mm more than 8 HP has. One house size down buys 2mm and costs 1mm of
    // radius. The alternative is a 10 HP filter, which is a bigger decision than a knob size.
    row([knack('cutoff', 'CUTOFF', 'cutoffCv', { depth: 'cutoffDepth', size: 'big',
      scale: ['20', '100', '400', '2k', '8k', '20k'] })]),
    row([knack('resonance', 'RES', 'resCv', { size: 'medium' }),
         knack('drive', 'DRIVE', 'driveCv', { size: 'medium' })]),
    row([lamps('poles', [['2', '12dB'], ['4', '24dB']])]),
  ]),
  band(null, [row([jack('audioIn', 'in')])]),
  outputs([jack('lowOut', 'low'), jack('bandOut', 'band'), jack('highOut', 'high')]),
]);
