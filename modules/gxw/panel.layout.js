// panel.layout.js — the GXW faceplate.
//
// A TWIN OF THE STRUDEL FACE, deliberately. The two modules do the same job on the rack — a source of
// parts feeding several voices, with a sound of its own on a stereo pair — and only one of them can be
// on a patch at a time. Making them look alike says that: swap one for the other and the jacks are
// where your hand already expects them.
//
// The differences are only where the modules genuinely differ. There is no tempo readout, because
// GXW's tempo lives in its own transport and it owns the clock when it is present, rather than reading
// one out of a pattern. In its place the face says what GXW is holding.
//
// NINE HP, like Strudel, for the same reason: the width is set by a row of four jacks with their names
// under them, and the panel is no wider than that needs.

'use strict';

import { panel, band, jack, button, caption, placed } from '../../panel/grammar.js';

const CX = 22.86;        // the centre line of a 9 HP face
// The four columns of the jack grid, and the two rows of it.
const COLS = [CX - 15, CX - 5, CX + 5, CX + 15];

export default panel({ hp: 9, pad: 1.2 }, [
  band(null, [
    placed([
      // THE TWO BUTTONS, in the same places Strudel's two sit. OPEN carries its own unlit colour — a
      // dark blue lens rather than the house grey — so the two are told apart by colour as well as by
      // legend, which matters on a face whose layout is deliberately the same as another's.
      { c: button('open', 'OPEN', { r: 5.4, labelSize: 5.4, off: '#24468a' }), x: CX, y: 14 },
      { c: button('run', 'RUN', { r: 5.4, labelSize: 5.4 }), x: CX, y: 35 },

      // WHAT IT IS, where Strudel reads out its tempo. GXW's transport is inside GXW and it is the
      // master clock when it is present, so there is no borrowed number to show here — and a readout
      // that only ever said the same thing would be furniture pretending to be an instrument.
      { c: caption('GEOMETRIC', { size: 2.6, italic: false }), x: CX, y: 53 },
      { c: caption('SEQUENCER', { size: 2.6, italic: false }), x: CX, y: 57.5 },

      // TEN JACKS, CENTRED, in Strudel's arrangement: two rows of four voice outs and the stereo pair
      // beneath them, symmetrical about the centre line, so the block reads as one group of outputs.
      ...[1, 2, 3, 4].map((n, i) => (
        { c: jack('noteOut' + n, 'V' + n, { labelSize: 2.8 }), x: COLS[i], y: 72 })),
      ...[5, 6, 7, 8].map((n, i) => (
        { c: jack('noteOut' + n, 'V' + n, { labelSize: 2.8 }), x: COLS[i], y: 85 })),

      // GXW'S OWN VOICES, as audio. L and R sit OUTSIDE the pair, left of one and right of the other,
      // so the two letters read as the ends of a stereo pair rather than as two more labels in the
      // column; the name of what they carry goes underneath, where it belongs to both.
      { c: jack('audioOutL', 'L', { side: 'left', labelSize: 3.0 }), x: CX - 5.5, y: 97 },
      { c: jack('audioOutR', 'R', { side: 'right', labelSize: 3.0 }), x: CX + 5.5, y: 97 },
      { c: caption('SUPERDOUGH', { size: 2.5, italic: false }), x: CX, y: 104 },
    ], 105),
  ]),
]);
