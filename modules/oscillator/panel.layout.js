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
// a cable has to find, so they get the easiest targets on the panel. Their centres are 10.2mm off the
// bottom edge, matching the panel grammar: at 8.2 their labels ended a millimetre from the edge and
// the row read as crowded against it.

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
// The sync jack's label goes ABOVE it. Below, it is trapped between the jack and the soft/hard lamps
// with nowhere to go — it overlapped them by 0.9mm — and above it reads better anyway: the lamps then
// belong unambiguously to the jack rather than competing with its name.
items.push({ t: 'jack', id: 'syncIn', x: 39.5, y: 31.5, opts: { label: { ...lab('sync', 1.8), placement: 'above' } } });
rule(40.5);

// ---- MODULATION -------------------------------------------------------------
// The sync-mode lamps ride on the MODULATION header line rather than beside the sync jack: up there
// they were the only thing holding the module two HP wider than everything else needed. They still
// sit directly under that jack, so the two read as one control.
//
// A REAL RADIO GROUP, not a hand-built pair of lamps. It was a `lampGroup`: two lamps with 'soft' set
// to the LEFT of the first and 'hard' to the RIGHT of the last, which is the flanking arrangement the
// house does not use — a label beside a lamp it may or may not belong to — and being hand-built it
// also missed the metal stem that says two lamps are one control. Both faults came from the same
// cause: a third implementation of a control the primitives already draw. Labels go underneath, which
// is where a horizontal group's labels go, and there is room: the LIN FM knob's rim is 2mm below them.
ink(14, 46.4, 'MODULATION', { size: 2.4 });
items.push({ t: 'radio', id: 'syncMode', x: 36.5, y: 46.4, opts: {
  orientation: 'h', spacing: 5, ledR: 1.5, size: 1.7,
  steps: [{ value: 'soft', label: 'soft' }, { value: 'hard', label: 'hard' }],
} });
items.push({ t: 'knack', id: 'linFm', x: 15, y: 60, opts: { radius: 7.2, port: 'linFmIn', label: lab('LIN FM') } });
ink(15, 73.4, 'through zero', { size: 1.6 });
items.push({ t: 'knack', id: 'expFm', x: 37, y: 60, opts: { radius: 7.2, port: 'expFmIn', label: lab('EXP FM') } });
rule(77);

// ---- shape, and self-modulation ---------------------------------------------
// 86, not 88: at 88 both labels sat with their baseline a quarter of a millimetre BELOW the rule at
// 98, so the line ran straight through the words. Two millimetres up clears it by 1.7 and leaves 4.2
// above the knobs' rims to the rule at 77 — more room above than below, which is the right way round
// for a row whose labels hang underneath it.
const SHAPE_Y = 86;
items.push({ t: 'knack', id: 'pulseWidth', x: 15, y: SHAPE_Y, opts: {
  radius: 6.8, port: 'pwIn', depth: 'pwDepth', av: 'on', label: lab('PULSE WIDTH', 1.9),
} });
items.push({ t: 'knob', id: 'feedback', x: 37, y: SHAPE_Y, opts: { radius: 6.8, label: lab('FEEDBACK', 1.9) } });
rule(98);

// ---- outputs ----------------------------------------------------------------
ink(4, 104.6, 'OUT', { size: 2.2, anchor: 'start' });
items.push({ t: 'jack', id: 'sineOut', x: 16, y: 103.4, opts: { label: lab('sine', 1.8) } });
items.push({ t: 'jack', id: 'triOut', x: 25, y: 103.4, opts: { label: lab('tri', 1.8) } });
items.push({ t: 'jack', id: 'sawOut', x: 34, y: 103.4, opts: { label: lab('saw', 1.8) } });
items.push({ t: 'jack', id: 'pulseOut', x: 43, y: 103.4, opts: { label: lab('pulse', 1.8) } });

// wrap: TRUE. This layout works from 0,0 — which is what makes it readable — so the renderer has to
// translate it to (faceLeft, faceTop) inside the 3U row. The rack's panel loader crops every module
// from x = 3.9mm, so a face drawn at 0 renders perfectly on its own and is shifted 3.9mm left in the
// rack, losing its right-hand edge. Which is what this panel was doing.
export default { faceW: FACE_W, faceH: FACE_H, faceLeft: FACE_LEFT, faceTop: FACE_TOP, wrap: true, items };
