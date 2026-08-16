// panel.layout.js — the Chord Changes faceplate, in the panel grammar.
//
// BANDED, not freeform: this panel really is a stack of sections, and they are the order you use them
// in. What is loaded, and what of it plays. What key it is in. How the chords are played. Then the
// jacks. (The decision is taken here, when the module is created — design/faceplate-system.md §5a.)
//
// FOURTEEN HP, and the display decides it: a chord symbol has to be readable across a room, the bar
// and beat sit beside it, and the chord coming next sits beside that. Everything else fits around
// those three.

'use strict';

import { panel, band, row, knob, jack, button, lamps, readout, display, outputs } from '../../panel/grammar.js';

export default panel({ hp: 14, pad: 1.2 }, [
  // ---- WHAT IT IS DOING. The one thing you look at while it plays: the chord under the playhead,
  // with the bar and beat and what is coming. Filled by the host, so it can say "Dm7" or "ii7"
  // according to NOTATION without the faceplate knowing either.
  band(null, [
    row([display('now', 58, 11)]),
  ]),

  // ---- WHAT IS LOADED AND WHAT OF IT PLAYS.
  //
  // LOAD OPENS A FILE DIALOG FROM THE FACEPLATE, which is the only one in the rack — and it belongs
  // here rather than in the app's File menu, because the rack does not load chord charts, this module
  // does, into its own list, the way a sampler owns its samples.
  band('CHART', [
    // NOTATION sits with these because it is about what the DISPLAY says, not about the voicing — and
    // it is a button rather than a lamp pair: two states, one of them the default, so a lit button
    // saying ROMAN says everything a pair of lamps would in a tenth of the height.
    row([readout('tune', null, { chars: 8, value: 'untitled', menu: true }), button('load', 'load'),
      button('chart', 'chart'), button('notation', 'roman')]),
    // PLAY says what is selected — a section, a range of bars, the whole tune — and scrolling it steps
    // through the sections. The selection is MADE by pointing at the chart in the window: knowing a
    // tune has a section called B does not tell you what is in it.
    row([readout('play', null, { chars: 9, value: 'whole tune', menu: true }),
      knob('repeats', 'REPEATS', { size: 'small' })]),
  ]),

  // ---- WHAT KEY IT IS IN.
  // THE KEY IS A READOUT, NOT A KNOB. Twelve printed tonics round a dial cost twenty millimetres of
  // panel and say C♯ to someone reading a chart written in D♭; a readout says the key in the chart's
  // own spelling, in two characters, and opens the list when you scroll it — the same control the
  // clock uses for its tempo.
  band('KEY', [
    row([readout('key', 'KEY', { chars: 2, value: 'C', menu: true }),
      lamps('mode', [['major', 'MAJOR'], ['minor', 'MINOR']]),
      knob('transpose', 'TRANSP', { size: 'small' })]),
  ]),

  // ---- HOW THE CHORDS ARE PLAYED.
  // VOICING IN TWO COLUMNS. Four choices stacked in one column cost twenty-two millimetres of a panel
  // that has fifteen to spare; two by two costs twelve and reads the same.
  band('VOICE', [
    row([lamps('voicing', [['close', 'CLOSE'], ['spread', 'SPREAD'], ['drop2', 'DROP 2'], ['shell', 'SHELL']],
      { columns: 2, colGap: 8 }),
      knob('octave', 'OCT', { size: 'small' }),
      knob('length', 'LEN', { size: 'small' }),
      knob('accent', 'ACC', { size: 'small' })]),
  ]),

  // ---- THE JACKS. Clock, reset and run in; the chord out, and the three plain signals that let a
  // patch follow the harmony without understanding a note of it. No header on the inputs: three jacks
  // named clock, reset and run explain themselves, and the row above is already labelled.
  band(null, [
    row([jack('clockIn', 'clock'), jack('resetIn', 'reset'), jack('runIn', 'run')]),
  ]),
  outputs([jack('noteOut', 'note'), jack('rootOut', 'v/oct'), jack('chordTrig', 'chord'),
    jack('barTrig', 'bar')]),
]);
