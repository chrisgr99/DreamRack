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

import { evenScale, textWidth } from './primitives.js';

const HP_MM = 5.08;
export const FACE_H = 113.5912;
const FACE_LEFT = 3.9, FACE_TOP = 7.0994;

// House sizes. A module picks by NAME, never by number, so "large" means the same thing on every
// panel — that is most of what makes a rack of ten modules look like one instrument.
export const SIZE = { large: 9.5, big: 8.5, medium: 7.2, small: 5.6, tiny: 4.2 };
const JACK_R = 3.0;
const LAMP_R = 1.5;

const OUT_CY_UP = 10.2;      // the output row's centre, measured up from the bottom edge
// Panel edge to the outermost thing in a row. 4.5mm on anything 5 HP or wider; below that it has to
// give, because a 3 HP panel is 15.2mm across and 9mm of margin leaves less room than a jack needs.
const MARGIN_MAX = 4.5;
const marginFor = (faceW) => Math.min(MARGIN_MAX, Math.max(1.5, (faceW - 12) / 2));
const LABEL_SIZE = 2.0;      // a control's own label
const LETTER_SIZE = 3.4;     // a single letter on a knob's rim
const LETTER_OUT = 2.9;      // how far past the rim its centre sits
const SUB_SIZE = 1.6;        // the small note under a label ("through zero")
const JACK_LABEL = 1.8;
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
     above: !!opts.above, letter: opts.letter || null, at: opts.at || 12 });

// A knAck: the ring is the value, the centre is `port`. Pass `depth` for the attenuverter variant —
// the one to use whenever the jack carries ordinary modulation rather than a signal the knob meters.
export const knack = (id, label, port, opts = {}) =>
  ({ kind: 'knack', id, label, port, depth: opts.depth || null, size: opts.size || 'medium',
     scale: opts.scale || null, sub: opts.sub || null, above: !!opts.above,
     letter: opts.letter || null, at: opts.at || 12 });

// `labelSize` overrides the default label size — worth it on a module's principal outputs, which are
// read more often than anything else on the panel. NOT called `size`: on a knob that name already
// means the size NAME ('big', 'large'), and reusing it fed a string into textWidth and produced a NaN
// position — a knob drawn off the edge of its own panel, with nothing warning about it.
export const jack = (id, label, opts = {}) =>
  ({ kind: 'jack', id, label, r: opts.r || JACK_R, labelSize: opts.labelSize || null });

export const button = (id, label, opts = {}) => ({ kind: 'button', id, label, r: opts.r || 2.0 });

// A stepped param as a row of clickable lamps: `steps` is [[value, label], …]. The role attribute is
// what makes them clickable, and it is set here so no module can forget it — which is a mistake that
// renders perfectly and produces a control nobody can operate.
export const lamps = (param, steps) => ({ kind: 'lamps', param, steps });

// A DISPLAY: a bordered rectangle the host draws into — an envelope's shape, a wavetable, a scope.
// The grammar reserves the space and draws the surround; what goes inside is the host's, because it
// is live and the panel file is not. `w` and `h` are millimetres.
// `h` may be the number 'fill', in which case the display takes whatever height the rest of the panel
// leaves. A drawing is the one element that is always better bigger, and making it the slack-taker
// means the knobs can pack tight without anyone doing arithmetic.
export const display = (id, w, h) => ({ kind: 'display', id, w, h, label: null });

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
export const outputs = (jacks, header = 'OUT') => ({ header, rows: [row(jacks)], out: true });

// ---------------------------------------------------------------------------
// Measuring. A control's extent is the wider of its art and its label — the label is what actually
// collides, and measuring only the knob is how panels end up with overlapping text.

function halfWidth(c) {
  if (c.kind === 'gap') return c.mm / 2;
  let art = 0;
  if (c.kind === 'knob' || c.kind === 'knack') art = SIZE[c.size] + (c.scale ? 3.2 : 0) + (c.letter ? 2.4 : 0);
  else if (c.kind === 'display') art = c.w / 2;
  else if (c.kind === 'jack') art = c.r;
  else if (c.kind === 'button') art = c.r;
  else if (c.kind === 'lamps') art = (c.steps.length - 1) * 5 / 2 + LAMP_R;
  let lab = 0;
  if (c.kind === 'lamps') {
    // labels flank the lamps, so they add to the outside rather than centring over them
    const w = c.steps.reduce((s, [, t]) => s + textWidth(t, 1.7) + 1.2, 0);
    art += w / 2;
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
    if (c.kind === 'knob' || c.kind === 'knack') h = Math.max(h, SIZE[c.size] * 2);
    else if (c.kind === 'display') h = Math.max(h, c.h);
    else if (c.kind === 'jack') h = Math.max(h, c.r * 2);
    else if (c.kind === 'button') h = Math.max(h, c.r * 2);
    else if (c.kind === 'lamps') h = Math.max(h, LAMP_R * 2);
    if (c.label && c.kind !== 'lamps') h = Math.max(h, h);   // label sits below; counted next
    if (c.sub) sub = SUB_H;
  }
  const hasLabel = r.controls.some((c) => c.label && c.kind !== 'lamps' && !c.letter);
  return h + (hasLabel ? LABEL_H : 0) + sub;
}

