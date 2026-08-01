// panel.layout.js — the Shapes faceplate as data.
//
// 8 HP. One column, read straight down: the field arrives, three knobs cut a window out of it,
// a switch says which side of the window to keep, and the shape leaves.
//
// The width is set by the widest ROW, not by a round number — the KEEP switch with its three
// captions — and everything else is centred on that. Anything wider is air, and rack width is
// the scarce resource in a patch that wants several of these.
//
// The panel deliberately shows no shapes. There is no disc icon and no bar icon, because the
// module does not make discs or bars — it makes a window, and the shape is whatever the field
// upstream turns that window into.

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

items.push({ t: 'vjack', id: 'fieldIn', x: COL, y: 13, opts: { r: 3.2 } });
ink(COL, 19.6, 'FIELD IN', { size: 1.9 });

knack('centre', COL, 32, 'CENTRE', ['0', '1']);
knack('width', COL, 52, 'WIDTH', ['0', '1']);
knack('soft', COL, 72, 'SOFT', ['hard', 'blur']);

ink(COL, 87, 'KEEP', { size: 1.9 });
items.push({ t: 'radio', id: 'mode', x: COL, y: 92.5,
  opts: { orientation: 'h', spacing: 10, ledR: 1.8, outline: false, led: 'green', size: 1.7,
    steps: [{ value: 'window', label: 'WIN' }, { value: 'above', label: 'ABV' },
      { value: 'below', label: 'BLW' }] } });

items.push({ t: 'button', id: 'invert', x: 10, y: 105, opts: { r: 2.3, kind: 'green' } });
ink(10, 110.8, 'INV', { size: 1.7 });
items.push({ t: 'vjack', id: 'shapeOut', x: 30, y: 105, opts: { r: 3.0 } });
ink(30, 111, 'OUT', { size: 1.7 });

export default { faceW: FACE_W, faceH: FACE_H, faceLeft: FACE_LEFT, faceTop: FACE_TOP, wrap: true, items };
