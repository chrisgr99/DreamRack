// panel.layout.js — Sequencer/Programmer Eight faceplate layout (data).
//
// Vertical stage layout: a module column of transport jacks on the LEFT, then eight
// stage rows running DOWN the face. Each stage row carries, left to right: the stage
// number, the A and B voltage knobs, the PLAY / STRT / END lamp columns, the ratchet
// knob with its short arc scale, the stage select input, and the stage pulse output.
//
// Everything in a stage row sits on the row's own centre line — including the two
// loop-window selectors, which are single stepped params drawn as a lamp per stage row.
//
// A deliberate divergence from the horizontal original — it takes the module from
// ~42 HP to 16, which keeps the whole faceplate inside one magnified viewport.
// See design/cv-sequencer.md.
//
// All coordinates are millimetres of real panel (the viewBox unit).

const FACE_W = 81.28;              // 16 HP × 5.08
const FACE_H = 113.5912;

// --- module column (left) ---------------------------------------------------
const COL_X = 5.5;                 // jack centres, 1 mm nearer the panel edge
// Everything that made this column wide has gone: the PRE toggle now sits UNDER the
// Reset jack instead of beside it, so the widest thing left is a five-letter legend
// ending at x = 15.5. The rule came in from 26 to 17, and those 9 mm are what pay for
// the wider A-B spacing and the three lamp columns in each stage row.
const COL_EDGE = 17.0;             // vertical divider between column and stage rows
const COL_LABEL = { placement: 'right', size: 1.8, gap: 0.9 };
const COL_ROWS = {
  run: 8, clock: 18.5, reset: 29, preset: 33.8, updown: 39.5, hold: 50,
  divider: 57,
  outA: 64, outB: 74.5, outAB: 85, allGate: 95.5, trig: 106,
};

// --- stage rows (right) -----------------------------------------------------
const LEGEND_Y = 7.2;              // column legends above stage row 1
const ROWS_TOP = 10.2;
const ROW_H = (FACE_H - ROWS_TOP) / 8;      // 12.92 mm per stage
const rowY = (i) => ROWS_TOP + ROW_H * (i + 0.5);

// Stage-row columns, laid out against ELEMENT WIDTHS rather than centres, because two of
// them are much wider than they look:
//
//   the ratchet knob   its 0..4 numerals print on a ±50° arc, so it occupies ±4.8 mm,
//                      not the 2.8 mm of its radius;
//   the legends        `size` is a nominal the renderer scales by about 1.4, so PLAY and
//                      STRT are each about 5 mm wide at the head of their columns.
//
// The lamp columns are spaced by those legends, not by the lamps: PLAY, STRT and END
// would read as one word at the lamps' own spacing. Every other gap is at least 1.0 mm,
// leaving 1.7 mm of margin at the right edge.
// EVERY KNOB ON THIS PANEL IS A TRIM — flat blue face, no ticks, no cap, one bold pointer running
// the full radius and out past the rim. Not to save space: none of the sixteen voltage knobs carries
// a marking, and what you actually read down a column of them is the PATTERN OF POINTER ANGLES, the
// contour of the sequence. That is the one thing the trim is built for and the one thing a full knob
// is worst at, because seven white ticks compete with the single line that matters.
//
// The columns moved to pay for the pointer's overhang. A trim reaches radius + 1.2 mm, so at the old
// spacing A's tip crossed the stage number and B's crossed the play lamp. Two things bought the room
// back: the stage number slid 0.3 mm left, and the A/B pair is now measured against the play LAMP at
// 40.9 rather than against the PLAY legend at 40.0 — the legend only exists on the header row, well
// above the first stage. Two neighbouring trims are allowed to let their tips into each other's gap
// but never to touch the other's rim, which is what the 2r + 1.2 centre spacing enforces.
//
// The columns shifted again, by fractions of a millimetre, when the loop-window selectors gained
// their track and the play button its bezel. Both grew sideways: a track reaches trackPad past its
// lamps, a bezel half a millimetre past its. Everything from the stage number to the ratchet moved
// to keep a real gap between neighbours — this row is packed, and the honest margins here are a few
// tenths, not millimetres.
const X_NUM = 18.0;                // stage number
const X_A = 24.6;                  // Row A trim
const X_B = 34.6;                  // Row B trim — 10.0 mm from A, against a 9.8 mm minimum
const X_PLAY = 43.0;               // play button — the ACTIVE-stage indication, so it leads
const X_START = 49.2;              // loop-window start selector (green)
const X_END = 54.7;                // loop-window end selector (red)
const X_RPT = 62.5;                // ratchet trim
const X_SEL = 70.7;                // stage select in
const X_PULSE = 77.0;              // stage pulse out

