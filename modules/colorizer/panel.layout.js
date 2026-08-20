// panel.layout.js — the Colorizer faceplate as data.
//
// 8 HP, laid out like Video Maths and the Compositor so the video set reads as one set: the image
// enters at the top, the knobs that shape it sit under it, the list of what it can become runs down
// the left, and the picture leaves at the bottom.
//
// ONE INPUT, so it is centred rather than pushed to a side. Where Maths and the Compositor put two
// jacks level with each other to say neither is the main one, this module has nothing to be
// symmetrical about, and a lone jack in the left column would read as half a pair.
//
// THE PALETTES ARE ONE VERTICAL LIST for the reason the other two lists are: a parameter can carry
// only one control, so two columns would need two radio groups sharing an id and the second would be
// dead. Five names also fit in one column, which eight blend modes did not.

'use strict';

const FACE_W = 42, FACE_H = 113.5912, FACE_LEFT = 3.9, FACE_TOP = 7.0994;   // 8 HP

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
    opts: { radius: R, cap: CAP, port: `${id}Cv`,
      scale: { ...SC, marks: [{ at: 0 }, { at: 1 }] } } });
  ink(x, y + R + NAME_DROP, label, { size: NAME_SIZE });
};

// The image, alone at the top.
items.push({ t: 'vjack', id: 'imageIn', x: MID, y: 13, opts: { r: 3.2 } });
ink(MID, 19.8, 'IN', { size: 2.3 });

// SPREAD and SHIFT together, because they are one gesture in two knobs: stretch what the image
// covers, then slide it. Reaching for one without the other almost never gives what you want.
knack('spread', LEFT, 33, 'SPREAD', ['0', '4']);
knack('shift', RIGHT, 33, 'SHIFT', ['-1', '+1']);

// The palettes, warm first, then cold, then the two that use every hue, then the one that has
// edges. Reading down the list is reading from the most photographic to the most graphic.
ink(6.5, 52.5, 'PALETTE', { size: 1.9, anchor: 'start' });
items.push({ t: 'radio', id: 'palette', x: 12, y: 72,
  opts: { orientation: 'v', spacing: 7.2, ledR: 1.9, outline: false, led: 'green', size: 1.8,
    steps: [{ value: 'heat', label: 'HEAT' }, { value: 'ice', label: 'ICE' },
      { value: 'spectrum', label: 'SPEC' }, { value: 'duo', label: 'DUO' },
      { value: 'steps', label: 'STEPS' }] } });

// CYCLE beside the list rather than under it, the way AMOUNT sits beside the operations on Video
// Maths: it applies to whichever palette is chosen, so it belongs level with the whole column
// rather than at the end of it.
knack('cycle', RIGHT, 70, 'CYCLE', ['0', '1']);

items.push({ t: 'vjack', id: 'imageOut', x: MID, y: 104, opts: { r: 3.2 } });
ink(MID, 110.8, 'OUT', { size: 1.9 });

export default { faceW: FACE_W, faceH: FACE_H, faceLeft: FACE_LEFT, faceTop: FACE_TOP, wrap: true, items };
