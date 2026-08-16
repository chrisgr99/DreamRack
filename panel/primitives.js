'use strict';
// Canonical faceplate control primitives. Each function draws ONE control type as
// an SVG string, styled centrally so every module looks the same. Size, count,
// and position are parameters; style is fixed here. Controls emit the binding
// attributes the host reads (data-wcoast-port / -param / -cx / -cy). See
// design/faceplate-system.md and DESIGN.md §5 (binding contract).

import { JACK_NEUTRAL, JACK_HOLE } from './theme.js';

// Shared <defs> every panel needs: soft drop shadow, the house blue knob ring
// (theme-independent), and the knob cap gradient (theme-dependent — pass the theme
// so light/dark caps differ). Theme is optional (falls back to the light cap).
function defs(theme) {
  const cap = (theme && theme.cap) || ['#f8f8f8', '#bfc3c5', '#f4f4f4', '#777777'];
  const strip = (theme && theme.strip) || ['#f8f8f8', '#d8dbdd', '#f4f4f4', '#9a9a9a'];
  // A radio group's metal plate. The knob cap's gradient is RADIAL — bright centre, falling to the
  // rim, with a specular ring two thirds out — and stretched along a capsule that reads as a smeared
  // bullseye rather than as metal. Same colours, laid out LINEARLY across the strip's short axis,
  // which is what a rolled metal strip actually looks like: two ids, because a vertical group wants
  // the gradient running left to right and a horizontal one top to bottom.
  const stripStops = strip.map((c, i) => `<stop offset="${[0, 0.45, 0.7, 1][i]}" stop-color="${c}"/>`).join('');
  return `<defs>
  <linearGradient id="metalStripV" x1="0" y1="0" x2="1" y2="0">${stripStops}</linearGradient>
  <linearGradient id="metalStripH" x1="0" y1="0" x2="0" y2="1">${stripStops}</linearGradient>
  <radialGradient id="metalDisc">${stripStops}</radialGradient>
  <radialGradient id="blueRing"><stop offset="0" stop-color="#1688cc"/><stop offset="0.55" stop-color="#006da8"/><stop offset="1" stop-color="#003d62"/></radialGradient>
  <radialGradient id="orangeRing"><stop offset="0" stop-color="#f2953a"/><stop offset="0.55" stop-color="#d06b00"/><stop offset="1" stop-color="#6f3800"/></radialGradient>
  <radialGradient id="greenRing"><stop offset="0" stop-color="#3ec06a"/><stop offset="0.55" stop-color="#149146"/><stop offset="1" stop-color="#0a4a24"/></radialGradient>
  <radialGradient id="purpleRing"><stop offset="0" stop-color="#a07ae0"/><stop offset="0.55" stop-color="#7548c0"/><stop offset="1" stop-color="#3d2268"/></radialGradient>
  <radialGradient id="blueDial"><stop offset="0" stop-color="#1d79b7"/><stop offset="0.6" stop-color="#00639a"/><stop offset="1" stop-color="#00456e"/></radialGradient>
  <radialGradient id="knobCap"><stop offset="0" stop-color="${cap[0]}"/><stop offset="0.4" stop-color="${cap[1]}"/><stop offset="0.62" stop-color="${cap[2]}"/><stop offset="1" stop-color="${cap[3]}"/></radialGradient>
  <radialGradient id="redLed"><stop offset="0" stop-color="#ff4a4a"/><stop offset="0.55" stop-color="#d00000"/><stop offset="1" stop-color="#650000"/></radialGradient>
  <radialGradient id="greenLed"><stop offset="0" stop-color="#5cf07a"/><stop offset="0.55" stop-color="#12a531"/><stop offset="1" stop-color="#054d15"/></radialGradient>
  <radialGradient id="orangeLed"><stop offset="0" stop-color="#ffbf5c"/><stop offset="0.55" stop-color="#ef7d00"/><stop offset="1" stop-color="#7a3a00"/></radialGradient>
</defs>`;
}

// Jack (port). Geometry only, per the binding contract: an outer ring around a
// concentric hole, tagged with the port id and its cord-anchor pivot. Neutral by
// default — the host repaints the outer ring by signal family and draws the
// dashed direction ring. `fill` lets the gallery preview a family colour without
// the running host; real panels leave it neutral.
function jack(id, cx, cy, { r = 3.0, hole = 1.6, fill = JACK_NEUTRAL, label: lab = null } = {}) {
  let out = `  <g data-wcoast-port="${id}" data-wcoast-cx="${cx}" data-wcoast-cy="${cy}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="#000000" stroke-width="0.3"/>
    <circle cx="${cx}" cy="${cy}" r="${hole}" fill="${JACK_HOLE}"/>
  </g>`;
  // Optional attached label the jack draws itself — on any side (lab.placement),
  // wrapping to fit (lab.maxWidth), via the shared attachedLabel helper.
  if (lab) out += '\n' + attachedLabel(cx, cy, r, r, lab);
  return out;
}

// vjack — a VIDEO jack. Same anatomy as jack() but the coloured surround is a ROUNDED
// SQUARE rather than a circle, which is what marks the video signal family apart from
// audio, CV and trigger at a glance. Shape, not colour: a jack told apart only by hue is a
// jack that cannot be told apart in peripheral vision, under magnification, or by anyone
// whose colour vision differs.
//
// The square carries NO outline. Every jack already has a soft drop shadow, and that is what
// defines a pale surround against a light faceplate — the black edge the round jacks wear on
// the light panel would fight the black direction dashes at this size.
//
// The host repaints the body in the domain colour and lays the direction dashes on it
// (paintJack / addDirRing): hugging the square's inner edge for an output, hugging the round
// hole for an input. `r` is the half-width, so a vjack and a jack of the same r occupy the
// same footprint.
function vjack(id, cx, cy, { r = 3.0, hole = 1.6, fill = JACK_NEUTRAL, label: lab = null } = {}) {
  const rr = (r * 0.34).toFixed(2);                 // corner radius: square, but not sharp
  let out = `  <g data-wcoast-port="${id}" data-wcoast-cx="${cx}" data-wcoast-cy="${cy}">
    <rect x="${(cx - r).toFixed(2)}" y="${(cy - r).toFixed(2)}" width="${(r * 2).toFixed(2)}" height="${(r * 2).toFixed(2)}" rx="${rr}" fill="${fill}" data-wcoast-role="jackbody"/>
    <circle cx="${cx}" cy="${cy}" r="${hole}" fill="${JACK_HOLE}" data-wcoast-role="jackhole"/>
  </g>`;
  if (lab) out += '\n' + attachedLabel(cx, cy, r, r, lab);
  return out;
}

// Knob (continuous control). House blue ring + metal cap + tick marks + a single
// pointer (the indicator the host rotates). Emits the binding tags and the angle
// sweep. Style is fixed; radius, cap, sweep, and tick count are params. Scales
// (numbers around the dial) are added as a later option. Needs theme for the ink /
// ring-stroke / cap-stroke colours (knobs are baked per theme, not repainted).
// Calibration scale — fixed panel art around a dial: a tick and/or a label at each
// mark's angle (from `at` 0..1 along the sweep, or an explicit `angle`), the label one
// or more lines. Optional 12-o'clock index triangle. Static (not rotated). Shared by
// knob() and knack().
// `owner` — the id of the knob this scale belongs to. Stamped on every numeral so the host can treat
// a knob's whole calibration as ONE block of lettering: hovering any part of it clears the cables over
// all of it, rather than one numeral at a time.
function dialScale(cx, cy, outerR, scale, angleMin, angleMax, ink, owner = null) {
  if (!scale) return '';
  let scaleSvg = '';
  const gap = scale.tickGap ?? 0.6, tlen = scale.tickLen ?? 1.1, lgap = scale.labelGap ?? 1.8;
  const scCol = scale.color || ink, scSize = scale.size ?? 2.0, bSc = scSize + LABEL_BUMP, lh = bSc * 1.1;
  // `r` moves the whole scale in or out from the knob's rim. Panels whose knobs sit close together
  // need their calibration inside the rim or the two knobs' scales collide — which is the sort of
  // thing that used to be solved by hand-drawing the panel and thereby leaving the system.
  const base = scale.r ?? outerR;
  const r0 = base + gap, r1 = r0 + tlen, rl = r1 + lgap;
  for (const m of (scale.marks || [])) {
    const deg = m.angle != null ? m.angle : angleMin + (m.at ?? 0) * (angleMax - angleMin);
    const rad = deg * Math.PI / 180, sn = Math.sin(rad), cs = Math.cos(rad);
    if (m.tick !== false) scaleSvg += `\n    <line x1="${(cx + sn * r0).toFixed(2)}" y1="${(cy - cs * r0).toFixed(2)}" x2="${(cx + sn * r1).toFixed(2)}" y2="${(cy - cs * r1).toFixed(2)}" stroke="${scCol}" stroke-width="0.355"/>`;
    if (m.label != null) {
      const lines = Array.isArray(m.label) ? m.label : [m.label];
      // A LABEL AT 3 OR 9 O'CLOCK REACHES BACK TOWARDS THE KNOB. Every mark used to sit at one radius,
      // measured to the text's CENTRE — which is right at 12 and 6, where the text runs across the
      // radius, and wrong at the sides, where half its width points straight at the rim. On the
      // filter's cutoff knob "100" and "8k" ended up printed over the white ticks. Push each label out
      // by its own half-width, in proportion to how sideways it is: nothing at the top and bottom,
      // all of it at the sides.
      const wHalf = Math.max(...lines.map((ln) => textWidth(String(ln), bSc))) / 2;
      const rlm = rl + Math.abs(sn) * wHalf;
      const lx = cx + sn * rlm, ly = cy - cs * rlm;
      lines.forEach((ln, i) => {
        scaleSvg += '\n    ' + label(lx, ly - (lines.length - 1) * lh / 2 + i * lh + bSc * 0.35, ln, { size: scSize, fill: scCol, owner });
      });
    }
  }
  if (scale.index) {
    const bR = base + gap, tR = bR + tlen + 1.4;
    scaleSvg += `\n    <path d="M ${(cx - 1.3).toFixed(2)} ${(cy - bR).toFixed(2)} L ${cx} ${(cy - tR).toFixed(2)} L ${(cx + 1.3).toFixed(2)} ${(cy - bR).toFixed(2)} Z" fill="#f0f0f0" stroke="${ink}" stroke-width="0.24" stroke-linejoin="round"/>`;
  }
  return scaleSvg;
}

