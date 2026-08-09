// panel.layout.js — the Quad Low Pass Gate faceplate as data (panel editor, Phase 1).
//
// The theme-independent item list the shared renderer (panel/render.js) turns into
// panel.svg + panel.dark.svg. Same layout the old gen-panel.js hand-authored — the
// equal-visual-gap column flow is solved here to concrete x positions, and every
// control becomes a data item. The OUTPUT is data; the flow math just computes it.
//
// The Level / Decay / Clock-ratio / Rate knobs are knAcks (t: 'knack') — knobs whose
// centre is a CV jack, with an attenuverter (AV) the user can show or hide from the
// knob's right-click menu. This layout reflects the 2026-07 faceplate rework: bands
// 1mm taller per row (rules stepped down), headers raised, the clock knob sized to
// Decay with its 1..8 ring tightened, divide/multiply at the knob's bottom, and the
// mode/clock column divider removed.

'use strict';

import { evenScale } from '../../panel/primitives.js';

const FACE_W = 142, FACE_H = 113.5912, FACE_LEFT = 3.9, FACE_TOP = 7.0994;
const CH = ['A', 'B', 'C', 'D'];
const ROWY = { A: 16.95, B: 38.65, C: 60.35, D: 82.05 };
const BOT = 102;
const DIVLINES = [27.8, 49.5, 71.2, 92.9];

// Equal visual-gap column layout (see the original gen-panel for the rationale).
const seq = [
  { k: 'in', eL: 3, eR: 3 }, { k: 'cv', eL: 3, eR: 3 }, { k: 'trig', eL: 3, eR: 3 },
  { k: 'level', eL: 6.7, eR: 6.7 }, { k: 'decay', eL: 5.9, eR: 5.9 },
  { k: 'mode', eL: 1.9, eR: 7.8 },
  { k: 'div', eL: 7.5, eR: 7.5 }, { k: 'on', eL: 2.0, eR: 2.0 },
  { k: 'clkOut', eL: 3, eR: 3 }, { k: 'out', eL: 3, eR: 3 },
];
const X0 = 13, X1 = 137;
const sumW = seq.reduce((s, c) => s + c.eL + c.eR, 0);
const GAP = (X1 - X0 - sumW) / (seq.length - 1);
const X = {}; { let cur = X0; for (const c of seq) { cur += c.eL; X[c.k] = +cur.toFixed(2); cur += c.eR + GAP; } }
const eR = (k) => seq.find((s) => s.k === k).eR, eL = (k) => seq.find((s) => s.k === k).eL;
const vmid = (a, b) => +(((X[a] + eR(a)) + (X[b] - eL(b))) / 2).toFixed(2);

const items = [];
const ink = (x, y, text, opts = {}) => items.push({ t: 'label', x, y, text, opts });
const lab = (text, size = 1.9) => ({ text, placement: 'below', size });

// face background + frame border
items.push({ t: 'rect', x: 0, y: 0, w: FACE_W, h: FACE_H, rx: 2.5, fill: 'face' });
items.push({ t: 'rect', x: 0.5, y: 0.5, w: FACE_W - 1, h: FACE_H - 1, rx: 2.2, fill: 'none', stroke: 'frame', sw: 0.5 });

// inter-track dividers (horizontal), then ONE vertical column divider (before the
// output jacks — the old mode/clock divider is gone, the clock knob owns that space)
for (const y of DIVLINES) items.push({ t: 'line', x1: 6, y1: y, x2: FACE_W - 6, y2: y, w: 0.355 });
items.push({ t: 'line', x1: vmid('clkOut', 'out'), y1: 13, x2: vmid('clkOut', 'out'), y2: DIVLINES[3], w: 0.355 });

// top headers
ink(X.level, 7, 'LEVEL', { size: 2.4 });
ink(X.decay, 7, 'DECAY', { size: 2.4 });
ink(X.mode + 3, 7, 'MODE', { size: 2.4 });
ink((X.div + X.on) / 2 + 6, 6.2, 'CLOCK', { size: 2.4 });

