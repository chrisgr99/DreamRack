// panel.layout.js — the Macro Oscillator 2 faceplate, in the panel grammar.
//
// LAID OUT FROM CHRIS'S OWN ARRANGEMENT, made symmetrical. The shape he placed: frequency and the
// model as a pair across the top, MORPH alone on the centre line, HARMONICS and TIMBRE below it, and
// the strike along the foot. Everything that came in pairs now sits at equal distances from the
// panel's centre line, and every attenuverter is left where the grammar puts it — the same corner of
// every knob — rather than positioned one at a time.
//
// THE FREQUENCY KNOB CARRIES THE COMPLEX OSCILLATOR'S GAUGE: A1 to A9 printed around it, eight
// octaves of A. Two frequency knobs on one rack should be read the same way, and a scale ring is what
// turns a knob you sweep by ear into one you can set to a note.
//
// NO RULES ACROSS THE FACE. Every other module here is a stack of bands and the lines explain the
// stack. This one is a shape, and a line through it cuts the shape rather than describing it.
//
// EVERY CONTINUOUS CONTROL IS A knАck — the jack in the middle of the knob it feeds, the attenuverter
// beside it. On this module the trims say something extra: unpatched, the internal envelope drives
// that parameter instead, scaled by the trim, so a struck note can open, brighten or bend on its own.

'use strict';

import { panel, band, knob, knack, jack, readout, placed } from '../../panel/grammar.js';

// The gauge the complex oscillator uses, so the two read alike: the frequency and the note it is.
const HZ = [['27.5', 'A1'], ['55', 'A2'], ['110', 'A3'], ['220', 'A4'], ['440', 'A5'],
  ['880', 'A6'], ['1760', 'A7'], ['3520', 'A8'], ['7040', 'A9']];

const MID = 38.1;    // the panel's centre line, at 15 HP

export default panel({ hp: 15, pad: 1.2, rules: false }, [
  band(null, [
    placed([
      // ---- the pair across the top, equidistant from the centre line
      { c: knack('freq', 'FREQ', 'fmCv', { depth: 'fmDepth', size: 11.0, scale: HZ }), x: MID - 17.66, y: 28.1 },
      { c: readout('model', 'MODEL', { widest: 'particle', value: 'string', menu: true, pad: 1.0, size: 2.0, side: 'above', labelSize: 5 }), x: MID + 18.28, y: 22 },
      { c: jack('modelCv', 'cv'), x: MID + 18.28, y: 35 },
      // Pitch under the frequency knob, clear of its printed scale.
      { c: jack('pitchIn', 'v/oct'), x: 7.81, y: 42.93 },

      // ---- MORPH on the centre line, HARMONICS and TIMBRE mirrored below it
      { c: knack('morph', 'MORPH', 'morphCv', { depth: 'morphDepth', size: 8.0 }), x: MID, y: 55 },
      { c: knack('harmonics', 'HARM', 'harmonicsCv', { depth: 'harmonicsDepth', size: 8.0 }), x: MID - 19.69, y: 76 },
      { c: knack('timbre', 'TIMBRE', 'timbreCv', { depth: 'timbreDepth', size: 8.0 }), x: MID + 19.69, y: 76 },

      // ---- the strike along the foot, in the order it happens
      { c: knob('decay', 'DECAY', { size: 5.0 }), x: 11.25, y: 98 },
      { c: knob('colour', 'COLOUR', { size: 5.0 }), x: 27.19, y: 98 },
      { c: jack('trigIn', 'trig'), x: 41.25, y: 98 },
      { c: jack('levelIn', 'level'), x: 51.56, y: 98 },
      { c: jack('out', 'out', { labelSize: 2.1 }), x: 61.88, y: 98 },
      { c: jack('auxOut', 'aux', { labelSize: 2.1 }), x: 69.84, y: 98 },
    ], 112),
  ]),
]);