// HOW FAR A PRINTED SCALE ACTUALLY REACHES, in each direction, so a control's own label can be placed
// clear of it. A label used to be set off the RIM, which is right on a bare knob and wrong on a scaled
// one: the filter's CUTOFF sat 1.6mm below an 8.5mm rim while the "20" and "20k" numerals at five and
// seven o'clock reached 11mm down, so the word was printed into its own calibration. Measured, not
// guessed — the marks' ANGLES decide it, and a scale stopping at ten and two o'clock reaches nowhere
// near as far down as one running to five and seven.
function scaleBox(outerR, scale, angleMin, angleMax) {
  if (!scale || !(scale.marks || []).length) return null;
  const gap = scale.tickGap ?? 0.6, tlen = scale.tickLen ?? 1.1, lgap = scale.labelGap ?? 1.8;
  const scSize = scale.size ?? 2.0, bSc = scSize + LABEL_BUMP, lh = bSc * 1.1;
  const rl = (scale.r ?? outerR) + gap + tlen + lgap;
  let up = 0, down = 0, side = 0;
  for (const m of scale.marks) {
    if (m.label == null) continue;
    const deg = m.angle != null ? m.angle : angleMin + (m.at ?? 0) * (angleMax - angleMin);
    const rad = deg * Math.PI / 180, sn = Math.sin(rad), cs = Math.cos(rad);
    const lines = Array.isArray(m.label) ? m.label : [m.label];
    const wHalf = Math.max(...lines.map((ln) => textWidth(String(ln), bSc))) / 2;
    const rlm = rl + Math.abs(sn) * wHalf, hHalf = lines.length * lh / 2;
    down = Math.max(down, -cs * rlm + hHalf);
    up = Math.max(up, cs * rlm + hHalf);
    side = Math.max(side, Math.abs(sn) * rlm + wHalf);
  }
  return { up, down, side };
}

// Every scale label as a box — centre, half-width, half-height — for anything that has to be placed
// AMONG the numerals rather than outside them. scaleBox answers "how far does the scale reach", which
// is the right question for a label going straight down and the wrong one for a trim tucked into the
// gap between two marks: a ring of numerals is not a solid ring, and treating it as one pushes the
// trim out to the panel's edge where it stops looking like part of its knob.
function scaleMarkBoxes(outerR, scale, angleMin, angleMax) {
  if (!scale || !(scale.marks || []).length) return [];
  const gap = scale.tickGap ?? 0.6, tlen = scale.tickLen ?? 1.1, lgap = scale.labelGap ?? 1.8;
  const scSize = scale.size ?? 2.0, bSc = scSize + LABEL_BUMP, lh = bSc * 1.1;
  const rl = (scale.r ?? outerR) + gap + tlen + lgap;
  const out = [];
  for (const m of scale.marks) {
    if (m.label == null) continue;
    const deg = m.angle != null ? m.angle : angleMin + (m.at ?? 0) * (angleMax - angleMin);
    const rad = deg * Math.PI / 180, sn = Math.sin(rad), cs = Math.cos(rad);
    const lines = Array.isArray(m.label) ? m.label : [m.label];
    const hw = Math.max(...lines.map((ln) => textWidth(String(ln), bSc))) / 2;
    const rlm = rl + Math.abs(sn) * hw;
    out.push({ x: sn * rlm, y: -cs * rlm, hw, hh: lines.length * lh / 2 });
  }
  return out;
}

// The half-extent an attached label must clear, on the side it is going.
function labelClear(ext, box, placement = 'below') {
  if (!box) return ext;
  if (placement === 'above') return Math.max(ext, box.up);
  if (placement === 'left' || placement === 'right') return Math.max(ext, box.side);
  return Math.max(ext, box.down);
}

function knob(id, cx, cy, opts = {}) {
  const { radius = 4.6, cap = +(radius * 0.72).toFixed(2), angleMin = -150, angleMax = 150,
    ticks = 7, tickColor = '#ffffff', ring = 'url(#blueRing)', skirt = 0, scale = null, theme = {}, label: lab = null,
    value = null, tint = null } = opts;
  const ink = theme.ink || '#163a69', ringStroke = theme.ringStroke || '#004b7a', capStroke = theme.capStroke || '#666666';
  const a0 = angleMin * Math.PI / 180, a1 = angleMax * Math.PI / 180;
  // White ticks around the rim — mostly ON the blue ring (so they read white in
  // both themes) with a very slight protrusion past the outer circumference.
  const tIn = radius * (1 - TICK_IN), tOut = radius * (1 + TICK_OUT);
  let tickSvg = '';
  for (let k = 0; k < ticks; k++) {
    const a = ticks === 1 ? (a0 + a1) / 2 : a0 + (k / (ticks - 1)) * (a1 - a0);
    const x1 = cx + Math.sin(a) * tIn, y1 = cy - Math.cos(a) * tIn;
    const x2 = cx + Math.sin(a) * tOut, y2 = cy - Math.cos(a) * tOut;
    tickSvg += `\n    <line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${tickColor}" stroke-width="${+(radius * KNACK_GRIP_W).toFixed(4)}"/>`;
  }
  // Optional outer skirt (the large "259t" two-tier knob): a wider dark-blue disc
  // beneath the inner ring. Static, like the ring — only the face rotates.
  const hasSkirt = skirt > radius;
  const skirtSvg = hasSkirt
    ? `\n    <circle cx="${cx}" cy="${cy}" r="${skirt}" fill="url(#blueDial)" stroke="#00507f" stroke-width="0.355"/>` : '';
  // A second pointer segment across the skirt band, colinear with the inner pointer
  // (from the skirt's inner edge out to its outer circumference), same weight. In the
  // indicator group, so it turns with the knob.
  const skirtLine = hasSkirt
    ? `\n      <line x1="${cx}" y1="${(cy - radius).toFixed(2)}" x2="${cx}" y2="${(cy - skirt).toFixed(2)}" stroke="${ink}" stroke-width="0.55"/>` : '';
  // Calibration scale — fixed panel art around the knob: a tick and/or a label at
  // each mark's angle (from `at` 0..1 along the sweep, or an explicit `angle`), the
  // label one or more lines. Optional 12-o'clock index triangle. Static (not rotated).
  const outerR = hasSkirt ? skirt : radius;
  const scaleSvg = dialScale(cx, cy, outerR, scale, angleMin, angleMax, ink, id);
  // The ring and the cap are rotationally
  // symmetric, so they stay put. The ticks and the pointer ARE the knob face — they
  // sit in the indicator group and rotate together, so the ticks turn with the knob.
  let out = `  <g data-wcoast-param="${id}" data-wcoast-cx="${cx}" data-wcoast-cy="${cy}" data-wcoast-angle-min="${angleMin}" data-wcoast-angle-max="${angleMax}">${skirtSvg}
    <circle cx="${cx}" cy="${cy}" r="${radius}" fill="${tint ? tintOf(tint).ring : ring}" stroke="${tint ? tintOf(tint).edge : ringStroke}" stroke-width="0.355"/>
    <circle cx="${cx}" cy="${cy}" r="${cap}" fill="url(#knobCap)" stroke="${capStroke}" stroke-width="0.2366"/>${scaleSvg}
    <g data-wcoast-role="indicator">${tickSvg}
      <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${(cy - cap).toFixed(2)}" stroke="${ink}" stroke-width="0.55"/>${skirtLine}
    </g>
  </g>`;
  const ext = Math.max(radius, skirt);   // label clears the outermost tier (skirt if present)
  out = withPrintedValue(out, cx, cy, ext, value);
  if (lab) {
    const e = labelClear(ext, scaleBox(outerR, scale, angleMin, angleMax), lab.placement);
    out += '\n' + attachedLabel(cx, cy, e, e, lab);
  }
  return out;
}

