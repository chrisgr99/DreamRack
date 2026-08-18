// panel.layout.js — the Load faceplate.
//
// THREE HP, which is the narrowest a panel gets here, and everything is stacked on its centre line:
// two numbers and a lamp. A meter earns its place by being permanently on the rack, and it can only be
// permanent if it takes almost no width.

'use strict';

import { panel, band, placed, readout, lamps } from '../../panel/grammar.js';

const CX = 7.62;         // the centre line of a 3 HP face

export default panel({ hp: 3, pad: 1.0 }, [
  band(null, [
    placed([
      // The average first and biggest: it is the one you watch. Percent of ONE CORE, which is the
      // ceiling that matters — the audio thread cannot use a second one.
      { c: readout('load', 'LOAD', { chars: 3, widest: '000', value: '0', size: 1.4, labelSize: 3.0, readOnly: true }), x: CX, y: 21 },
      // And the worst block in the window under it, because that is what breaks first.
      { c: readout('peak', 'PEAK', { chars: 3, widest: '000', value: '0', size: 1.0, labelSize: 2.6, readOnly: true }), x: CX, y: 45 },
      // Dark until something actually dropped. GLITCH rather than DROP or the pro-audio XRUN: it names
      // what you HEARD — a block that missed its deadline is a click or a gap in the sound — and needs
      // no explanation the first time someone sees it lit.
      { c: lamps('under', [['on', 'GLITCH']], { dir: 'h', labelSize: 2.4, labelDrop: 2 }), x: CX, y: 64 },
      // THE DRAWING, WHICH IS THE OTHER HALF OF KEEPING UP — and its name in two lines, because at
      // 3 HP the panel is 15.2mm across and FRAME RATE on one line is wider than the module.
      { c: readout('fps', 'FRAME\nRATE', { chars: 3, widest: '000', value: '0', size: 1.0, labelSize: 2.6, readOnly: true }), x: CX, y: 86 },
    ], 105),
  ]),
]);
