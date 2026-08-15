// grammar.js — a faceplate described as bands and rows, not as millimetres.
//
// The Oscillator's layout was hand-placed: every knob, jack and label given an x and a y I worked out
// by arithmetic and then adjusted three times when the module narrowed. That is fine once. It is not
// fine ten times, and it drifts — one panel's labels end up 1.9pt and the next's 2.0, one leaves 4mm
// at the edges and the next leaves 2.5, and nobody notices until they sit side by side in a rack.
//
// So: a module declares WHAT is on its panel and in what order, and this file decides where. You get
// consistency by construction rather than by remembering.
//
//   export default panel({ hp: 8 }, [
//     band('FILTER', [
//       row([ knob('cutoff', 'CUTOFF', { size: 'large', scale: [...] }) ]),
//       row([ knack('res', 'RESONANCE', 'resIn'), knack('drive', 'DRIVE', 'driveIn') ]),
//     ]),
//     band('IN', [ row([ jack('audioIn', 'in') ]) ]),
//     outputs([ jack('lpOut', 'low'), jack('hpOut', 'high') ]),
//   ]);
//
// THE TWO THINGS IT SOLVES
//
// ACROSS a row: equal VISUAL gaps, not equal centres. A row of a big knob and two jacks spaced by
// their centres leaves the knob crowding its neighbour and a lake of empty panel beside the jacks.
// Each control declares how far it actually reaches left and right — including its label, which is
// usually wider than the control — and the leftover width is shared equally between the gaps.
//
// DOWN the panel: bands stack from the top with a rule between them, each as tall as its content
// needs, and the OUTPUT band is pinned to the bottom edge where a cable always expects to find it.
// The slack, wherever it falls, is distributed between the bands so a sparse panel breathes instead
// of huddling at the top.

'use strict';

import { evenScale, textWidth, scaleBox, scaleMarkBoxes, LAMP_PAD, LAMP_LABEL_GAP,
  TRIM_MARK_IN, TRIM_MARK_OUT, TRIM_SIGN_R, TRIM_SIGN_X, TRIM_SIGN_OUT, READOUT_H, READOUT_CH, READOUT_PAD, READOUT_ARROW_GAP,
  printedValueH } from './primitives.js';

const HP_MM = 5.08;
export const FACE_H = 113.5912;
const FACE_LEFT = 3.9, FACE_TOP = 7.0994;

// House sizes. A module picks by NAME, never by number, so "large" means the same thing on every
// panel — that is most of what makes a rack of ten modules look like one instrument.
export const SIZE = { large: 9.5, big: 8.5, medium: 7.2, small: 5.6, tiny: 4.2 };
// A control's radius: one of the named sizes, or a number in millimetres for a panel that wants a
// size between them. Everything that measures a knob asks through here.
const sizeOf = (c) => (typeof c.size === 'number' ? c.size : SIZE[c.size]);
const JACK_R = 3.0;
// THE TRIM'S CORNER. A knAck's attenuverter is a separate small knob (see design/inserts.md for why
// it is not on the control itself), and it always sits in the SAME place relative to its knob: the
// lower right, at half past four. That corner is dead space on every round knob — the label is below
// and the neighbour is beside — so the trim costs almost no height, which is what makes it affordable
// on a panel four channel-rows deep.
//
// It carries NO LABEL. Sitting in that corner of a knob named LEVEL is what says what it is, and a
// word under it would cost the height the position was chosen to save. Its centre mark shows zero.
const TRIM_R = 2.8;           // matches primitives' house trim size
const TRIM_TIP_OVER = 1.2;    // how far a trim's pointer pokes past its rim (primitives' TRIM_OVERHANG)
const TRIM_TIP = 1.2;         // its pointer's overhang — part of its real extent
const TRIM_ANGLE = 34;        // degrees below the horizontal — FOUR O'CLOCK, from drawing it by hand
                              // in the panel editor and comparing. At 50 the trim sat under the knob's
                              // shoulder; at 34 it tucks against the rim and reads as part of the same
                              // group. On a scaled knob it also lands in the gap the numerals leave
                              // between three and five o'clock, which is what lets it come in close.
const TRIM_CLEAR = 2.2;       // rim to trim rim: the pointer's overhang plus a millimetre of air
// HOW FAR A PRINTED SCALE ACTUALLY REACHES PAST THE RIM. This was a flat 3.2 for every knob and every
// scale — a guess that is about right for two-character labels and wrong for "20k". Being wrong here
// does not look like a measurement error; it looks like the numerals were printed on top of the knob.
// The ring the numerals sit on is gap + tick + labelGap out; a numeral at the SIDE then extends
// another half-width beyond that (see dialScale), and one at top or bottom half a line height.
const SCALE_RING = 2.8;       // rim to the numerals' own radius
const SCALE_LINE = 1.6;       // half a line of scale text, vertically
const scaleLabelHalf = (marks, size) =>
  Math.max(0, ...marks.map((m) => textWidth(String(Array.isArray(m.label) ? m.label[0] : m.label), size + 0.706) / 2));
// Where the trim's centre lands. Measured from the knob's OUTER edge, which on a knob with a printed
// scale is the numerals, not the rim: a calibration scale runs the full -150 to +150 sweep, so the
// half-past-four corner is exactly where its bottom-right numeral sits. Placed off the rim, the trim
// landed on the filter's "20k" and swallowed the k.
function trimOffset(c) {
  const d = trimDistance(c);
  const a = TRIM_ANGLE * Math.PI / 180;
  return { dx: +(d * Math.cos(a)).toFixed(2), dy: +(d * Math.sin(a)).toFixed(2) };
}
const LAMP_R = 2.0;          // a radio lamp: bigger than it was, because it is a click target
const LAMP_LABEL = 1.9;      // the text beside (or beneath) each lamp