// knack — THE knAck: a knob whose centre is a CV jack. The panel carries only the
// skeleton (blue ring, cap, centre jack, binding attributes, optional printed scale);
// the app dresses it live — metal band, grips, pointer, AV hemisphere — so improving
// the control in code updates every panel that uses it. Options beyond knob():
//   port     the centre jack's port id (required for a live knАck)
//   depth    the attenuverter (AV) param id — present = the AV capability exists
//   quantize a detented knАck's quantize-toggle param id
//   av       'on' | 'off' — the DESIGNER'S default for whether the AV shows when a
//            cable is patched (the user can flip it from the knob's right-click menu)
// A KNOB'S FURNITURE IS A FRACTION OF ITS RADIUS — the same fractions for an ordinary knob and for a
// knАck, because they are the same control with a jack in the middle of one of them.
//
// Every one of these was a fixed millimetre, so a 1.5mm tick was a quiet detail on a big knob and most
// of the radius on a small one. The fractions are calibrated against the HARMONICS knob on the complex
// oscillator, radius 8.05 — the one whose proportions are right — so that knob is unchanged and every
// other size is that same knob, scaled. No floors: a control drawn too small to read is a control that
// should not have been drawn that small.
const KNOB_REF_R = 8.05;
const kf = (mm) => mm / KNOB_REF_R;
const TICK_IN = kf(1.0);                      // how far a tick reaches INSIDE the rim
const TICK_OUT = kf(0.5);                     // ...and how far it pokes past it
const KNACK_GRIP_LEN = TICK_IN + TICK_OUT;    // a grip is the same mark, described end to end
const KNACK_GRIP_OUT = TICK_OUT;
const KNACK_GRIP_W = kf(0.4);                 // tick thickness
const KNACK_POINTER_W = kf(0.5);              // the indicator line
const KNACK_RING_W = kf(0.355);               // the blue ring's stroke
const KNACK_CAP_W = kf(0.2366);               // the metal cap's stroke

function knack(id, cx, cy, opts = {}) {
  const { radius = 4.6, cap = +(radius * 0.72).toFixed(2), angleMin = -150, angleMax = 150,
    port = null, depth = null, quantize = null, av = null,
    scale = null, theme = {}, label: lab = null } = opts;
  const ink = theme.ink || '#163a69', ringStroke = theme.ringStroke || '#004b7a', capStroke = theme.capStroke || '#666666';
  // The hole keeps its clamp: it is a JACK, and a plug has a real size no matter how small the knob
  // around it is drawn.
  const hole = Math.max(1.1, Math.min(1.8, +(radius * 0.242).toFixed(2)));
  // The band stays tied to the HOLE, not the radius: it is part of the jack, and a jack has to stay a
  // real jack — the same reason the hole itself is clamped.
  const band = +(hole + 1).toFixed(2);
  const gripW = +(radius * KNACK_GRIP_W).toFixed(4);
  const pointerW = +(radius * KNACK_POINTER_W).toFixed(4);
  const ringW = +(radius * KNACK_RING_W).toFixed(4);
  const capW = +(radius * KNACK_CAP_W).toFixed(4);
  const scaleSvg = dialScale(cx, cy, radius, scale, angleMin, angleMax, ink, id);
  // Static preview of the live dress: 7 grip dashes evenly around the rim (the app
  // re-draws these, reading the FIRST white line's length as the dash length — so the
  // grips must precede the pointer here), then a pointer from the jack band to the rim.
  let tickSvg = '';
  for (let k = 0; k < 7; k++) {
    const a = k * (2 * Math.PI / 7);
    const sn = Math.sin(a), cs = Math.cos(a);
    const oR = radius * (1 + KNACK_GRIP_OUT), iR = oR - radius * KNACK_GRIP_LEN;
    tickSvg += `\n      <line x1="${(cx + sn * oR).toFixed(2)}" y1="${(cy - cs * oR).toFixed(2)}" x2="${(cx + sn * iR).toFixed(2)}" y2="${(cy - cs * iR).toFixed(2)}" stroke="#ffffff" stroke-width="${gripW}"/>`;
  }
  const attrs =
    ` data-wcoast-param="${id}" data-wcoast-cx="${cx}" data-wcoast-cy="${cy}"` +
    ` data-wcoast-angle-min="${angleMin}" data-wcoast-angle-max="${angleMax}"` +
    (port ? ` data-wcoast-port="${port}"` : '') +
    (depth ? ` data-wcoast-depth="${depth}"` : '') +
    (quantize ? ` data-wcoast-quantize="${quantize}"` : '') +
    (av ? ` data-wcoast-av="${av}"` : '');
  let out = `  <g${attrs}>
    <circle cx="${cx}" cy="${cy}" r="${radius}" fill="url(#blueRing)" stroke="${ringStroke}" stroke-width="${ringW}"/>
    <circle cx="${cx}" cy="${cy}" r="${cap}" fill="url(#knobCap)" stroke="${capStroke}" stroke-width="${capW}"/>${scaleSvg}
    <circle cx="${cx}" cy="${cy}" r="${band}" fill="#ff7300"/>
    <circle cx="${cx}" cy="${cy}" r="${hole}" fill="#000000" data-wcoast-role="jackhole"/>
    <g data-wcoast-role="indicator">${tickSvg}
      <line x1="${cx}" y1="${(cy - band).toFixed(2)}" x2="${cx}" y2="${(cy - radius).toFixed(2)}" stroke="#ffffff" stroke-width="${pointerW}"/>
    </g>
  </g>`;
  if (lab) {
    const e = labelClear(radius, scaleBox(radius, scale, angleMin, angleMax), lab.placement);
    out += '\n' + attachedLabel(cx, cy, e, e, lab);
  }
  return out;
}

// trim — THE TRIM KNOB: the small knob, for attenuverters and for settings you place by ear.
//
// NOT A KNOB SCALED DOWN. Everything on a knob is a fraction of its radius, so shrinking one shrinks
// its ticks and its cap along with it — and those two stop working long before the knob does. Below
// about 3mm the ticks are hairlines a tenth of a millimetre wide, and the cap's gradient is a grey
// smudge with no room to read as a dome. You would be paying panel space for detail nobody can see.
//
// So the trim drops both and spends everything on the pointer. One flat blue face, the house outline
// so it is visibly the same family, and a pointer running the full radius and OUT PAST THE RIM. The
// overhang is the whole trick: the tip is read against the faceplate rather than against the knob, so
// it stays sharp at sizes where everything inside the circle has gone soft. Same white-on-navy line
// the app draws on a knАck, for the same reason — the white reads on the blue inside, the navy reads
// on the panel outside, in both themes.
//
// ITS WIDTHS ARE ABSOLUTE, not fractions of the radius. A pointer is legible at a width, not at a
// proportion, and this control exists precisely because proportional furniture fails at this size.
//
// NO SCALE ON THE KNOB — nothing is printed inside the rim, because at this size nothing printed
// inside the rim can be read. Two things may sit OUTSIDE it, and both are measured from the
// POINTER'S TIP rather than the rim, or the pointer would cover them:
//
//   `centreMark`  a single tick at twelve o'clock, for a bipolar control whose zero is the middle.
//                 On an attenuverter "is this at zero" is the question you ask constantly, and it is
//                 the only mark worth the millimetre.
//   `scale`       the same dialScale every knob can carry, for a trim standing in for a small
//                 stepped control — the sequencer's ratchet count, where the numerals ARE the
//                 setting. Pass it with `tick: false` marks: the trim's own pointer is what points
//                 at the numeral, and a tick beside a tip that already reaches the numeral is one
//                 mark too many.
//
// WHAT IT COSTS. There is no scale to aim at, so you set a trim by ear, not by eye. Anything where
// you place a specific value — a tuning, a ratio, a time — wants a full knob however rarely you touch
// it. Rarity is not the test; whether you are aiming at a number is.
const TRIM_R = 2.8;              // the house size
const TRIM_OVERHANG = 1.2;       // how far the pointer pokes past the rim
const TRIM_POINTER_W = 0.5;      // the white line
const TRIM_CASING_W = 1.0;       // the navy under it, so the overhanging tip reads on the faceplate
const TRIM_CASING = '#06253d';
// THE CENTRE MARK IS AN INDEX, NOT A DOT. It runs from just clear of the rim out past the pointer's
// tip, so it reads as a proper twelve-o'clock index rather than a speck floating above the knob. At
// zero the pointer lies along its inner half and the mark carries on beyond — pointer meeting its
// reference and continuing, which is exactly the reading you want. The mark is drawn BEFORE the
// indicator so the pointer paints over that overlap rather than fighting it.
const TRIM_MARK_IN = 0.35;       // rim to the mark's inner end: adjacent, not touching
const TRIM_MARK_OUT = 2.5;       // rim to its outer end
// AND IT IS FLANKED BY A MINUS AND A PLUS, each in its own circle — the same marking the complex
// oscillator's big knobs wear, at the size this control can afford. That is what says ATTENUVERTER
// rather than "a knob with a detent in the middle". They sit either side of the mark, halfway along
// it, and inside the trim's own width, so they cost the panel nothing: the rim is still the widest
// thing about the control.
const TRIM_SIGN_R = 1.05;        // the circle
const TRIM_SIGN_X = 1.95;        // its centre, from the axis — 0.9 to 3.0 out, a shade past a 2.8 rim
const TRIM_SIGN_W = 0.28;        // its stroke, and the strokes of the signs inside it
const TRIM_SIGN_OUT = TRIM_SIGN_X + TRIM_SIGN_R;   // how far the pair reaches sideways
// THE LIGHTEST OF THE CAP'S TONES, not one picked by index. A cap is a dome, so its stops run from
// light to dark in an order that DIFFERS BY THEME — the light cap is brightest at its centre and
// darkest at its rim, the dark cap the other way about. Reaching for a fixed stop therefore gave a
// highlight in one theme and a shadow in the other, and the shadow read as a dirty ring rather than
// as a metal collar. Asked for by luminance, it is the cap's highlight in both, and it stays right if
// the stops are ever re-ordered.
function lightestCapTone(theme) {
  const stops = (theme && theme.cap) || ['#f8f8f8', '#bfc3c5', '#f4f4f4', '#777777'];
  const lum = (hex) => {
    const n = parseInt(String(hex).slice(1), 16);
    return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  };
  return stops.reduce((best, c) => (lum(c) > lum(best) ? c : best), stops[0]);
}

