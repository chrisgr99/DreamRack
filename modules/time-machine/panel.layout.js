// panel.layout.js — the Time faceplate as data.
//
// 8 HP. One column: what comes in, how far back to look, how much of the past to let through,
// how much of it against the present, and which reading to take.
//
// MODE is at the BOTTOM rather than the top, against the usual instinct. The three modes are not
// three settings of one control — they are three different instruments — and putting the choice
// last means the eye passes the knobs that shape it on the way down, which is the order you
// actually work in once the mode is chosen.
//
// The width is set by the MODE row with its captions and nothing else; the panel hugs it.

'use strict';

const FACE_W = 40, FACE_H = 113.5912, FACE_LEFT = 3.9, FACE_TOP = 7.0994;

const items = [];
const ink = (x, y, text, opts = {}) => items.push({ t: 'label', x, y, text, opts });

items.push({ t: 'rect', x: 0, y: 0, w: FACE_W, h: FACE_H, rx: 2.5, fill: 'face' });
items.push({ t: 'rect', x: 0.5, y: 0.5, w: FACE_W - 1, h: FACE_H - 1, rx: 2.2, fill: 'none', stroke: 'frame', sw: 0.5 });

const COL = 20;
const R = 6.0, CAP = 4.5;
const SC = { size: 1.4, tickLen: 0.7, tickGap: 0.45 };
const NAME_DROP = 3.8, NAME_SIZE = 1.9;
const TICK_R = R + SC.tickGap + SC.tickLen;
const END_DX = Math.sin(150 * Math.PI / 180) * TICK_R + 1.7;
const END_DY = -Math.cos(150 * Math.PI / 180) * TICK_R;
const knack = (id, x, y, label, ends) => {
  ink(x - END_DX, y + END_DY, ends[0], { size: SC.size, anchor: 'end' });
  ink(x + END_DX, y + END_DY, ends[1], { size: SC.size, anchor: 'start' });
  items.push({ t: 'knack', id, x, y,
    opts: { radius: R, cap: CAP, port: `${id}Cv`, depth: `${id}Depth`, av: 'off',
      scale: { ...SC, marks: [{ at: 0 }, { at: 1 }] } } });
  ink(x, y + R + NAME_DROP, label, { size: NAME_SIZE });
};

items.push({ t: 'vjack', id: 'imageIn', x: COL, y: 13, opts: { r: 3.2 } });
ink(COL, 19.6, 'IMAGE IN', { size: 1.9 });

// DEPTH reads in FRAMES, not seconds — the ring is 32 frames whatever the display is doing, and
// a figure that changes meaning with the frame rate would be a worse lie than an honest count.
knack('depth', COL, 32, 'DEPTH', ['now', '32']);
knack('spread', COL, 52, 'SPREAD', ['0', '1']);
knack('mix', COL, 72, 'MIX', ['dry', 'wet']);

ink(COL, 87, 'MODE', { size: 1.9 });
items.push({ t: 'radio', id: 'mode', x: COL, y: 92.5,
  opts: { orientation: 'h', spacing: 10, ledR: 1.8, outline: false, led: 'green', size: 1.7,
    steps: [{ value: 'delay', label: 'DLY' }, { value: 'trails', label: 'TRL' },
      { value: 'slit', label: 'SLIT' }] } });

// AXIS is only read in SLIT, so it sits small beside the OUT jack rather than taking a row.
ink(9, 102.6, 'AXIS', { size: 1.6 });
items.push({ t: 'radio', id: 'axis', x: 9, y: 107,
  opts: { orientation: 'h', spacing: 6, ledR: 1.6, outline: false, led: 'green', size: 1.6,
    steps: [{ value: 'y', label: 'Y' }, { value: 'x', label: 'X' }] } });

items.push({ t: 'vjack', id: 'imageOut', x: 30, y: 105, opts: { r: 3.0 } });
ink(30, 111, 'OUT', { size: 1.7 });

export default { faceW: FACE_W, faceH: FACE_H, faceLeft: FACE_LEFT, faceTop: FACE_TOP, wrap: true, items };
