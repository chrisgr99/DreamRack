// panel.layout.js — the Voice In faceplate, in the panel grammar.
//
// FREEFORM, NOT BANDED. Everything here is placed at an explicit coordinate. This panel holds a knob,
// a column of lamps, a second knob and three rows of jacks that do not divide into stacked sections,
// and the banded version was being overridden into new positions one control at a time until the
// structure described nothing — a layout that is almost entirely overridden is a layout of the wrong
// shape. WHICH OF THE TWO A MODULE USES IS A DECISION TO TAKE WHEN IT IS CREATED, not one to
// discover later by fighting the grammar.
//
// The coordinates are the ones the panel editor arrived at, baked back in, so the overrides file is
// gone and this file is the truth again. They are measured from the BAND'S ORIGIN, which begins four
// millimetres below the top of the face — the rendered positions are those numbers plus four.
//
// NO RULES ACROSS THE FACE, for the same reason the Macro Oscillator has none: a rule explains a
// stack of bands, and there is no stack here to explain. They were also in the way of the jacks.

'use strict';

import { panel, band, knob, jack, lamps, placed } from '../../panel/grammar.js';

// The count printed round the knob, one to eight. A detented knob shows its position by where it
// points, which tells you it has moved; a gauge tells you WHAT IT SAYS, and how many voices a page is
// running is a number you want to read rather than infer. Plain strings: a scale entry that is an
// ARRAY is two printed lines, which is how the frequency knobs show hertz above a note name.
const COUNT = ['1', '2', '3', '4', '5', '6', '7', '8'];

export default panel({ hp: 12, pad: 1.2, rules: false }, [
  band(null, [
    placed([
      // ---- THE LEFT SIDE IS WHAT YOU SET: the note arrives, then how many voices play it, then what
      // gives when they run out, then how long that takes.
      { c: jack('noteIn', 'note'), x: 15, y: 12 },
      { c: knob('poly', 'POLY', { size: 6.6, scale: COUNT }), x: 15, y: 34 },
      { c: lamps('rollover', [['oldest', 'OLDEST'], ['quietest', 'QUIET'], ['ignore', 'IGNORE'],
        ['glide', 'GLIDE'], ['legato', 'LEGATO']], { spacing: 8.4 }), x: 12, y: 58 },
      { c: knob('time', 'TIME', { size: 'small' }), x: 15, y: 97 },

      // ---- THE RIGHT SIDE IS WHAT COMES OUT, in one column and in the order a patch is built: the
      // two you reach for first, then the pitch's movement, then the note's own values, then the two
      // that keep moving. The page's audio is NOT here — it leaves through a Poly to Stereo.
      //
      // EACH LABEL SITS BESIDE ITS JACK, not under it. Thirteen jacks in one column do not fit on a
      // 113.59 mm face while every label claims five millimetres of the gap below; put the words to
      // the left and the column's spacing is set by the jacks alone.
      { c: jack('gateOut', 'gate', { side: 'left' }), x: 50, y: 8.0 },
      { c: jack('pitchOut', 'v/oct', { side: 'left' }), x: 50, y: 19.6 },
      { c: jack('bendOut', 'bend', { side: 'left' }), x: 50, y: 31.2 },
      { c: jack('bendVOut', 'bend v', { side: 'left' }), x: 50, y: 42.8 },
      { c: jack('levelOut', 'level', { side: 'left' }), x: 50, y: 54.4 },
      { c: jack('durOut', 'dur', { side: 'left' }), x: 50, y: 66.0 },
      { c: jack('panOut', 'pan', { side: 'left' }), x: 50, y: 77.6 },
      { c: jack('pressureOut', 'press', { side: 'left' }), x: 50, y: 89.2 },
      { c: jack('timbreOut', 'timb', { side: 'left' }), x: 50, y: 100.8 },
    ], 112),
  ]),
]);
