// panel.layout.js — the ADSR faceplate, in the panel grammar.
//
// 10 HP. The graph sits at the top, because it is what you look at while your hand is on a knob and
// it explains the four knobs better than their labels do.
//
// THE FOUR KNOBS ARE AN ARRANGEMENT, NOT A ROW. They read as a rise and a fall, and in the order the
// envelope actually runs: A low at the left edge, D up and in from it, S across the centre from D,
// R low at the right edge. Rise, plateau, fall — the shape of the layout says the same thing the
// graph above it says.
//
// SINGLE LETTERS ON THE RIM, not words underneath. Each letter sits at a clock position that carries
// the arc through the knob itself: A at 11, D at 10, S at 2, R at 1. Four words underneath would say no
// more than four letters do and would cost 8.6mm of panel height — which is the whole of the room
// the graph needed.
//
// PACKED TIGHT, and the graph takes whatever height the rest leaves. On a panel where one element is
// always better bigger, sharing the leftover height out evenly just puts a gap above and below
// everything — which is what it did, and why the graph was half the size it could be.

'use strict';

import { panel, band, row, placed, knack, jack, button, display, outputs } from '../../panel/grammar.js';

const R = 8.5;                    // 'big'
const MID = 25.4;                 // half of 10 HP
const EDGE = 10.5;                // attack and release near the edges; fixed, so the knobs stay put
                                  // whatever size they are
const SPREAD = 10;                // the top pair, 20mm apart — 3mm of air between them
// TOP leaves room for the knob's own radius AND the label above it. Placed at the band's edge both
// hang outside the band and land on whatever is above, which is how the first version put SUSTAIN
// and RELEASE inside the graph.
//
// 20mm between the rows. The pairs are offset 3.9mm horizontally, so the diagonal centre distance is
// 20.4 against the 19 that two radii need — 1.4mm of air, and any less and they touch.
// Fixed rather than derived from R, so changing the knob size does not move the arrangement.
// With letters on the rim instead of labels underneath, TOP need only clear the letter.
const TOP = 10.8, BOT = 30.8;

export default panel({ hp: 10, tight: true, pad: 1.4 }, [
  band('ADSR', [
    row([display('env', 40.4, 'fill')]),   // 41.8 before: the last millimetre and a half of it ran
                                          // under the corner the poly lamp is drawn in.
  ]),
  band(null, [
    placed([
      { c: knack('decay', null, 'decayCv', { size: 'big', letter: 'D', at: 10 }), x: MID - SPREAD, y: TOP },
      { c: knack('sustain', null, 'sustainCv', { size: 'big', letter: 'S', at: 2 }), x: MID + SPREAD, y: TOP },
      { c: knack('attack', null, 'attackCv', { size: 'big', letter: 'A', at: 11 }), x: EDGE, y: BOT },
      { c: knack('release', null, 'releaseCv', { size: 'big', letter: 'R', at: 1 }), x: 50.8 - EDGE, y: BOT },
    ], BOT + R + 2.6),
  ]),
  // No header on this row: PUSH, gate and retrig say what they are, and a header costs 5.4mm of
  // height that the graph wants more.
  band(null, [
    row([button('gateBtn', 'PUSH'), jack('gateIn', 'gate'), jack('retrigIn', 'retrig')]),
  ]),
  // The outputs carry a larger label than the default: they are what you read most often on this
  // panel and at the jack default they were the hardest thing on it to make out.
  outputs([jack('envOut', 'env', { labelSize: 2.2 }), jack('invOut', 'inv', { labelSize: 2.2 }),
           jack('eocOut', 'eoc', { labelSize: 2.2 })]),
]);
