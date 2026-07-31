// panel.layout.js — the Coordinate Field faceplate as data.
//
// THE ONE IDEA THE PANEL HAS TO TEACH. The module owns a coordinate space. Everything in the
// left two sections MOVES that space; the switch in the third decides what you READ OUT of it.
// So the panel is laid out left to right in exactly that order — place, warp, read — and the
// signal path reads the same way: the optional image arrives at the bottom left, the field
// leaves at the bottom right.
//
// ONE COLUMN OF FOUR PER SECTION. Two columns of two made a square block that wasted the
// panel's height and pushed the module out to 26 HP; a single stack uses the full 113mm a rack
// row already gives, and takes the whole module down to 16. It also means a section IS a
// column, so the dividers stop being decoration and become the structure.
//
// Every continuous control is a knАck, because every one of them is worth automating and a
// separate jack for each would double the panel again. The two stepped controls are switches:
// MIRROR and FIELD choose between kinds rather than degrees, and neither means anything swept.
//
// Conventions inherited from the Video Output panel, learned the hard way there:
//   - A LABEL GOES BELOW ITS CONTROL, clear of the outermost tier (a knob's ticks reach
//     radius + 0.5, so a label at radius + 3 sits on them).
//   - `radio`'s x is the CENTRE of the lamp run, not its first lamp.

'use strict';

const FACE_W = 80, FACE_H = 113.5912, FACE_LEFT = 3.9, FACE_TOP = 7.0994;

const items = [];
const ink = (x, y, text, opts = {}) => items.push({ t: 'label', x, y, text, opts });
const vrule = (x, y1, y2) => items.push({ t: 'line', x1: x, y1, x2: x, y2, w: 0.25 });

items.push({ t: 'rect', x: 0, y: 0, w: FACE_W, h: FACE_H, rx: 2.5, fill: 'face' });
items.push({ t: 'rect', x: 0.5, y: 0.5, w: FACE_W - 1, h: FACE_H - 1, rx: 2.2, fill: 'none', stroke: 'frame', sw: 0.5 });

// Section dividers run the full height, the mixer's convention: each section is one unbroken
// column, and the eye follows the column rather than the row.
const SEP_TOP = 2, SEP_BOT = FACE_H - 2;
vrule(26, SEP_TOP, SEP_BOT);
vrule(52, SEP_TOP, SEP_BOT);

const COL_PLACE = 13, COL_WARP = 39, COL_READ = 66;
ink(COL_PLACE, 7.4, 'PLACE', { size: 2.3 });
ink(COL_WARP, 7.4, 'WARP', { size: 2.3 });
ink(COL_READ, 7.4, 'FIELD', { size: 2.3 });

// One knob size throughout: no control here outranks another, and four of them have to stack
// inside one rack row with their labels.
const R = 6.6, CAP = 4.9;
const ROW = [20, 40.5, 61, 81.5];
// A knАck with its calibration. `ends` are the two labels at the extremes of the sweep, drawn
// small and pushed out past the dial; `bipolar` adds the house minus-to-plus arc over the top
// instead, for a control whose meaningful value is the MIDDLE of its travel.
//
// Ends rather than a full numbered scale: at 6.6mm radius a ring of numbers would collide with
// the control's own label below and with the knob above. Two figures say what the range is,
// which is the question a scale actually answers here — the exact value is what the readout is
// for, not the panel.
// The figures sit BESIDE THEIR OWN TICKS, at the ends of the sweep — seven and five o'clock.
// A number floating at the side of a dial says what the range is; a number against the tick says
// where that end of the travel actually is, which is the question a calibration answers.
//
// That is the same low-left and low-right the control's own name occupies, so the name moved
// DOWN and got slightly smaller to make room. Two millimetres of label position, and the panel
// tells the truth about its own ranges.
const SC = { size: 1.5, tickLen: 0.8, tickGap: 0.5 };
const NAME_DROP = 4.0, NAME_SIZE = 1.9;
// The scale's own label placement is RADIAL, and at the ends of the sweep — 150° — radial means
// mostly downward: pushing a figure clear of its tick that way drives it straight into the
// control's name. So the ticks come from the scale and the FIGURES are placed by hand, out to
// the side of each tick and anchored away from it, so they grow outward into the empty column
// rather than back over the mark they belong to.
const TICK_R = R + SC.tickGap + SC.tickLen;          // where the tick ends
const END_DX = Math.sin(150 * Math.PI / 180) * TICK_R + 2;   // ...and 2mm further out
const END_DY = -Math.cos(150 * Math.PI / 180) * TICK_R;
const knack = (id, x, y, label, { ends = null, bipolar = false } = {}) => {
  const scale = ends ? { ...SC, marks: [{ at: 0 }, { at: 1 }] } : null;
  if (ends) {
    ink(x - END_DX, y + END_DY, ends[0], { size: SC.size, anchor: 'end' });
    ink(x + END_DX, y + END_DY, ends[1], { size: SC.size, anchor: 'start' });
  }
  items.push({ t: 'knack', id, x, y, opts: { radius: R, cap: CAP, port: `${id}Cv`, depth: `${id}Depth`, scale } });
  if (bipolar) items.push({ t: 'bipolarMark', x, y, r: R, opts: { gap: 1.5, spanDeg: 21, r: 1.0, sw: 0.34 } });
  ink(x, y + R + NAME_DROP, label, { size: NAME_SIZE });
};

