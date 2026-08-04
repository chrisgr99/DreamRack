// panel.layout.js — the Mixer / Output faceplate as data (panel editor, Phase 1).
//
// The theme-independent item list the shared renderer (panel/render.js) turns into
// panel.svg + panel.dark.svg: ten channels, the two send-bus outputs, and the master section —
// a Monitor and a Master fader, their two bus-enable lamps, and the VU meters.

'use strict';

const CH = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
// The channels are PRINTED as numbers although their ids stay lettered — a mixing desk numbers its
// channels, and letters here would sit oddly beside the numbered send buses. Only the drawn
// character changes; every param id, port id and saved patch is untouched.
//
// Eight numbers, then two RETURNS. Nothing in the descriptor or the factory distinguishes the last
// two — they are ordinary channels — but naming them for the job they are meant for is what makes
// the send buses legible: two sends leave, two returns come back, and they sit next to each other.
const CH_LABEL = { A: '1', B: '2', C: '3', D: '4', E: '5', F: '6', G: '7', H: '8', I: 'RET 1', J: 'RET 2' };
const CH_LABEL_SIZE = { I: 2.0, J: 2.0 };

const FACE_W = 184, FACE_H = 113.5912, FACE_LEFT = 3.9, FACE_TOP = 7.0994;
// The returns sit past the SENDS column, not in the channel run: a return belongs beside the bus it
// comes back from, and the panel then reads left to right as the signal does — channels, the buses
// they feed, what comes back from those buses, and the master everything passes through.
const CH_X = { A: 15.5, B: 28.5, C: 41.5, D: 54.5, E: 67.5, F: 80.5, G: 93.5, H: 106.5, I: 134.5, J: 147.5 };
const MON_X = 161.5, MSTR_X = 176, ENGINE_X = 168.75, ROW_LABEL_X = 11.5;
// The send-bus outputs get a section of their OWN, BETWEEN the channels and the master. They began
// in the monitor and master columns, which read as though they belonged to those two faders — a send
// bus belongs to the whole desk. Placing them left of the master rather than right of it also puts
// them in signal order: the taps are on the channels, the buses they add up to come next, and the
// master, which everything finally passes through, stays at the end.
const SEND_OUT_X = 119, SEND_SEP_X = 126.5;
// The dividers sit at CH_X + 5, one channel apart, so the true middle of a channel is
// 1.5 mm LEFT of CH_X. Everything a channel owns as a discrete control — its letter, its
// input jack, its enable lamp, its amp CV jack, its pan knob — is drawn on that middle, so
// the five of them form one straight column down the centre of the strip. The fader keeps
// CH_X because it is not alone: its VU meter sits 6 mm to its left, and the two together
// are already balanced about the strip.
const MID_X = (L) => CH_X[L] - 1.5;
// The ENABLE lamps sit directly under the input jacks — the channel you are enabling and
// the jack you plugged into it read as one thing, which they did not when the lamps were
// four rows away at the bottom. Everything from the fader down moved 5 mm to make room;
// removing the old enable row and one of its two separator lines freed more than that, so
// the faders keep their full 54 mm throw.
const Y_CHAN_LABEL = 9, Y_INPUT = 15, Y_MUTE = 21.9;
// The engine's label and lamp, stacked above the MON / MSTR headers and centred across both,
// because it governs both. The 11 mm between the top edge and those headers takes exactly this:
// a caption on the first line and a lamp on the second, clear of the headers by about a
// millimetre. It is the same lamp as the enables below it, deliberately — one kind of switch.
const Y_ENGINE_LABEL = 6.4, Y_ENGINE = 11.6;
// The faders gave up 19 mm to make room for the two SEND rows. They are the most-used control on
// the panel and the last thing that should shrink — but a pair of shared effect buses is worth more
// than the top third of a throw, and 35 mm is still a longer fader than any knob here is wide.
// The fader gives up 2mm of its travel — 35 down to 33 — so the sends band below can hold two
// FULL-SIZED knАcks. A send knob at the old 3.2 radius was too small to take hold of, and two of the
// new ones will not fit the old band: they need 9.4mm each in a band that was 19.5mm tall. Crowded is
// fine; overlapping is not, and 0.7mm of clearance would have read as an accident rather than a
// decision. The VU beside each fader is drawn to the fader's length, so it follows.
// The sends band is 23.5mm tall, a millimetre taken from each side rather than two from the fader —
// the fader has given up enough. Its two knАcks sit 11.5mm apart, CENTRED in the band: 1.3mm clear of
// each rule and 2.1mm between them. The widened band is what buys that; at the old height the same
// spacing left only 0.3mm at the rules, which read as a control that barely fitted.
const SLIDER_TOP = 29, SLIDER_BOT = 61;
const Y_LINE_SF = 63.5, Y_SEND1 = 69.5, Y_SEND2 = 81;
const Y_LINE_FC = 87, Y_AMPCV = 91, Y_LINE_CP = 96, Y_PAN = 104.5;
const MUTE_R = 2.3;        // 1 mm wider than it was: a small lamp is a small target
// ONE knАck SIZE ON THIS PANEL, and no hand-set cap: the metal face is a proportion of the control,
// which the canonical knАck already knows. Three different sizes with three hand-picked caps was
// three chances to disagree with the control and with each other.
const KNACK_R = 4.7;

