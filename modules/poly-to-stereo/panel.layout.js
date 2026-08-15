// panel.layout.js — the Poly to Stereo faceplate, in the panel grammar.
//
// BANDED, not freeform: this panel really is a stack of sections — what comes in, the two gains, the
// placing, what goes out — and each is a row or two of one control. That is exactly what bands are
// for. (The decision is taken here, when the module is created: see design/faceplate-system.md §5a.)
//
// THE MULTIPLICATION SIGN IS THE POINT OF THE LEVEL BAND. Two jacks with the same name and no sign
// between them would leave the user to guess whether they sum, and the guess would be wrong.

'use strict';

import { panel, band, row, knack, jack, caption, placed, outputs } from '../../panel/grammar.js';

export default panel({ hp: 8 }, [
  band('POLYPHONIC', [
    row([jack('audioIn', 'in')]),
  ]),
  // THE HEADER NAMES WHAT THEY ARE: two voltage-controlled amplifiers in series, which is what a
  // multiplied pair of gain stages is. "LEVEL" alone left the user to work that out.
  //
  // A and B rather than "vel" and "env": multiplication is symmetric, and printing one of them "env"
  // would say something false about the other — pressure, a second envelope or a plain LFO belongs in
  // either. The header carries the meaning and the sign carries the operation.
  //
  // PLACED rather than rowed, because the sign has to sit BETWEEN the two knobs at a spacing that
  // says "these two belong together", and rows spread to fill their band.
  band('DUAL VCA', [
    placed([
      // The names sit BESIDE the knobs — "LEVEL A" is too wide to go under a small knob without
      // crowding the sign below it — so the knobs move right to make room.
      { c: knack('levelA', 'LEVEL A', 'levelACv', { depth: 'levelADepth', size: 'small', side: 'left' }), x: 24, y: 6 },
      { c: caption('×', { size: 5.2, ring: true }), x: 24, y: 21 },
      { c: knack('levelB', 'LEVEL B', 'levelBCv', { depth: 'levelBDepth', size: 'small', side: 'left' }), x: 24, y: 36 },
    ], 44),
  ]),
  band('PAN', [
    row([knack('pan', 'PAN', 'panCv', { depth: 'panDepth', size: 'small' })]),
  ]),
  outputs([jack('outL', 'L'), jack('outR', 'R'), jack('outMono', 'mono')]),
]);
