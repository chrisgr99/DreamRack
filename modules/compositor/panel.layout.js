// panel.layout.js — the Compositor faceplate as data.
//
// 10 HP, not 8. Eight named blend modes in one vertical list is 45mm of panel, and 8 HP has about 24
// left under the knobs — the list ran off the bottom and through the output jack. Two columns of four
// would fix the height and break the module: one parameter can have only one control, so the second
// group would share an id with the first and be dead. So the panel gets wider and the list gets a
// column of its own, which is the trade the video set's own conventions call for — width is set by
// what the widest thing needs.
//
// Laid out like Video Maths otherwise: A and B side by side at the top, because neither
// is the main input. That is the whole point of a compositor, and stacking them would imply an order
// that does not exist — except in the one place it DOES exist, which is the blend, where every mode
// is "A something B" and MIX runs from A at nothing to B at full. The knob's travel and the two
// jacks read left to right in the same order, which is the only thing that keeps that straight.
//
// KEY IS SET APART from A and B, below them and alone. It is not a third picture to be blended; it
// is a picture used as a decision — where to show one and where the other — and a socket in the row
// with the other two would say it was more of the same.
//
// THE BLEND IS A VERTICAL LIST for the same reason Video Maths' operations are: one parameter can
// only have one control, so two columns of four would need two radio groups sharing an id and the
// second would be dead. Vertical also lets each mode carry its name, and OVER does not fit under a
// lamp any better than MEAN did.

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

// The two pictures, level with each other.
items.push({ t: 'vjack', id: 'aIn', x: LEFT, y: 13, opts: { r: 3.2 } });
ink(LEFT, 19.8, 'A', { size: 2.3 });
items.push({ t: 'vjack', id: 'bIn', x: RIGHT, y: 13, opts: { r: 3.2 } });
ink(RIGHT, 19.8, 'B', { size: 2.3 });

// MIX between them, under the pair, with its ends named for the jacks above rather than for numbers:
// what a compositor's crossfade is between is the question, and A and B answer it where 0 and 1 do
// not. The parameter most worth automating in the whole video set — an envelope is a dissolve, an
// LFO a throb, a sequencer a cut — which is why it sits where a cable reaches first.
knack('mix', MID, 33, 'MIX', ['A', 'B']);

// The key, alone, and its amount beside it. KEY at 0 ignores the key however bright it is, so a
// patched key can be faded in without unplugging it — which is the reason it is a knob and not the
// mere presence of a cable.
items.push({ t: 'vjack', id: 'keyIn', x: LEFT, y: 54, opts: { r: 3.2 } });
ink(LEFT, 60.8, 'KEY', { size: 2.3 });
knack('key', RIGHT, 54, 'AMT', ['off', 'full']);

// The blend, gentlest first — which is how you hunt through them — and folded into TWO COLUMNS.
// Eight in one column is 40mm and made the module 10 HP wide for the sake of the labels; two of four
// is half the height and lets it be 8 HP like the rest of the video set. Still one group: a parameter
// can carry only one control, so the fold is inside the primitive rather than two groups side by side.
ink(6.5, 71, 'BLEND', { size: 1.9, anchor: 'start' });
items.push({ t: 'radio', id: 'mode', x: 19, y: 86,
  opts: { orientation: 'v', spacing: 5.0, columns: 2, colGap: 15, ledR: 1.7, outline: false,
    led: 'green', size: 1.75,
    steps: [{ value: 'mix', label: 'MIX' }, { value: 'over', label: 'OVER' },
      { value: 'add', label: 'ADD' }, { value: 'screen', label: 'SCREEN' },
      { value: 'mult', label: 'MULT' }, { value: 'dark', label: 'DARK' },
      { value: 'light', label: 'LIGHT' }, { value: 'diff', label: 'DIFF' }] } });

items.push({ t: 'vjack', id: 'imageOut', x: 33, y: 104, opts: { r: 3.2 } });
ink(33, 110.8, 'OUT', { size: 1.9 });

export default { faceW: FACE_W, faceH: FACE_H, faceLeft: FACE_LEFT, faceTop: FACE_TOP, wrap: true, items };