// The eye's edge is THE KNOB CAP — the burnished metal that surrounds the orange band on a knАck is
// exactly what surrounds this orange disc, so the two controls have the same anatomy reading outwards:
// signal colour, then metal, then blue. It takes the cap's body tone rather than the cap's gradient,
// because a radial gradient stroked round a 1.4mm circle is a smear, not metal. Theme-dependent, like
// the cap itself — pale on the light faceplate, dark on the dark one.
const TRIM_EYE_EDGE_W = 0.32;

// THE VALUE, PRINTED ON THE PANEL: a large white numeral ABOVE the control, saying what it is set to.
// The other answer to the problem the lit readout solves. Where the readout IS the control and is
// scrolled, this is an ordinary knob that happens to tell you its setting — the gesture everyone
// already knows, minus the one thing a knob cannot do, which is answer without being turned.
//
// ABOVE, not below, so the label keeps the place labels have everywhere else on the rack and the two
// never trade positions from control to control. White and larger than a label, so it reads as a
// value rather than as more lettering.
//
// INSIDE THE CONTROL'S GROUP — which is not cosmetic. The host finds the numeral by searching the
// group it binds, so a numeral printed as a sibling is painted once by the panel and never again.
// Put outside, the number is a picture of one setting; put inside, it is the setting.
// WHAT EACH TINT IS. A layout names the function; this decides the colour, so there is one place to
// change what swing looks like. Anything unnamed is blue, which is the house knob.
const TINTS = {
  blue:   { ring: 'url(#blueRing)',   edge: '#004b7a' },
  orange: { ring: 'url(#orangeRing)', edge: '#8a4700' },
  green:  { ring: 'url(#greenRing)',  edge: '#0b5b2c' },
  purple: { ring: 'url(#purpleRing)', edge: '#4a2a7d' },
};
const tintOf = (t) => TINTS[t] || TINTS.blue;

function withPrintedValue(out, cx, cy, reach, value) {
  if (!value) return out;
  const size = value.size || 3.6;
  const vy = cy - reach - (value.gap == null ? 1.6 : value.gap);
  const svg = `\n    <text x="${cx}" y="${vy.toFixed(2)}" data-wcoast-role="value-text" font-size="${size}" font-weight="700" fill="${value.fill || '#ffffff'}" text-anchor="middle" font-family="Arial Narrow, Helvetica, Arial, sans-serif">${value.text || ''}</text>`;
  const close = out.lastIndexOf('\n  </g>');
  return close < 0 ? out + svg : out.slice(0, close) + svg + out.slice(close);
}

// How much room the numeral takes above the control — the grammar reserves this at the TOP of the row
// and drops the art by it, so nothing lands in the band header above.
// THE INK, not the font size. A numeral reaches about three quarters of its size above the baseline
// and nothing at all below it — reserving a full line's height billed the row for a descender that
// digits do not have, which at twice the size was two and a half millimetres of nothing.
export const printedValueH = (v) => (v && typeof v === 'object' ? (v.size || 3.6) * 0.78 + (v.gap == null ? 1.6 : v.gap) : 0);

function trim(id, cx, cy, opts = {}) {
  const { radius = TRIM_R, angleMin = -150, angleMax = 150, overhang = TRIM_OVERHANG,
    centreMark = false, scale = null, accentPort = null, theme = {}, label: lab = null,
    value = null, tint = null } = opts;
  const ink = theme.ink || '#163a69', ringStroke = theme.ringStroke || '#004b7a';
  const eyeEdge = lightestCapTone(theme);
  const tip = +(cy - (radius + overhang)).toFixed(2);
  // `scale.r` defaults to the tip's radius, so the numerals clear the pointer at every angle.
  const scaleSvg = scale ? dialScale(cx, cy, radius + overhang, scale, angleMin, angleMax, ink, id) : '';
  let markSvg = '';
  if (centreMark) {
    const y0 = +(cy - radius - TRIM_MARK_IN).toFixed(2), y1 = +(cy - radius - TRIM_MARK_OUT).toFixed(2);
    // Halfway along the mark, measured from the knob outwards.
    const sy = +(cy - radius - (TRIM_MARK_IN + TRIM_MARK_OUT) / 2).toFixed(2);
    const q = +(TRIM_SIGN_R * 0.52).toFixed(2);
    const sign = (sx, plus) => {
      let g = `<circle cx="${sx}" cy="${sy}" r="${TRIM_SIGN_R}" fill="none" stroke="${ink}" stroke-width="${TRIM_SIGN_W}"/>`;
      g += `<line x1="${(sx - q).toFixed(2)}" y1="${sy}" x2="${(sx + q).toFixed(2)}" y2="${sy}" stroke="${ink}" stroke-width="${TRIM_SIGN_W}"/>`;
      if (plus) g += `<line x1="${sx}" y1="${(sy - q).toFixed(2)}" x2="${sx}" y2="${(sy + q).toFixed(2)}" stroke="${ink}" stroke-width="${TRIM_SIGN_W}"/>`;
      return g;
    };
    // DRAWN, NOT SET. A plus and a minus as text at this size are two glyphs whose bar heights and
    // widths are the font's business, and they did not line up with each other or sit level with the
    // mark. Two lines and a circle are the same shapes with the geometry under our control.
    // The TICK carries a role: on a trim that attenuates a jack, the host paints it in that jack's
    // colour once something is patched, and runs a line from the jack up to its top end. The signs
    // either side stay in the panel's ink — they say which way is more, which is true whatever is
    // plugged in. See rack._syncDepthTrims.
    markSvg = `\n    <line x1="${cx}" y1="${y0}" x2="${cx}" y2="${y1}" stroke="${ink}" stroke-width="0.4" data-wcoast-role="trim-tick" data-tick-top="${y1}"/>`
      + `\n    ${sign(+(cx - TRIM_SIGN_X).toFixed(2), false)}`
      + `\n    ${sign(+(cx + TRIM_SIGN_X).toFixed(2), true)}`;
  }
  // ACCENT — AN EYE AT THE CENTRE, in the family colour of the jack this trim attenuates. It is a
  // deliberate echo of the knАck it belongs to: that control is a knob with a coloured centre, and so
  // is this one, at a size that says "related to" rather than "another socket". Solid, with no dark
  // hole: a ring around a hole is what a jack looks like, and a trim you could mistake for something
  // to plug into is worse than no link at all.
  //
  // ITS RIM STAYS HOUSE BLUE. Colouring the rim instead was tried and read as a different family of
  // knob rather than as a relative of the one beside it — the outline is what says which family a
  // control belongs to, and the centre is what says which signal.
  //
  // The panel ships it NEUTRAL and the host paints it at load, through the port id tagged on the
  // group — the same paint from the same table that colours the jack, so the link is literal. Baking
  // orange would have been right everywhere on the rack today, since every trimmed input is
  // control-domain, and would have quietly stopped being right the first time one was not.
  // HALF THE CAP'S DIAMETER, RINGED IN DARK GREY. Size alone was doing all the work and the eye kept
  // reading as a painted dot: at a third it was too small to mean anything, at two thirds it swamped
  // the blue. The outline is what settles it — every jack on the panel is a coloured disc with a dark
  // edge, so a coloured disc with a dark edge is recognisably OF that family without being a socket,
  // and once it has the edge it no longer needs the size.
  const accentR = accentPort ? +(radius * 0.5).toFixed(2) : 0;
  const accent = accentPort ? ` data-wcoast-accent-port="${accentPort}"` : '';
  const accentSvg = accentPort
    ? `\n    <circle cx="${cx}" cy="${cy}" r="${accentR}" fill="${JACK_NEUTRAL}" stroke="${eyeEdge}" stroke-width="${TRIM_EYE_EDGE_W}" data-wcoast-role="trim-accent"/>` : '';
  // THE POINTER STARTS AT THE EYE'S EDGE, not at the centre — exactly as a knАck's pointer starts at
  // the edge of its jack band. Run to the centre it would bisect the eye and spoil both.
  const pFrom = +(cy - accentR).toFixed(2);
  let out = `  <g data-wcoast-param="${id}" data-wcoast-cx="${cx}" data-wcoast-cy="${cy}" data-wcoast-angle-min="${angleMin}" data-wcoast-angle-max="${angleMax}"${accent}>
    <circle cx="${cx}" cy="${cy}" r="${radius}" fill="${tintOf(tint).ring}" stroke="${tint ? tintOf(tint).edge : ringStroke}" stroke-width="0.355"/>${markSvg}${scaleSvg}${accentSvg}
    <g data-wcoast-role="indicator">
      <line x1="${cx}" y1="${pFrom}" x2="${cx}" y2="${tip}" stroke="${TRIM_CASING}" stroke-width="${TRIM_CASING_W}" stroke-linecap="round"/>
      <line x1="${cx}" y1="${pFrom}" x2="${cx}" y2="${tip}" stroke="#ffffff" stroke-width="${TRIM_POINTER_W}"/>
    </g>
  </g>`;
  // The numeral clears the POINTER, not the rim, for the same reason the label does.
  const reach = radius + overhang;
  out = withPrintedValue(out, cx, cy, reach, value);
  // The label clears the POINTER too — it sweeps to within 30 degrees of straight down, so a label
  // set at the rim would have the tip land on it. A centre-marked trim takes its label below.
  if (lab) out += '\n' + attachedLabel(cx, cy, reach, reach, lab);
  return out;
}

