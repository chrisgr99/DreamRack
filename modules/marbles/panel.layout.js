// panel.layout.js — the Marbles faceplate, laid out by hand.
//
// NOT IN THE BAND GRAMMAR, and deliberately. That grammar describes a panel as a vertical stack of
// bands, each a row of controls sharing their width evenly, and it is right for most modules here.
// Marbles is not that shape. It is TWO MIRRORED COLUMNS either side of a shared spine, where what
// matters is that a knob on the left and its counterpart on the right sit at reflected positions —
// a relationship the grammar has no way to state, so expressing it there meant a `placed` block per
// section, a mirror helper called by hand, and a running argument with the band stacker about height.
//
// The Complex Oscillator and Programmer Eight are built this way for the same reason. Nothing is lost:
// the same primitives, the same jack and knob art, the same `data-wcoast-param` binding, the same
// generator and the same panels:check. What is given up is automatic stacking and spreading, which on
// a mirrored panel is the part that was fighting.
//
// THE MIRROR IS THE COORDINATE SYSTEM. `T(x)` is a position in the rhythm column and `X(x)` is the
// same position in the voltage column, reflected. Write a pair with the same argument and they cannot
// drift apart — the symmetry is enforced by how the file is written rather than remembered each time.
// It is a local idea, not a new rule for the rack: no other module is built like this, and one that
// was would be better served copying eight lines than by a grammar feature nobody else calls.
//
// The layout follows Émilie Gillet's closely. Her panel graphics are not ours to use and none are
// here; this is her control complement drawn in our own vocabulary.
//
// WHAT WE DO DIFFERENTLY. Seven of her nine CV inputs modulate a knob that is right there, so they
// become knAcks — jack in the middle of the knob it drives — and her whole input row disappears. Only
// the two clocks stay plain jacks: a clock drives no single knob, it drives a side. And her four
// press-to-cycle LED buttons become radios: three named options with one lit says the same thing with
// nothing to memorise.
//
// NO SECTION RULES. Her panel has none, and this one needs none — the arrangement says where one half
// ends far more plainly than a line across it would.

'use strict';

const FACE_W = 76.2;               // 15 HP × 5.08
const FACE_H = 113.5912;
const MID = FACE_W / 2;

// The mirror. Every control is placed by the column it belongs to.
const T = (x) => +x.toFixed(2);
const X = (x) => +(FACE_W - x).toFixed(2);

const R_BIG = 8.5, R_MED = 7.2, R_SMALL = 5.6;
const JACK_R = 2.6;
const BTN_R = 2.0;
const LAMP_R = 1.6;

const LABEL = { placement: 'below', size: 2.2, gap: 1.6 };
const JACK_LABEL = { placement: 'below', size: 1.9, gap: 1.5 };

// Column positions, given once and used by both halves. Every one is a distance from the LEFT edge;
// T() takes it as it stands and X() reflects it, so a pair written with the same constant is exactly
// symmetric and stays that way through any edit.
//
// THE PANEL IS AS NARROW AS ITS WIDEST ROW ALLOWS. That row is bias-jitter-steps-bias, four medium
// knobs, and at 15 HP they sit with 2.1mm between them and 6.6mm across the centre line — which is the
// gap that says the two halves are two halves. The output jacks end up 2mm apart, which is as close as
// a cable will let them be.
const COL_EDGE = 11.1;             // bias, and the clock beneath it
const COL_BIG = 22.1;              // rate and spread, the two knobs you play
const COL_INNER = 27.6;            // jitter and steps, closing on the centre
const COL_SWITCH = 27.1;           // each half's déjà vu switch — tucked in close to the knob it flanks
const COL_MODE = 11.6;             // ...and its model, standing off from the switch so the row spaces evenly
const COL_RANGE = 24.1;            // each half's range, either side of EXTERNAL

// Rows.
const Y_DEJAVU = 12.0;             // the spine's head
const Y_BIG = 34.0;                // the big pair
const Y_LENGTH = 49.0;             // loop length, on the spine — clear of the row below, since its
                                   // label hangs under it and jitter and steps reach up to meet it
const Y_MID = 68.0;                // bias, jitter, steps
const Y_LOW = 86.0;                // clocks, external, and the two range radios
const Y_OUT = 103.0;

const items = [];

// Face + frame.
items.push({ t: 'rect', x: 0, y: 0, w: FACE_W, h: FACE_H, rx: 2.5, fill: 'face' });
items.push({ t: 'rect', x: 0.5, y: 0.5, w: FACE_W - 1, h: FACE_H - 1, rx: 2.2, fill: 'none', stroke: 'frame', sw: 0.5 });

const knack = (id, x, y, port, radius, label) =>
  items.push({ t: 'knack', id, x, y, opts: { radius, port, ...(label ? { label: { text: label, ...LABEL } } : {}) } });
const knob = (id, x, y, radius, label) =>
  items.push({ t: 'knob', id, x, y, opts: { radius, ...(label ? { label: { text: label, ...LABEL } } : {}) } });
const jack = (id, x, y, label) =>
  items.push({ t: 'jack', id, x, y, opts: { r: JACK_R, ...(label ? { label: { text: label, ...JACK_LABEL } } : {}) } });
// A READOUT shows its own value and steps under the wheel — see the primitive. `chars` is the widest
// value it will ever hold, so the window is sized to its contents and never to a guess.
// `value` is what the STATIC svg shows — the param's default in words. The loader repaints it from the
// live value the moment the module is bound; without it the window is blank in the library and the
// panel editor, which is where a reader first meets it.
// A MENU READOUT: click or scroll it and its values open as a list. See rack._openValueMenu.
 const readout = (id, x, y, chars, label, value) =>
  items.push({ t: 'readout', id, x, y, opts: { chars, value: value || '', menu: true, ...(label ? { label: { text: label, ...LABEL } } : {}) } });