const items = [];
const ink = (x, y, text, opts = {}) => items.push({ t: 'label', x, y, text, opts });
const vu = (role, cx, chan) => items.push({ t: 'vu', role, x: cx - 6, y: SLIDER_BOT, opts: { length: SLIDER_BOT - SLIDER_TOP, orientation: 'v', segments: 12, chan, thick: 1.0, label: '' } });

// face + frame
items.push({ t: 'rect', x: 0, y: 0, w: FACE_W, h: FACE_H, rx: 2.5, fill: 'face' });
items.push({ t: 'rect', x: 0.5, y: 0.5, w: FACE_W - 1, h: FACE_H - 1, rx: 2.2, fill: 'none', stroke: 'frame', sw: 0.5 });

// column headers: the channel numbers and returns over the inputs, plus MON / MSTR over the master faders
for (const L of CH) ink(MID_X(L), Y_CHAN_LABEL, CH_LABEL[L], { size: CH_LABEL_SIZE[L] || 2.6 });
ink(MON_X, Y_INPUT + 1.5, 'MON', { size: 2.1 });
ink(MSTR_X, Y_INPUT + 1.5, 'MSTR', { size: 2.1 });
ink(ENGINE_X, Y_ENGINE_LABEL, 'ENGINE', { size: 2.1 });

// Pan row: a knAck per channel — the knob IS the CV jack, so every channel now has both.
// Before this, A and F had a pan CV jack and no knob, and B through E had a knob and no CV
// input at all. AV is off: a patched pan CV drives the full sweep, and any single knob can
// be given an attenuverter from its right-click menu if it ever needs scaling.
for (const L of CH) {
  items.push({ t: 'knack', id: `pan${L}`, x: MID_X(L), y: Y_PAN,
    opts: { radius: KNACK_R, port: `panCv${L}`, depth: `panDepth${L}`, av: 'off' } });
}

// left-margin row labels, right-aligned. x is overridable so each label can hug its own
// row: the bottom two rows moved 1.5 mm left onto the channel centre, and the pan knAck
// is wider than a jack again, so those two rows end further left than the top two. Each
// keeps 1 mm of air between the label and channel A's control.
const rowLabel = (y, t, x = ROW_LABEL_X, size = 2.5) => ink(x, y, t, { size, anchor: 'end' });
rowLabel(Y_INPUT + 1.5, 'IN', 8.4);
// Both are stacked on two lines, not because the wording wants it but because the margin
// is 11.5 mm and a six-character word at 2.5 mm is 11 mm: on one line, ending where it has
// to end to clear the pan knob, "PAN CV" would run off the left edge of the face.
// The send labels are the longest in the margin — five characters where the others have three — and
// at the row-label size they ran off the left edge of the face. Set smaller and moved right, so they
// end just clear of the first send knob with the same millimetre of air the other rows keep.
rowLabel(Y_SEND1 + 0.8, 'SND 1', 8.8, 2.1);
rowLabel(Y_SEND2 + 0.8, 'SND 2', 8.8, 2.1);
rowLabel(Y_AMPCV - 0.5, 'AMP', 8.4); rowLabel(Y_AMPCV + 2.3, 'CV', 8.4);
rowLabel(Y_PAN - 0.5, 'PAN', 6.8);    rowLabel(Y_PAN + 2.3, 'CV', 6.8);

// Horizontal section dividers. The lower one used to stop at the master boundary because
// the master section had nothing below it; the two buses now have the same gain-CV and pan
// rows as the channels, so it runs the full width. There is
// deliberately NO line between the input/enable block and the faders: the vertical channel
// dividers below now run the whole way up, so a channel reads as one continuous strip from
// its jack to its pan knob rather than as three stacked bands.
items.push({ t: 'line', x1: 3, y1: Y_LINE_SF, x2: FACE_W - 3, y2: Y_LINE_SF, w: 0.355 });
items.push({ t: 'line', x1: 3, y1: Y_LINE_FC, x2: FACE_W - 3, y2: Y_LINE_FC, w: 0.355 });
items.push({ t: 'line', x1: 3, y1: Y_LINE_CP, x2: FACE_W - 3, y2: Y_LINE_CP, w: 0.355 });
// Channel dividers, running the FULL height of the face — 2 mm from the top edge to 2 mm
// from the bottom. Each strip is then one unbroken column from its input jack to its pan
// knob, which is what lets the horizontal band lines go: the eye follows the column, not
// the row. The last divider doubles as the boundary with the master section.
const SEP_TOP = 2, SEP_BOT = FACE_H - 2;
for (const L of CH) items.push({ t: 'line', x1: CH_X[L] + 5, y1: SEP_TOP, x2: CH_X[L] + 5, y2: SEP_BOT, w: 0.25 });

