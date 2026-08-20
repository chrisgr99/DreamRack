// panel.layout.js — the Encoder faceplate as data.
//
// 8 HP. THREE ROWS, ONE PER CHANNEL, jack on the left and its gain on the right, because the three
// channels are the same thing three times and any other arrangement would hide that. Reading down
// the panel is reading red, green, blue in the order everyone already holds them in.
//
// NO SECTION HEADINGS and no borders between the rows. The repetition is the structure; a rule
// drawn between identical rows only adds ink.

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

// One row per channel. The letter under the jack is large: at any zoom this panel is three
// identical rows, and the letter is the only thing that tells them apart.
const row = (jackId, gainId, y, letter) => {
  items.push({ t: 'vjack', id: jackId, x: LEFT, y, opts: { r: 3.2 } });
  ink(LEFT, y + 6.8, letter, { size: 2.6 });
  knack(gainId, RIGHT, y, 'GAIN', ['0', '2']);
};

row('rIn', 'gainR', 20, 'R');
row('gIn', 'gainG', 50, 'G');
row('bIn', 'gainB', 80, 'B');

items.push({ t: 'vjack', id: 'imageOut', x: MID, y: 104, opts: { r: 3.2 } });
ink(MID, 110.8, 'OUT', { size: 1.9 });

export default { faceW: FACE_W, faceH: FACE_H, faceLeft: FACE_LEFT, faceTop: FACE_TOP, wrap: true, items };
