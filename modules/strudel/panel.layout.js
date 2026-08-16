// panel.layout.js — the Strudel faceplate.
//
// SMALL ON PURPOSE. The pattern is the instrument and it lives in the editor window; the faceplate is
// the transport — run it, stop it, see that it is running, and take the notes away.

'use strict';

import { panel, band, row, jack, button, readout, outputs } from '../../panel/grammar.js';

export default panel({ hp: 8, pad: 1.4 }, [
  band('PATTERN', [
    // CODE opens the editor. PLAY evaluates what is in it and starts; STOP silences.
    row([button('edit', 'code')]),
    row([button('run', 'play')]),
  ]),
  // The tempo is set in the pattern, not on the panel, so the panel READS it. A live coder changes
  // cps in the code and should see the rack agree.
  band('CPS', [
    row([readout('cps', null, { chars: 4, value: '0.5' })]),
  ]),
  outputs([jack('noteOut', 'note')]),
]);