// ---------------------------------------------------------------------------
// Placing a row: equal visual gaps between extents, centred in the available width.

function placeRow(r, faceW) {
  const hw = r.controls.map(halfWidth);
  const span = hw.reduce((s, w) => s + w * 2, 0);
  const MARGIN = marginFor(faceW);
  const x0 = MARGIN, x1 = faceW - MARGIN;
  const n = r.controls.length;
  const slack = (x1 - x0) - span;
  // One control centres; several share the slack equally between them. Negative slack means the row
  // is wider than the panel — allowed, and reported by the caller, because the honest fix is a wider
  // module or fewer controls, not silent overlap.
  const g = n > 1 ? slack / (n - 1) : 0;
  const xs = [];
  let cur = n > 1 ? x0 : x0 + (x1 - x0) / 2 - hw[0];
  for (let i = 0; i < n; i++) { xs.push(+(cur + hw[i]).toFixed(2)); cur += hw[i] * 2 + g; }
  return { xs, overflow: slack < 0 ? +(-slack).toFixed(2) : 0 };
}

// ---------------------------------------------------------------------------
// Emitting.

function emit(items, c, x, y) {
  const lab = c.label ? { text: c.label, placement: c.above ? 'above' : 'below',
    size: c.labelSize || (c.kind === 'jack' ? JACK_LABEL : LABEL_SIZE), gap: 1.6 } : null;
  switch (c.kind) {
    case 'knob':
      items.push({ t: 'knob', id: c.id, x, y, opts: {
        radius: SIZE[c.size], label: lab,
        ...(c.scale ? { scale: { marks: evenScale(c.scale), size: 1.9, labelGap: 1.1 } } : {}),
      } });
      break;
    case 'knack':
      items.push({ t: 'knack', id: c.id, x, y, opts: {
        radius: SIZE[c.size], port: c.port, label: lab,
        ...(c.depth ? { depth: c.depth, av: 'on' } : {}),
        ...(c.scale ? { scale: { marks: evenScale(c.scale), size: 1.9, labelGap: 1.1 } } : {}),
      } });
      break;
    case 'jack':
      items.push({ t: 'jack', id: c.id, x, y, opts: { r: c.r, label: lab } });
      break;
    case 'button':
      items.push({ t: 'button', id: c.id, x, y, opts: { r: c.r, kind: 'red', label: lab } });
      break;
    case 'lamps': {
      // label · lamp · lamp · label, so each label is beside its own lamp and the pair reads as one
      // switch rather than as two indicators.
      const children = [];
      const n = c.steps.length, spread = (n - 1) * 5;
      let lx = x - spread / 2;
      c.steps.forEach(([value], i) => {
        children.push({ kind: 'lamp', x: +(lx + i * 5).toFixed(2), y, r: LAMP_R, role: 'step-indicator', step: value });
      });
      c.steps.forEach(([, text], i) => {
        const at = lx + i * 5;
        const side = i === 0 ? -1 : (i === n - 1 ? 1 : 0);
        if (side === 0) children.push({ kind: 'label', x: +at.toFixed(2), y: +(y - 3.4).toFixed(2), text, size: 1.7 });
        else children.push({ kind: 'label', x: +(at + side * (LAMP_R + 0.9 + textWidth(text, 1.7) / 2)).toFixed(2), y: +(y + 0.6).toFixed(2), text, size: 1.7 });
      });
      items.push({ t: 'lampGroup', param: c.param, children });
      break;
    }
    case 'display': {
      // A recessed well: the frame line, and a group the host fills. The group carries the id so the
      // host can find it without knowing anything else about the panel.
      const x0 = +(x - c.w / 2).toFixed(2), y0 = +(y - c.h / 2).toFixed(2);
      items.push({ t: 'rect', x: x0, y: y0, w: c.w, h: c.h, rx: 1.2, fill: 'none', stroke: 'frame', sw: 0.355 });
      items.push({ t: 'raw', svg: `  <g data-wcoast-display="${c.id}" data-x="${x0}" data-y="${y0}" data-w="${c.w}" data-h="${c.h}"></g>` });
      break;
    }
    case 'gap': break;
    default: throw new Error(`grammar: unknown control kind "${c.kind}"`);
  }
  // The letter, on the rim at its clock hour. 12 o'clock is straight up and each hour is 30 degrees,
  // so 11 leans left and 1 leans right — which is what makes four of them read as an arc.
  if (c.letter) {
    const rad = (c.at * 30 - 90) * Math.PI / 180;
    const rr = SIZE[c.size] + LETTER_OUT;
    items.push({ t: 'label', x: +(x + rr * Math.cos(rad)).toFixed(2),
      y: +(y + rr * Math.sin(rad) + LETTER_SIZE * 0.36).toFixed(2),
      text: c.letter, opts: { size: LETTER_SIZE, italic: false } });
  }
  if (c.sub) items.push({ t: 'label', x, y: +(y + SIZE[c.size || 'medium'] + LABEL_H + 2.2).toFixed(2), text: c.sub, opts: { size: SUB_SIZE } });
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
  stacked.forEach((b, bi) => {
    if (b.header) { items.push({ t: 'label', x: MARGIN + textWidth(b.header, HEADER_SIZE) / 2, y: +(y + 3.4).toFixed(2), text: b.header, opts: { size: HEADER_SIZE } }); }
    let ry = y + (b.header ? HEADER_H : 0);
    b.rows.forEach((r, ri) => {
      const h = rowHeight(r);
      if (r.placed) {
        for (const it of r.placed) emit(items, it.c, it.x, ry + it.y);
        ry += h + (ri < b.rows.length - 1 ? ROW_PAD + extra : 0);
        return;
      }
      const { xs, overflow } = placeRow(r, faceW);
      if (overflow) warnings.push(`row ${bi}.${ri} overflows the panel by ${overflow}mm`);
      // the row's controls are centred on their art, so the y is the art's centre
      const artH = Math.max(...r.controls.map((c) => (c.kind === 'knob' || c.kind === 'knack') ? SIZE[c.size] * 2
        : c.kind === 'display' ? c.h
          : c.kind === 'jack' ? c.r * 2 : c.kind === 'button' ? c.r * 2 : LAMP_R * 2), 0);
      const cy = +(ry + artH / 2).toFixed(2);
      r.controls.forEach((c, i) => emit(items, c, xs[i], cy));
      ry += h + (ri < b.rows.length - 1 ? ROW_PAD + extra : 0);
    });
    y = ry + PAD + extra;
    const last = bi === stacked.length - 1;
    if (!last) {
      items.push({ t: 'divider', x: MARGIN, y: +y.toFixed(2), len: +(faceW - MARGIN * 2).toFixed(2), w: RULE_W });
      y += PAD;
    }
  });

  // The rule ABOVE the outputs is placed from the output row, not from wherever the bands above
  // happened to finish — flowed, it ran straight across the output jacks whenever the content above
  // ended low.
  if (outBand) {
    items.push({ t: 'divider', x: MARGIN, y: +(FACE_H - OUT_CY_UP - JACK_R - 2.4).toFixed(2),
      len: +(faceW - MARGIN * 2).toFixed(2), w: RULE_W });
  }

  if (outBand) {
    const jacks = outBand.rows[0].controls;
    // The header sits left of the jacks. Its width is taken out of the row before the gaps are shared,
    // so the jacks never run under it.
    const headW = textWidth(outBand.header, 2.2);
    const cy = FACE_H - OUT_CY_UP;
    items.push({ t: 'label', x: MARGIN - 0.5, y: +(cy + 1.2).toFixed(2), text: outBand.header, opts: { size: 2.2, anchor: 'start' } });
    const hw = jacks.map(halfWidth);
    const x0 = MARGIN + headW + 2.5, x1 = faceW - MARGIN;
    const span = hw.reduce((s, w) => s + w * 2, 0);
    const g = jacks.length > 1 ? ((x1 - x0) - span) / (jacks.length - 1) : 0;
    if (g < 0) warnings.push(`output row overflows the panel by ${(-g * (jacks.length - 1)).toFixed(2)}mm`);
    let cur = x0;
    jacks.forEach((c, i) => { emit(items, c, +(cur + hw[i]).toFixed(2), cy); cur += hw[i] * 2 + g; });
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