const OUT_CY_UP = 10.2;      // the output row's centre, measured up from the bottom edge
// Panel edge to the outermost thing in a row. 4.5mm on anything 5 HP or wider; below that it has to
// give, because a 3 HP panel is 15.2mm across and 9mm of margin leaves less room than a jack needs.
// PROPORTIONAL, not flat. A flat 4.5 is a tenth of a wide panel and a third of a 6 HP one, and that
// third is what made the VCA's level knob plus its trim overflow by 2.2mm — on a panel with 9mm of
// blank edge. Scaled to the width and capped at the old value, so nothing 10 HP or wider moves.
const MARGIN_MAX = 4.5;
const marginFor = (faceW) => Math.min(MARGIN_MAX, Math.max(1.5, faceW * 0.11));
const LABEL_SIZE = 2.0;      // a control's own label
const SCALE_SIZE = 1.9;      // a knob's printed calibration numerals
const LETTER_SIZE = 3.4;     // a single letter on a knob's rim
const LETTER_OUT = 2.9;      // how far past the rim its centre sits
const SUB_SIZE = 1.6;        // the small note under a label ("through zero")
const JACK_LABEL = 1.8;
// A caption is a sign rather than a name, so it is drawn larger than a label or it reads as a smudge.
const CAPTION_SIZE = 3.4;
const HEADER_SIZE = 2.4;
const RULE_W = 0.355;

const HEADER_H = 5.4;        // a band header line
// A label's real height is its gap plus its size plus the renderer's own LABEL_BUMP (0.706). At 2.0pt
// that is 4.3mm, and reserving 3.2 was under by a millimetre — enough for the bottom row's labels to
// cross the rule beneath them once a panel packed tight.
const LABEL_H = 4.3;         // a label below a control
const SUB_H = 3.9;
const ROW_PAD = 3.0;         // between rows inside a band
const BAND_PAD = 3.4;        // band content to the rule below it

// ---------------------------------------------------------------------------
// Control declarations. Each returns a plain record; nothing is positioned yet.

// `letter` puts a single character on the knob's rim at a CLOCK position instead of a word beneath
// it: knob('attack', null, { letter: 'A', at: 11 }). Four knobs labelled A D S R with their letters
// climbing from 11 through 12 to 1 o'clock read as an arc — the shape of the envelope — and cost none
// of the height a row of words underneath does, which on a full panel is the whole point.
export const knob = (id, label, opts = {}) =>
  ({ kind: 'knob', id, label, size: opts.size || 'medium', scale: opts.scale || null, sub: opts.sub || null,
     above: !!opts.above, letter: opts.letter || null, at: opts.at || 12, trim: opts.trim || null,
     value: opts.value || null, style: opts.style || null, tint: opts.tint || null });

// A knAck: the ring is the value, the centre is `port`. Pass `depth` to hang a TRIM KNOB in its lower
// right for that param — the one to use whenever the jack carries ordinary modulation rather than a
// signal the knob meters. The depth used to be a ring on the knAck itself; it is its own small knob
// now, because one control could not carry two settings and a socket.
// `trimBelow` puts the depth trim CENTRED UNDER the knob, past its label, instead of in its lower
// right. For a knob carrying a full calibration scale that is the only place left: a scale running the
// whole -150 to +150 sweep occupies the half-past-four corner with its own numerals, and a trim pushed
// out beyond them floats free of the knob it belongs to. Under the label it is unambiguous, and it
// costs height rather than width — which is what a tall panel has and a narrow one does not.
export const knack = (id, label, port, opts = {}) =>
  ({ kind: 'knack', id, label, port, depth: opts.depth || null, trimBelow: !!opts.trimBelow, size: opts.size || 'medium',
     scale: opts.scale || null, sub: opts.sub || null, above: !!opts.above,
     // `side` puts the name BESIDE the knob rather than under it — for a name too long to sit under a
     // small knob without claiming the space of whatever is below it.
     side: opts.side === 'left' || opts.side === 'right' ? opts.side : null,
     letter: opts.letter || null, at: opts.at || 12 });

// `labelSize` overrides the default label size — worth it on a module's principal outputs, which are
// read more often than anything else on the panel. NOT called `size`: on a knob that name already
// means the size NAME ('big', 'large'), and reusing it fed a string into textWidth and produced a NaN
// position — a knob drawn off the edge of its own panel, with nothing warning about it.
// `side: 'left'|'right'` puts the label BESIDE the jack instead of under it, which is what a tall
// column of jacks needs: the label no longer claims the gap to the next jack, so the spacing is set
// by the jacks themselves. Voice In's output column is the case that asked for it.
export const jack = (id, label, opts = {}) =>
  ({ kind: 'jack', id, label, r: opts.r || JACK_R, labelSize: opts.labelSize || null,
    side: opts.side === 'left' || opts.side === 'right' ? opts.side : null });

export const button = (id, label, opts = {}) => ({ kind: 'button', id, label, r: opts.r || 2.0 });

// A stepped param as a COLUMN of clickable lamps in a recessed track: `steps` is [[value, label], …].
// The role attribute is what makes them clickable, and it is set here so no module can forget it —
// a mistake that renders perfectly and produces a control nobody can operate.
//
// VERTICAL BY DEFAULT, labels to the right. A radio group is a list of named options and a list reads
// down. Pass `{ dir: 'h' }` only when the options are a SCALE you would read across — low to high,
// a row of waveshape glyphs — and then the labels go underneath. Either way the labels run
// PERPENDICULAR to the lamps.
//
// This used to build its own drawing: lamps in a row, the first label to its left, the last to its
// right, any in between above. That put a label between two lamps, belonging to neither, and it was
// a second implementation of a control the radio primitive already drew correctly — every other
// group on the rack goes through the primitive and always had its labels perpendicular. It now does
// too, so there is one radio group in the codebase instead of two.
// `columns` folds a vertical stack into that many columns, filling the first before starting the
// next, with `colGap` between their centres. The primitive has done this since the Compositor's blend
// list; the grammar could not ask for it, so a panel wanting two columns of named options had to be
// hand-authored. Sixteen named models is exactly that panel.
export const lamps = (param, steps, opts = {}) =>
  ({ kind: 'lamps', param, steps, dir: opts.dir === 'h' ? 'h' : 'v', ledR: opts.ledR || LAMP_R, spacing: opts.spacing || (opts.dir === 'h' ? 5.6 : 5.2), labelLeft: !!opts.labelLeft,
     columns: Math.max(1, opts.columns || 1), colGap: opts.colGap || 0, value: opts.value == null ? null : opts.value,
     outline: opts.outline !== false });

