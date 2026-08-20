// panel.layout.js — the Chroma faceplate as data.
//
// 8 HP. FOUR KNOBS IN A SQUARE, image in at the top and out at the bottom, which is the plainest
// panel in the video set and should stay that way: this module has no modes and no lists, and the
// two pairs read as what they are — colour on the top row, light on the bottom.
//
// All four carry a cable in the middle. The set's own convention says three or four modulated
// parameters per panel and not more; four is the whole control complement here, and every one of
// them is a parameter a patch will want an LFO on.

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

items.push({ t: 'vjack', id: 'imageIn', x: MID, y: 13, opts: { r: 3.2 } });
ink(MID, 19.8, 'IN', { size: 2.3 });

// Colour: what it is, and how much of it there is. HUE's ends are named for the turn rather than
// for numbers, because 0 and 1 are the same colour and printing both would say the opposite.
knack('hue', LEFT, 38, 'HUE', ['0', 'full']);
knack('sat', RIGHT, 38, 'SAT', ['grey', '2']);

// Light: how much, and how hard the step from dark to light is.
knack('level', LEFT, 72, 'LEVEL', ['0', '2']);
knack('contrast', RIGHT, 72, 'CONT', ['flat', '4']);

items.push({ t: 'vjack', id: 'imageOut', x: MID, y: 104, opts: { r: 3.2 } });
ink(MID, 110.8, 'OUT', { size: 1.9 });

export default { faceW: FACE_W, faceH: FACE_H, faceLeft: FACE_LEFT, faceTop: FACE_TOP, wrap: true, items };
