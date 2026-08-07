// panel.layout.js — the Filter faceplate, in the panel grammar.
//
// 8 HP. CUTOFF is the largest thing on the panel and sits alone with its own scale, because it is the
// control your hand goes to and the one most often under a cable. RESONANCE and DRIVE share the row
// beneath it. The slope lamps ride on the header line, where they cost no height.

'use strict';

import { panel, band, row, knack, jack, lamps, outputs } from '../../panel/grammar.js';

export default panel({ hp: 8, tight: true, pad: 2.2 }, [
  band('FILTER', [
    row([knack('cutoff', 'CUTOFF', 'cutoffCv', { depth: 'cutoffDepth', size: 'large',
      scale: ['20', '100', '400', '2k', '8k', '20k'] })]),
    row([knack('resonance', 'RES', 'resCv', { depth: 'resDepth', size: 'medium' }),
         knack('drive', 'DRIVE', 'driveCv', { depth: 'driveDepth', size: 'medium' })]),
    row([lamps('poles', [['2', '12dB'], ['4', '24dB']])]),
  ]),
  band(null, [row([jack('audioIn', 'in')])]),
  outputs([jack('lowOut', 'low'), jack('bandOut', 'band'), jack('highOut', 'high')]),
]);