const KNOB_R = 4.3;                // the largest the row allows, tip to rim; the old knob was 4.2
// The ratchet is a trim too, and the clearest case on the rack for one: it was already at trim size,
// wearing a metal cap two millimetres across that could not read as a dome and five ticks a seventh
// of a millimetre wide. As a trim it grows from 2.8 to 3.6 and its pointer is what points at the
// numeral — which is what a five-position rotary switch is.
const RPT_R = 3.6;
const BTN_R = 1.8;
const JACK_R = 2.6;

// The ratchet scale: 0..4 across a short arc above the knob, tight gaps so the numerals stay inside
// the 12.9 mm row. NUMERALS ONLY. A trim's pointer already reaches past its rim to the numeral, so a
// tick between the two is a third mark saying what two already say — and at this size three marks in
// four millimetres is a smudge. The scale is measured from the pointer's TIP (the trim primitive does
// that), so nothing the pointer sweeps over can be printed under it.
const rptScale = {
  size: 1.5, tickGap: 0, tickLen: 0, labelGap: 1.1,
  marks: [0, 1, 2, 3, 4].map((v, i) => ({ at: i / 4, label: String(v), tick: false })),
};

const items = [];

// Face + frame.
items.push({ t: 'rect', x: 0, y: 0, w: FACE_W, h: FACE_H, rx: 2.5, fill: 'face' });
items.push({ t: 'rect', x: 0.5, y: 0.5, w: FACE_W - 1, h: FACE_H - 1, rx: 2.2, fill: 'none', stroke: 'frame', sw: 0.5 });

// Vertical rule separating the module column from the stage rows.
items.push({ t: 'line', x1: COL_EDGE, y1: 3, x2: COL_EDGE, y2: FACE_H - 3, w: 0.355 });

// --- module column ----------------------------------------------------------
// Start/Stop, then the four inputs, the divider, then the five outputs.
items.push({ t: 'button', id: 'run', x: COL_X, y: COL_ROWS.run, opts: { r: 2.0, kind: 'white', label: { text: 'RUN', ...COL_LABEL } } });
items.push({ t: 'jack', id: 'clock', x: COL_X, y: COL_ROWS.clock, opts: { r: JACK_R, label: { text: 'CLOCK', ...COL_LABEL } } });
items.push({ t: 'jack', id: 'reset', x: COL_X, y: COL_ROWS.reset, opts: { r: JACK_R, label: { text: 'RESET', ...COL_LABEL } } });
// Directly beneath the Reset jack, close to it, so it still reads as belonging to that
// jack — and its caption sits to the right, left-aligned under the RESET legend (the
// 2.0 gap is what lines the two up, since this button is smaller than a jack). Taking
// it out of the jack's own line is what let the whole column narrow by 9 mm.
items.push({ t: 'button', id: 'presetMode', x: COL_X, y: COL_ROWS.preset, opts: { r: 1.5, kind: 'white', label: { text: 'PRE', placement: 'right', size: 1.5, gap: 2.0 } } });
items.push({ t: 'jack', id: 'updown', x: COL_X, y: COL_ROWS.updown, opts: { r: JACK_R, label: { text: 'UP/DN', ...COL_LABEL } } });
items.push({ t: 'jack', id: 'hold', x: COL_X, y: COL_ROWS.hold, opts: { r: JACK_R, label: { text: 'HOLD', ...COL_LABEL } } });

items.push({ t: 'divider', x: 2.0, y: COL_ROWS.divider, len: 18, w: 0.355 });