const button = (id, x, y, label) =>
  items.push({ t: 'button', id, x, y, opts: { r: BTN_R, kind: 'white', ...(label ? { label: { text: label, ...LABEL } } : {}) } });
// `left` puts the words on the left of a vertical stack, which is what makes the X column a true
// reflection rather than a copy shifted sideways to dodge its neighbour.
// SPACING FOLLOWS THE LABELS, not the lamps. Across, the words sit under their own lamp, so the gap
// has to clear the WIDEST of them — at the lamps' own spacing, BERN CLUS DRUM ran together into one
// word. Two-character values like ÷4 need no such room, which is why it is a per-radio number.
const radio = (id, x, y, steps, opts = {}) =>
  items.push({ t: 'radio', id, x, y, opts: { orientation: opts.dir || 'v', spacing: opts.spacing || (opts.dir === 'h' ? 6.4 : 5.2),
    ledR: LAMP_R, size: 2.0, labelLeft: !!opts.left, steps: steps.map(([value, label]) => ({ value, label })) } });

// ---- the top row: each half's MODEL at its outer edge, then its déjà vu switch, then the knob ----
// The déjà vu knob belongs to both halves; the switches say which half is listening, so each sits on
// its own side of the knob they share.
//
// THE MODEL RADIOS SIT HERE, not beside the big knobs. What kind of thing a half makes is a decision
// you take once when you set the patch up, and it belongs with the other once-per-patch choices at the
// top — not in the middle of the two knobs you actually play. It also gives RATE and SPREAD the whole
// width of their row, which is what a pair of knobs that size wants.
//
// ACROSS, AND IN THE SAME ROW as the switches and the knob. One row holds every once-per-patch
// decision the module has, read outward from the centre in both directions: the shared knob, each
// half's switch, each half's model. Laid out across, neither radio needs its labels on a particular
// side, so the mirror costs nothing there.
//
// THE MODEL LABELS ARE THREE LETTERS. Fitting a three-way radio outboard of the switch leaves about
// twenty millimetres, and BERN CLUS DRUM does not go in it. Dropping a letter each does, and BRN CLS
// DRM is no harder to read than the four-letter abbreviation was — both are already short for
// something, and the panel is what tells you which half they belong to.
button('tDejaVu', T(COL_SWITCH), Y_DEJAVU, 'T');
knack('dejaVu', MID, Y_DEJAVU, 'dejaVuIn', R_MED, 'DÉJÀ VU');
button('xDejaVu', X(COL_SWITCH), Y_DEJAVU, 'X');
radio('tMode', T(COL_MODE), Y_DEJAVU, [['bernoulli', 'BRN'], ['clusters', 'CLS'], ['drums', 'DRM']], { dir: 'h', spacing: 6.4 });
radio('xMode', X(COL_MODE), Y_DEJAVU, [['identical', 'IDN'], ['bump', 'BMP'], ['tilt', 'TLT']], { dir: 'h', spacing: 6.4 });

// ---- the pair you play ------------------------------------------------------------------------
knack('tRate', T(COL_BIG), Y_BIG, 'tRateIn', R_BIG, 'RATE');
knack('xSpread', X(COL_BIG), Y_BIG, 'xSpreadIn', R_BIG, 'SPREAD');

// ...and the loop length below it, on the spine, because it belongs to both.
readout('dejaVuLength', MID, Y_LENGTH, 2, 'LENGTH', '1');

// ---- bias at the edges, jitter and steps closing on the centre ---------------------------------
knack('tBias', T(COL_EDGE), Y_MID, 'tBiasIn', R_MED, 'BIAS');
knack('tJitter', T(COL_INNER), Y_MID, 'tJitterIn', R_MED, 'JITTER');
knack('xSteps', X(COL_INNER), Y_MID, 'xStepsIn', R_MED, 'STEPS');
knack('xBias', X(COL_EDGE), Y_MID, 'xBiasIn', R_MED, 'BIAS');

// ---- the low row: each side's clock at its own edge, and the ranges either side of EXTERNAL -----
// The two ranges sit where they are read: beside the switch that decides what is being processed, one
// per half, laid out ACROSS because three values of one quantity are a scale rather than a list.
jack('tClockIn', T(COL_EDGE), Y_LOW, 'CLK');
radio('tRange', T(COL_RANGE), Y_LOW, [['div4', '÷4'], ['x1', '×1'], ['x4', '×4']], { dir: 'h' });
button('external', MID, Y_LOW, 'EXT');
radio('xRange', X(COL_RANGE), Y_LOW, [['narrow', '±2'], ['positive', '+5'], ['full', '±5']], { dir: 'h' });
jack('xClockIn', X(COL_EDGE), Y_LOW, 'CLK');

// ---- outputs: T's three gates, Y on the centre line, X's three voltages ------------------------
const OUT_STEP = 7.2;               // 2mm between jack rims — as close as a cable will allow
const outs = [['t1Out', 'T1'], ['t2Out', 'T2'], ['t3Out', 'T3'], ['yOut', 'Y'], ['x1Out', 'X1'], ['x2Out', 'X2'], ['x3Out', 'X3']];
outs.forEach(([id, label], i) => jack(id, +(MID + (i - 3) * OUT_STEP).toFixed(2), Y_OUT, label));

export default {
  faceW: FACE_W,
  faceH: FACE_H,
  faceLeft: 3.9,
  faceTop: 7.0994,
  wrap: true,
  items,
};