// A DISPLAY: a bordered rectangle the host draws into — an envelope's shape, a wavetable, a scope.
// The grammar reserves the space and draws the surround; what goes inside is the host's, because it
// is live and the panel file is not. `w` and `h` are millimetres.
// `h` may be the number 'fill', in which case the display takes whatever height the rest of the panel
// leaves. A drawing is the one element that is always better bigger, and making it the slack-taker
// means the knobs can pack tight without anyone doing arithmetic.
export const display = (id, w, h) => ({ kind: 'display', id, w, h, label: null });

// A READOUT: a lit window showing its own value, stepped with the wheel. `chars` is the widest value
// it will ever hold, so the window is sized to its contents. `value` is what the static SVG shows
// before anything is bound — the param's default, in words.
export const readout = (id, label, opts = {}) =>
  ({ kind: 'readout', id, label, chars: opts.chars || 3, value: opts.value || '', menu: !!opts.menu, digits: opts.digits || null,
    widest: opts.widest || null, pad: opts.pad == null ? null : opts.pad, width: opts.width || 0,
    side: opts.side || null, labelSize: opts.labelSize || null, size: opts.size || 1 });

// A WORD OR A SIGN ON ITS OWN, belonging to no control. Poly to Stereo's two level inputs multiply,
// and a
// multiplication sign between them is the only thing that says so — the panel has to be readable
// without the manual. It carries no id and no port: it is ink, and the host never looks at it.
// `ring: true` draws a circle round it. An operator wants to look like an operator: a bare multiplication
// sign between two knobs reads as a stray mark or a letter, and the ring is what makes it a SYMBOL —
// the same reason a mixing desk rings its phase and mute glyphs.
export const caption = (text, opts = {}) => {
  const size = opts.size || CAPTION_SIZE;
  return { kind: 'caption', text, size, italic: opts.italic !== false,
    ring: opts.ring ? (opts.ringR || +(size * 0.85).toFixed(2)) : 0 };
};

// A BRACKET — the spine with a short arm turning in at each end, the notation a panel uses to say
// "these belong together". Voice In's TIME knob only means anything under GLIDE and LEGATO, and a
// control whose relevance depends on a setting three centimetres away has to say so on the face:
// greying out tells you AFTER you have wondered, and the panel should tell you before.
//
// `h` is the span it encloses; `arm` how far the ends turn in. Placed by its CENTRE like everything
// else, with the arms reaching to the RIGHT of the spine.
export const bracket = (h, opts = {}) =>
  ({ kind: 'bracket', h, arm: opts.arm || 2.2, w: opts.w || 0.355 });

// Free space in a row, in mm, for when even gaps are not what you want.
export const gap = (mm) => ({ kind: 'gap', mm });

// ---------------------------------------------------------------------------
// Structure.

export const row = (controls) => ({ controls });

// An ARRANGEMENT: controls at explicit points within the band, in panel millimetres, for a shape a
// row cannot express — the envelope's four knobs read as a rise and a fall, which is a picture and
// not a list. `h` is how much height the band should reserve.
export const placed = (items, h) => ({ placed: items, h });
export const band = (header, rows) => ({ header, rows: rows.map((r) => (r.controls || r.placed ? r : row(r))) });
// The output band, pinned to the bottom edge. Its header sits to the LEFT of the jacks rather than
// above them, which buys back a whole line of height on a short panel.
// The rail along the bottom. The header names it — pass null on a panel where the jacks say what they
// are and the word is only a word: outputs at the bottom edge under a rule is the rack's own idiom,
// and a panel does not have to explain its own idiom every time.
export const outputs = (jacks, header = 'OUT') => ({ header, rows: [row(jacks)], out: true });

// ---------------------------------------------------------------------------
// Measuring. A control's extent is the wider of its art and its label — the label is what actually
// collides, and measuring only the knob is how panels end up with overlapping text.

// A control reaches L to its left and R to its right. These were one symmetric number until the trim
// arrived: a trim hangs off the RIGHT of its knob only, and forcing that onto both sides pushed a
// 6 HP panel's one knob into overflow by more than 5mm — space wasted on a side with nothing in it.
// A below-the-label trim's centre, measured down from the knob's centre.
//
// MEASURED AT BOTH ENDS. The first attempt guessed the scale's reach from a flat constant and allowed
// only the trim's RADIUS above its centre — but a trim reaches five and a half millimetres up, not two
// and a half: the pointer overhangs the rim and the centre mark sits past the pointer's tip. The mark
// landed in the middle of the word CUTOFF. So: ask the scale how far down it actually goes, add the
// label block, add air, then add everything the trim puts above its own centre.
const LABEL_BLOCK = 1.6 + (LABEL_SIZE + 0.706) * 0.97;   // gap + cap height + descender
const TRIM_UP = TRIM_R + TRIM_TIP + 1.9;                 // radius + pointer overhang + centre mark
const TRIM_BELOW_AIR = 1.0;
function trimBelowY(c) {
  const R = sizeOf(c);
  // The SAME scale object emit() builds, or the measurement is of something that is not on the panel.
  const box = c.scale ? scaleBox(R, { marks: evenScale(c.scale), size: SCALE_SIZE, labelGap: 1.1 }, -150, 150) : null;
  const down = box ? Math.max(R, box.down) : R;
  return +(down + LABEL_BLOCK + TRIM_BELOW_AIR + TRIM_UP).toFixed(2);
}