// --- text / labels ------------------------------------------------------------
// One canonical text style (house italic bold), used by free-floating labels and
// by controls' own attached labels. Supports multi-line: pass an explicit break
// with "\n", or a `maxWidth` (mm) to word-wrap to fit — so the SAME label reads
// "phase lock" on one line where there's room, or wraps to two lines where it's
// tight, chosen by the space it's given rather than by re-authoring the text.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Rough per-glyph advance for Arial Narrow at a given size — enough to decide word
// wraps for short control legends (no DOM at generation time).
function charW(ch, size) {
  if (ch === ' ') return 0.28 * size;
  if ("iljtI.,'!|:;".includes(ch)) return 0.22 * size;
  if ('fr'.includes(ch)) return 0.33 * size;
  if ('mw'.includes(ch)) return 0.72 * size;
  if ('MW'.includes(ch)) return 0.80 * size;
  if (ch >= 'A' && ch <= 'Z') return 0.56 * size;
  if (ch >= '0' && ch <= '9') return 0.50 * size;
  return 0.46 * size;
}
const textWidth = (str, size) => { let w = 0; for (const ch of String(str)) w += charW(ch, size); return w; };

// Split into display lines: honour explicit "\n", then greedy word-wrap each
// segment to maxWidth (skipped when maxWidth <= 0).
function wrapLines(text, size, maxWidth) {
  const out = [];
  for (const seg of String(text).split('\n')) {
    if (!(maxWidth > 0)) { out.push(seg); continue; }
    let line = '';
    for (const word of seg.split(/\s+/).filter(Boolean)) {
      const trial = line ? line + ' ' + word : word;
      if (line && textWidth(trial, size) > maxWidth) { out.push(line); line = word; } else line = trial;
    }
    out.push(line);
  }
  return out.length ? out : [''];
}

// Global bump applied to every rendered label — ~2 typographic points (0.706mm).
const LABEL_BUMP = 0.706;

// Label. `x,y` is the anchor of the FIRST line; extra lines stack downward.
function label(x, y, text, { size = 2.4, fill = '#000000', anchor = 'middle', rotation = 0, maxWidth = 0, lineHeight = 1.15, weight = 700, italic = true, owner = null } = {}) {
  size += LABEL_BUMP;
  const lines = wrapLines(text, size, maxWidth);
  // `owner` NAMES THE CONTROL THIS LABEL BELONGS TO. A label is a sibling of its control's group, not
  // a child of it — nesting it would change what a press on the name does — so without this the host
  // has no way to ask "where is this jack's name", which is what the cable fade needs: a cable lying
  // across a label makes it just as unreadable as one across the jack.
  const own = owner ? ` data-wcoast-label-for="${owner}"` : '';
  const style = `font-size="${size}" font-weight="${weight}"${italic ? ' font-style="italic"' : ''} fill="${fill}" text-anchor="${anchor}" font-family="Arial Narrow, Helvetica, Arial, sans-serif"${own}`;
  const rot = rotation ? ` transform="rotate(${rotation} ${x} ${y})"` : '';
  if (lines.length === 1) return `  <text x="${x}" y="${y}" ${style}${rot}>${esc(lines[0])}</text>`;
  const dy = +(size * lineHeight).toFixed(2);
  const tspans = lines.map((ln, i) => `<tspan x="${x}" dy="${i ? dy : 0}">${esc(ln)}</tspan>`).join('');
  return `  <text x="${x}" y="${y}" ${style}${rot}>${tspans}</text>`;
}

// Attach a label to a control centred at (cx,cy) with half-width hw and half-height
// hh. `placement` puts it below / above / left / right; the text block is centred
// on the control's axis and wraps to `maxWidth`. Control-type-agnostic — any
// control that names itself calls this, so placement and wrapping behave the same
// everywhere. Returns the label SVG.
function attachedLabel(cx, cy, hw, hh, spec = {}) {
  const { text, placement = 'below', gap = 1.6, size = 2.4, maxWidth = 0, fill = '#000000', lineHeight = 1.15, owner = null } = spec;
  const bs = size + LABEL_BUMP;   // label() bumps too; position/wrap at the same size
  const lines = wrapLines(text, bs, maxWidth);
  const n = lines.length, lh = bs * lineHeight, cap = bs * 0.72;
  let x, y, anchor;
  if (placement === 'left' || placement === 'right') {
    anchor = placement === 'left' ? 'end' : 'start';
    x = cx + (placement === 'left' ? -(hw + gap) : hw + gap);
    y = cy - (n - 1) * lh / 2 + cap * 0.5;            // vertically centre the block on cy
  } else if (placement === 'above') {
    anchor = 'middle'; x = cx;
    y = cy - hh - gap - (n - 1) * lh;                 // last line sits just above the control
  } else {                                            // below (default)
    anchor = 'middle'; x = cx;
    y = cy + hh + gap + cap;                          // first line sits just below the control
  }
  return label(x, y, lines.join('\n'), { size, fill, anchor, lineHeight, owner });
}

// --- LED lamp · buttons · radio groups · slider -------------------------------

// LED colours. Red is the house default and every existing panel uses it; green and
// orange exist so a module can distinguish lamps that mean different things sitting
// side by side (the sequencer's START / END / PLAY columns). Each entry carries the
// static gradient, the ring, and the glossy highlight tint.
const LED = {
  red: { grad: 'redLed', stroke: '#7c0000', gloss: '#ffb4b4' },
  green: { grad: 'greenLed', stroke: '#005c1e', gloss: '#b7ffc6' },
  orange: { grad: 'orangeLed', stroke: '#8a3d00', gloss: '#ffdcb0' },
};

// An LED lamp with a highlight — the shared building block for radios, buttons, and
// indicators. Pass role/step to make it a bindable step-indicator; `white` for the
// light push-button disc instead of an LED; `led` to pick the LED colour.
// `off` — the colour this lamp shows when it is NOT lit. Panels have always used one grey; a button
// that is the whole point of its module can say otherwise, and the host reads the attribute back when
// it draws the unlit state.
function ledLamp(cx, cy, { r = 1.66, role = null, step = null, white = false, on = true, led = 'red', off = null } = {}) {
  // `on` bakes the lit / unlit state for a static render; the host's showStep
  // repaints step-indicators live, so it only matters before load. The colour is
  // carried on the element as data-wcoast-led so showStep can light the right one —
  // a lamp with no such attribute is red, which is every panel authored so far.
  const c = LED[led] || LED.red;
  const fill = white ? '#e9e9ec' : (on ? `url(#${c.grad})` : (off || '#505055'));
  const stroke = white ? '#8a8a8e' : (on ? c.stroke : '#4a4a4a'), sw = white ? '0.35' : '0.2366';
  const roleAttr = role ? ` data-wcoast-role="${role}"${step != null ? ` data-wcoast-step="${step}"` : ''}` : '';
  const ledAttr = (!white && led !== 'red') ? ` data-wcoast-led="${led}"` : '';
  // The host redraws this circle whenever the value changes, so the unlit colour has to travel WITH
  // the element — it cannot be inferred from a fill that is about to be overwritten.
  const offAttr = off ? ` data-wcoast-off="${off}"` : '';
  const hr = 0.3 * r, hx = cx - 0.28 * r, hy = cy - 0.28 * r;
  const hFill = white ? '#ffffff' : c.gloss, hOp = white ? '0.8' : (on ? '0.85' : (off ? '0.35' : '0'));
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${roleAttr}${ledAttr}${offAttr}/>`
    + `<circle cx="${hx.toFixed(2)}" cy="${hy.toFixed(2)}" r="${hr.toFixed(2)}" fill="${hFill}" opacity="${hOp}" data-wcoast-role="led-gloss" pointer-events="none"/>`;
}

// Small wave/shape glyph for a mode step, centred at (gx,gy): transient · sustained
// · cyclic (also triangle) · sawtooth · square.
function waveGlyph(kind, gx, gy, color = '#163a69', w = 1.3) {
  const t = (gy - 0.7).toFixed(2), b = (gy + 0.7).toFixed(2), sw = 0.3, L = (gx - w).toFixed(2), R = (gx + w).toFixed(2);
  if (kind === 'square') return `<path d="M ${L} ${b} L ${L} ${t} L ${gx} ${t} L ${gx} ${b} L ${R} ${b} L ${R} ${t}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  let pts;
  if (kind === 'transient') pts = `${L},${b} ${gx},${t} ${R},${b}`;
  else if (kind === 'sustained') pts = `${L},${b} ${(gx - 0.5).toFixed(2)},${t} ${(gx + 0.5).toFixed(2)},${t} ${R},${b}`;
  else if (kind === 'sawtooth') pts = `${L},${b} ${R},${t} ${R},${b}`;
  else pts = `${L},${b} ${(gx - 0.65).toFixed(2)},${t} ${gx},${b} ${(gx + 0.65).toFixed(2)},${t} ${R},${b}`;   // cyclic / triangle
  return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round"/>`;
}

