// panel.layout.js — the Quad Function Generator faceplate as data.
//
// The theme-independent item list the shared renderer (panel/render.js) turns into
// panel.svg + panel.dark.svg.
//
// RESYNCED to the shipped faceplate, which had been hand-edited away from this file and could no
// longer be regenerated from it. The hand-edited panel had drifted in three ways, and all three are
// now expressed here rather than in the SVG:
//
//   - It was NARROWED from 99mm to 91 by hanging translate() offsets on the right-hand groups instead
//     of moving their coordinates. The columns below are the true positions those transforms produced.
//   - attack and decay had become knАcks, with the CV jack in the knob's centre; this file still had
//     them as plain knobs beside separate 'c.v. in' jack columns — the old four-column layout.
//   - It had no per-channel indicator lamps, which this file was still emitting.
//
// The knАcks are drawn by the canonical control now, so they differ from the hand-drawn ones in the
// one place the hand-drawing disagreed with it: the centre hole is the standard jack size rather than
// a proportionally-scaled one. That is the point of coming back into the system.

'use strict';

import { evenScale } from '../../panel/primitives.js';

const CH = ['A', 'B', 'C', 'D'];
// 95mm, UP FROM 91, to pay for the two attenuverter trims. The four millimetres are not spread
// evenly: nearly all of them go into the gap between attack and decay, which was the tightest place on
// the panel before anything was added — the two time scales had already been drawn with tightened
// gaps and smaller type to stop them running into each other. Attack's trim sits at four o'clock, so
// it lands squarely in that gap, and decay's lands in the gap before the output jacks.
//
//   cycle -> attack   15.0 -> 15.2      (+0.2, it was never the problem)
//   attack -> decay   18.0 -> 20.8      (+2.8, the trim needs 20.7 to clear decay's ".001")
//   decay -> out      14.0 -> 17.5      (+3.5: the CV-out JACK needs 16.9, but its label is wider
//                                        than the jack and needs the extra half)
//
// The left-hand columns move in a little to help pay for it; trig's jack still leaves 3mm to the
// panel rule, and the quadrature knob keeps the margin it had.
const FACE_W = 95, FACE_H = 113.5912, FACE_LEFT = 3.9, FACE_TOP = 7.0994;
const COL_TRIG = 9, COL_CYCLE = 17.5, COL_ATK = 32.7, COL_DEC = 53.5, COL_OUT = 71;
const DIVIDER_X = 77, Q_KNOB_X = 86.8;
const KNACK_R = 6.4;
// The trim's offset from its knАck's centre — four o'clock, at the distance that clears this knob's
// own calibration. Same rule the grammar applies for panels laid out by band and row; this panel
// places by hand, so the numbers are here.
const TRIM_DX = 10.28, TRIM_DY = 6.93;
// The mode lamps sit a millimetre right of the cycle jack above them rather than sharing its centre
// line. Their row is wider than the jack, so centring the two on each other left the lamps hanging
// further into the gap on the left than on the right.
const COL_MODE = COL_CYCLE + 1;
// Attack and decay stand 18mm apart with 6.4mm knobs, so a calibration drawn at the usual distance
// puts the two scales into each other. Kept OUTSIDE the rim, where a calibration belongs, but with the
// gaps and the type tightened until the neighbouring scales clear.
const SCALE = (marks) => ({ marks, size: 1.8, tickLen: 0.6, labelGap: 0.55 });
const Y_RULE = 9, ROW_Y = [21.5, 46.5, 71.5, 96.5], ROW_DIV = [34, 59, 84], Y_BOTTOM = 109;
const TIME_SCALE = ['.001', '.03', '.3', '10'];

const items = [];
const ink = (x, y, text, size) => items.push({ t: 'label', x, y, text, opts: { size } });
const line = (x1, y, x2) => items.push({ t: 'line', x1, y1: y, x2, y2: y, w: 0.355 });

// face + frame
items.push({ t: 'rect', x: 0, y: 0, w: FACE_W, h: FACE_H, rx: 2.5, fill: 'face' });
items.push({ t: 'rect', x: 0.5, y: 0.5, w: FACE_W - 1, h: FACE_H - 1, rx: 2.2, fill: 'none', stroke: 'frame', sw: 0.5 });

// interior grid (no top title)
line(3, Y_RULE, FACE_W - 3);
line(3, ROW_DIV[0], DIVIDER_X); line(3, ROW_DIV[1], FACE_W - 3); line(3, ROW_DIV[2], DIVIDER_X); line(3, Y_BOTTOM, FACE_W - 3);
items.push({ t: 'line', x1: DIVIDER_X, y1: Y_RULE, x2: DIVIDER_X, y2: Y_BOTTOM, w: 0.355 });

