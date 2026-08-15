// panel.layout.js — the Voice In faceplate, in the panel grammar.
//
// FREEFORM, NOT BANDED. Everything here is placed at an explicit coordinate. This panel holds a knob,
// a column of lamps, a second knob and a column of jacks that do not divide into stacked sections, and
// the banded version was being overridden into new positions one control at a time until the structure
// described nothing — a layout that is almost entirely overridden is a layout of the wrong shape.
// WHICH OF THE TWO A MODULE USES IS A DECISION TO TAKE WHEN IT IS CREATED, not one to discover later
// by fighting the grammar.
//
// The coordinates are measured from the BAND'S ORIGIN, which begins four millimetres below the top of
// the face — the rendered positions are those numbers plus four.
//
// NO RULES ACROSS THE FACE, for the same reason the Macro Oscillator has none: a rule explains a
// stack of bands, and there is no stack here to explain. They were also in the way of the jacks.
//
// NINE HP, DOWN FROM TWELVE. The module lost its audio jacks to Poly to Stereo and kept the width that
// had carried them: the settings need about 25mm and the output column about 20, so a strip of the old
// panel was empty down its middle.

'use strict';

import { panel, band, knob, jack, lamps, bracket, placed } from '../../panel/grammar.js';

// The count printed round the knob, one to eight. A detented knob shows its position by where it
// points, which tells you it has moved; a gauge tells you WHAT IT SAYS, and how many voices a page is
// running is a number you want to read rather than infer. Plain strings: a scale entry that is an
// ARRAY is two printed lines, which is how the frequency knobs show hertz above a note name.
const COUNT = ['1', '2', '3', '4', '5', '6', '7', '8'];

export default panel({ hp: 9, pad: 1.2, rules: false }, [
  band(null, [
    placed([
      // ---- THE LEFT SIDE IS WHAT YOU SET: the note arrives, then how many voices play it, then what
      // gives when they run out, then how long that takes.
      { c: jack('noteIn', 'note'), x: 11.5, y: 12 },
      // POLYPHONY, not POLY. The short name was there all along and could not be read: the lamps began
      // high enough that the first of their names sat on top of it, so the knob looked unlabelled. The
      // lamps have moved down twelve millimetres, which is what makes room for the word.
      { c: knob('poly', 'POLYPHONY', { size: 6.6, scale: COUNT }), x: 11.5, y: 34 },
      { c: lamps('rollover', [['oldest', 'OLDEST'], ['quietest', 'QUIETEST'], ['ignore', 'IGNORE\nNEWEST'],
        // A LAMP GROUP IS PLACED BY ITS CENTRE, not by its first lamp — five at 6.6mm apart span 26.4,
        // so the centre sits 13.2 below the top one. Reading that as "where OLDEST goes" is what put
        // the names back over the POLYPHONY label.
        ['glide', 'GLIDE'], ['legato', 'LEGATO']], { spacing: 7.6 }), x: 8.5, y: 67.2 },
      // TIME sits directly under the lamps now rather than twenty millimetres below them, because it
      // belongs to two of them and to nothing else.
      { c: knob('time', 'TIME', { size: 'small' }), x: 11.5, y: 92 },
      // THE BRACKET SAYS WHICH TWO. It encloses GLIDE, LEGATO and the TIME knob: the portamento time
      // and the crossfade are the only things TIME means, and under the other three rollovers it does
      // nothing at all. The knob greys out there — but greying tells you only after you have wondered,
      // and the face should say it before you touch anything.
      { c: bracket(29.5, { arm: 2.2 }), x: 3.3, y: 88.25 },

      // ---- THE RIGHT SIDE IS WHAT COMES OUT, in one column and in the order a patch is built: the
      // two you reach for first, then the pitch's movement, then the note's own values, then the two
      // that keep moving. The page's audio is NOT here — it leaves through a Poly to Stereo.
      //
      // EACH LABEL SITS BESIDE ITS JACK, not under it, which is what lets nine jacks share one column
      // without their names claiming the gaps between them.
      { c: jack('gateOut', 'gate', { side: 'left' }), x: 37.5, y: 8.0 },
      { c: jack('pitchOut', 'v/oct', { side: 'left' }), x: 37.5, y: 19.6 },
      { c: jack('bendOut', 'bend', { side: 'left' }), x: 37.5, y: 31.2 },
      { c: jack('bendVOut', 'bend v', { side: 'left' }), x: 37.5, y: 42.8 },
      { c: jack('levelOut', 'level', { side: 'left' }), x: 37.5, y: 54.4 },
      { c: jack('durOut', 'dur', { side: 'left' }), x: 37.5, y: 66.0 },
      { c: jack('panOut', 'pan', { side: 'left' }), x: 37.5, y: 77.6 },
      { c: jack('pressureOut', 'press', { side: 'left' }), x: 37.5, y: 89.2 },
      { c: jack('timbreOut', 'timb', { side: 'left' }), x: 37.5, y: 100.8 },
    ], 108),
  ]),
]);