// WHERE THE TRIM GOES ON A SCALED KNOB. Not outside the numeral ring — a ring of numerals is not a
// solid ring, and treating it as one pushed the trim out to the panel's edge, floating free of the
// knob it belongs to. It goes in the GAP the marks leave at four o'clock, as close to the rim as it
// can while missing their corners: start where an unscaled knob would put it and walk outwards until
// every numeral is clear. Which numerals matter falls out of their angles, so a scale that stops
// short of five o'clock lets the trim sit closer still.
const TRIM_MARK_UP = 1.3;     // the centre mark, above the pointer's tip (rim + 2.5, tip at rim + 1.2)
const TRIM_CLEARANCE = 0.6;   // trim to numeral, at the closest point
// The minus circle beside the centre mark leans BACK TOWARDS THE KNOB — it sits above the trim and to
// its left, and the knob is up and to the left. On the VCA that left it 0.57mm off the rim, which is
// a gap you can see rather than a gap you can rely on. So the walk outwards tests the sign circles
// against the knob as well as the trim against the numerals.
// The sign circles' geometry comes FROM THE PRIMITIVE that draws them. It was copied here once and
// the two promptly disagreed the moment the signs grew — a placement computed against a drawing that
// is not the drawing on the panel.
const TRIM_SIGN_UP = TRIM_R + (TRIM_MARK_IN + TRIM_MARK_OUT) / 2;   // the mark's midpoint
function trimDistance(c) {
  const R = sizeOf(c);
  const d0 = R + TRIM_CLEAR + TRIM_R;
  const boxes = c.scale
    ? scaleMarkBoxes(R, { marks: evenScale(c.scale), size: SCALE_SIZE, labelGap: 1.1 }, -150, 150)
    : [];
  const a = (90 + TRIM_ANGLE) * Math.PI / 180;          // clockwise from twelve o'clock
  const ux = Math.sin(a), uy = -Math.cos(a);
  const disc = TRIM_R + TRIM_TIP + TRIM_CLEARANCE;
  for (let d = d0; d <= d0 + 12; d += 0.05) {
    const px = ux * d, py = uy * d;
    // The sign circles, and the knob's own rim.
    const signsClear = [-TRIM_SIGN_X, TRIM_SIGN_X].every((sx) =>
      Math.hypot(px + sx, py - TRIM_SIGN_UP) >= R + TRIM_SIGN_R + TRIM_CLEARANCE);
    if (!signsClear) continue;
    const markTip = { x: px, y: py - (TRIM_R + TRIM_TIP + TRIM_MARK_UP) };
    const clear = boxes.every((b) => {
      const dx = Math.max(Math.abs(px - b.x) - b.hw, 0), dy = Math.max(Math.abs(py - b.y) - b.hh, 0);
      if (Math.hypot(dx, dy) < disc) return false;
      const mx = Math.abs(markTip.x - b.x) - b.hw, my = Math.abs(markTip.y - b.y) - b.hh;
      return Math.max(mx, my) > TRIM_CLEARANCE;
    });
    if (clear) return +d.toFixed(2);
  }
  return d0 + 12;
}

function extent(c) {
  const w = halfWidth(c);
  // The chevrons sit OUTSIDE the window on the right, so a readout reaches further that way than the
  // box alone suggests — measure it or the next control lands on them.
  if (c.kind === 'readout') {
    const half = readoutHalf(c);
    // A menu readout has no chevrons, so it reaches no further right than its own window — unless it
    // wears its label at the side, in which case the word is what the next control has to clear.
    const arrows = c.menu ? 0 : READOUT_ARROW_GAP + 2.6;
    const sideLab = (c.side === 'right' && c.label) ? 1.6 + textWidth(c.label, c.labelSize || LABEL_SIZE) : 0;
    const sideLabL = (c.side === 'left' && c.label) ? 1.6 + textWidth(c.label, c.labelSize || LABEL_SIZE) : 0;
    return { l: half + sideLabL, r: half + Math.max(arrows, sideLab) };
  }
  if (c.kind === 'lamps' && c.dir !== 'h') {
    const tH = c.ledR + LAMP_PAD;
    const widest = Math.max(0, ...c.steps.map(([, t]) => textWidth(t || '', LAMP_LABEL)));
    // A left-labelled stack reaches LEFT, so the row has to measure it that way or it is placed as
    // though its labels were somewhere else entirely.
    const reach = tH + LAMP_LABEL_GAP + widest;
    return c.labelLeft ? { l: reach, r: tH } : { l: tH, r: reach };
  }
  // A knob with a trim measures the same way a knAck with a depth does — the satellite is the same
  // satellite, and a row that does not count it puts the next control on top of it.
  if ((c.kind === 'knack' && c.depth && !c.trimBelow) || (c.kind === 'knob' && c.trim)) {
    // The trim's RIM, not its pointer's tip. The tip is a half-millimetre hairline that only reaches
    // that far when the pointer happens to point straight at the panel edge, and what it reaches into
    // is blank margin. Counting it cost every trimmed knob 1.2mm of row on both sides to protect
    // empty panel from a line.
    const { dx } = trimOffset(c);
    // The sign circles reach a shade wider than the trim's own rim, so they are what the row measures.
    return { l: w, r: Math.max(w, dx + Math.max(TRIM_R, TRIM_SIGN_OUT)) };
  }
  return { l: w, r: w };
}

// The same width the primitive draws — measured off the widest value when the layout names it.
function readoutHalf(c) { const pad = c.pad == null ? READOUT_PAD : c.pad;
  if (c.width) return c.width / 2;
  const h = READOUT_H * (c.size || 1);
  return (c.widest ? textWidth(c.widest, h * 0.78) + pad * 2 : c.chars * READOUT_CH * (c.size || 1) + pad * 2) / 2; }