// ---- PLACE — translate, rotate, scale. The controls reached for constantly. ----
knack('offsetX', COL_PLACE, ROW[0], 'X', { bipolar: true });
knack('offsetY', COL_PLACE, ROW[1], 'Y', { bipolar: true });
knack('rotate', COL_PLACE, ROW[2], 'ROTATE', { bipolar: true });
knack('scale', COL_PLACE, ROW[3], 'SCALE', { ends: ['0', '8'] });

// INVERT: one lamp in the space between SCALE and the jack. A knob would not fit there and a
// lamp does, which is the whole reason this control is here rather than a tenth knАck. It earns
// its place while Video maths does not exist — without it, turning a field into its opposite has
// no route at all; once that module lands this becomes a convenience.
items.push({ t: 'button', id: 'invert', x: COL_PLACE, y: 96, opts: { r: 2.4, kind: 'green' } });
ink(COL_PLACE, 101.6, 'INVERT', { size: 2.0 });

// The image input sits at the foot of PLACE, because that is where an incoming picture enters
// the coordinate space: patched, the space resamples it instead of emitting a field.
items.push({ t: 'vjack', id: 'imageIn', x: COL_PLACE, y: 106.5, opts: { r: 3.0 } });
ink(COL_PLACE, 112.3, 'IMAGE IN', { size: 1.9 });

// ---- WARP — the space bent rather than moved. ----
knack('polar', COL_WARP, ROW[0], 'POLAR', { ends: ['XY', 'R\u03b8'] });
knack('twist', COL_WARP, ROW[1], 'TWIST', { bipolar: true });
knack('tile', COL_WARP, ROW[2], 'TILE', { ends: ['1', '16'] });
knack('quantise', COL_WARP, ROW[3], 'QUANT', { ends: ['off', '32'] });

// MIRROR: four kinds, not four degrees. A switch, and the only stepped control in this section.
ink(COL_WARP, 99, 'MIRROR', { size: 2.1 });
items.push({ t: 'radio', id: 'mirror', x: COL_WARP, y: 105,
  opts: { orientation: 'h', spacing: 6.4, ledR: 1.9, outline: false, led: 'green', size: 1.8,
    steps: [{ value: 'off', label: 'OFF' }, { value: 'x', label: 'X' },
      { value: 'y', label: 'Y' }, { value: 'both', label: 'XY' }] } });

// ---- FIELD — what to take out of the space. ----
// The section has no heading of its own beyond the switch's name: READ was one word doing two
// jobs, and FIELD is the term that means something in this world. The switch IS the section.
//
// Vertical: five entries read better stacked than crammed across the column, and stacking puts
// each field's name beside its lamp rather than under it. It also fits in the height of the
// first two knob rows, which is what lets SCROLL and PHASE land on rows three and four.
items.push({ t: 'radio', id: 'field', x: 58, y: 30,
  opts: { orientation: 'v', spacing: 8.2, ledR: 2.0, outline: false, led: 'green', size: 2.0,
    steps: [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }, { value: 'diag', label: 'DIAG' },
      { value: 'radius', label: 'RADIUS' }, { value: 'angle', label: 'ANGLE' }] } });

// SCROLL animates the readout, PHASE offsets it. Both belong in READ rather than WARP: the
// motion is generated per pixel inside the shader and the rack's CV sets only its RATE — the
// rate rule, made visible in the layout. PHASE pairs with SCROLL the way fine pairs with coarse
// elsewhere, and it gives this column something to do besides pick a field.
//
// Stacked, not side by side: side by side they set the column's width and so the module's, for
// no reason but habit. One above the other, the width falls out of the longest field NAME
// instead, which is the only thing in here that genuinely needs the room — and they land on the
// same two rows as ROTATE/TILE and SCALE/QUANT, so all three columns share one grid.
knack('scroll', COL_READ, ROW[2], 'SCROLL', { bipolar: true });
knack('phase', COL_READ, ROW[3], 'PHASE', { ends: ['0', '1'] });

// The field leaves at the foot of READ, diagonally opposite the image input.
items.push({ t: 'vjack', id: 'fieldOut', x: COL_READ, y: 102, opts: { r: 3.3 } });
ink(COL_READ, 109.5, 'FIELD OUT', { size: 2.1 });

export default { faceW: FACE_W, faceH: FACE_H, faceLeft: FACE_LEFT, faceTop: FACE_TOP, wrap: true, items };