// channel rows
const MODE = [{ value: 'transient', glyph: 'transient' }, { value: 'sustained', glyph: 'sustained' }, { value: 'cyclic', glyph: 'cyclic' }];
for (let ci = 0; ci < CH.length; ci++) {
  const L = CH[ci], cy = ROW_Y[ci];
  ink(5.8, cy - 7.9, L, 5.3);   // the channel letter down the left edge
  items.push({ t: 'jack', id: `trig${L}`, x: COL_TRIG, y: cy - 5 });
  ink(COL_TRIG, cy + 1.2, 'trig', 2.1);
  items.push({ t: 'button', id: `trigBtn${L}`, x: COL_TRIG, y: cy + 6.5, opts: { r: 2.2, kind: 'white' } });
  items.push({ t: 'jack', id: `cycleIn${L}`, x: COL_CYCLE, y: cy - 5 });
  ink(COL_CYCLE, cy - 0.3, 'cycle', 2.0);
  items.push({ t: 'radio', id: `mode${L}`, x: COL_MODE, y: cy + 4, opts: { orientation: 'h', spacing: 4.2, ledR: 1.3, steps: MODE } });
  // Attack and decay are knАcks: the CV jack sits in the knob's centre, with an attenuverter, so the
  // separate 'c.v. in' columns this panel used to carry are gone.
  items.push({ t: 'knack', id: `attack${L}`, x: COL_ATK, y: cy - 1,
    opts: { radius: KNACK_R, port: `attackCv${L}`, scale: SCALE(evenScale(TIME_SCALE)) } });
  ink(COL_ATK, cy + 11, 'attack', 2.2);
  items.push({ t: 'trim', id: `attackDepth${L}`, x: +(COL_ATK + TRIM_DX).toFixed(2), y: +(cy - 1 + TRIM_DY).toFixed(2),
    opts: { centreMark: true, accentPort: `attackCv${L}` } });
  items.push({ t: 'knack', id: `decay${L}`, x: COL_DEC, y: cy - 1,
    opts: { radius: KNACK_R, port: `decayCv${L}`, scale: SCALE(evenScale(TIME_SCALE)) } });
  ink(COL_DEC, cy + 11, 'decay', 2.2);
  items.push({ t: 'trim', id: `decayDepth${L}`, x: +(COL_DEC + TRIM_DX).toFixed(2), y: +(cy - 1 + TRIM_DY).toFixed(2),
    opts: { centreMark: true, accentPort: `decayCv${L}` } });
  ink(COL_OUT, cy - 9, 'pulse out', 2.1);
  items.push({ t: 'jack', id: `pulse${L}`, x: COL_OUT, y: cy - 5 });
  items.push({ t: 'jack', id: `fn${L}`, x: COL_OUT, y: cy + 5 });
  ink(COL_OUT, cy + 9.7, 'CV out', 2.1);
}

// quadrature bands: A-B and C-D
function quadRegion(knobId, portId, enId, cy, nm) {
  const [up, dn] = nm.split('-');
  items.push({ t: 'label', x: Q_KNOB_X, y: cy - 18, text: 'QUAD- RATURE', opts: { size: 2.0, maxWidth: 9 } });
  items.push({ t: 'button', id: enId, x: Q_KNOB_X, y: cy - 9.25, opts: { r: 1.65, kind: 'red' } });
  ink(Q_KNOB_X, cy - 12, 'on', 1.9);
  // THE HOUSE SWEEP. This knob carried angleMin -215, angleMax 35: a 250-degree travel centred on
  // NINE O'CLOCK, so its ticks ran round the bottom, up the left and over the top with nothing on the
  // right, and — worse than the art — a parameter sitting at its 0.5 default pointed left instead of
  // up. It is a plain linear 0..1 like any other knob and there is nothing about it that wanted its
  // own geometry; the angles are a leftover from the hand-drawn faceplate this file was resynced
  // from, where the knob art had been rotated. Every other knob on the rack is symmetric about twelve.
  items.push({ t: 'knob', id: knobId, x: Q_KNOB_X, y: cy, opts: { radius: 6.4, ticks: 11 } });
  ink(Q_KNOB_X - 6.5, cy - 5.1, up, 2.6);
  ink(Q_KNOB_X - 6.5, cy + 6.9, dn, 2.6);
  ink(Q_KNOB_X, cy + 9.5, 'mix', 2.0);
  items.push({ t: 'jack', id: portId, x: Q_KNOB_X, y: cy + 15 });
  ink(Q_KNOB_X, cy + 20.5, `${nm} out`, 2.0);
}
quadRegion('quadTimeAB', 'quadOutAB', 'quadEnAB', 34, 'A-B');
quadRegion('quadTimeCD', 'quadOutCD', 'quadEnCD', 84, 'C-D');

export default { faceW: FACE_W, faceH: FACE_H, faceLeft: FACE_LEFT, faceTop: FACE_TOP, wrap: true, items };