function halfWidth(c) {
  if (c.kind === 'readout') return readoutHalf(c);
  if (c.kind === 'gap') return c.mm / 2;
  let art = 0;
  if (c.kind === 'knob' || c.kind === 'knack') {
    // A side numeral's OUTER edge is the ring plus a whole half-width again — dialScale pushes it out
    // by its own half-width so its inner end clears the rim, and it still has that half-width to
    // spend going outwards.
    const sc = c.scale ? SCALE_RING + 2 * scaleLabelHalf(evenScale(c.scale), SCALE_SIZE) : 0;
    art = sizeOf(c) + sc + (c.letter ? 2.4 : 0);
  }
  else if (c.kind === 'display') art = c.w / 2;
  else if (c.kind === 'jack') art = c.r;
  else if (c.kind === 'caption') art = Math.max(textWidth(c.text, c.size) / 2, c.ring);
  else if (c.kind === 'bracket') art = c.arm / 2;
  else if (c.kind === 'button') art = c.r;
  else if (c.kind === 'lamps') {
    const tH = c.ledR + LAMP_PAD;
    art = c.dir === 'h' ? (c.steps.length - 1) * c.spacing / 2 + tH : tH;
  }
  let lab = 0;
  if (c.kind === 'lamps') {
    // A horizontal group's labels sit UNDER their own lamps, so only the outermost two widen it; a
    // vertical group's all sit to the right, and the widest one is what it reaches.
    if (c.dir === 'h') art += textWidth(c.steps[c.steps.length - 1][1] || '', LAMP_LABEL) / 2;
  } else if (c.label) {
    const size = c.labelSize || (c.kind === 'jack' ? JACK_LABEL : LABEL_SIZE);
    lab = textWidth(c.label, size) / 2;
    if (c.sub) lab = Math.max(lab, textWidth(c.sub, SUB_SIZE) / 2);
  }
  return Math.max(art, lab);
}

