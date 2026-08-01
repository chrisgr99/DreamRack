// panel.layout.js — the Video Maths faceplate as data.
//
// 8 HP. A and B sit side by side at the top with a gain under each, because neither is the main
// input — that is the whole point of the module, and stacking them would imply an order that
// does not exist.
//
// The six operations are ONE vertical list, not two rows of three. A parameter can only have one
// control: two radio groups sharing an id would leave the second unclickable, because the panel
// loader takes the first and warns about the duplicate. Vertical also lets each operation carry
// its name rather than a symbol, and MEAN does not fit under a lamp.

'use strict';

const FACE_W = 42, FACE_H = 113.5912, FACE_LEFT = 3.9, FACE_TOP = 7.0994;

const items = [];
const ink = (x, y, text, opts = {}) => items.push({ t: 'label', x, y, text, opts });

items.push({ t: 'rect', x: 0, y: 0, w: FACE_W, h: FACE_H, rx: 2.5, fill: 'face' });
items.push({ t: 'rect', x: 0.5, y: 0.5, w: FACE_W - 1, h: FACE_H - 1, rx: 2.2, fill: 'none', stroke: 'frame', sw: 0.5 });

const LEFT = 12, RIGHT = 30, MID = 21;
const R = 5.6, CAP = 4.2;
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

// The two inputs, level with each other.
items.push({ t: 'vjack', id: 'aIn', x: LEFT, y: 13, opts: { r: 3.2 } });
ink(LEFT, 19.8, 'A', { size: 2.3 });
items.push({ t: 'vjack', id: 'bIn', x: RIGHT, y: 13, opts: { r: 3.2 } });
ink(RIGHT, 19.8, 'B', { size: 2.3 });

knack('gainA', LEFT, 33, 'GAIN', ['0', '2']);
knack('gainB', RIGHT, 33, 'GAIN', ['0', '2']);

// The operations, stacked. The order is not arbitrary: the two that MULTIPLY light against
// light come first, then the two that SELECT one input or the other, then the two that SUM —
// so moving down the list moves from the harshest combination to the gentlest.
ink(13, 52.5, 'OPERATION', { size: 1.9, anchor: 'start' });
items.push({ t: 'radio', id: 'op', x: 12, y: 75,
  opts: { orientation: 'v', spacing: 7.2, ledR: 1.9, outline: false, led: 'green', size: 1.8,
    steps: [{ value: 'mult', label: 'MULT' }, { value: 'diff', label: 'DIFF' },
      { value: 'add', label: 'ADD' }, { value: 'min', label: 'MIN' },
      { value: 'max', label: 'MAX' }, { value: 'mean', label: 'MEAN' }] } });

// AMOUNT beside the list rather than under it: at 0 the module passes A untouched, which is the
// setting you patch through before choosing anything, so it wants to be reachable without
// reading the list first.
knack('amount', 30, 70, 'AMT', ['A', 'full']);

items.push({ t: 'vjack', id: 'outImage', x: MID, y: 104, opts: { r: 3.2 } });
ink(MID, 110.8, 'OUT', { size: 1.9 });

export default { faceW: FACE_W, faceH: FACE_H, faceLeft: FACE_LEFT, faceTop: FACE_TOP, wrap: true, items };
