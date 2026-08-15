// panel.layout.js — the Formula faceplate as data.
//
// 8 HP. The four inputs and the four knobs are each stacked two by two rather than run across
// the panel, which halves the width: a module whose point is that it REPLACES three or four
// others should not itself be the widest thing in the rack. Rack width is the scarce resource,
// and eight jacks and knobs in a row spend it on air.
//
// The expression well still takes the top third. That proportion is the module's argument — the
// text IS the module — and it survived the narrowing because the well got taller relative to the
// panel rather than shorter.
//
// A2 sits beside A1 and K2 beside K1, reading left to right then down, the same order the terms
// appear in an expression.

'use strict';

const FACE_W = 38, FACE_H = 113.5912, FACE_LEFT = 3.9, FACE_TOP = 7.0994;

const items = [];
const ink = (x, y, text, opts = {}) => items.push({ t: 'label', x, y, text, opts });
const rule = (y) => items.push({ t: 'line', x1: 3, y1: y, x2: FACE_W - 3, y2: y, w: 0.355 });

items.push({ t: 'rect', x: 0, y: 0, w: FACE_W, h: FACE_H, rx: 2.5, fill: 'face' });
items.push({ t: 'rect', x: 0.5, y: 0.5, w: FACE_W - 1, h: FACE_H - 1, rx: 2.2, fill: 'none', stroke: 'frame', sw: 0.5 });

// The expression well. Matches the `readout` rect in the descriptor.
// The readout was 32 wide and reached x=35, which is inside the top-right corner the rack draws the
// poly lamp in. Narrowed rather than moved: it is left-aligned with everything below it.
const RO = { x: 3, y: 8, w: 29, h: 20 };
ink(FACE_W / 2, 5.8, 'EXPRESSION', { size: 1.9 });
items.push({ t: 'rect', x: RO.x - 0.7, y: RO.y - 0.7, w: RO.w + 1.4, h: RO.h + 1.4, rx: 1,
  fill: 'none', stroke: 'frame', sw: 0.45 });
rule(32);

// The four inputs, two by two.
const XL = 12, XR = 26;
const IN = [
  { id: 'aIn', name: 'A', x: XL, y: 38.5 }, { id: 'bIn', name: 'B', x: XR, y: 38.5 },
  { id: 'cIn', name: 'C', x: XL, y: 51 }, { id: 'dIn', name: 'D', x: XR, y: 51 },
];
for (const j of IN) {
  items.push({ t: 'vjack', id: j.id, x: j.x, y: j.y, opts: { r: 3.0 } });
  ink(j.x, j.y + 6.2, j.name, { size: 2.2 });
}
rule(61);

// The four knobs, two by two, under the jacks they share a naming scheme with.
const R = 5.4, CAP = 4.0;
const SC = { size: 1.4, tickLen: 0.7, tickGap: 0.45 };
const TICK_R = R + SC.tickGap + SC.tickLen;
const END_DX = Math.sin(150 * Math.PI / 180) * TICK_R + 1.6;
const END_DY = -Math.cos(150 * Math.PI / 180) * TICK_R;
const K = [
  { id: 'k1', x: XL, y: 70 }, { id: 'k2', x: XR, y: 70 },
  { id: 'k3', x: XL, y: 88 }, { id: 'k4', x: XR, y: 88 },
];
for (const k of K) {
  ink(k.x - END_DX, k.y + END_DY, '0', { size: SC.size, anchor: 'end' });
  ink(k.x + END_DX, k.y + END_DY, '1', { size: SC.size, anchor: 'start' });
  items.push({ t: 'knack', id: k.id, x: k.x, y: k.y,
    opts: { radius: R, cap: CAP, port: `${k.id}Cv`,
      scale: { ...SC, marks: [{ at: 0 }, { at: 1 }] } } });
  ink(k.x, k.y + R + 3.4, k.id.toUpperCase(), { size: 1.8 });
}

items.push({ t: 'vjack', id: 'outImage', x: FACE_W / 2, y: 104, opts: { r: 3.2 } });
ink(FACE_W / 2, 110.6, 'OUT', { size: 2.0 });

export default { faceW: FACE_W, faceH: FACE_H, faceLeft: FACE_LEFT, faceTop: FACE_TOP, wrap: true, items };
