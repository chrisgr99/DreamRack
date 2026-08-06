// panel.layout.js — the Noise faceplate, written in the panel grammar.
//
// Five outputs and nothing else, so the panel is one column, brightest at the top. The house pattern
// puts outputs in a row along the bottom; a module that is ONLY outputs is the exception, because a
// row of five on a narrow panel would either overlap or force the module three times wider than its
// contents deserve.
//
// Nothing here is positioned by hand — see panel/grammar.js. The whole faceplate is the list below.

'use strict';

import { panel, band, row, jack } from '../../panel/grammar.js';

export default panel({ hp: 5 }, [
  band('NOISE', [
    row([jack('violetOut', 'violet')]),
    row([jack('blueOut', 'blue')]),
    row([jack('whiteOut', 'white')]),
    row([jack('pinkOut', 'pink')]),
    row([jack('redOut', 'red')]),
  ]),
]);
