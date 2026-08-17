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

import { panel, band, jack, button, lamps, readout, placed } from '../../panel/grammar.js';

const CX = 22.86;        // the centre line of a 9 HP face
// The four columns of the jack grid, and the two rows of it.
const COLS = [CX - 15, CX - 5, CX + 5, CX + 15];

export default panel({ hp: 9, pad: 1.2 }, [
  band(null, [
    placed([
      // The two that matter. STRUDEL carries its own unlit colour — a dark red lens rather than the
      // house grey — and flashes full red as it is pressed.
      { c: button('edit', 'STRUDEL', { r: 5.4, labelSize: 5.4, off: '#8a2424' }), x: CX, y: 17 },
      { c: button('run', 'PLAY', { r: 5.4, labelSize: 5.4 }), x: CX, y: 40 },

      // The tempo is set in the pattern, not here, so this READS it — and turning it sets the running
      // pattern, which is the more useful direction while a piece plays. Half again as tall as a
      // standard readout, because it is the only number on the module.
      { c: readout('cps', 'CPS', { chars: 5, widest: '00.00', value: '0.50', size: 1.5, labelSize: 5.4 }), x: CX, y: 60 },

      // Dark when all is well: "it is fine" needs no lamp of its own.
      { c: lamps('status', [['error', 'ERR']], { dir: 'h', labelSize: 2.8, labelDrop: 2 }), x: CX, y: 74 },

      // THE EIGHT VOICE OUTS, in two rows of four. Not in an output band: that band packs its jacks
      // along one rail from the left behind an OUT header, and eight jacks want a grid whose columns
      // line up with each other rather than a line that runs off the panel.
      //
      // NUMBERED, BECAUSE THE PATTERN IS. `.rack(3)` and V3 are the same thing said twice, once in the
      // code and once on the panel, and nothing in between needs translating.
      ...[1, 2, 3, 4].map((n, i) => (
        { c: jack(n === 1 ? 'noteOut' : 'noteOut' + n, 'V' + n, { labelSize: 2.8 }), x: COLS[i], y: 87 })),
      ...[5, 6, 7, 8].map((n, i) => (
        { c: jack('noteOut' + n, 'V' + n, { labelSize: 2.8 }), x: COLS[i], y: 98 })),
    ], 105),
  ]),
]);
