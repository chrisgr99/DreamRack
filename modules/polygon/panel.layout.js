// panel.layout.js — the Polygon faceplate as data.
//
// 10 HP, and wider than the rest of the video set for a reason: this module has nine controls where
// Shapes has four, because a drawn shape has more to say about itself than a slice of a field does.
// Two columns, and the split is by what the controls MEAN rather than by what fits: the left column
// is what the shape is — how many sides, how big, how spiky, how rounded — and the right column is
// how it is drawn and where, which is rotation, outline, softness and position.
//
// SIDES SITS AT THE TOP LEFT, alone above the pair, because it is the control that decides what you
// are looking at. Everything under it modifies a shape that control has already chosen.
//
// The output jack is centred at the foot, where every other module in the set puts it.

'use strict';

const FACE_W = 52, FACE_H = 113.5912, FACE_LEFT = 3.9, FACE_TOP = 7.0994;   // 10 HP

const items = [];
const ink = (x, y, text, opts = {}) => items.push({ t: 'label', x, y, text, opts });

items.push({ t: 'rect', x: 0, y: 0, w: FACE_W, h: FACE_H, rx: 2.5, fill: 'face' });
items.push({ t: 'rect', x: 0.5, y: 0.5, w: FACE_W - 1, h: FACE_H - 1, rx: 2.2, fill: 'none', stroke: 'frame', sw: 0.5 });

const LEFT = 14, RIGHT = 38, MID = 26;
const R = 5.6, CAP = 4.2, PLAIN_R = 4.6;
const SC = { size: 1.4, tickLen: 0.7, tickGap: 0.45 };
const NAME_DROP = 3.8, NAME_SIZE = 1.9;
const TICK_R = R + SC.tickGap + SC.tickLen;
const END_DX = Math.sin(150 * Math.PI / 180) * TICK_R + 1.7;
const END_DY = -Math.cos(150 * Math.PI / 180) * TICK_R;

// A knob with a cable in its middle: the parameters worth automating.
const knack = (id, x, y, label, ends) => {
  ink(x - END_DX, y + END_DY, ends[0], { size: SC.size, anchor: 'end' });
  ink(x + END_DX, y + END_DY, ends[1], { size: SC.size, anchor: 'start' });
  items.push({ t: 'knack', id, x, y,
    opts: { radius: R, cap: CAP, port: `${id}Cv`,
      scale: { ...SC, marks: [{ at: 0 }, { at: 1 }] } } });
  ink(x, y + R + NAME_DROP, label, { size: NAME_SIZE });
};

// ...and a plain one, for the parameters that are set once and left. Smaller, so the difference is
// visible across the panel rather than only on inspection.
const knob = (id, x, y, label, ends) => {
  const tr = PLAIN_R + SC.tickGap + SC.tickLen;
  const dx = Math.sin(150 * Math.PI / 180) * tr + 1.5;
  const dy = -Math.cos(150 * Math.PI / 180) * tr;
  ink(x - dx, y + dy, ends[0], { size: SC.size, anchor: 'end' });
  ink(x + dx, y + dy, ends[1], { size: SC.size, anchor: 'start' });
  items.push({ t: 'knob', id, x, y, opts: { radius: PLAIN_R, scale: { ...SC, marks: [{ at: 0 }, { at: 1 }] } } });
  ink(x, y + PLAIN_R + NAME_DROP, label, { size: NAME_SIZE });
};

// WHAT THE SHAPE IS.
ink(6.5, 12.5, 'SHAPE', { size: 1.9, anchor: 'start' });
knack('sides', MID, 24, 'SIDES', ['2', '12']);
knack('size', LEFT, 47, 'SIZE', ['0', '1']);
knack('star', RIGHT, 47, 'STAR', ['off', 'full']);
knob('round', LEFT, 69, 'ROUND', ['0', '1']);
knob('outline', RIGHT, 69, 'LINE', ['fill', 'thin']);

// HOW IT IS DRAWN, AND WHERE.
knack('rotate', LEFT, 89, 'ROT', ['-1', '+1']);
knob('soft', RIGHT, 89, 'SOFT', ['hard', 'blur']);
knob('posX', 10, 104, 'X', ['-1', '+1']);
knob('posY', 42, 104, 'Y', ['-1', '+1']);

items.push({ t: 'vjack', id: 'shapeOut', x: MID, y: 104, opts: { r: 3.2 } });
ink(MID, 110.8, 'OUT', { size: 1.9 });

export default { faceW: FACE_W, faceH: FACE_H, faceLeft: FACE_LEFT, faceTop: FACE_TOP, wrap: true, items };