// channel strips
for (const L of CH) {
  items.push({ t: 'jack', id: `chan${L}`, x: MID_X(L), y: Y_INPUT });
  items.push({ t: 'slider', id: `level${L}`, x: CH_X[L], opts: { top: SLIDER_TOP, bot: SLIDER_BOT, valuePos: 0.8 } });
  items.push({ t: 'jack', id: `ampCv${L}`, x: MID_X(L), y: Y_AMPCV });
  items.push({ t: 'button', id: `mute${L}`, x: MID_X(L), y: Y_MUTE, opts: { r: MUTE_R, kind: 'red' } });
  // knAcks like the pan below them: a send amount is exactly the sort of thing you want an envelope
  // on, and giving each a jack of its own would have cost two more rows the panel does not have.
  items.push({ t: 'knack', id: `send1${L}`, x: MID_X(L), y: Y_SEND1,
    opts: { radius: KNACK_R, port: `send1Cv${L}`, depth: `send1Depth${L}`, av: 'off' } });
  items.push({ t: 'knack', id: `send2${L}`, x: MID_X(L), y: Y_SEND2,
    opts: { radius: KNACK_R, port: `send2Cv${L}`, depth: `send2Depth${L}`, av: 'off' } });
  vu('vu', CH_X[L], L);
}

// master section: Monitor + Master faders, their two bus-enable lamps, VU meters
items.push({ t: 'slider', id: 'monitorLevel', x: MON_X, opts: { top: SLIDER_TOP, bot: SLIDER_BOT, valuePos: 0.7 } });
items.push({ t: 'slider', id: 'master', x: MSTR_X, opts: { top: SLIDER_TOP, bot: SLIDER_BOT, valuePos: 0.7 } });
// The two bus enables sit in the SAME row as the channel enables, at the same size — one
// unbroken line of "is this on?" across the whole panel, each lamp under the thing it
// enables. They used to sit under their faders with a second pair of MON / MSTR captions;
// those captions went with them, since the headers at the top already name the columns.
items.push({ t: 'button', id: 'engine', x: ENGINE_X, y: Y_ENGINE, opts: { r: MUTE_R, kind: 'red' } });
items.push({ t: 'button', id: 'monitorEnable', x: MON_X, y: Y_MUTE, opts: { r: MUTE_R, kind: 'red' } });
items.push({ t: 'button', id: 'masterEnable', x: MSTR_X, y: Y_MUTE, opts: { r: MUTE_R, kind: 'red' } });
// The MASTER keeps the channels' two bottom rows — a gain CV jack and a pan knАck. The MONITOR has
// neither: it is the bus you listen on, so panning or modulating it changes what reaches your ears
// without changing anything that leaves the rack. Its column ends at its fader and its lamp.
for (const [B, X] of [['Master', MSTR_X]]) {
  items.push({ t: 'jack', id: `ampCv${B}`, x: X, y: Y_AMPCV });
  items.push({ t: 'knack', id: `pan${B}`, x: X, y: Y_PAN,
    opts: { radius: KNACK_R, port: `panCv${B}`, depth: `panDepth${B}`, av: 'off' } });
}
// Where each bus leaves: its own column at the right end, behind its own divider, each jack level
// with the row of taps that feeds it. So a send row reads as one thing across the whole panel — ten
// taps and, past the master, the jack they add up to.
items.push({ t: 'line', x1: SEND_SEP_X, y1: SEP_TOP, x2: SEND_SEP_X, y2: SEP_BOT, w: 0.25 });
// EFFECT SENDS, on two lines, as close to the jacks as two lines can get. There is no room for them
// BETWEEN the rule and the upper jack — 3.5mm of gap against a two-line block of about five — so the
// label sits just above the rule instead. That column has no fader, so the space is free.
ink(SEND_OUT_X, Y_LINE_SF - 5.4, 'EFFECT\nSENDS', { size: 2.1 });
items.push({ t: 'jack', id: 'send1Out', x: SEND_OUT_X, y: Y_SEND1 });
items.push({ t: 'jack', id: 'send2Out', x: SEND_OUT_X, y: Y_SEND2 });
vu('vuMonitor', MON_X, 'MON');
// The master meter is a PAIR — left and right — because the pan knobs above it are meaningless if
// you cannot see where they are putting the sound. The channels keep a single bar each: a channel is
// mono until its panner, so there is nothing per-side to show.
vu('vuMaster', MSTR_X - 2, 'ML');
vu('vuMaster', MSTR_X + 2, 'MR');
ink(MSTR_X - 4, SLIDER_BOT + 2.6, 'L', { size: 1.7 });
ink(MSTR_X, SLIDER_BOT + 2.6, 'R', { size: 1.7 });

export default { faceW: FACE_W, faceH: FACE_H, faceLeft: FACE_LEFT, faceTop: FACE_TOP, wrap: true, items };