// Momentary / toggle push-button — a single step-indicator lamp. kind 'red' (LED)
// or 'white' (light disc). Covers strike, trig, mute, clock-on.
// BUTTON — a lamp ON ITS OWN, mounted in a small metal disc. A radio lamp and a push button are the
// same drawing, so what tells them apart is the METAL THEY SIT IN and nothing else: a stem linking
// several lamps says one control with several positions, a disc under one lamp says this one stands
// alone. Same material either way, so the whole family reads as one idea rather than as a rule and an
// exception.
//
// It replaces a thin ring the width of a panel rule. That worked while the radio group was a filled
// slab and stopped working the moment the group became a stem — a hairline ring beside a metal stem
// reads as two unrelated marks, where a disc beside a stem reads as two shapes of the same thing.
const BUTTON_METAL = 0.7;     // how far the disc reaches past the lamp
// AT REST, AND THAT MEANS UNLIT. An LED button used to bake itself lit, so the sequencer's eight play
// buttons came up as a column of eight burning orange lamps beside two loop-window tracks showing one
// lit each — which reads as "all eight of these are on" and undoes the distinction the track draws.
// A button's resting state is off. `on: true` is for a specimen that is standing in for a lamp.
// A white disc has no lit state, so it is always drawn as itself.
function button(id, cx, cy, { r = 2.2, kind = 'red', on = false, label: lb = null, theme = {}, off = null } = {}) {
  // POINTER-EVENTS NONE, and a role so the host can find it. The disc is drawn on top of the button's
  // invisible hit pad, so as an ordinary filled circle it SWALLOWED every click that landed on the
  // metal rather than on the lamp — the control shrank to the lamp the moment it got its mounting.
  const ring = `<circle cx="${cx}" cy="${cy}" r="${(r + BUTTON_METAL).toFixed(2)}" fill="url(#metalDisc)" pointer-events="none" data-wcoast-role="button-metal"/>`;
  const lamp = ring + ledLamp(cx, cy, { r, white: kind === 'white', led: kind === 'white' ? 'red' : kind, role: 'step-indicator', step: 'on', on: kind === 'white' ? true : on, off });
  // Label placement goes through attachedLabel so it always clears the lamp
  // (first line sits gap+cap below the edge), the same as jack/knob labels.
  const lbl = lb ? '\n    ' + attachedLabel(cx, cy, r, r, { fill: '#163a69', ...lb }) : '';
  return `  <g data-wcoast-param="${id}">${lamp}${lbl}</g>`;
}

// Radio group — one stepped param shown as a row/column of LED lamps (one lit).
// steps: [{ value, label?, glyph? }]. orientation 'h' | 'v'. Each LED can carry a
// side label (v → right, h → below) or a wave glyph (below).
// How far a group's furniture reaches past a lamp, and how far a label sits beyond that.
const LAMP_PAD = 0;           // labels are measured off the LAMP's edge; the stem is narrower than that
// THE STEM IS HALF A LAMP WIDE — one radius across, centred on the line of lamps, so the metal reads
// as a rod the lamps are strung on rather than a plate they are set into. It was a full-width capsule
// first, tangent to the lamps: better than the dark recess it replaced, but still a slab, and far
// more emphasis than a setting you place once and leave.
const STEM_FRAC = 0.5;        // of a lamp's WIDTH, so half a diameter — one radius
// AND IT CARRIES NO OUTLINE. At exactly lamp width the plate's rounded ends ARE the first and last
// lamps' own circles, so an outline would trace straight over their rings and leave those two looking
// heavier than the rest. Metal against the faceplate reads on its own in both themes.
const LAMP_LABEL_GAP = 1.3;
const lampReach = (ledR) => ledR + LAMP_PAD;

// A RADIO GROUP IS ONE CONTROL WITH N POSITIONS, and its METAL PLATE is what says so: a capsule with
// round ends that the lamps are mounted in, in the same burnished metal as a knob's cap and edged
// with the same outline. That is the point of choosing it — the faceplate's materials are blue
// plastic, burnished metal, black sockets and grey panel, so a radio group is not a new material but
// an existing one in a new shape. Metal is what a lamp is mounted in; the shape of the metal says how
// many lamps share it.
//
// TWO OTHER FORMS WERE TRIED AND ARE NOT HERE. A recessed dark capsule borrowed from the fader's slot
// — right idea, wrong material: the fader's slot earns its shading by having a handle sitting in it,
// so a dark region with nothing sliding in it read as the odd thing out on every panel. And short
// connectors between adjacent lamps: on a tight group like the filter's those are 1.2mm stubs, and
// being broken they say "linked in pairs" where the truth is "one control".
// COLUMNS: a vertical stack may be folded into two or more columns, filling the first from the top
// before starting the next. It is one group, not several side by side, because a parameter can carry
// exactly ONE control — the loader rejects a second group with the same id, so two stacks would leave
// the second one dead. Eight named modes is what forced this: as a single column it is 40mm of panel
// and sets the module's height, folded it is 20mm and lets the module be narrow instead of tall.
// `colGap` is centre to centre, and has to clear the widest LABEL, not the lamp.
function radioGroup(id, cx, cy, { steps = [], orientation = 'v', spacing = 5.6, ledR = 2.16, size = 2.1, outline = true, value = null, led = 'red', theme = {}, labelLeft = false, columns = 1, colGap = 0, labelDrop = 0 } = {}) {
  const ink = theme.ink || '#163a69', n = steps.length;
  const tHalf = lampReach(ledR);
  const cols = orientation === 'h' ? 1 : Math.max(1, Math.round(columns));
  const perCol = Math.ceil(n / cols);
  // Where a step sits, as a column and a row within it. One column is the old arithmetic exactly.
  const place = (i) => {
    if (cols === 1) return { col: 0, row: i, rows: n };
    const col = Math.floor(i / perCol);
    const rows = Math.min(perCol, n - col * perCol);
    return { col, row: i - col * perCol, rows };
  };
  let g = `  <g data-wcoast-param="${id}">`;
  // CENTRE TO CENTRE, AND THE LAMPS PAINT OVER IT. Stopping the stem where it touches a lamp on the
  // axis leaves a nick at each of its corners — a circle curves away from its tangent, so at the
  // stem's outer edges the lamp's boundary is some 13% of a radius further in. Running it right
  // through and drawing the lamps on top hides the overlap and leaves the stem meeting each circle
  // cleanly across its whole width, wrapped by the lamp's own edge.
  if (outline && n > 1) {
    const sw = ledR * 2 * STEM_FRAC;
    const fill = orientation === 'h' ? 'url(#metalStripH)' : 'url(#metalStripV)';
    // ONE STEM PER COLUMN. A single stem spanning both would run through the labels between them.
    for (let c = 0; c < cols; c++) {
      const rows = cols === 1 ? n : Math.min(perCol, n - c * perCol);
      if (rows < 2) continue;
      const half = (rows - 1) / 2 * spacing;
      const x0 = cx + (c - (cols - 1) / 2) * colGap;
      const w = orientation === 'h' ? half * 2 : sw;
      const h = orientation === 'h' ? sw : half * 2;
      g += `\n    <rect x="${(x0 - w / 2).toFixed(2)}" y="${(cy - h / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="${fill}"/>`;
    }
  }
  steps.forEach((s, i) => {
    const p = place(i);
    const off = (p.row - (p.rows - 1) / 2) * spacing;
    const colX = cx + (p.col - (cols - 1) / 2) * colGap;
    const lx = orientation === 'h' ? cx + (i - (n - 1) / 2) * spacing : colX, ly = orientation === 'h' ? cy : cy + off;
    // ONE LIT, THE REST DARK, in the static art too. Every lamp used to be drawn lit, which on a
    // track reads as a row of indicators all shouting at once rather than as a switch resting in one
    // position. `value` says which; without it, the first. The host repaints from the real value at
    // load, so this only decides what a screenshot and a cold panel look like — but that is exactly
    // where the control has to explain itself.
    g += `\n    ${ledLamp(lx, ly, { r: ledR, role: 'step-indicator', step: s.value, led, on: value != null ? s.value === value : i === 0 })}`;
    if (s.glyph) {
      const gx = orientation === 'h' ? lx : lx + tHalf + 2.2, gy = orientation === 'h' ? ly + tHalf + 2.4 : ly;
      g += `\n    ${waveGlyph(s.glyph, gx, gy, ink)}`;
    }
    if (s.label) {
      // PERPENDICULAR TO THE LAMP AXIS, always: beside a vertical stack, beneath a horizontal row.
      // Never in line with the lamps — a label between two lamps belongs to neither of them.
      // LABELS MAY SIT TO THE LEFT of a vertical stack. A mirrored panel carries a radio each side of
      // its centre line, and the right-hand one has its neighbour on the right — labels running that
      // way land on top of it. Reading right to left costs nothing; landing on a knob costs the knob.
      const side = labelLeft && orientation !== 'h' ? -1 : 1;
      // `labelDrop` pushes a horizontal group's words further below its lamps — at a larger label size
      // the standard gap puts them through the lamp rather than under it.
      const tx = orientation === 'h' ? lx : lx + side * (tHalf + LAMP_LABEL_GAP), ty = orientation === 'h' ? ly + tHalf + 2.3 + labelDrop : ly + size * 0.35;
      g += `\n    ${label(tx, ty, s.label, { size, fill: ink, anchor: orientation === 'h' ? 'middle' : (side < 0 ? 'end' : 'start') })}`;
    }
  });
  return g + `\n  </g>`;
}

