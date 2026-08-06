// panel.layout.js — the Oscillator faceplate as data.
//
// The theme-independent item list the shared renderer (panel/render.js) turns into panel.svg and
// panel.dark.svg. 10 HP, one 3U row. See design/panel-editor.md.
//
// THREE BANDS, top to bottom, and the order is the order you reach for them:
//
//   FREQUENCY   COARSE, large, because it is the control you touch first and most. FINE beside it,
//               small, because it is a tuning control you set once. Under them the three jacks that
//               belong to pitch — 1V/oct, sync, and the sync mode switch.
//   MODULATION  LIN FM and EXP FM, both knAcks: the ring is the depth, the centre is the signal.
//   Below that  PULSE WIDTH (a knAck with an attenuverter, since its CV is an ordinary modulation)
//               and FEEDBACK, which has no jack — it routes the oscillator's own output, so there is
//               nothing to plug in. Putting it here rather than in MODULATION keeps "driven from
//               outside" and "driving itself" apart.
//
// The four outputs sit in one row along the bottom, evenly spaced and full size. They are the things
// a cable has to find, so they get the easiest targets on the panel.

'use strict';

import { evenScale } from '../../panel/primitives.js';

const FACE_W = 50.8;               // 10 HP x 5.08 mm
const FACE_H = 113.5912;
const FACE_LEFT = 3.9, FACE_TOP = 7.0994;

const items = [];
const ink = (x, y, text, opts = {}) => items.push({ t: 'label', x, y, text, opts });
const lab = (text, size = 2.0, gap = 1.6) => ({ text, placement: 'below', size, gap });
const rule = (y) => items.push({ t: 'divider', x: 4.5, y, len: FACE_W - 9, w: 0.355 });

// face + frame
items.push({ t: 'rect', x: 0, y: 0, w: FACE_W, h: FACE_H, rx: 2.5, fill: 'face' });
items.push({ t: 'rect', x: 0.5, y: 0.5, w: FACE_W - 1, h: FACE_H - 1, rx: 2.2, fill: 'none', stroke: 'frame', sw: 0.5 });

// ---- FREQUENCY --------------------------------------------------------------
ink(15, 7.4, 'FREQUENCY', { size: 2.4 });
items.push({ t: 'knob', id: 'coarse', x: 16, y: 22, opts: {
  radius: 9.5,
  scale: { marks: evenScale(['20', '60', '220', '800', '3k', '8k']), size: 1.9, labelGap: 1.1 },
  label: lab('COARSE (Hz)', 2.0, 2.6),
} });
items.push({ t: 'knob', id: 'fine', x: 38, y: 15.5, opts: { radius: 5.2, label: lab('FINE', 1.95) } });

items.push({ t: 'jack', id: 'pitchIn', x: 28, y: 31.5, opts: { label: lab('1V/oct', 1.8) } });
items.push({ t: 'jack', id: 'syncIn', x: 39.5, y: 31.5, opts: { label: lab('sync', 1.8) } });
rule(40.5);

// ---- MODULATION -------------------------------------------------------------
// The sync-mode lamps ride on the MODULATION header line rather than beside the sync jack: up there
// they were the only thing holding the module two HP wider than everything else needed. They still
// sit directly under that jack, so the two read as one control.
//
// role 'step-indicator' is what makes a lamp CLICKABLE. Without it the lamps render perfectly, never
// light, and cannot be pressed — a silent dead control, which is exactly what happened first time.
ink(14, 46.4, 'MODULATION', { size: 2.4 });
items.push({ t: 'lampGroup', param: 'syncMode', children: [
  { kind: 'label', x: 30, y: 47, text: 'soft', size: 1.7 },
  { kind: 'lamp', x: 34, y: 46.4, r: 1.5, role: 'step-indicator', step: 'soft' },
  { kind: 'lamp', x: 39, y: 46.4, r: 1.5, role: 'step-indicator', step: 'hard' },
  { kind: 'label', x: 43, y: 47, text: 'hard', size: 1.7 },
] });
items.push({ t: 'knack', id: 'linFm', x: 15, y: 60, opts: { radius: 7.2, port: 'linFmIn', label: lab('LIN FM') } });
ink(15, 73.4, 'through zero', { size: 1.6 });
items.push({ t: 'knack', id: 'expFm', x: 37, y: 60, opts: { radius: 7.2, port: 'expFmIn', label: lab('EXP FM') } });
rule(77);

// ---- shape, and self-modulation ---------------------------------------------
items.push({ t: 'knack', id: 'pulseWidth', x: 15, y: 88, opts: {
  radius: 6.8, port: 'pwIn', depth: 'pwDepth', av: 'on', label: lab('PULSE WIDTH', 1.9),
} });
items.push({ t: 'knob', id: 'feedback', x: 37, y: 88, opts: { radius: 6.8, label: lab('FEEDBACK', 1.9) } });
rule(100);

// ---- outputs ----------------------------------------------------------------
ink(4, 106.6, 'OUT', { size: 2.2, anchor: 'start' });
items.push({ t: 'jack', id: 'sineOut', x: 16, y: 105.4, opts: { label: lab('sine', 1.8) } });
items.push({ t: 'jack', id: 'triOut', x: 25, y: 105.4, opts: { label: lab('tri', 1.8) } });
items.push({ t: 'jack', id: 'sawOut', x: 34, y: 105.4, opts: { label: lab('saw', 1.8) } });
items.push({ t: 'jack', id: 'pulseOut', x: 43, y: 105.4, opts: { label: lab('pulse', 1.8) } });

// wrap: TRUE. This layout works from 0,0 — which is what makes it readable — so the renderer has to
// translate it to (faceLeft, faceTop) inside the 3U row. The rack's panel loader crops every module
// from x = 3.9mm, so a face drawn at 0 renders perfectly on its own and is shifted 3.9mm left in the
// rack, losing its right-hand edge. Which is what this panel was doing.
export default { faceW: FACE_W, faceH: FACE_H, faceLeft: FACE_LEFT, faceTop: FACE_TOP, wrap: true, items };
