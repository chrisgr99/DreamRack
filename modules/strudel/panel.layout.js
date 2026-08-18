// panel.layout.js — the Strudel faceplate.
//
// SMALL, AND WHAT IS ON IT IS BIG. The pattern is the instrument and it lives in the editor window; the
// faceplate is the transport, so its two buttons are the whole point of it and are drawn to be hit
// without looking. Below them, what it SHOWS: the tempo the pattern is running at, and a lamp for a
// pattern that will not evaluate.
//
// NINE HP. The transport is on one centre line — the buttons, the tempo, the lamp — and below them the
// eight voice outs in two rows of four, which is what set the width: a row of four jacks with their
// names under them, and no more panel than that needs.
//
// PLACED, NOT ROWED. A band spreads its rows to fill the height it is given, and this face wants
// explicit gaps: fifteen millimetres of air above the first button, then a fixed rhythm down to the
// jack.

'use strict';

import { panel, band, jack, button, readout, caption, placed } from '../../panel/grammar.js';

const CX = 22.86;        // the centre line of a 9 HP face
// The four columns of the jack grid, and the two rows of it.
const COLS = [CX - 15, CX - 5, CX + 5, CX + 15];

export default panel({ hp: 9, pad: 1.2 }, [
  band(null, [
    placed([
      // The two that matter, up at the top and close together — what the panel is for, and everything
      // below them is where the sound leaves. SCRIPT carries its own unlit colour, a dark red lens
      // rather than the house grey, and flashes full red as it is pressed.
      { c: button('edit', 'SCRIPT', { r: 5.4, labelSize: 5.4, off: '#8a2424' }), x: CX, y: 14 },
      { c: button('run', 'PLAY', { r: 5.4, labelSize: 5.4 }), x: CX, y: 35 },

      // The tempo is set in the pattern, not here, so this READS it — and turning it sets the running
      // pattern, which is the more useful direction while a piece plays. Its arrows and its wheel move
      // in tenths (see the descriptor's `step`).
      { c: readout('cps', 'CPS', { chars: 5, widest: '00.00', value: '0.50', size: 1.125, labelSize: 3.4 }), x: CX, y: 56 },

      // TEN JACKS, CENTRED. Two rows of four voice outs and the stereo pair beneath them, symmetrical
      // about the centre line, so the block reads as one group of outputs.
      ...[1, 2, 3, 4].map((n, i) => (
        { c: jack(n === 1 ? 'noteOut' : 'noteOut' + n, 'V' + n, { labelSize: 2.8 }), x: COLS[i], y: 72 })),
      ...[5, 6, 7, 8].map((n, i) => (
        { c: jack('noteOut' + n, 'V' + n, { labelSize: 2.8 }), x: COLS[i], y: 85 })),

      // STRUDEL'S OWN VOICES, as audio. L and R sit OUTSIDE the pair, left of one and right of the
      // other, so the two letters read as the ends of a stereo pair rather than as two more labels in
      // the column; the name of what they carry goes underneath, where it belongs to both.
      { c: jack('audioOutL', 'L', { side: 'left', labelSize: 3.0 }), x: CX - 5.5, y: 97 },
      { c: jack('audioOutR', 'R', { side: 'right', labelSize: 3.0 }), x: CX + 5.5, y: 97 },
      { c: caption('SUPERDOUGH', { size: 2.5, italic: false }), x: CX, y: 104 },
    ], 105),
  ]),
]);