function rowHeight(r) {
  if (r.placed) return r.h;
  let h = 0, sub = 0;
  for (const c of r.controls) {
    if (c.kind === 'knob' || c.kind === 'knack') h = Math.max(h, (sizeOf(c) + (c.style === 'trim' ? TRIM_TIP_OVER : 0) + (c.scale ? SCALE_RING + SCALE_LINE : 0)) * 2);
    else if (c.kind === 'display') h = Math.max(h, c.h);
    else if (c.kind === 'readout') h = Math.max(h, READOUT_H * (c.size || 1));
    else if (c.kind === 'jack') h = Math.max(h, c.r * 2);
    else if (c.kind === 'caption') h = Math.max(h, c.ring ? c.ring * 2 : c.size);
    else if (c.kind === 'bracket') h = Math.max(h, c.h);
    else if (c.kind === 'button') h = Math.max(h, c.r * 2);
    else if (c.kind === 'lamps') {
      const tH = c.ledR + LAMP_PAD;
      const perCol = Math.ceil(c.steps.length / Math.max(1, c.columns || 1));
      h = Math.max(h, c.dir === 'h' ? tH * 2 + LABEL_H : (perCol - 1) * c.spacing + tH * 2);
    }
    if (c.label && c.kind !== 'lamps') h = Math.max(h, h);   // label sits below; counted next
    if (c.sub) sub = SUB_H;
  }
  const hasLabel = r.controls.some((c) => c.label && c.kind !== 'lamps' && !c.letter);
  // A printed value sits between the knob and its label, so the row is that much taller.
  // Only a KNOB's printed value — a readout's `value` is its own text and costs no extra height.
  const valueH = Math.max(0, ...r.controls.map((c) => printedValueH(c.value)));
  let out = h + (hasLabel ? LABEL_H : 0) + sub + valueH;
  // A trim hangs below its knob's centre line. On a big knob that is still inside the label's own
  // reach and costs nothing; on a small one it is not, so measure rather than assume.
  for (const c of r.controls) {
    // A knob with a trim hangs one just as a knAck does, and the row has to reserve the same room.
    if (!((c.kind === 'knack' && c.depth) || (c.kind === 'knob' && c.trim))) continue;
    // FROM THE ROW'S TOP, NOT THE KNOB'S CENTRE. A trim's offset is measured from the centre of the
    // knob it belongs to, and the knob's centre sits half the art's height down the row — so adding
    // the offset to nothing reserved half a knob too little, and the filter's below-the-label trim
    // came to rest in the middle of the resonance and drive row beneath it.
    const half = sizeOf(c) + (c.scale ? SCALE_RING + SCALE_LINE : 0);
    const drop = c.trimBelow ? trimBelowY(c) : trimOffset(c).dy;
    out = Math.max(out, half + drop + TRIM_R + TRIM_TIP);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Placing a row: equal visual gaps between extents, centred in the available width.

// PACKED ROWS cap the gap between neighbours instead of sharing all the slack out between them, and
// then centre what is left over. Spreading is right on a panel with three controls on it, where the
// air IS the layout; on a dense one it pushes a display away from the knob it belongs to and makes
// the module wider than its contents. A capped gap keeps things that belong together together, and
// gives the panel back the width.
//
// TWO CAPS, because two jacks side by side read as a group at a distance that would look cramped for
// knobs — a jack is small and its label is under it, a knob is large and reaches further.
const GAP_KNOB = 3, GAP_JACK = 2;
const isJack = (c) => c.kind === 'jack';

function placeRow(r, faceW, pack) {
  const hw = r.controls.map(extent);
  const span = hw.reduce((s, w) => s + w.l + w.r, 0);
  const MARGIN = marginFor(faceW);
  const x0 = MARGIN, x1 = faceW - MARGIN;
  const n = r.controls.length;
  const slack = (x1 - x0) - span;
  // One control centres; several share the slack equally between them, or — packed — take no more
  // than the cap for that pair. Negative slack means the row is wider than the panel: allowed, and
  // reported by the caller, because the honest fix is a wider module or fewer controls, not silent
  // overlap.
  const even = n > 1 ? slack / (n - 1) : 0;
  const gaps = [];
  for (let i = 0; i < n - 1; i++) {
    const cap = isJack(r.controls[i]) && isJack(r.controls[i + 1]) ? GAP_JACK : GAP_KNOB;
    gaps.push(pack ? Math.min(even, cap) : even);
  }
  const lead = pack ? Math.max(0, slack - gaps.reduce((t, v) => t + v, 0)) / 2 : 0;
  const xs = [];
  let cur = n > 1 ? x0 + lead : x0 + (x1 - x0) / 2 - (hw[0].l + hw[0].r) / 2;
  for (let i = 0; i < n; i++) { xs.push(+(cur + hw[i].l).toFixed(2)); cur += hw[i].l + hw[i].r + (gaps[i] || 0); }
  return { xs, overflow: slack < 0 ? +(-slack).toFixed(2) : 0 };
}

// ---------------------------------------------------------------------------
// Emitting.

function emit(items, c, x, y) {
  const lab = c.label ? { text: c.label, placement: c.side || (c.above ? 'above' : 'below'),
    size: c.labelSize || (c.kind === 'jack' ? JACK_LABEL : LABEL_SIZE), gap: 1.6,
    owner: c.id || c.param || null } : null;
  switch (c.kind) {
    case 'knob':
      items.push({ t: c.style === 'trim' ? 'trim' : 'knob', id: c.id, x, y, opts: {
        radius: sizeOf(c), label: lab,
        ...(c.value ? { value: c.value } : {}),
        ...(c.tint ? { tint: c.tint } : {}),
        ...(c.scale ? { scale: { marks: evenScale(c.scale), size: SCALE_SIZE, labelGap: 1.1 } } : {}),
      } });
      // A TRIM ON A PLAIN KNOB. The satellite was built for a knAck's depth, but the shape says
      // something more general than that: a second, smaller setting belonging to the knob it hangs
      // off. A fine tempo beside a coarse one is exactly that, and drawing it as anything else would
      // make the rack's smallest control mean two different things.
      if (c.trim) {
        const p = trimOffset(c);
        items.push({ t: 'trim', id: c.trim, x: +(x + p.dx).toFixed(2), y: +(y + p.dy).toFixed(2),
          opts: { radius: TRIM_R, centreMark: true } });
      }
      break;
    case 'knack':
      items.push({ t: 'knack', id: c.id, x, y, opts: {
        radius: sizeOf(c), port: c.port, label: lab,
        ...(c.scale ? { scale: { marks: evenScale(c.scale), size: SCALE_SIZE, labelGap: 1.1 } } : {}),
      } });
      if (c.depth) {
        const p = c.trimBelow ? { dx: 0, dy: trimBelowY(c) } : trimOffset(c);
        items.push({ t: 'trim', id: c.depth, x: +(x + p.dx).toFixed(2), y: +(y + p.dy).toFixed(2),
          opts: { radius: TRIM_R, centreMark: true, accentPort: c.port } });
      }
      break;
    case 'jack':
      items.push({ t: 'jack', id: c.id, x, y, opts: { r: c.r, label: lab } });
      break;
    case 'button':
      items.push({ t: 'button', id: c.id, x, y, opts: { r: c.r, kind: 'red', label: lab } });
      break;
    case 'lamps':
      items.push({ t: 'radio', id: c.param, x, y, opts: {
        orientation: c.dir, spacing: c.spacing, ledR: c.ledR, size: LAMP_LABEL, labelLeft: !!c.labelLeft,
        ...(c.columns > 1 ? { columns: c.columns, colGap: c.colGap } : {}),
        ...(c.value == null ? {} : { value: c.value }),
        ...(c.outline === false ? { outline: false } : {}),
        steps: c.steps.map(([value, label]) => ({ value, label })),
      } });
      break;
    case 'readout':
      items.push({ t: 'readout', id: c.id, x, y, opts: { chars: c.chars, value: c.value, ...(c.menu ? { menu: true } : {}), ...(c.digits ? { digits: c.digits } : {}), ...(c.widest ? { widest: c.widest } : {}), ...(c.pad == null ? {} : { pad: c.pad }), ...(c.width ? { width: c.width } : {}), ...(c.size && c.size !== 1 ? { size: c.size } : {}), ...(lab ? { label: lab } : {}) } });
      break;
    case 'display': {
      // A recessed well: the frame line, and a group the host fills. The group carries the id so the
      // host can find it without knowing anything else about the panel.
      const x0 = +(x - c.w / 2).toFixed(2), y0 = +(y - c.h / 2).toFixed(2);
      items.push({ t: 'rect', x: x0, y: y0, w: c.w, h: c.h, rx: 1.2, fill: 'none', stroke: 'frame', sw: 0.355 });
      items.push({ t: 'raw', svg: `  <g data-wcoast-display="${c.id}" data-x="${x0}" data-y="${y0}" data-w="${c.w}" data-h="${c.h}"></g>` });
      break;
    }
    case 'caption':
      // y is the CENTRE of the sign, so the baseline drops by roughly a third of its size — the same
      // correction the rim letters make.
      if (c.ring) items.push({ t: 'circle', x, y, r: c.ring, sw: 0.4 });
      items.push({ t: 'label', x, y: +(y + c.size * 0.36).toFixed(2), text: c.text,
        opts: { size: c.size, italic: c.italic } });
      break;
    case 'bracket': {
      const t = +(y - c.h / 2).toFixed(2), b = +(y + c.h / 2).toFixed(2), a = +(x + c.arm).toFixed(2);
      items.push({ t: 'path', d: `M${a},${t} L${x},${t} L${x},${b} L${a},${b}`, w: c.w });
      break;
    }
    case 'gap': break;
    default: throw new Error(`grammar: unknown control kind "${c.kind}"`);
  }
  // The letter, on the rim at its clock hour. 12 o'clock is straight up and each hour is 30 degrees,
  // so 11 leans left and 1 leans right — which is what makes four of them read as an arc.
  if (c.letter) {
    const rad = (c.at * 30 - 90) * Math.PI / 180;
    const rr = sizeOf(c) + LETTER_OUT;
    items.push({ t: 'label', x: +(x + rr * Math.cos(rad)).toFixed(2),
      y: +(y + rr * Math.sin(rad) + LETTER_SIZE * 0.36).toFixed(2),
      text: c.letter, opts: { size: LETTER_SIZE, italic: false } });
  }
  if (c.sub) items.push({ t: 'label', x, y: +(y + (sizeOf(c) || SIZE.medium) + LABEL_H + 2.2).toFixed(2), text: c.sub, opts: { size: SUB_SIZE } });
}

// ---------------------------------------------------------------------------
// The panel itself.

// opts: { hp, tight, pad }
//   tight — do not spread leftover height between the bands. Use it whenever one element is meant to
//           take the slack (a display sized 'fill'); without it the space is shared out evenly and
//           the panel ends up with a gap above and below everything.
//   pad   — millimetres between a band's content and the rule below it. Default BAND_PAD.
export function panel(opts, bands) {
  const faceW = +(opts.hp * HP_MM).toFixed(2);
  const MARGIN = marginFor(faceW);
  const PAD = opts.pad != null ? opts.pad : BAND_PAD;
  // `rules: false` — bands still group and space, but no line is drawn between them or above the
  // outputs. For a panel whose own arrangement is the grouping.
  const noRules = opts.rules === false;
  const items = [];
  const warnings = [];

  items.push({ t: 'rect', x: 0, y: 0, w: faceW, h: FACE_H, rx: 2.5, fill: 'face' });
  items.push({ t: 'rect', x: 0.5, y: 0.5, w: faceW - 1, h: FACE_H - 1, rx: 2.2, fill: 'none', stroke: 'frame', sw: 0.5 });

  const stacked = bands.filter((b) => !b.out);
  const outBand = bands.find((b) => b.out) || null;

  // A display sized 'fill' is measured as nothing until the rest of the panel has been added up —
  // otherwise its own height is part of the sum that decides its height, and everything downstream
  // comes out NaN.
  const filler = stacked.flatMap((b) => b.rows).flatMap((r) => r.controls || [])
    .find((c) => c && c.kind === 'display' && c.h === 'fill');
  if (filler) filler.h = 0;

  // Height each band needs, then share the leftover across EVERY gap on the panel — the spaces between
  // rows as well as the spaces between bands. Sharing it between bands alone leaves a one-band module
  // (a noise source, five jacks) huddled at the top with half the panel empty below it.
  const need = stacked.map((b) => (b.header ? HEADER_H : 0)
    + b.rows.reduce((s, r) => s + rowHeight(r), 0) + (b.rows.length - 1) * ROW_PAD + PAD);
  // The output row is PINNED to the bottom and its rule is placed from it, so the flowing bands have
  // to stop above that rule — not merely leave room for the jacks. Budgeting against the face height
  // let the last band drift down until its labels crossed the rule.
  // The output row sits 10.2mm off the bottom edge, not 8.2: at 8.2 its labels ended a millimetre from
  // the panel's edge and the whole row read as crowded against it. The rule ABOVE the row has not
  // moved with it — the clearance below the rule absorbed the two millimetres instead, so nothing
  // above is disturbed and a display sized 'fill' keeps its height.
  const outTop = FACE_H - OUT_CY_UP - JACK_R - 2.4;   // where the rule above the outputs sits
  const limit = outBand ? outTop - PAD : FACE_H - 4;
  const total = need.reduce((s, h) => s + h, 0);
  const spare = Math.max(0, limit - 4 - total);
  // The filler now takes the slack; otherwise it is shared between the gaps, unless the panel asked
  // to be packed tight, in which case it is simply left at the bottom.
  if (filler) filler.h = Math.max(8, spare);
  const gaps = stacked.reduce((n, b) => n + (b.rows.length - 1), 0) + stacked.length;
  const extra = (filler || opts.tight || !gaps) ? 0 : spare / gaps;

  let y = 4;
  // THE LAST BAND BEFORE THE OUTPUTS gets a little more room and sits in the middle of it. A lone
  // input jack under a rule was top-aligned like every other band, so it hung a millimetre below its
  // rule with four below its label — cramped at the top, empty at the bottom, and reading as an
  // afterthought rather than a section. Its rule lifts by LAST_BAND_LIFT and its content centres in
  // what is left. Only a HEADERLESS band: a header anchors a band to its top by definition.
  const LAST_BAND_LIFT = 2.0;
  const OUT_RULE_Y = FACE_H - OUT_CY_UP - JACK_R - 2.4;
  const bandContentH = (b) => b.rows.reduce((t, r, ri) => t + rowHeight(r) + (ri ? ROW_PAD + extra : 0), 0);

  stacked.forEach((b, bi) => {
    const last = bi === stacked.length - 1;
    if (last && outBand && !b.header) {
      const avail = OUT_RULE_Y - y;
      const slack = avail - bandContentH(b);
      if (slack > 0) y += slack / 2;
    }
    // A HEADER CARRIES AN ID, like the rules do, so the panel editor can select it and an override can
    // restyle it — a header is presentation, and presentation belongs to the panel rather than to the
    // grammar's one global size. Numbered by band position, which is stable while the panel's sections
    // are: renaming a header does not move it.
    //
    // ANCHORED AT ITS LEFT EDGE rather than centred on a precomputed middle. Identical on screen, but
    // a centred header drawn from a width worked out at emit time drifts left as soon as its size is
    // overridden — the very thing the id is there to allow.
    if (b.header) { items.push({ t: 'label', id: `header${bi + 1}`, x: MARGIN, y: +(y + 3.4).toFixed(2), text: b.header, opts: { size: HEADER_SIZE, anchor: 'start' } }); }
    let ry = y + (b.header ? HEADER_H : 0);
    b.rows.forEach((r, ri) => {
      const h = rowHeight(r);
      if (r.placed) {
        for (const it of r.placed) emit(items, it.c, it.x, ry + it.y);
        ry += h + (ri < b.rows.length - 1 ? ROW_PAD + extra : 0);
        return;
      }
      const { xs, overflow } = placeRow(r, faceW, !!opts.pack);
      if (overflow) warnings.push(`row ${bi}.${ri} overflows the panel by ${overflow}mm`);
      // the row's controls are centred on their art, so the y is the art's centre
      // The art's height, which decides where its CENTRE line falls. It must count a printed scale for
      // the same reason rowHeight does: measured at the rim, a scaled knob was centred a scale-height
      // too high and its top numerals were printed into the band header above — "400" sitting in the
      // middle of the word FILTER.
      const artH = Math.max(...r.controls.map((c) => (c.kind === 'knob' || c.kind === 'knack')
        ? (sizeOf(c) + (c.scale ? SCALE_RING + SCALE_LINE : 0)) * 2
        : c.kind === 'display' ? c.h
          : c.kind === 'jack' ? c.r * 2 : c.kind === 'button' ? c.r * 2
            : c.kind === 'lamps' ? (c.dir === 'h' ? (c.ledR + LAMP_PAD) * 2 : (c.steps.length - 1) * c.spacing + (c.ledR + LAMP_PAD) * 2)
              : LAMP_R * 2), 0);
      // A printed value sits ABOVE the art, so the art starts that far down the row — otherwise the
      // numeral is drawn into whatever is above, which on the top row of a band is its header.
      const valueUp = Math.max(0, ...r.controls.map((c) => printedValueH(c.value)));
      const cy = +(ry + valueUp + artH / 2).toFixed(2);
      r.controls.forEach((c, i) => emit(items, c, xs[i], cy));
      ry += h + (ri < b.rows.length - 1 ? ROW_PAD + extra : 0);
    });
    y = ry + PAD + extra;
    if (!last) {
      // The rule going INTO the last band comes up, taking its couple of millimetres from the slack
      // the band above was sitting on rather than from anyone's content.
      const intoLast = outBand && bi === stacked.length - 2 && !stacked[bi + 1].header;
      if (intoLast) y = Math.max(y - LAST_BAND_LIFT, y - Math.max(0, extra));
      // AN ID, so the panel editor can address this one rule. A divider is generated by the band
      // structure rather than placed by hand, so without a name the only way to be rid of one was to
      // turn every rule on the panel off in the layout file.
      if (!noRules) items.push({ t: 'divider', id: `rule${bi + 1}`, x: MARGIN, y: +y.toFixed(2), len: +(faceW - MARGIN * 2).toFixed(2), w: RULE_W });
      y += PAD;
    }
  });

  // The rule ABOVE the outputs is placed from the output row, not from wherever the bands above
  // happened to finish — flowed, it ran straight across the output jacks whenever the content above
  // ended low.
  if (outBand && !noRules) {
    items.push({ t: 'divider', id: 'ruleOut', x: MARGIN, y: +(FACE_H - OUT_CY_UP - JACK_R - 2.4).toFixed(2),
      len: +(faceW - MARGIN * 2).toFixed(2), w: RULE_W });
  }

  if (outBand) {
    // ONE ROW, and saying so out loud. The out rail is pinned to the foot of the panel, so a second
    // row has nowhere to go — and for a while it was dropped in silence, which cost three jacks on the
    // Voice module and nothing anywhere reported it. A layout wanting more outputs than fit puts the
    // rest in an ordinary band above.
    if (outBand.rows.length > 1) warnings.push(`the output row holds one row; ${outBand.rows.length - 1} more were dropped`);
    const jacks = outBand.rows[0].controls;
    // The header sits left of the jacks. Its width is taken out of the row before the gaps are shared,
    // so the jacks never run under it.
    const headW = outBand.header ? textWidth(outBand.header, 2.2) : 0;
    const cy = FACE_H - OUT_CY_UP;
    const hw = jacks.map(extent);
    const headGap = outBand.header ? 2.5 : 0;
    const x0 = MARGIN + headW + headGap, x1 = faceW - MARGIN;
    const span = hw.reduce((s, w) => s + w.l + w.r, 0);
    let g = jacks.length > 1 ? ((x1 - x0) - span) / (jacks.length - 1) : 0;
    if (g < 0) warnings.push(`output row overflows the panel by ${(-g * (jacks.length - 1)).toFixed(2)}mm`);
    let cur = x0;
    let headX = MARGIN - 0.5;
    // PACKED, like every other row on a packed panel: the gap is capped and the whole group — header
    // and jacks together — is centred in what is left, so the header stays against the jacks it names.
    if (opts.pack && g > GAP_JACK) {
      g = GAP_JACK;
      const groupW = headW + headGap + span + g * (jacks.length - 1);
      headX = MARGIN + ((x1 - MARGIN) - groupW) / 2;
      cur = headX + headW + headGap;
    }
    if (outBand.header) items.push({ t: 'label', id: 'headerOut', x: +headX.toFixed(2), y: +(cy + 1.2).toFixed(2), text: outBand.header, opts: { size: 2.2, anchor: 'start' } });
    jacks.forEach((c, i) => { emit(items, c, +(cur + hw[i].l).toFixed(2), cy); cur += hw[i].l + hw[i].r + g; });
  }

  // A NON-FINITE COORDINATE IS A BUG, NOT A LAYOUT. It renders — the browser reads NaN as zero — so
  // the control simply appears at the panel's edge and the panel check, which only compares the file
  // to a re-render, agrees with itself and passes. Caught here instead, by name, at generate time.
  for (const it of items) {
    for (const k of ['x', 'y', 'w', 'h', 'len']) {
      if (it[k] !== undefined && !Number.isFinite(it[k])) {
        throw new Error(`panel grammar: ${it.id || it.t} has a non-finite ${k} (${it[k]}) — check the ` +
          `options passed to it.`);
      }
    }
  }

  if (warnings.length) {
    // Loud, at generate time, where it can still be fixed — not a silent overlap discovered in a
    // screenshot three modules later.
    for (const w of warnings) console.warn(`[panel grammar] ${w}`);
  }

  // wrap: TRUE — the renderer translates the whole panel to (faceLeft, faceTop) inside the 3U row.
  // The layout above works from 0,0, which is what makes it readable, but the face has to END UP at
  // 3.9mm because that is where the rack's panel loader crops every module from. Drawn at 0 the panel
  // renders perfectly on its own and is shifted 3.9mm left in the rack, losing its right-hand edge —
  // which is exactly what the Oscillator and Noise were doing before this line.
  return { faceW, faceH: FACE_H, faceLeft: FACE_LEFT, faceTop: FACE_TOP, wrap: true, items };
}
