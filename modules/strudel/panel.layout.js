// panel.layout.js — the Strudel faceplate.
//
// SMALL, AND WHAT IS ON IT IS BIG. The pattern is the instrument and it lives in the editor window; the
// faceplate is the transport, so its two buttons are the whole point of it and are drawn to be hit
// without looking. Below them, what it SHOWS: the tempo the pattern is running at, and a lamp for a
// pattern that will not evaluate.
//
// SEVEN HP. Everything is on one centre line — the buttons, the tempo, the lamp, the cable out — so
// the panel needs only the width of its widest word rather than the width of a column layout.
//
// PLACED, NOT ROWED. A band spreads its rows to fill the height it is given, and this face wants
// explicit gaps: fifteen millimetres of air above the first button, then a fixed rhythm down to the
// jack.

'use strict';

import { panel, band, jack, button, lamps, readout, placed } from '../../panel/grammar.js';

const CX = 17.78;        // the centre line of a 7 HP face

export default panel({ hp: 7, pad: 1.2 }, [
  band(null, [
    placed([
      // The two that matter. STRUDEL carries its own unlit colour — a dark red lens rather than the
      // house grey — and flashes full red as it is pressed.
      { c: button('edit', 'STRUDEL', { r: 5.4, labelSize: 5.4, off: '#8a2424' }), x: CX, y: 17 },
      { c: button('run', 'PLAY', { r: 5.4, labelSize: 5.4 }), x: CX, y: 40 },

      // The tempo is set in the pattern, not here, so this READS it — and turning it sets the running
      // pattern, which is the more useful direction while a piece plays. Half again as tall as a
      // standard readout, because it is the only number on the module.
      { c: readout('cps', 'CPS', { chars: 5, widest: '00.00', value: '0.50', size: 1.5, labelSize: 5.4 }), x: CX, y: 62 },

      // Dark when all is well: "it is fine" needs no lamp of its own.
      { c: lamps('status', [['error', 'ERR']], { dir: 'h', labelSize: 2.8, labelDrop: 2 }), x: CX, y: 78 },

      // THE CABLE OUT, ON THE SAME CENTRE LINE. Not in an output band: that band packs its jacks from
      // the left behind an OUT header, and with a single jack whose own label says what it is, both
      // the header and the packing only push it off the line everything else sits on.
      { c: jack('noteOut', 'note', { labelSize: 3.8 }), x: CX, y: 97 },
    ], 105),
  ]),
]);