// channel rows
for (const L of CH) {
  const y = ROWY[L];
  ink(8.5, y + 2, L, { size: 5.5, anchor: 'middle' });
  items.push({ t: 'jack', id: `in${L}`, x: X.in, y, opts: { label: lab('IN') } });
  items.push({ t: 'jack', id: `cv${L}`, x: X.cv, y, opts: { label: lab('CV') } });
  items.push({ t: 'jack', id: `trig${L}`, x: X.trig, y, opts: { label: lab('TRIG') } });
  items.push({ t: 'knack', id: `level${L}`, x: X.level, y, opts: { radius: 7.2, port: `levelCv${L}`, depth: `levelDepth${L}`, av: 'on' } });
  items.push({ t: 'knack', id: `decay${L}`, x: X.decay, y, opts: { radius: 6.4, port: `decayCv${L}`, depth: `decayDepth${L}`, av: 'on' } });
  // VCA and LP are two independent buttons, not a radio pair, so each wears its own metal mounting.
  // At the old 2.6 offset the two discs met exactly — 5.2mm apart with 2.6mm discs — and the pair read
  // as one crammed object. 3.6 leaves 2mm of faceplate between them and still sits inside the level
  // knob's own height.
  const MODE_DY = 3.6;
  items.push({ t: 'button', id: `vca${L}`, x: X.mode, y: y - MODE_DY, opts: { r: 1.9, kind: 'red' } });
  ink(X.mode + 3.2, y - MODE_DY + 0.9, 'VCA', { size: 1.9, anchor: 'start' });
  items.push({ t: 'button', id: `lp${L}`, x: X.mode, y: y + MODE_DY, opts: { r: 1.9, kind: 'red' } });
  ink(X.mode + 3.2, y + MODE_DY + 0.9, 'LP', { size: 1.9, anchor: 'start' });
  items.push({ t: 'button', id: `strike${L}`, x: X.trig + 2.5, y: y - 6.3, opts: { r: 2.0, kind: 'red' } });
  ink(X.trig + 0.2, y - 6.3 + 0.6, 'STRIKE', { size: 1.7, anchor: 'end' });
  items.push({ t: 'knack', id: `div${L}`, x: X.div, y: y - 1.0, opts: {
    radius: 6.4, port: `ratioCv${L}`, depth: `ratioDepth${L}`, quantize: `ratioQuant${L}`, av: 'on',
    scale: { marks: evenScale(['1', '2', '3', '4', '5', '6', '7', '8']), size: 2.0, labelGap: 1.1 },
  } });
  // divide / multiply at the BOTTOM of the ratio knob, between the 1 and 8 marks
  const yR = y + 9;
  items.push({ t: 'lampGroup', param: `clkMode${L}`, children: [
    { kind: 'label', x: X.div - 3.7, y: yR + 0.9, text: '÷', size: 1.9 },
    { kind: 'lamp', x: X.div - 1.8, y: yR, r: 1.0, role: 'step-indicator', step: 'div' },
    { kind: 'lamp', x: X.div + 1.8, y: yR, r: 1.0, role: 'step-indicator', step: 'mul' },
    { kind: 'label', x: X.div + 3.7, y: yR + 0.9, text: '×', size: 1.9 },
  ] });
  items.push({ t: 'button', id: `clkOn${L}`, x: X.on, y, opts: { r: 2.0, kind: 'red', label: { text: 'CLK ON', placement: 'below', size: 1.8, maxWidth: 4 } } });
  items.push({ t: 'jack', id: `clkOut${L}`, x: X.clkOut, y, opts: { label: { text: 'CLK out', placement: 'below', size: 1.8, maxWidth: 4.2 } } });
  items.push({ t: 'jack', id: `out${L}`, x: X.out, y, opts: { label: lab('OUT') } });
}

// bottom row: clock + sum
ink(8.5, BOT, 'CLK', { size: 2.2 });
items.push({ t: 'knack', id: 'rate', x: 18, y: BOT, opts: { radius: 5.9, port: 'rateCv', depth: 'rateDepth', av: 'on', label: lab('RATE') } });
items.push({ t: 'button', id: 'run', x: 30, y: BOT, opts: { r: 2.0, kind: 'red', label: { text: 'RUN', placement: 'below', size: 1.8 } } });
items.push({ t: 'jack', id: 'clkOut', x: 41, y: BOT, opts: { label: lab('CLK OUT') } });
ink(72, BOT - 0.6, 'three ways to strike:', { size: 1.9 });
ink(72, BOT + 2.4, 'button · external · clock', { size: 1.9 });
ink(96, BOT, 'SUM', { size: 2.2 });
items.push({ t: 'jack', id: 'mixOdd', x: 112, y: BOT, opts: { label: lab('ODD A C') } });
items.push({ t: 'jack', id: 'mixEven', x: 126, y: BOT, opts: { label: lab('EVEN B D') } });

export default { faceW: FACE_W, faceH: FACE_H, faceLeft: FACE_LEFT, faceTop: FACE_TOP, wrap: true, items };
