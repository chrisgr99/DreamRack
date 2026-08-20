// panel.layout.js — the Symmetry faceplate as data.
//
// 8 HP. Image in at the top, picture out at the foot, like the rest of the set.
//
// SECTORS SITS ALONE UNDER THE INPUT, because it is the control that decides what kind of figure you
// are looking at — two is a reflection, six is a snowflake, twelve is a rosette — and everything else
// on the panel adjusts a figure it has already chosen.
//
// ROTATE AND SPREAD are a pair: one turns what is folded, the other decides how much of the frame is
// folded at all. MODE and ZOOM go at the foot, being the two you set once and leave.

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

// What kind of figure.
knack('sectors', MID, 36, 'SECTORS', ['1', '16']);

// How it is folded.
knack('rotate', LEFT, 62, 'ROT', ['-1', '+1']);
knack('spread', RIGHT, 62, 'SPREAD', ['centre', 'all']);

// Set once and left.
ink(6.5, 80, 'FOLD', { size: 1.9, anchor: 'start' });
items.push({ t: 'radio', id: 'mode', x: 12, y: 87,
  opts: { orientation: 'v', spacing: 7.0, ledR: 1.9, outline: false, led: 'green', size: 1.8,
    steps: [{ value: 'mirror', label: 'MIRROR' }, { value: 'repeat', label: 'REPEAT' }] } });
knob('zoom', RIGHT, 87, 'ZOOM', ['in', 'out']);

items.push({ t: 'vjack', id: 'imageOut', x: MID, y: 104, opts: { r: 3.2 } });
ink(MID, 110.8, 'OUT', { size: 1.9 });

export default { faceW: FACE_W, faceH: FACE_H, faceLeft: FACE_LEFT, faceTop: FACE_TOP, wrap: true, items };