items.push({ t: 'jack', id: 'outA', x: COL_X, y: COL_ROWS.outA, opts: { r: JACK_R, label: { text: 'A', ...COL_LABEL } } });
items.push({ t: 'jack', id: 'outB', x: COL_X, y: COL_ROWS.outB, opts: { r: JACK_R, label: { text: 'B', ...COL_LABEL } } });
items.push({ t: 'jack', id: 'outAB', x: COL_X, y: COL_ROWS.outAB, opts: { r: JACK_R, label: { text: 'A\u2212B', ...COL_LABEL } } });
items.push({ t: 'jack', id: 'allGate', x: COL_X, y: COL_ROWS.allGate, opts: { r: JACK_R, label: { text: 'GATE', ...COL_LABEL } } });
items.push({ t: 'jack', id: 'trig', x: COL_X, y: COL_ROWS.trig, opts: { r: JACK_R, label: { text: 'TRIG', ...COL_LABEL } } });

// --- stage-column legends ---------------------------------------------------
// One legend per lamp column, so nothing has to be inferred from position.
for (const [x, text] of [[X_A, 'A'], [X_B, 'B'], [X_PLAY, 'PLAY'], [X_START, 'STRT'], [X_END, 'END'], [X_RPT, 'RPT'], [X_SEL, 'SEL'], [X_PULSE, 'OUT']]) {
  items.push({ t: 'label', id: `legend-${text}`, x, y: LEGEND_Y, text, opts: { size: 1.7 } });
}

// --- the eight stage rows ---------------------------------------------------
for (let i = 0; i < 8; i++) {
  const s = i + 1;
  const y = rowY(i);
  items.push({ t: 'label', id: `num${s}`, x: X_NUM, y: y + 0.9, text: String(s), opts: { size: 2.1 } });
  items.push({ t: 'trim', id: `a${s}`, x: X_A, y, opts: { radius: KNOB_R } });
  items.push({ t: 'trim', id: `b${s}`, x: X_B, y, opts: { radius: KNOB_R } });
  // Play leads the lamp columns: its lamp is the active-stage indication, the thing
  // you read while the sequence runs. Orange, so it cannot be mistaken for either end
  // of the loop window beside it.
  items.push({ t: 'button', id: `play${s}`, x: X_PLAY, y, opts: { r: BTN_R, kind: 'orange' } });
  items.push({ t: 'trim', id: `rpt${s}`, x: X_RPT, y: y + 1.0, opts: { radius: RPT_R, angleMin: -50, angleMax: 50, scale: rptScale } });
  items.push({ t: 'jack', id: `sel${s}`, x: X_SEL, y, opts: { r: JACK_R } });
  items.push({ t: 'jack', id: `pulse${s}`, x: X_PULSE, y, opts: { r: JACK_R } });
}

// --- the loop window: two one-of-eight selectors ----------------------------
// Each is a single stepped param drawn as a column of eight lamps, one per stage row —
// so they are ordinary radio groups, and the host's existing click-a-lamp handling
// drives them with no new machinery. Green for the start, red for the end, which is
// the colour convention the two-marker design wanted but could not show on one lamp.
//
// The spacing IS the stage row pitch and the group is centred on the middle of the eight rows, so
// lamp n lands exactly on stage n's centre line.
//
// THEY WEAR THEIR PLATE, which used to be suppressed on the grounds that on a column this tall the
// mark would run most of the faceplate. It does — and that is the point. Each of these is ONE control
// spanning all eight stages, and nothing on the panel said so: eight lamps beside eight rows read as
// eight separate settings. Two metal rails down the stage rows say what is true.
const stageSteps = [1, 2, 3, 4, 5, 6, 7, 8].map((v) => ({ value: v }));
const WINDOW_CY = (rowY(0) + rowY(7)) / 2;
items.push({ t: 'radio', id: 'start', x: X_START, y: WINDOW_CY, opts: { orientation: 'v', spacing: ROW_H, ledR: BTN_R, led: 'green', value: 1, steps: stageSteps } });
items.push({ t: 'radio', id: 'end', x: X_END, y: WINDOW_CY, opts: { orientation: 'v', spacing: ROW_H, ledR: BTN_R, led: 'red', value: 8, steps: stageSteps } });

export default {
  faceW: FACE_W,
  faceH: FACE_H,
  faceLeft: 3.9,
  faceTop: 7.0994,
  wrap: true,
  items,
};