// Stepper button — ONE momentary push-button that cycles a stepped param, with a
// row of small indicator lamps (one per step: the active one lit red, the rest
// grey), each carrying a text label or a wave glyph. `steps.length` sets the lamp
// count. orientation 'v' puts the button ABOVE the lamp row, 'h' to its LEFT. The
// button carries data-wcoast-role="stepper" (the host advances the param on each
// click, wrapping); the lamps are step-indicators and are NOT clickable, so they
// can be small. Same one-of-N model as radioGroup, but a single actuator.
function stepButton(id, cx, cy, { steps = [], orientation = 'v', btnR = 2.2, ledR = 0.95, spacing = 4.5, size = 1.9, active = 0, theme = {} } = {}) {
  const ink = theme.ink || '#163a69', capStroke = theme.capStroke || '#666';
  const n = steps.length, rowW = (n - 1) * spacing;
  const lx0 = orientation === 'h' ? cx + btnR + 1.2 + ledR : cx - rowW / 2;
  const ly = orientation === 'h' ? cy : cy + btnR + 1.2 + ledR;
  let g = `  <g data-wcoast-param="${id}">`;
  // metal-dome push button with a slightly raised centre; the actuator (role=stepper)
  g += `\n    <circle cx="${cx}" cy="${cy}" r="${btnR}" fill="url(#knobCap)" stroke="${capStroke}" stroke-width="0.3" data-wcoast-role="stepper" style="cursor:pointer"/>`;
  g += `\n    <circle cx="${cx}" cy="${cy}" r="${(btnR * 0.52).toFixed(2)}" fill="url(#knobCap)" stroke="${capStroke}" stroke-width="0.18" pointer-events="none"/>`;
  g += `\n    <circle cx="${(cx - btnR * 0.2).toFixed(2)}" cy="${(cy - btnR * 0.2).toFixed(2)}" r="${(btnR * 0.16).toFixed(2)}" fill="#ffffff" opacity="0.55" pointer-events="none"/>`;
  for (let i = 0; i < n; i++) {
    const s = steps[i], px = lx0 + i * spacing;
    g += `\n    ${ledLamp(px, ly, { r: ledR, role: 'step-indicator', step: s.value, on: i === active })}`;
    if (s.glyph) g += `\n    ${waveGlyph(s.glyph, px, ly + ledR + 2.0, ink)}`;
    else if (s.label) g += `\n    ${label(px, ly + ledR + 2.4, s.label, { size, fill: ink })}`;
  }
  return g + `\n  </g>`;
}

// Vertical fader — a track with a handle riding top..bot; the host translates the
// handle by value. `valuePos` 0..1 sets the authored (rendered) position.

// ---- readout --------------------------------------------------------------------------------
// A LIT WINDOW YOU SCROLL. It shows its own value in green digits and steps through the setting's
// values under the wheel — a control and its own indication in one object.
//
// WHY IT EXISTS. A knob shows a POSITION. Ask one "am I on 8 or on 10?" and you have to turn it and
// watch something else to find out. Where the values are a short discrete list and the number is what
// matters — a clock ratio, a loop length, a delay of 1/16 — the number itself is the better control,
// and it takes about a third of the panel a knob and its separate display took between them.
//
// GREEN SAYS YOU CAN CHANGE IT. The engine-driven windows on the same panel — a tempo that is being
// told to you — stay in the panel's ink. Green is this control's colour and means the wheel does
// something here.
//
// THE COLOUR IS AN OPTION, though, because a panel may want a value to belong to something: the same
// window in the colour a section is coded in says which section it settles. Green is the default and
// the meaning above is why. Whatever it is set to, the LIST that opens over the window is set in it
// too — the host reads the colour off the digits rather than being told it twice.
//
// IT IS A SPIN CONTROL. The chevrons outside the right edge are pressable: up for the next value, down
// for the previous, and the wheel does the same thing anywhere on the window. They began as a legend —
// marks that said "scroll me" without being targets — but a mark that looks like a button and is not
// one is worse than a button, and one click is cheaper than finding the wheel for a single step.
//
// EACH CARRIES AN INVISIBLE HIT PAD wider than the mark it wraps. The chevrons are about two
// millimetres across, which is a hard target under magnification; the pad is the size of a jack.
const READOUT_H = 6.2;                 // window height; the digits fill most of it
const READOUT_CH = 2.55;               // width per character, at the size the digits are set
// LEFT AND RIGHT PADDING INSIDE THE WINDOW. A millimetre and a half each side suits a window sized by
// a character count, where the count is already generous and the air is what stops the digits touching
// the frame. A window measured to an exact string can spend less: `pad` is how much, per control.
const READOUT_PAD = 1.5;
const READOUT_ARROW_GAP = 1.1;         // window edge to the chevrons
const READOUT_GREEN = '#4ee37a';

// `size` scales the whole window — its height and, with it, the digits. The house height suits a
// value read in passing beside a knob; a module whose PRINCIPAL controls are windows rather than
// knobs wants them at the size a knob would have been, or the panel has nothing on it to look at.
function readout(id, cx, cy, { chars = 3, value = '', label: lb = null, theme = {}, menu = false, digits = READOUT_GREEN, widest = null, pad = READOUT_PAD, width = 0, size = 1 } = {}) {
  // This file rounds inline everywhere else; one local helper keeps the path data readable.
  const r2 = (v) => (+v).toFixed(2);
  const h = READOUT_H * (size || 1);
  // MEASURED, WHEN THE WIDEST VALUE IS KNOWN. A character count has to assume every character is as
  // wide as the widest one, which for digits is nearly true and for '1/16' is not — a slash and two
  // ones are half the width of two eights, so the delay windows were a third wider than anything they
  // would ever hold. `widest` is the longest string the control can show; the window is set to it.
  // A WIDTH ASKED FOR, or a width measured. Given one, the digits are set to whatever size makes the
  // widest value fit it — because a window told to be eight and a half millimetres wide and left with
  // type sized for ten is a window with its number hanging out of both ends. Text width is linear in
  // size, so the size that fits is a division.
  const digitH = width && widest
    ? Math.min(h * 0.78, (width - pad * 2) / textWidth(widest, 1))
    : h * 0.78;
  const w = +(width || (widest ? textWidth(widest, digitH) + pad * 2 : chars * READOUT_CH + pad * 2)).toFixed(2);
  const x = +(cx - w / 2).toFixed(2), y = +(cy - h / 2).toFixed(2);
  const dark = (theme && theme.face || '').toLowerCase() !== '#cfcfcf';
  const field = dark ? '#101216' : '#15171c';   // the window is a dark field in both themes, as a display is
  let g = `  <g data-wcoast-param="${id}" data-wcoast-role="readout"${menu ? ' data-wcoast-menu="1"' : ''} data-wcoast-cx="${r2(cx)}" data-wcoast-cy="${r2(cy)}" data-wcoast-w="${w}">`;
  g += `\n    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.2" fill="${field}" stroke="${theme.frame || '#8a8a90'}" stroke-width="0.3"/>`;
  // The digits. data-wcoast-role="readout-text" is what the loader repaints; the value baked in here
  // is only what the SVG shows before anything is bound.
  g += `\n    <text x="${r2(cx)}" y="${r2(cy + h * 0.31)}" data-wcoast-role="readout-text" font-size="${r2(digitH)}" font-weight="700" fill="${digits}" text-anchor="middle" font-family="Arial Narrow, Helvetica, Arial, sans-serif">${value}</text>`;
  // The chevrons, outside the right edge.
  // Bigger and further apart than they first were: at working size two 0.85mm chevrons half a
  // millimetre apart read as one small glyph rather than as up and down.
  const ax = x + w + READOUT_ARROW_GAP, half = 1.2, rise = 1.05, gap = 0.8;
  const up = `M ${r2(ax - half)} ${r2(cy - gap)} L ${r2(ax)} ${r2(cy - gap - rise)} L ${r2(ax + half)} ${r2(cy - gap)}`;
  const dn = `M ${r2(ax - half)} ${r2(cy + gap)} L ${r2(ax)} ${r2(cy + gap + rise)} L ${r2(ax + half)} ${r2(cy + gap)}`;
  const arrow = (d, role, cyPad) =>
    `\n    <g data-wcoast-role="${role}">` +
    `\n      <rect x="${r2(ax - 2.1)}" y="${r2(cyPad - 1.9)}" width="4.2" height="3.8" fill="none" pointer-events="all"/>` +
    `\n      <path d="${d}" fill="none" stroke="${theme.ink || '#888'}" stroke-width="0.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.75"/>` +
    `\n    </g>`;
  // NO CHEVRONS ON A MENU READOUT. They are up and down by one, and a control whose values you pick
  // from a list has no next and no previous worth drawing — a pair of arrows beside it would offer a
  // second, slower way to do the thing the list does in one gesture.
  if (!menu) {
    g += arrow(up, 'readout-up', cy - gap - rise / 2);
    g += arrow(dn, 'readout-down', cy + gap + rise / 2);
  }
  // The name, beneath, exactly as a knob or a jack wears it — measured from the window's half-height
  // so it clears the box rather than the text inside it.
  if (lb) g += '\n    ' + attachedLabel(cx, cy, w / 2, h / 2, { fill: theme.ink || '#163a69', ...lb });
  return g + `\n  </g>`;
}

