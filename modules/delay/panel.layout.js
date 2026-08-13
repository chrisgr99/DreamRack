// panel.layout.js — the Delay faceplate, in the panel grammar.
//
// FOUR CONTROLS AND FOUR JACKS, in the order you ask the questions: what goes in and at what rate,
// how long, how much comes back, what it sounds like, how much of it you hear. Reading order is
// reaching order, which is the module set's second rule.
//
// TWO BANDS, not four rows in one. DELAY is what the line does — the time and how much returns to it
// — and TONE is what it sounds like on the way out. They are different questions and the rule between
// them says so. It also means the panel reads at a glance from across the room: the top half is the
// echo, the bottom half is the colour.
//
// THE INPUTS SHARE A ROW WITH TIME. A delay's audio input is not general furniture to be gathered
// into an input block; it is the thing being delayed, and the clock beside it is what decides the
// interval. Both belong with the knob that answers the same question.

'use strict';

import { panel, band, row, knack, jack, outputs } from '../../panel/grammar.js';

export default panel({ hp: 8, pad: 1.2 }, [
  band('DELAY', [
    // THE TWO INPUTS, THEN TIME. They flanked it at first, which reads beautifully and is three
    // millimetres wider than eight HP: a big knАck with its attenuverter is most of the panel on its
    // own. Above it they still sit with what they feed — audio in, where the signal arrives, and the
    // clock, which takes the time over when it is patched and leaves the knob choosing a ratio to it.
    row([jack('audioIn', 'in'), jack('clockIn', 'clk')]),
    row([knack('time', 'TIME', 'timeCv', { depth: 'timeDepth', size: 'big' })]),
    row([knack('feedback', 'FEEDBACK', 'feedbackCv', { depth: 'feedbackDepth', size: 'small' })]),
  ]),
  band('TONE', [
    // Both from the middle, and both about what you end up hearing rather than about the line itself,
    // so they share a row. SMALL, because two medium knАcks with the room their attenuverters need are
    // nine millimetres wider than eight HP — and a row each was taller than the panel. Only TIME is
    // hunted for by value; these two are set by ear and a small ring is enough to say where they are.
    row([knack('tone', 'TONE', 'toneCv', { depth: 'toneDepth', size: 'tiny' }),
      knack('mix', 'MIX', 'mixCv', { depth: 'mixDepth', size: 'tiny' })]),
  ]),
  outputs([jack('wetOut', 'wet'), jack('mixOut', 'mix')]),
]);
