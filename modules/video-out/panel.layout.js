// panel.layout.js — the Video Output faceplate as data.
//
// Reading order is top to bottom and follows the signal: the image arrives, you look at it,
// you put it somewhere, you shape it, you choose how it is rendered.
//
// Two conventions this panel learned the hard way:
//   - A LABEL GOES BELOW ITS CONTROL, clear of the control's outermost tier. A knob's tick
//     marks reach radius + 0.5, so a label at radius + 3 sits on them.
//   - `radio`'s x is the CENTRE of the lamp run, not its first lamp. Treating it as the first
//     lamp marched every row leftwards across its own row label.
//
// The value captions under each switch are the radio group's OWN per-step labels, so they are
// positioned by the same code that positions the lamps and cannot drift out of step with them.
//
// The preview is NOT drawn here. The rack places a canvas at the descriptor's `preview` rect
// inside a foreignObject, so the SVG itself positions it; this layout only draws its well.

'use strict';

const FACE_W = 52, FACE_H = 113.5912, FACE_LEFT = 3.9, FACE_TOP = 7.0994;

const items = [];
const ink = (x, y, text, opts = {}) => items.push({ t: 'label', x, y, text, opts });
const rule = (y) => items.push({ t: 'line', x1: 3, y1: y, x2: FACE_W - 3, y2: y, w: 0.355 });

items.push({ t: 'rect', x: 0, y: 0, w: FACE_W, h: FACE_H, rx: 2.5, fill: 'face' });
items.push({ t: 'rect', x: 0.5, y: 0.5, w: FACE_W - 1, h: FACE_H - 1, rx: 2.2, fill: 'none', stroke: 'frame', sw: 0.5 });

// ---- the preview well. 16:9, so the thumbnail is not lying about the framing. ----
const PV = { x: 5, y: 12, w: 42, h: 23.63 };
const PVCX = PV.x + PV.w / 2;
ink(PVCX, 9.6, 'PREVIEW', { size: 2.1 });
items.push({ t: 'rect', x: PV.x - 0.7, y: PV.y - 0.7, w: PV.w + 1.4, h: PV.h + 1.4, rx: 1,
  fill: 'none', stroke: 'frame', sw: 0.45 });
rule(39.5);

// ---- the image in, and the two on/off lamps ----
// TEST is a single lamp rather than an off/on pair: it IS an on/off state, the same shape as
// WINDOW, and a pair of lamps with captions cost a whole row the panel does not have.
const Y_ROW1 = 47, LBL1 = Y_ROW1 + 6.6;
items.push({ t: 'vjack', id: 'imageIn', x: 12, y: Y_ROW1, opts: { r: 3.2 } });
ink(12, LBL1, 'IN', { size: 2.3 });
items.push({ t: 'button', id: 'window', x: 27, y: Y_ROW1, opts: { r: 3.0, kind: 'green' } });
ink(27, LBL1, 'WINDOW', { size: 2.0 });
items.push({ t: 'button', id: 'test', x: 42, y: Y_ROW1, opts: { r: 3.0, kind: 'green' } });
ink(42, LBL1, 'TEST', { size: 2.0 });
rule(58);

// ---- the two continuous controls ----
// BRIGHT is a knАck — the master fade, and the parameter most worth automating. LIMIT is a
// plain knob: set once, and it is there to stop feedback running away to a white frame.
const Y_KNOB = 70, R_BRIGHT = 7.9, R_LIMIT = 6.5;
const LBL2 = Y_KNOB + R_BRIGHT + 3.6;
items.push({ t: 'knack', id: 'bright', x: 15.5, y: Y_KNOB,
  opts: { radius: R_BRIGHT, cap: 5.7, port: 'brightCv', depth: 'brightDepth' } });
ink(15.5, LBL2, 'BRIGHT', { size: 2.3 });
items.push({ t: 'knob', id: 'limit', x: 38, y: Y_KNOB, opts: { radius: R_LIMIT, cap: 4.7 } });
ink(38, LBL2, 'LIMIT', { size: 2.3 });
rule(86);

// ---- the two rendering switches ----
// Switches, not knobs: each reallocates framebuffers, so neither may be swept.
const LAMP_CX = 31, LED_R = 2.0;              // 4 mm lamps
const row = (id, y, steps, spacing) => {
  items.push({ t: 'radio', id, x: LAMP_CX, y,
    opts: { orientation: 'h', spacing, ledR: LED_R, outline: false, led: 'green', size: 1.9, steps } });
};
ink(5, 93.2, 'RES', { size: 2.1, anchor: 'start' });
row('res', 92.4, [{ value: 'qtr', label: '¼' }, { value: 'half', label: '½' },
  { value: 'threeQ', label: '¾' }, { value: 'full', label: '1' }], 7);

ink(5, 105.2, 'FRAME', { size: 2.1, anchor: 'start' });
row('frame', 104.4, [{ value: '16:9', label: '16:9' }, { value: '1:1', label: '1:1' },
  { value: '9:16', label: '9:16' }], 10);

export default { faceW: FACE_W, faceH: FACE_H, faceLeft: FACE_LEFT, faceTop: FACE_TOP, wrap: true, items };
