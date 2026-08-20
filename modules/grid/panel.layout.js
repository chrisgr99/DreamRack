// panel.layout.js — the Grid faceplate as data.
//
// 8 HP, laid out like the rest of the video set: image in at the top, the controls under it, the
// picture out at the foot.
//
// COLUMNS AND ROWS SIT SIDE BY SIDE, level with each other, because they are the same kind of thing
// in the two directions — stacking one above the other would imply an order that does not exist.
// BRICK and GAP go below them: both are about the space BETWEEN cells rather than how many there
// are, and they are the two that turn a grid into a wall or a set of separate tiles.

'use strict';

const FACE_W = 42, FACE_H = 113.5912, FACE_LEFT = 3.9, FACE_TOP = 7.0994;   // 8 HP

const items = [];
const ink = (x, y, text, opts = {}) => items.push({ t: 'label', x, y, text, opts });

items.push({ t: 'rect', x: 0, y: 0, w: FACE_W, h: FACE_H, rx: 2.5, fill: 'face' });
items.push({ t: 'rect', x: 0.5, y: 0.5, w: FACE_W - 1, h: FACE_H - 1, rx: 2.2, fill: 'none', stroke: 'frame', sw: 0.5 });

const LEFT = 12, RIGHT = 30, MID = 21;
const R = 5.6, CAP = 4.2, PLAIN_R = 4.6;
const SC = { size: 1.4, tickLen: 0.7, tickGap: 0.45 };
const NAME_DROP = 3.8, NAME_SIZE = 1.9;
const TICK_R = R + SC.tickGap + SC.tickLen;
const END_DX = Math.sin(150 * Math.PI / 180) * TICK_R + 1.7;
const END_DY = -Math.cos(150 * Math.PI / 180) * TICK_R;
const knack = (id, x, y, label, ends) => {
  ink(x - END_DX, y + END_DY, ends[0], { size: SC.size, anchor: 'end' });
  ink(x + END_DX, y + END_DY, ends[1], { size: SC.size, anchor: 'start' });
  items.push({ t: 'knack', id, x, y,
    opts: { radius: R, cap: CAP, port: `${id}Cv`,
      scale: { ...SC, marks: [{ at: 0 }, { at: 1 }] } } });
  ink(x, y + R + NAME_DROP, label, { size: NAME_SIZE });
};
const knob = (id, x, y, label, ends) => {
  const tr = PLAIN_R + SC.tickGap + SC.tickLen;
  const dx = Math.sin(150 * Math.PI / 180) * tr + 1.5;
  const dy = -Math.cos(150 * Math.PI / 180) * tr;
  ink(x - dx, y + dy, ends[0], { size: SC.size, anchor: 'end' });
  ink(x + dx, y + dy, ends[1], { size: SC.size, anchor: 'start' });
  items.push({ t: 'knob', id, x, y, opts: { radius: PLAIN_R, scale: { ...SC, marks: [{ at: 0 }, { at: 1 }] } } });
  ink(x, y + PLAIN_R + NAME_DROP, label, { size: NAME_SIZE });
};

items.push({ t: 'vjack', id: 'imageIn', x: MID, y: 13, opts: { r: 3.2 } });
ink(MID, 19.8, 'IN', { size: 2.3 });

// How many, across and down.
knack('cols', LEFT, 36, 'COLS', ['1', '12']);
knack('rows', RIGHT, 36, 'ROWS', ['1', '12']);

// What lies between them.
knack('brick', LEFT, 62, 'BRICK', ['0', '1']);
knob('gap', RIGHT, 62, 'GAP', ['none', 'wide']);

// And how much the cells differ from one another.
knob('vary', MID, 85, 'VARY', ['same', 'mixed']);

items.push({ t: 'vjack', id: 'imageOut', x: MID, y: 104, opts: { r: 3.2 } });
ink(MID, 110.8, 'OUT', { size: 1.9 });

export default { faceW: FACE_W, faceH: FACE_H, faceLeft: FACE_LEFT, faceTop: FACE_TOP, wrap: true, items };