function slider(id, cx, { top = 24, bot = 78, valuePos = 0.5, theme = {} } = {}) {
  const track = theme.track || '#3a3d43', trackEdge = theme.trackEdge || '#222222';
  const handle = theme.handle || '#e9e9ec', handleEdge = theme.handleEdge || '#8a8a8e', handleLine = theme.handleLine || '#555555';
  const travel = bot - top, mid = top + travel / 2, hy = bot - valuePos * travel;
  return `  <g data-wcoast-param="${id}" data-wcoast-role="slider" data-wcoast-cx="${cx}" data-wcoast-top="${top}" data-wcoast-bot="${bot}">
    <rect x="${(cx - 1.2).toFixed(2)}" y="${(top - 2).toFixed(2)}" width="2.4" height="${(travel + 4).toFixed(2)}" rx="1.2" fill="${track}" stroke="${trackEdge}" stroke-width="0.3"/>
    <g data-wcoast-role="handle" transform="translate(0 ${(hy - mid).toFixed(3)})">
      <rect x="${(cx - 4).toFixed(2)}" y="${(mid - 2.2).toFixed(2)}" width="8" height="4.4" rx="1.1" fill="${handle}" stroke="${handleEdge}" stroke-width="0.4"/>
      <line x1="${(cx - 3.2).toFixed(2)}" y1="${mid}" x2="${(cx + 3.2).toFixed(2)}" y2="${mid}" stroke="${handleLine}" stroke-width="0.7"/>
    </g>
  </g>`;
}

// VU meter — a run of small rectangular segments the host lights from level. Each
// segment is 1.5mm along the run and 3× that across it (the long side perpendicular
// to the run). (cx,cy) is the bottom end (vertical) or left end (horizontal); the
// meter grows up / right over `length`, `segments` bars spaced evenly. Segments
// carry the binding tags so the host's RMS loop finds and fills them; `lit` pre-fills
// N bars (green→yellow→red) for a static preview where there's no live signal. A
// label (default 'VU') sits just past the anchor end.
function vuMeter(role, cx, cy, { length = 44, orientation = 'v', segments = 12, chan = '', label: lab = 'VU', lit = 0, thick = 1.5, theme = {} } = {}) {
  const frame = theme.frame || '#7d7d7d', ink = theme.ink || '#163a69';
  const T = thick, L = T * 3, half = T / 2, lhalf = L / 2;   // short side (run) / long side (across); thick shrinks both for tight columns
  const vertical = orientation !== 'h';
  const litColour = (f) => f > 0.85 ? '#ff5a4a' : f > 0.6 ? '#f4c430' : '#3ad16b';
  let segs = '';
  for (let i = 0; i < segments; i++) {
    const t = segments <= 1 ? 0 : i / (segments - 1);
    const x = vertical ? cx - lhalf : cx + t * length - half;
    const y = vertical ? cy - t * length - half : cy - lhalf;
    const w = vertical ? L : T, h = vertical ? T : L;
    const fill = i < lit ? litColour(t) : 'none';
    segs += `\n    <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w}" height="${h}" rx="0.35" fill="${fill}" stroke="${frame}" stroke-width="0.3" data-wcoast-seg="${i}"/>`;
  }
  const text = lab ? '\n' + label(vertical ? cx : cx + length / 2, (vertical ? cy + half : cy + lhalf) + 3.3, lab, { size: 2.2, fill: ink }) : '';
  return `  <g data-wcoast-role="${role}" data-wcoast-chan="${chan}">${segs}\n  </g>${text}`;
}

// Build evenly-spaced scale marks from a list of labels (each a string, or a line
// array for multi-line like ['220','A4']). Spreads them across the whole sweep.
function evenScale(labels, { tick = true } = {}) {
  const n = labels.length;
  return labels.map((label, i) => ({ at: n <= 1 ? 0.5 : i / (n - 1), label, tick }));
}

// Panel marking — a bipolar/polarity indicator drawn AROUND a knob: a curved double
// arrow concentric with the knob, arcing over its top with an arrowhead at each end
// pointing to a minus-circle (left) and a plus-circle (right), plus a short radial
// centre tick running from the knob edge out past the arc. Pass the KNOB's centre
// (kx,ky) and radius kr. Pure panel art, no binding.
function bipolarMark(kx, ky, kr, { gap = 2.0, spanDeg = 23, r = 1.27, color = '#163a69', sw = 0.4 } = {}) {
  const R = kr + gap, a = spanDeg * Math.PI / 180, sn = Math.sin(a), cs = Math.cos(a);
  const p0 = [kx - sn * R, ky - cs * R], p1 = [kx + sn * R, ky - cs * R];   // left / right arc ends
  const dir0 = [-cs, sn], dir1 = [cs, sn];                                  // unit tangents; heads point out toward the circles
  const rot = (vx, vy, t) => [vx * Math.cos(t) - vy * Math.sin(t), vx * Math.sin(t) + vy * Math.cos(t)];
  const head = (px, py, dx, dy) => {
    const bl = 1.2, [b1x, b1y] = rot(-dx, -dy, 0.5), [b2x, b2y] = rot(-dx, -dy, -0.5);
    return `<path d="M ${px.toFixed(2)} ${py.toFixed(2)} l ${(b1x * bl).toFixed(2)} ${(b1y * bl).toFixed(2)} M ${px.toFixed(2)} ${py.toFixed(2)} l ${(b2x * bl).toFixed(2)} ${(b2y * bl).toFixed(2)}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
  };
  const off = 1.2 + r + 0.7;                                                // circle centre sits beyond each head
  const cL = [p0[0] + dir0[0] * off, p0[1] + dir0[1] * off], cR = [p1[0] + dir1[0] * off, p1[1] + dir1[1] * off];
  const q = r * 0.5;
  const sign = (c, plus) => {
    let s = `<circle cx="${c[0].toFixed(2)}" cy="${c[1].toFixed(2)}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"/>`;
    s += `<line x1="${(c[0] - q).toFixed(2)}" y1="${c[1].toFixed(2)}" x2="${(c[0] + q).toFixed(2)}" y2="${c[1].toFixed(2)}" stroke="${color}" stroke-width="${sw}"/>`;
    if (plus) s += `<line x1="${c[0].toFixed(2)}" y1="${(c[1] - q).toFixed(2)}" x2="${c[0].toFixed(2)}" y2="${(c[1] + q).toFixed(2)}" stroke="${color}" stroke-width="${sw}"/>`;
    return s;
  };
  const parts = [
    `<path d="M ${p0[0].toFixed(2)} ${p0[1].toFixed(2)} A ${R.toFixed(2)} ${R.toFixed(2)} 0 0 1 ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}" fill="none" stroke="${color}" stroke-width="${sw}"/>`,
    head(p0[0], p0[1], dir0[0], dir0[1]), head(p1[0], p1[1], dir1[0], dir1[1]),
    `<line x1="${kx}" y1="${(ky - kr).toFixed(2)}" x2="${kx}" y2="${(ky - R - 1.3).toFixed(2)}" stroke="${color}" stroke-width="${sw}"/>`,
    sign(cL, false), sign(cR, true),
  ];
  return `  <g>\n    ${parts.join('\n    ')}\n  </g>`;
}

export { KNACK_GRIP_LEN, KNACK_GRIP_OUT, KNACK_GRIP_W, KNACK_POINTER_W, LAMP_PAD, LAMP_LABEL_GAP, lampReach, BUTTON_METAL };
export { scaleBox, scaleMarkBoxes, labelClear };
export { TRIM_R, TRIM_OVERHANG, TRIM_MARK_IN, TRIM_MARK_OUT, TRIM_SIGN_R, TRIM_SIGN_X, TRIM_SIGN_OUT };
export { defs, jack, vjack, knob, knack, trim, label, attachedLabel, evenScale, bipolarMark, ledLamp, waveGlyph, button, radioGroup, stepButton, slider, readout, vuMeter, textWidth, wrapLines };
export { READOUT_H, READOUT_CH, READOUT_PAD, READOUT_ARROW_GAP };
