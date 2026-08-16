// panel-loader.js — load a module's faceplate SVG and bind it to the schema.
//
// This is the host side of the binding contract (DESIGN.md §5). It takes a
// module's hand-authored panel SVG plus its descriptor, VALIDATES that the
// two agree (every `data-wcoast-*` tag resolves to a real descriptor id; every
// param/port has an element; knobs have an indicator + pivot; lamp switches
// have a step-indicator per step; jacks have an anchor), and returns a binding
// model the rest of the host drives: a map of controls (knobs/switches) and
// ports (jacks), each pointing at the live SVG elements the host rotates,
// lights, or anchors cords to.
//
// The panel says HOW the module looks and WHERE each element sits; the
// descriptor stays the source of truth for WHAT each control is. This file is
// the bridge. It reads the explicit `data-wcoast-cx/cy` pivots (in viewBox mm),
// so it needs no layout measurement — parsing is pure attribute reading, which
// keeps the validation logic testable apart from the DOM.

'use strict';

import { attachKnobHover } from './knob-hover.js';
import { showReadout, hideReadout, readoutLive, readoutPinned, formatParamValue } from './knob-readout.js';

// Default pointer sweep (degrees each side of straight-up), per the contract.
// A control may override with data-wcoast-angle-min / -max.
const KNOB_SPAN = 150;
const SWITCH_SPAN = 20;

// Panels are authored at the full 128.5 mm Eurorack height, but only the
// functional FACE — the region between the top and bottom frame rails — is
// displayed; the mounting-rail rim (screw ears and title strip) is cropped so
// no vertical space is wasted, and modules can be scaled a little larger. These
// bounds are the shared convention for every module panel (the Complex Oscillator frame).
export const FACE_TOP_MM = 7.0994;
export const FACE_H_MM = 113.5912;
// This panel's faceplate art is offset +3.9mm from the viewBox origin (an
// authoring quirk), so the drawn panel runs x=3.9..175.2, not 0..171.3. Crop the
// viewBox to the faceplate's left edge so a module FILLS its box — otherwise it
// carries a transparent left margin that shows as a dark seam between butted
// modules. Width is unchanged, so the right edge lands on the faceplate's right.
export const FACE_LEFT_MM = 3.9;
// The horizontal TITLE STRIP shown ABOVE the face: the module's name + identity colour
// band live here (they used to run vertically up the left edge). The strip occupies part
// of the top gutter the crop used to discard, so no module content moves — the module
// simply displays 4mm taller.
export const TITLE_STRIP_MM = 4;
// The DRAWN title bar is taller than the revealed gutter: the extra 2mm overlays the face's
// blank top margin, so total module height and all content positions stay put.
export const TITLE_BAR_MM = 6;

function cropToFace(svg) {
  const vb = (svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
  if (vb.length === 4) svg.setAttribute('viewBox', `${FACE_LEFT_MM} ${FACE_TOP_MM - TITLE_STRIP_MM} ${vb[2]} ${FACE_H_MM + TITLE_STRIP_MM}`);
}

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function round2(x) { return Math.round(x * 100) / 100; }
function numAttr(el, name) {
  const v = el.getAttribute(name);
  if (v == null) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

// Resolve a point given in an element's LOCAL coordinates up to the SVG root's
// user space (viewBox mm), composing every `transform` from the element to the
// root. Port anchors need this: an authored panel may wrap its jacks in a
// translated group, so raw data-wcoast-cx/cy is local, not absolute, and a
// cable drawn to the raw value lands off-centre. (Knob pivots deliberately stay
// LOCAL — their rotation is applied inside that same transformed group.)
function matMul(A, B) { // 2x3 affine [a,b,c,d,e,f]; result applies B then A
  return [
    A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1],
    A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
    A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5],
  ];
}
function parseTransform(str) {
  let M = [1, 0, 0, 1, 0, 0];
  const re = /(\w+)\s*\(([^)]*)\)/g;
  let m;
  while ((m = re.exec(str))) {
    const a = m[2].split(/[\s,]+/).map(Number).filter((v) => Number.isFinite(v));
    let T = null;
    if (m[1] === 'matrix' && a.length === 6) T = a;
    else if (m[1] === 'translate') T = [1, 0, 0, 1, a[0] || 0, a[1] || 0];
    else if (m[1] === 'scale') T = [a[0] || 1, 0, 0, a.length > 1 ? a[1] : (a[0] || 1), 0, 0];
    if (T) M = matMul(M, T);
  }
  return M;
}
export function resolveToRoot(el, x, y) {
  let M = [1, 0, 0, 1, 0, 0];
  let node = el;
  while (node && node.nodeType === 1) {
    const t = node.getAttribute('transform');
    if (t) M = matMul(parseTransform(t), M);
    if (node.tagName && node.tagName.toLowerCase() === 'svg') break;
    node = node.parentNode;
  }
  return { x: M[0] * x + M[2] * y + M[4], y: M[1] * x + M[3] * y + M[5] };
}

// ---- value <-> normalised position (0..1) -------------------------------
// A knob turns LINEARLY in position; the value comes from position through the
// descriptor's curve (so an exp knob turns evenly while its Hz value tapers).

// A volume/gain fader taper: the throw is dB-LINEAR (equal travel = equal dB), unity at
// the top and ~GAIN_FLOOR_DB near the bottom, so it matches how the ear hears level. The
// range is deliberately moderate so a useful default sits around the middle of the throw
// (mixer channels default to ~60% travel) with clear headroom above — not pinned near the
// top. Use Mute for true silence.
const GAIN_FLOOR_DB = -36;

export function valueToPosition(meta, value) {
  if (meta.curve === 'gainDb') {
    if (value <= meta.min) return 0;
    return clamp01(1 - (20 * Math.log10(value / meta.max)) / GAIN_FLOOR_DB);
  }
  if (meta.curve === 'exp') {
    const lo = Math.max(meta.min, 1e-6);
    return clamp01(Math.log(value / lo) / Math.log(meta.max / lo));
  }
  if (meta.curve === 'stepped') {
    const steps = meta.steps || [];
    if (steps.length < 2) return 0;
    const i = steps.findIndex((s) => s.value === value);
    return (i < 0 ? 0 : i) / (steps.length - 1);
  }
  // A DETENT knob: integer values min..max, evenly spaced along the throw. Like a linear
  // knob for placement, but positionToValue rounds to the nearest integer so the pointer
  // (and value) only ever land on a mark.
  if (meta.curve === 'detent') {
    if (meta.max === meta.min) return 0;
    return clamp01((value - meta.min) / (meta.max - meta.min));
  }
  return clamp01((value - meta.min) / (meta.max - meta.min));
}

export function positionToValue(meta, pos) {
  pos = clamp01(pos);
  if (meta.curve === 'gainDb') {
    if (pos <= 0) return meta.min;
    return meta.max * Math.pow(10, (GAIN_FLOOR_DB * (1 - pos)) / 20);
  }
  if (meta.curve === 'exp') {
    const lo = Math.max(meta.min, 1e-6);
    return lo * Math.pow(meta.max / lo, pos);
  }
  if (meta.curve === 'stepped') {
    const steps = meta.steps || [];
    if (!steps.length) return undefined;
    const i = Math.round(pos * (steps.length - 1));
    return steps[Math.max(0, Math.min(steps.length - 1, i))].value;
  }
  // Detent knob: snap to the nearest integer in min..max, so a scroll clicks from one mark
  // to the next and never rests between them.
  if (meta.curve === 'detent') {
    return meta.min + Math.round(pos * (meta.max - meta.min));
  }
  return meta.min + pos * (meta.max - meta.min);
}

// ---- applying a value to the SVG ----------------------------------------

// ---- the gauge ----------------------------------------------------------
// A continuous knob shows its setting as a filled arc in the band between the cap and the edge, not
// as a pointer. See design/knob-gauge.md. The arc is one circle stroked as wide as the band, with a
// dash pattern that opens and closes — so a value change writes two attributes and does no path
// arithmetic, which matters while you are dragging.
//
// A circle's own path starts at three o'clock and runs clockwise, so the whole element is rotated to
// put its start where the fill starts.
const GAUGE_MIN_SWEEP = 3;      // degrees — a knob at its minimum still shows a stub, so zero reads
                                // as SET TO ZERO rather than as an unpainted control

// The colour code, by what kind of quantity the knob sets — the same families as the jacks, declared
// per parameter (`signal`) because it cannot be derived: nothing in a port's domain knows that pulse
// width is a percentage while coarse is an audio frequency.
const GAUGE_COLOR = {
  audio: '#f3c40b',    // levels, and frequencies in the audio band
  cv: '#ff7300',       // every other setting — the default
  trigger: '#5aa0e6',  // things measured in pulses: clock rates, divisions, repeat counts
  pitch: '#39a85a',    // 1V/oct amounts, and only those
  rgb: '#e0359b',      // picture quantities on the video modules
  luma: '#babab6',
};

function ensureGaugeFill(binding) {
  if (binding.gaugeFill !== undefined) return binding.gaugeFill;
  const track = binding.group.querySelector('[data-wcoast-role="gauge-track"]');
  if (!track) return (binding.gaugeFill = null);
  const doc = binding.group.ownerDocument;
  const fill = doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
  for (const a of ['cx', 'cy', 'r', 'stroke-width']) fill.setAttribute(a, track.getAttribute(a));
  fill.setAttribute('fill', 'none');
  fill.setAttribute('stroke', GAUGE_COLOR[(binding.meta && binding.meta.signal) || 'cv'] || GAUGE_COLOR.cv);
  fill.setAttribute('class', 'gauge-fill');
  fill.style.pointerEvents = 'none';
  track.after(fill);
  binding.gaugeR = parseFloat(track.getAttribute('r')) || 1;
  // Bipolar is read off the RANGE, not declared: a control that crosses zero fills from twelve
  // o'clock either way, because on those the middle is the meaningful place and filling from the
  // minimum would make centred look half on.
  const m = binding.meta || {};
  binding.gaugeBipolar = typeof m.min === 'number' && typeof m.max === 'number' && m.min < 0 && m.max > 0;
  return (binding.gaugeFill = fill);
}

function showGauge(binding, pos) {
  const fill = ensureGaugeFill(binding);
  if (!fill || !binding.pivot) return;
  const a = binding.angleMin + clamp01(pos) * (binding.angleMax - binding.angleMin);
  // Where the fill starts: twelve o'clock on a bipolar control, the knob's own minimum otherwise.
  const zero = binding.gaugeBipolar
    ? 0
    : binding.angleMin;
  let lo = Math.min(zero, a), hi = Math.max(zero, a);
  if (hi - lo < GAUGE_MIN_SWEEP) {
    if (binding.gaugeBipolar) { const mid = (lo + hi) / 2; lo = mid - GAUGE_MIN_SWEEP / 2; hi = mid + GAUGE_MIN_SWEEP / 2; }
    else hi = lo + GAUGE_MIN_SWEEP;
  }
  const c = 2 * Math.PI * binding.gaugeR;
  const len = c * (hi - lo) / 360;
  fill.setAttribute('stroke-dasharray', `${round2(len)} ${round2(c)}`);
  fill.setAttribute('transform', `rotate(${round2(lo - 90)} ${binding.pivot.x} ${binding.pivot.y})`);
}

// Rotate a knob's pointer (or a lever switch's lever) to a normalised position, and fill its gauge.
export function showPosition(binding, pos) {
  if (!binding.pivot) return;
  showGauge(binding, pos);
  if (!binding.indicator) return;
  const a = binding.angleMin + clamp01(pos) * (binding.angleMax - binding.angleMin);
  binding.indicator.setAttribute(
    'transform', `rotate(${round2(a)} ${binding.pivot.x} ${binding.pivot.y})`);
}

// Show a stepped param's current step: light the matching lamp(s) (dim the
// rest) AND displace the blade/lever to its position — an on/off toggle throws
// left for on and right for off; a multi-position selector fans across its
// positions.
export function showStep(binding, stepValue) {
  for (const [val, el] of binding.stepIndicators) {
    const on = val === stepValue;
    // A medium-light-gray push-button disc either way; ON lights a red LED in its
    // centre (the ledLit gradient: red core fading to the gray body) plus a glossy
    // highlight. OFF is the flat gray disc. The thin edge is black on the light
    // panel, the font-gray on the dark panel.
    // A lamp may declare its LED colour; no declaration means red, which is every
    // panel authored before the sequencer's START / END / PLAY columns.
    const hue = el.getAttribute('data-wcoast-led');
    // A lamp may carry its own unlit colour (data-wcoast-off) — a module whose one button IS the
    // module can be dark red rather than the house grey, and still light the same bright red.
    const offFill = el.getAttribute('data-wcoast-off') || BUTTON_OFF;
    el.setAttribute('fill', on ? (hue === 'green' ? 'url(#ledLitGreen)' : hue === 'orange' ? 'url(#ledLitOrange)' : 'url(#ledLit)') : offFill);
    el.setAttribute('stroke', binding.dark ? DARK_LINE : BUTTON_EDGE_LIGHT);
    // Match the jack edge's PROPORTION (~6% of radius): buttons are smaller, so a
    // fixed width read much heavier on them. Scale the edge to each button's radius.
    const r = parseFloat(el.getAttribute('r')) || 2;
    const edgeW = r * 0.06 * (on ? 1 : 2);   // double the outline on unlit buttons
    el.setAttribute('stroke-width', String(Math.round(edgeW * 1000) / 1000));
    el.setAttribute('opacity', '1');
    const hi = el.nextElementSibling;   // the little glossy highlight
    // Matched by role now that a gloss can be green or orange as well as red. The
    // fill test stays as a fallback for panels rendered before the role existed —
    // the function generator's SVGs are hand-held and are not regenerated.
    if (hi && hi.getAttribute
        && (hi.getAttribute('data-wcoast-role') === 'led-gloss' || hi.getAttribute('fill') === '#ffb4b4')) {
      hi.setAttribute('opacity', on ? '0.85' : (el.getAttribute('data-wcoast-off') ? '0.35' : '0'));
    }
  }
  if (binding.indicator && binding.pivot) {
    let angle = 0;
    if (binding.switchStyle === 'toggle') {
      const on = binding.stepValues.includes('on') ? 'on' : binding.stepValues[0];
      angle = (stepValue === on) ? -70 : 70;          // on -> left, off -> right
    } else {
      const n = binding.stepCount;
      const i = binding.stepValues.indexOf(stepValue);
      const spread = 55;
      angle = n > 1 ? -spread + (i < 0 ? 0 : i) * (2 * spread / (n - 1)) : 0;
    }
    binding.indicator.setAttribute('transform',
      `rotate(${round2(angle)} ${binding.pivot.x} ${binding.pivot.y})`);
  }
}

// Slide a fader's handle to a normalised position. The handle is authored at the
// track midpoint and translated along y; pos 1 (full) is at the top (bot..top).
export function showSlider(binding, pos) {
  if (!binding.handle || binding.top == null || binding.bot == null) return;
  const travel = binding.bot - binding.top;
  binding.handle.setAttribute('transform', `translate(0 ${round2(travel * (0.5 - clamp01(pos)))})`);
}

// Set a control from a raw descriptor value (dispatches on kind/curve).
export function showValue(binding, value) {
  // A readout paints the value as WORDS, through the same formatter the hover bubble uses — so the
  // window and the bubble can never disagree about what the setting is called.
  if (binding.kind === 'readout') { if (binding.text) binding.text.textContent = readoutText(binding, value); return; }
  // ...and an ordinary knob may print its value on the panel too. Same formatter again: three places
  // can show one setting, and they say the same words.
  if (binding.valueText) binding.valueText.textContent = readoutText(binding, value);
  if (binding.kind === 'slider') showSlider(binding, valueToPosition(binding.meta, value));
  else if (binding.meta.curve === 'stepped') showStep(binding, value);
  else showPosition(binding, valueToPosition(binding.meta, value));
}

// What a readout prints. A stepped param shows the step's own short label if it has one, so a value
// of 'div4' reads as the ÷4 it means; anything else goes through the shared formatter, which already
// knows about units, detents and each param's readoutText hook.
export function readoutText(binding, value) {
  const meta = binding.meta;
  if (meta.curve === 'stepped') {
    const step = (meta.steps || []).find((st) => st.value === value);
    if (step && step.short) return step.short;
    if (step && step.name) return step.name;
    return String(value);
  }
  const t = formatParamValue(meta, value, binding.values);
  return t == null ? '' : String(t);
}

// ---- parsing / validation -----------------------------------------------

// Build the binding model from an already-parsed SVG root and a descriptor.
// Pure DOM reading + validation; returns { svg, controls, ports, warnings }.
export function parsePanel(svg, descriptor) {
  const warnings = [];
  const paramMeta = new Map((descriptor.params || []).map((p) => [p.id, p]));
  const portMeta = new Map((descriptor.ports || []).map((p) => [p.id, p]));
  const controls = new Map();
  const ports = new Map();

  for (const el of svg.querySelectorAll('[data-wcoast-param]')) {
    const id = el.getAttribute('data-wcoast-param');
    const meta = paramMeta.get(id);
    if (!meta) { warnings.push(`unknown param tag "${id}"`); continue; }
    if (controls.has(id)) { warnings.push(`duplicate param "${id}"`); continue; }

    const stepped = meta.curve === 'stepped';
    // A SLIDER (fader): a linear param whose group is tagged data-wcoast-role
    // "slider" and holds a data-wcoast-role "handle" child that rides a vertical
    // track spanning data-wcoast-top..bot (group-local y). Drag moves the handle;
    // unlike a knob it has no rotating indicator or pivot.
    // A READOUT: a lit window that shows its own value and steps under the wheel. It has no
    // indicator to rotate and no lamps to light — the text IS the indication — so it is its own kind
    // rather than a knob that happens to be drawn as a rectangle.
    if (el.getAttribute('data-wcoast-role') === 'readout') {
      const text = el.querySelector('[data-wcoast-role="readout-text"]');
      if (!text) warnings.push(`readout "${id}" has no text element`);
      controls.set(id, { id, meta, group: el, kind: 'readout', text,
        // A MENU READOUT lists its values instead of stepping through them — see below.
        menu: el.getAttribute('data-wcoast-menu') === '1',
        up: el.querySelector('[data-wcoast-role="readout-up"]'),
        down: el.querySelector('[data-wcoast-role="readout-down"]') });
      continue;
    }
    if (el.getAttribute('data-wcoast-role') === 'slider') {
      const handle = el.querySelector('[data-wcoast-role="handle"]');
      const top = numAttr(el, 'data-wcoast-top');
      const bot = numAttr(el, 'data-wcoast-bot');
      if (!handle) warnings.push(`slider "${id}" has no handle element`);
      if (top == null || bot == null) warnings.push(`slider "${id}" has no track range (data-wcoast-top/bot)`);
      controls.set(id, { id, meta, group: el, kind: 'slider', handle, top, bot });
      continue;
    }
    const span = stepped ? SWITCH_SPAN : KNOB_SPAN;
    const cx = numAttr(el, 'data-wcoast-cx');
    const cy = numAttr(el, 'data-wcoast-cy');
    let angleMin = numAttr(el, 'data-wcoast-angle-min'); if (angleMin == null) angleMin = -span;
    let angleMax = numAttr(el, 'data-wcoast-angle-max'); if (angleMax == null) angleMax = span;

    const binding = {
      id, meta, group: el,
      kind: stepped ? 'switch' : 'knob',
      // A numeral printed above the knob, if the panel drew one — see showValue.
      valueText: el.querySelector('[data-wcoast-role="value-text"]'),
      // A dual knAck also names a DEPTH param (the attenuverter on its centre CV). The
      // element additionally carries data-wcoast-port for the CV jack; the rack renders it
      // as a normal knob until that jack is patched, then splits it (value top, depth below).
      depthId: el.getAttribute('data-wcoast-depth') || null,
      quantizeId: el.getAttribute('data-wcoast-quantize') || null,   // detented knAck: right-click Quantize toggle
      avDefault: el.getAttribute('data-wcoast-av') || 'on',          // the DESIGNER'S default for the AV; the user can flip it per knob (right-click)
      pivot: (cx != null && cy != null) ? { x: cx, y: cy } : null,
      indicator: el.querySelector('[data-wcoast-role="indicator"]'),
      operator: el.querySelector('[data-wcoast-role="operator"]'),
      stepper: el.querySelector('[data-wcoast-role="stepper"]'),
      switchStyle: el.getAttribute('data-wcoast-switch') || null,
      stepIndicators: new Map(),
      stepValues: (meta.steps || []).map((s) => s.value),
      stepCount: (meta.steps || []).length,
      angleMin, angleMax,
    };
    for (const s of el.querySelectorAll('[data-wcoast-role="step-indicator"]')) {
      // An SVG attribute is always a string, but a descriptor's step values need not
      // be — the sequencer's loop-window selectors step through the NUMBERS 1..8. Key
      // the map by the DECLARED value, so the lit-lamp comparison, the unknown-step
      // check below, and the value a click writes back are all one type. Without this
      // a numeric stepped param renders lamps that never light and, when clicked,
      // writes a string back into a numeric param.
      const raw = s.getAttribute('data-wcoast-step');
      const declared = binding.stepValues.find((v) => String(v) === raw);
      binding.stepIndicators.set(declared !== undefined ? declared : raw, s);
    }

    // A STEPPED control needs a pointer — it is a selector or a toggle, and a filled arc says nothing
    // about which of three positions it is in. Faceplates no longer draw one (a continuous knob reads
    // from its gauge instead), so it is added here, where the curve is known. Panels that carry their
    // own drawn pointer, the hand-held ones, already have a line and are left alone.
    if (stepped && binding.indicator && binding.pivot && !binding.indicator.querySelector('line')) {
      const capR = parseFloat(binding.indicator.getAttribute('data-wcoast-cap'));
      if (isFinite(capR) && capR > 0) {
        const ln = el.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'line');
        ln.setAttribute('x1', binding.pivot.x); ln.setAttribute('y1', binding.pivot.y);
        ln.setAttribute('x2', binding.pivot.x); ln.setAttribute('y2', round2(binding.pivot.y - capR));
        ln.setAttribute('stroke', '#163a69'); ln.setAttribute('stroke-width', '0.55');
        ln.style.pointerEvents = 'none';
        binding.indicator.appendChild(ln);
      }
    }
    // A continuous knob still has an indicator group, empty, and it is still rotated: the drag and
    // scroll code and the hover mark measure from it.

    // Geometry validation (the contract's load-time checks).
    if (!stepped) {
      if (!binding.indicator) warnings.push(`knob "${id}" has no indicator element`);
      if (!binding.pivot) warnings.push(`knob "${id}" has no pivot (data-wcoast-cx/cy)`);
    } else {
      // A switch needs SOMETHING to operate/show it. Lamps needn't cover every
      // step (an on/off toggle has one "on" lamp; "off" is all-dark).
      for (const [val] of binding.stepIndicators) {
        if (!binding.stepValues.includes(val)) warnings.push(`switch "${id}" has a lamp for unknown step "${val}"`);
      }
      if (!binding.indicator && !binding.operator && !binding.stepIndicators.size) {
        warnings.push(`switch "${id}" has no operator, lever, or lamps`);
      }
      // A `stepped` param is a SWITCH: it is operated by clicking one of its lamps. Drawn
      // as a knob instead — an indicator on a pivot, no lamps, no stepper — it renders
      // perfectly and cannot be operated at all, which is a silent dead control. A knob
      // you turn to whole numbers wants `curve: 'detent'` with min/max.
      if (binding.indicator && binding.pivot && !binding.stepIndicators.size && !binding.stepper && !binding.operator) {
        warnings.push(`switch "${id}" is drawn as a knob but has no lamps to click — it cannot be operated. Use curve:'detent' with min/max for a knob that steps to integers.`);
      }
    }
    // ONE CIRCULAR HIT AREA, exactly the dial. A knob's group holds a dozen shapes — dial,
    // ring, cap, indicator, gloss, scale numerals, legend — and SVG hit-tests each of them
    // separately. That made the scrollable region a ragged union: it reached OUTSIDE the dial
    // wherever a numeral sat, and it had holes INSIDE wherever a shape was unfilled or a
    // decoration lay on top. Both are invisible, and both are perfectly repeatable, which is
    // what made the fault feel intermittent.
    //
    // So: every other shape in the group is taken out of hit-testing, and one transparent
    // circle matching the dial is put in. `fill: none` with `pointer-events: all` is an SVG
    // idiom for "invisible but solid to the pointer". It is inserted as the dial's next
    // sibling so it inherits exactly the dial's coordinate system — no assumption about
    // nested transforms — and since nothing else in the group takes events any more, its
    // depth in the group does not matter.
    //
    // Only true knobs: a `stepped` switch is operated by CLICKING ITS LAMPS, so its children
    // must stay hittable.
    if (!stepped && binding.indicator && binding.pivot) {
      let dial = null, dr = -1;
      for (const c of el.querySelectorAll('circle')) {
        const r = numAttr(c, 'r');
        if (r != null && r > dr) { dr = r; dial = c; }
      }
      if (dial && dr > 0) {
        for (const n of el.querySelectorAll('*')) n.setAttribute('pointer-events', 'none');
        const hit = el.ownerDocument.createElementNS(SVG_NS, 'circle');
        hit.setAttribute('cx', dial.getAttribute('cx'));
        hit.setAttribute('cy', dial.getAttribute('cy'));
        // THE SCROLL AREA IS THE DIAL, and nothing beyond it. It used to reach into the band
        // outside, because a knАck's dial was mostly jack and attenuverter and the value was left
        // with a narrow ring. The attenuverter has its own control now — a pill below the knob — so
        // the whole dial is the value again and the reach is not needed. What lives outside the knob
        // is only ever drawn: the hover wedge, and a patched knАck's depth ring.
        binding.dial = dial;
        binding.dialR = dr;
        hit.setAttribute('r', String(dr));
        hit.setAttribute('fill', 'none');
        hit.setAttribute('pointer-events', 'all');
        hit.setAttribute('class', 'knob-hit');
        dial.parentNode.insertBefore(hit, dial.nextSibling);
        binding.hitArea = hit;
        attachKnobHover(binding);   // the hover mark hangs off the hit area, so the two agree
      }
    }
    controls.set(id, binding);
  }

  for (const el of svg.querySelectorAll('[data-wcoast-port]')) {
    const id = el.getAttribute('data-wcoast-port');
    const meta = portMeta.get(id);
    if (!meta) { warnings.push(`unknown port tag "${id}"`); continue; }
    if (ports.has(id)) { warnings.push(`duplicate port "${id}"`); continue; }
    const cx = numAttr(el, 'data-wcoast-cx');
    const cy = numAttr(el, 'data-wcoast-cy');
    if (cx == null || cy == null) warnings.push(`port "${id}" has no anchor (data-wcoast-cx/cy)`);
    // Resolve to root user space so cords land on the jack's true centre even
    // when the panel wraps the jack in a transformed group.
    const anchor = (cx != null && cy != null) ? resolveToRoot(el, cx, cy) : null;
    // The inner-hole radius (smallest circle) and the outer radius (largest), so
    // a cord can end in the middle of the jack's coloured ring — inside the colour
    // but clear of the dark centre hole.
    let holeR = 0, outerR = 0;
    for (const c of panelCircles(el)) {
      const r = numAttr(c, 'r');
      if (r == null) continue;
      if (holeR === 0 || r < holeR) holeR = r;
      if (r > outerR) outerR = r;
    }
    // A knAck (a jack sharing its element with a knob, so it also carries
    // data-wcoast-param) spans the whole knob — but its cable must land on the
    // centre JACK, not out in the blue. Clamp the outer radius to the jack band
    // (hole + 1mm, matching paintKnAck's orange ring) so the cord ends at centre.
    const isKnack = el.hasAttribute('data-wcoast-param');
    ports.set(id, { id, meta, element: el, anchor, holeR, outerR: isKnack ? holeR + 1.0 : outerR });
  }

  // Coverage: every descriptor param/port must have exactly one element — EXCEPT
  // subControl params (a knAck's depth/quantize), which ride on their knob's binding
  // (data-wcoast-depth / data-wcoast-quantize) rather than their own SVG element.
  for (const p of (descriptor.params || [])) {
    if (p.subControl) continue;
    if (!controls.has(p.id)) warnings.push(`descriptor param "${p.id}" has no panel element`);
  }
  for (const p of (descriptor.ports || [])) {
    if (!ports.has(p.id)) warnings.push(`descriptor port "${p.id}" has no panel element`);
  }

  // DECORATION MUST NOT EAT INPUT. Legends, tick marks, section dividers and rules are drawn
  // over the face, and some of them cross a knob. SVG hit-tests per shape, not per layer, so a
  // 0.25 mm divider line lying across a knob is a live element sitting on top of it: the wheel
  // event targets the LINE, the line has no handler and is not inside the knob's group, so the
  // knob never sees it. The result is a thin dead streak across the control that is invisible
  // and perfectly repeatable — scroll there and nothing turns, every time.
  //
  // Anything OUTSIDE a control or port group that is text or stroke-only (no fill) is pure
  // decoration and is made transparent to the pointer. Filled shapes are left alone: the face
  // itself is a filled rect, and it must stay hittable to carry the panel's right-click menu.
  // The module title is the move/menu handle and keeps its own explicit pointer-events.
  for (const el of svg.querySelectorAll('text, line, polyline, path, rect, circle, ellipse, polygon')) {
    if (el.closest('[data-wcoast-param],[data-wcoast-port]')) continue;   // part of a control
    if (el.classList && el.classList.contains('module-title')) continue;  // the drag/menu handle
    const isText = el.tagName === 'text';
    const fill = (el.getAttribute('fill') || '').trim();
    const strokeOnly = fill === 'none' || el.tagName === 'line' || el.tagName === 'polyline';
    if (isText || strokeOnly) el.setAttribute('pointer-events', 'none');
  }

  return { svg, controls, ports, warnings };
}

// ---- interaction --------------------------------------------------------
// Make a control operable. `hooks.get()` returns the control's current raw
// value; `hooks.set(value)` is called with the new value as the user scrolls
// or clicks. The host owns interaction uniformly across modules; the panel only
// supplies geometry. Knobs turn with the scroll wheel (pointer-drag is
// deliberately NOT used — it fights screen magnification, where the cursor
// can't be held still); switches cycle their steps on click. The caller's
// set() updates the visuals via showValue, so there is a single update path.

// Momentum smoothing for knob scrolling: a wheel/trackpad pulse adds velocity,
// which decays with drag while an animation loop integrates it into position.
// HOW FAST A SCROLL TURNS SOMETHING, by modifier. This replaces the radial law — full rate at the
// centre of a knob, a quarter at its rim — which nobody could see, could not be aimed for
// deliberately, and meant the same gesture did different things depending on where your hand had
// happened to land. A held key is explicit and repeatable.
//
// CTRL IS NOT ONE OF THEM. Ctrl+wheel is the rack's pinch-zoom, and a trackpad pinch arrives as
// exactly that, so Cmd carries the slow tiers instead.
// WHERE THE READOUT COMES FROM: the top centre of the band the number is about, in screen
// coordinates. A knob's gauge band, or a fader's handle — its middle, not its top, because a fader's
// handle is the thing that carries the value and it is small enough to be one point.
//
// Worked out at the moment it is needed, from the control's position on screen, so it stays right at
// any rack zoom and wherever the module has been dragged to.
// Where the drawn arc ends, in degrees clockwise from twelve o'clock. The fill is a circle stroked
// with a dash, rotated so its start sits at the sweep's start: the start angle is in the transform,
// the swept angle is the dash length over the circumference.
function arcEndAngle(el, r, binding, valueOverride) {
  const fill = el.querySelector('.gauge-fill');
  if (fill && r > 0 && valueOverride === undefined) {
    const m = /rotate\(\s*(-?[\d.]+)/.exec(fill.getAttribute('transform') || '');
    const dash = parseFloat((fill.getAttribute('stroke-dasharray') || '').split(' ')[0]);
    if (m && isFinite(dash)) return (parseFloat(m[1]) + 90) + (dash / (2 * Math.PI * r)) * 360;
  }
  // No arc drawn (a stepped control, or a fader): fall back to the value, then to the sweep's start.
  const v = valueOverride !== undefined ? valueOverride : (binding.readValue && binding.readValue());
  if (v != null && binding.meta) {
    const pos = clamp01(valueToPosition(binding.meta, v));
    return binding.angleMin + pos * (binding.angleMax - binding.angleMin);
  }
  return binding.angleMin;
}

// WHERE THE CHIP STANDS: centred over the control, just clear of its top. Not at the pointer, which
// is where it used to be — a number that follows your hand is a number you have to chase, and on a
// knob you are already looking at, the top of the knob is where your eye is. A slider's is above the
// TOP OF ITS TRACK rather than above its handle, so it holds still while the handle runs under it.
const CHIP_GAP = 3;   // px between the control's top edge and the bottom of the chip
export function controlAnchor(binding) {
  const el = binding && binding.group;
  if (!el) return null;
  let r = null;
  if (binding.kind === 'slider') {
    const track = el.querySelector('[data-wcoast-role="slider-track"]') || el;
    r = track.getBoundingClientRect();
  } else {
    // The RING, not the group: a knob's group carries its label underneath and, on a knАck, its
    // attenuverter — so the group's top is the ring's top anyway, but its centre is not the ring's.
    const ring = el.querySelector('circle') || el;
    r = ring.getBoundingClientRect();
  }
  if (!r || (!r.width && !r.height)) return null;
  return { x: r.left + r.width / 2, y: r.top - CHIP_GAP };
}

export function controlOrigin(binding, valueOverride) {
  const el = binding && binding.group;
  if (!el) return null;
  if (binding.kind === 'slider' && binding.handle) {
    const r = binding.handle.getBoundingClientRect();
    if (r.width || r.height) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  const ctm = el.getScreenCTM && el.getScreenCTM();
  if (!ctm || !binding.pivot) return null;
  const track = el.querySelector('[data-wcoast-role="gauge-track"]');
  const r = track ? (parseFloat(track.getAttribute('r')) || 0) : (binding.dialR || 0);
  // THE MOVING END OF THE ARC — the place the value is — so the number comes out of the setting and
  // goes back into wherever the setting has moved to.
  //
  // READ OFF THE DRAWING, not computed from the value a second time. The arc is already on screen
  // with its start angle in a transform and its length in a dash, and taking the angle from those
  // means the animation cannot disagree with what you can see. Computing it independently is how the
  // first version ended up pointing at the start of the sweep on every control that had no value
  // reader hooked up.
  const rad = arcEndAngle(el, r, binding, valueOverride) * Math.PI / 180;
  const ux = binding.pivot.x + Math.sin(rad) * r, uy = binding.pivot.y - Math.cos(rad) * r;
  return { x: ctm.a * ux + ctm.c * uy + ctm.e, y: ctm.b * ux + ctm.d * uy + ctm.f };
}

export function scrollScale(e) {
  if (e.metaKey) return e.shiftKey ? 0.01 : 0.1;
  return e.shiftKey ? 4 : 1;
}
// What to add to the readout while a modifier is held, so the ladder is discoverable the first time
// you hold a key by accident.
//
// AN ARROW, NOT A TIMES SIGN. `×0.1` puts an arithmetic operator next to a number and reads as a
// tenth of the VALUE. The up-down arrow says how far the control moves per notch, which is what the
// modifier actually changes, and it cannot be read as arithmetic on the number beside it.
export function scrollScaleTag(scale) { return scale === 1 ? '' : ` ↕${scale}`; }

const KNOB_STEP = 0.04;    // position move per normalised notch — the old CENTRE rate, since fine
                           // control is now a held key rather than a place on the knob
const KNOB_DRAG = 6;       // velocity decay per second (coast ~ 1/DRAG seconds)
const KNOB_MAXV = 8;       // clamp runaway velocity (position units / second)

// A single push button (momentary or on/off) can carry an invisible hit-pad a few mm wider
// than its lamp, so it's easier to click. Placed as the FIRST child of the lamp's parent so
// it sits UNDER the lamp (the lamp still owns its own area; the pad only catches the margin)
// and never becomes the lamp's nextElementSibling (which showStep uses for the gloss).
function makeHitPad(lamp, growMm) {
  if (!lamp || !lamp.parentNode) return null;
  const cx = parseFloat(lamp.getAttribute('cx')), cy = parseFloat(lamp.getAttribute('cy')), r = parseFloat(lamp.getAttribute('r'));
  if (!isFinite(cx) || !isFinite(cy) || !isFinite(r)) return null;
  // THE METAL DISC IS PART OF THE CONTROL, so the pad is never smaller than it. A button mounted in
  // metal reads as one object the size of the metal, and a hit area that stopped at the lamp made the
  // mounting look like decoration you were not allowed to touch. Where the adaptive grow is already
  // wider — a button with room around it — that wins.
  const metal = lamp.parentNode.querySelector('[data-wcoast-role="button-metal"]');
  const metalR = metal ? parseFloat(metal.getAttribute('r')) : 0;
  const want = Math.max(r + (growMm > 0 ? growMm : 0), isFinite(metalR) ? metalR : 0);
  if (!(want > r + 0.05)) return null;
  const pad = lamp.ownerDocument.createElementNS(SVG_NS, 'circle');
  pad.setAttribute('cx', cx); pad.setAttribute('cy', cy);
  pad.setAttribute('r', String(Math.round(want * 1000) / 1000));
  pad.setAttribute('fill', 'none'); pad.setAttribute('pointer-events', 'all'); pad.setAttribute('class', 'hit-pad');
  lamp.parentNode.insertBefore(pad, lamp.parentNode.firstChild);
  return pad;
}

// The on-screen RADIUS OF THE KNOB ITSELF, in px. Not the group's bounding box: that box also
// contains the knob's legend and scale numerals, so for a knob with numbers around it the box is
// half again as wide as the knob (105 px against a 76 px dial on the oscillator's Pitch). Sizing
// the fine/coarse zones off the box meant the rim never reached the intended quarter rate — it
// bottomed out near half — and the feel differed from knob to knob purely by how much text was
// printed beside it. The largest circle in the group is the dial.
// The circles a panel actually DREW. The transparent hit circle is deliberately the largest one in a
// knob's group — the scroll area reaches past the dial — so anything that reasons about "the biggest
// circle" (the knob's face, a jack's coloured ring, a cord's anchor radius) has to leave it out.
function panelCircles(el) {
  return [...el.querySelectorAll('circle')].filter((c) => c.getAttribute('class') !== 'knob-hit');
}

// The DIAL's radius on screen — what the radial fine-control law and the knАck's zone test both
// measure against. It skips the hit circle, which is deliberately larger than the dial: counting it
// would put the "rim" outside the knob and quietly slow every knob's scrolling near its own edge.
export function knobRadiusPx(el) {
  let r = 0;
  for (const c of el.querySelectorAll('circle')) {
    if (c.getAttribute('class') === 'knob-hit') continue;
    const w = c.getBoundingClientRect().width;
    if (w > r) r = w;
  }
  return (r / 2) || (el.getBoundingClientRect().width / 2) || 1;
}

export function attachControlInteraction(binding, hooks, opts = {}) {
  const el = binding.group;
  binding.readValue = hooks.get;   // the hover readout asks for the number a second later
  if (hooks.values) binding.values = hooks.values;   // ...and the module's other values, for the
                                                     // parameters whose number depends on a switch
  if (binding.kind === 'readout' && !binding.menu) {
    // DOUBLE CLICK RESTORES THE DEFAULT, as it does on every knob. (A menu readout has its own, in the
    // branch below, because there it has to race the menu.) Timed on the press rather than taken from
    // a dblclick event: the press handler stops the event so the panel does not drag under it, and a
    // stopped press does not always become a click.
    let lastDown = 0;
    el.addEventListener('pointerdown', (e) => {
      const t = e.timeStamp || 0;
      if (t - lastDown < 350 && binding.meta.default !== undefined) { lastDown = 0; hooks.set(binding.meta.default); return; }
      lastDown = t;
    }, true);
  }
  if (binding.kind === 'readout' && binding.menu && hooks.menu) {
    // A MENU READOUT: click the window and every value it can take opens over it; click one to choose.
    // An ordinary pop-up menu, which is the gesture nobody has to be taught.
    //
    // AND THE WHEEL NUDGES IT, on the controls that ask for it — `listStep` in the descriptor. A menu
    // is the right way to reach ×32 from ÷32; it is a poor way to go from 119 to 120, which is a nudge
    // and wants a nudge's gesture. So a tempo answers to both, and a ratio to neither, and which is
    // which is a property of the setting rather than a rule about windows.
    //
    // THE MENU WAITS FOR THE DOUBLE-CLICK WINDOW TO PASS. Two presses mean "back to the default", and
    // a menu that opened on the first of them would be standing in the way of the second — so the open
    // is scheduled and a second press cancels it. The cost is a fifth of a second before the list
    // appears, which is the price of the same window meaning two things.
    const DBL_MS = 260;
    let lastDown = 0, openTimer = 0;
    el.style.cursor = 'pointer';
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      if (binding.gated) return;   // a window that is only reporting — see the colour, and _attachTextReadout
      const t = e.timeStamp || 0;
      if (t - lastDown < DBL_MS) {
        clearTimeout(openTimer); openTimer = 0; lastDown = 0;
        if (binding.meta.default !== undefined) hooks.set(binding.meta.default);
        return;
      }
      lastDown = t;
      clearTimeout(openTimer);
      openTimer = setTimeout(() => { openTimer = 0; hooks.menu(); }, DBL_MS);
    });
    if (binding.meta.listStep) {
      const min = binding.meta.min, max = binding.meta.max;
      const THRESH = Math.max(4, (binding.meta.detentThresh || 100) / binding.meta.listStep);
      let acc = 0;
      const nudge = (dir) => {
        const cur = Math.round(Number(hooks.get()));
        const nv = Math.max(min, Math.min(max, cur + dir));
        if (nv !== cur) hooks.set(nv);
      };
      el.addEventListener('wheel', (e) => {
        if (e.ctrlKey) return;   // ctrl+wheel is the rack pinch-zoom
        if (binding.gated) return;
        e.preventDefault(); e.stopPropagation();
        const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
        acc += -d;
        let guard = 0;
        while (acc >= THRESH && guard++ < 16) { acc -= THRESH; nudge(+1); }
        while (acc <= -THRESH && guard++ < 16) { acc += THRESH; nudge(-1); }
      }, { passive: false });
    }
    return;
  }
  if (binding.kind === 'readout') {
    // SCROLL ONLY, and one value per notch. There is no spin control and no click target: a click on a
    // readout does nothing, deliberately, because a lit rectangle that responded to a click would be
    // the button it is drawn not to be. The chevrons beside it are a legend, not a pair of buttons.
    const stepped = binding.meta.curve === 'stepped';
    const values = stepped ? (binding.meta.steps || []).map((st) => st.value) : null;
    const min = binding.meta.min, max = binding.meta.max;
    const THRESH = Math.max(10, binding.meta.detentThresh || 100);
    let acc = 0;
    const step = (dir) => {
      const cur = hooks.get();
      if (stepped) {
        const i = values.indexOf(cur);
        const ni = Math.max(0, Math.min(values.length - 1, (i < 0 ? 0 : i) + dir));
        if (values[ni] !== cur) hooks.set(values[ni]);
        return;
      }
      const nv = Math.max(min, Math.min(max, Math.round(Number(cur)) + dir));
      if (nv !== Number(cur)) hooks.set(nv);
    };
    // NO CURSOR CHANGE over the window itself. The wheel works there, but a resize cursor on a panel
    // control says the wrong thing — nothing here is being dragged or resized.
    for (const [node, dir] of [[binding.up, +1], [binding.down, -1]]) {
      if (!node) continue;
      node.style.cursor = 'pointer';
      node.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); });
      node.addEventListener('click', (e) => { e.stopPropagation(); step(dir); });
    }
    el.addEventListener('wheel', (e) => {
      if (e.ctrlKey) return;   // ctrl+wheel is the rack pinch-zoom
      e.preventDefault();
      const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      acc += -d;
      let guard = 0;
      while (acc >= THRESH && guard++ < 8) { acc -= THRESH; step(+1); }
      while (acc <= -THRESH && guard++ < 8) { acc += THRESH; step(-1); }
      // No hover bubble: the window is already showing the value, and a second copy of it floating
      // beside your hand is the thing this control exists to make unnecessary.
    }, { passive: false });
    return;
  }
  if (binding.kind === 'knob' && binding.meta.curve === 'detent') {
    // A DETENT knob steps by whole integers. Momentum integration would move the
    // position by less than one detent per gentle notch and round straight back, so
    // it never leaves its mark — scroll must advance discrete detents instead. Scroll
    // deltas accumulate; each time they cross a threshold the value steps one detent.
    if (!binding.indicator || !binding.pivot) return;
    const min = binding.meta.min, max = binding.meta.max;
    // HOW MUCH SCROLL ONE DETENT COSTS. A hundred is one mouse notch, which is the right default: one
    // click, one detent, and the control cannot run away from you. A knob with a long range wants the
    // notch to be worth more without the STEP being worth more — a tempo that moved 30 BPM a click
    // would be unusable to settle with — so this makes the travel cheaper rather than the step bigger.
    const THRESH = Math.max(10, binding.meta.detentThresh || 100);
    // HOW FAR ONE NOTCH GOES. One detent per notch is right for a knob with a handful of positions —
    // an octave shifter, a sync mode — and unusable on one with hundreds: a tempo spanning 30 to 300
    // took 270 notches end to end, which does not read as a fine control, it reads as a stuck one.
    // `detentStep` lets such a param say how far a notch should carry it; everything else is
    // unaffected, because the default is still one.
    const stepBy = Math.max(1, Math.round(binding.meta.detentStep || 1));
    let acc = 0;
    const step = (dir, by) => {
      const cur = Math.round(Number(hooks.get()));
      // Land on multiples of the step from the range's start, so a coarse sweep passes through the
      // same values every time rather than wherever it happened to begin.
      let nv = cur + dir * by;
      if (by > 1) nv = min + Math.round((nv - min) / by) * by;
      nv = Math.max(min, Math.min(max, nv));
      if (nv !== cur) hooks.set(nv);
    };
    el.addEventListener('wheel', (e) => {
      if (e.ctrlKey) return;   // ctrl+wheel is the rack pinch-zoom
      e.preventDefault();
      // The same modifier ladder the continuous knobs use, so it is one thing to learn: Shift for
      // coarse, Command for fine — and on a stepped knob "fine" can only ever mean one detent.
      const scale = scrollScale(e);
      const by = scale >= 1 ? Math.max(1, Math.round(stepBy * scale)) : 1;
      const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      acc += -d;   // up (negative delta) raises the value
      let guard = 0;
      while (acc >= THRESH && guard++ < 8) { acc -= THRESH; step(+1, by); }
      while (acc <= -THRESH && guard++ < 8) { acc += THRESH; step(-1, by); }
      showReadout(formatParamValue(binding.meta, hooks.get(), binding.values) + scrollScaleTag(scale), controlAnchor(binding), null, true, { origin: () => controlOrigin(binding), region: 'value', hold: true });
    }, { passive: false });
    return;
  }
  if (binding.kind === 'knob') {
    if (!binding.indicator || !binding.pivot) return;
    // Momentum: each scroll pulse adds velocity (scaled by the actual scroll
    // amount AND the radial fine-control factor); an animation loop integrates
    // it while drag bleeds it off, so the discrete pulses become smooth motion
    // and a gentle two-finger scroll makes very small, smooth changes.
    let vel = 0;      // position units per second
    let raf = null;
    let last = 0;
    let at = null;    // where the pointer was, so the readout can follow the value as it coasts
    let tag = '';     // the modifier's multiplier, shown while it is held
    const tick = (t) => {
      const now = t || performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const next = clamp01(valueToPosition(binding.meta, hooks.get()) + vel * dt);
      hooks.set(positionToValue(binding.meta, next));
      // Refreshed from the LOOP, not from the wheel event: momentum keeps the value moving after
      // the last tick, and a readout driven by the event alone would freeze on the first number
      // while the knob carried on somewhere else.
      if (at) showReadout(formatParamValue(binding.meta, hooks.get(), binding.values) + tag, controlAnchor(binding), null, true, { origin: () => controlOrigin(binding), region: 'value', hold: true });
      vel *= Math.exp(-KNOB_DRAG * dt);
      // Stop only when the velocity is spent, or when we're pushing INTO a
      // boundary (not when velocity would carry us away from it — that's how you
      // leave the edge again).
      const pinned = (next <= 0 && vel < 0) || (next >= 1 && vel > 0);
      if (Math.abs(vel) > 1e-3 && !pinned) raf = requestAnimationFrame(tick);
      else { raf = null; vel = 0; }
    };
    el.addEventListener('wheel', (e) => {
      if (e.ctrlKey) return;   // ctrl+wheel is a pinch-zoom for the rack, not a knob turn
      // A GATED CONTROL DOES NOT TURN. Set by the host on a CV-depth trim whose jack is empty — the
      // trim is greyed to say it is doing nothing, and a wheel that moved it anyway would contradict
      // the panel. Not preventDefault'd either: the scroll belongs to whatever is underneath.
      if (binding.gated) return;
      e.preventDefault();
      // Normalise the scroll amount across devices (px / lines / pages).
      const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      const factor = scrollScale(e);
      tag = scrollScaleTag(factor);
      at = { x: e.clientX, y: e.clientY };
      // Straight away, not on the next frame: the chip is standing in for the pointer, and a frame's
      // wait is enough to see it arrive late. The loop keeps it current from here on.
      showReadout(formatParamValue(binding.meta, hooks.get(), binding.values) + tag, controlAnchor(binding), null, true, { origin: () => controlOrigin(binding), region: 'value', hold: true });
      vel += (-d / 100) * KNOB_STEP * KNOB_DRAG * factor;   // up (negative delta) raises
      if (vel > KNOB_MAXV) vel = KNOB_MAXV; else if (vel < -KNOB_MAXV) vel = -KNOB_MAXV;
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    }, { passive: false });
  } else if (binding.kind === 'slider') {
    // Faders are DRAGGED (unlike knobs, which scroll): the value tracks the
    // pointer's y within the track. Map the client point into the group's user
    // space via the inverse screen CTM (which carries the panel's mm scale and
    // the crop translate), then normalise against top..bot. stopPropagation keeps
    // a fader grab from starting a rack module drag.
    if (!binding.handle || binding.top == null || binding.bot == null) return;
    // A FADER HAS NO HOVER MODULE, so nothing else would send its chip home now that the timer is off.
    // Leaving the fader is leaving the thing the number describes, which is the same rule a knob has.
    el.addEventListener('pointerleave', () => hideReadout());

    // THE NUMBER ON HOVER, which faders were missing. A knob gets it from the hover mark, and a fader
    // has no hover mark — it has no scroll band to shade — so the same behaviour is wired here: a
    // second after the pointer arrives the value appears, follows the pointer while it stays, and
    // goes home into the handle when it leaves.
    // A fader shows its number when you DRAG or SCROLL it, like every other control — never on
    // hover. While it is up it follows the pointer, and it goes home into the handle on leaving.
    el.addEventListener('pointerleave', () => hideReadout());

    const posFromEvent = (e) => {
      const ctm = el.getScreenCTM && el.getScreenCTM();
      if (!ctm) return null;
      const inv = ctm.inverse();
      const ly = inv.b * e.clientX + inv.d * e.clientY + inv.f;
      return clamp01((binding.bot - ly) / (binding.bot - binding.top));
    };
    const onMove = (e) => {
      const p = posFromEvent(e);
      if (p == null) return;
      hooks.set(positionToValue(binding.meta, p));
      showReadout(formatParamValue(binding.meta, hooks.get(), binding.values), controlAnchor(binding), null, true, { origin: () => controlOrigin(binding), region: 'value', hold: true });
    };
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
      onMove(e);
      const up = (ev) => {
        el.releasePointerCapture && el.releasePointerCapture(ev.pointerId);
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
      };
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
    // Faders also take the scroll wheel, with the same momentum feel as the knobs
    // (no radial factor — a fader is linear).
    let vel = 0, raf = null, last = 0, at = null, fTag = '';
    const tick = (t) => {
      const now = t || performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const next = clamp01(valueToPosition(binding.meta, hooks.get()) + vel * dt);
      hooks.set(positionToValue(binding.meta, next));
      if (at) showReadout(formatParamValue(binding.meta, hooks.get(), binding.values) + fTag, controlAnchor(binding), null, true, { origin: () => controlOrigin(binding), region: 'value', hold: true });
      vel *= Math.exp(-KNOB_DRAG * dt);
      const pinned = (next <= 0 && vel < 0) || (next >= 1 && vel > 0);
      if (Math.abs(vel) > 1e-3 && !pinned) raf = requestAnimationFrame(tick);
      else { raf = null; vel = 0; }
    };
    el.addEventListener('wheel', (e) => {
      if (e.ctrlKey) return;   // ctrl+wheel is the rack pinch-zoom
      e.preventDefault();
      const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      at = { x: e.clientX, y: e.clientY };
      const factor = scrollScale(e);
      fTag = scrollScaleTag(factor);
      showReadout(formatParamValue(binding.meta, hooks.get(), binding.values) + fTag, controlAnchor(binding), null, true, { origin: () => controlOrigin(binding), region: 'value', hold: true });
      vel += (-d / 100) * KNOB_STEP * KNOB_DRAG * factor;   // up (negative delta) raises
      if (vel > KNOB_MAXV) vel = KNOB_MAXV; else if (vel < -KNOB_MAXV) vel = -KNOB_MAXV;
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    }, { passive: false });
  } else if (binding.meta.readOnly) {
    // A PARAM THE ENGINE OWNS. It is painted like any other — the host's readout map finds it by id and
    // lights it — but nothing here binds a click to it. A lamp reporting what the clock is doing must
    // not also look like a switch you can throw, or the first thing anyone does is throw it.
  } else if (binding.kind === 'switch' && binding.stepCount > 1) {
    // Operate a switch by clicking its LAMPS. A multi-position switch (Range,
    // Waveshape) jumps to whichever lamp you click; a single-lamp on/off switch
    // (the centre mod switches) flips between its two states when clicked.
    const lamps = [...binding.stepIndicators.entries()];
    if (binding.stepper) {
      // A stepper: one button advances the param to its next step (wrapping); the
      // lamps only indicate the current step and are not clickable.
      binding.stepper.style.cursor = 'pointer';
      binding.stepper.addEventListener('click', (e) => {
        e.stopPropagation();
        const v = binding.stepValues, i = v.indexOf(hooks.get());
        hooks.set(v[(i + 1) % v.length]);
      });
    } else if (binding.meta.momentary && lamps.length >= 1) {
      // Momentary push button (STRIKE): ON only while held, OFF on release, and
      // every press is a fresh trigger. Capture the pointer so the release still
      // registers if it happens off the lamp.
      const lamp = lamps[0][1];
      const on = binding.stepValues.includes('on') ? 'on' : binding.stepValues[0];
      const off = binding.stepValues.find((v) => v !== on);
      const release = () => { if (hooks.get() === on) hooks.set(off); };
      const pad = makeHitPad(lamp, opts.hitGrowMm);
      for (const tgt of pad ? [lamp, pad] : [lamp]) {
        tgt.style.cursor = 'pointer';
        tgt.addEventListener('pointerdown', (e) => { e.stopPropagation(); tgt.setPointerCapture && tgt.setPointerCapture(e.pointerId); hooks.set(on); });
        tgt.addEventListener('pointerup', release);
        tgt.addEventListener('pointercancel', release);
      }
    } else if (lamps.length >= 2) {
      for (const [val, lamp] of lamps) {
        lamp.style.cursor = 'pointer';
        lamp.addEventListener('click', (e) => { e.stopPropagation(); hooks.set(val); });
      }
    } else if (lamps.length === 1) {
      const lamp = lamps[0][1];
      const toggle = (e) => {
        e.stopPropagation();
        const cur = hooks.get();
        const other = binding.stepValues.find((v) => v !== cur);
        if (other !== undefined) hooks.set(other);
      };
      const pad = makeHitPad(lamp, opts.hitGrowMm);
      for (const tgt of pad ? [lamp, pad] : [lamp]) { tgt.style.cursor = 'pointer'; tgt.addEventListener('click', toggle); }
    }
  }
}

// ---- jack colour code + dark-mode decoration (applied, not authored) ----
// Jacks carry TWO reads, applied HERE (not baked per-jack in the art) so one code
// paints both panels and every module. COLOUR = signal family: audio yellow,
// CV/control orange, trigger/gate/pulse blue, with 1V/oct pitch inputs kept green;
// the same colour serves an input and an output. DIRECTION = a bold black dashed
// ring (addDirRing): an output's hugs the OUTER edge of the coloured band, an
// input's hugs the HOLE, each a third of the band wide so it reads at a glance.
// Every jack gets a thin black edge on the LIGHT panel only (black would vanish on
// the dark face). The centre hole is dark grey with a hair-thin light-grey rim.
// Unlit lamps show dark grey (not cream) on the dark panel; a vertical TITLE up
// the left edge is added in both modes.

const SVG_NS = 'http://www.w3.org/2000/svg';
const DARK_LINE = '#b8b8bc';        // dark-mode vertical title (light gray)
// Push buttons are a medium-LIGHT-gray disc in BOTH states; pressed/on adds a red
// LED in the centre (the `ledLit` gradient below). The thin edge is black on the
// light panel and the font-gray on the dark panel (set per-mode in showStep).
const BUTTON_OFF = '#505055';        // unlit push-button body: dark-medium gray
const BUTTON_EDGE_LIGHT = '#141414'; // button edge on the light panel (black); dark uses DARK_LINE

const round3 = (x) => Math.round(x * 1000) / 1000;

// The jack colour code — one colour per SIGNAL FAMILY, the same for in and out
// (direction is carried by the dashed ring, addDirRing).
const JACK = {
  audio: '#f3c40b',    // audio — yellow
  cv: '#ff7300',       // CV / control — orange
  trigger: '#5aa0e6',  // trigger / gate / pulse — light blue (black dashes read on it)
  pitch: '#39a85a',    // 1V/oct pitch — green (kept distinct)
  luma: '#babab6',     // video, one channel — off-white knocked back 20%. NOT pure white: the
                       //   square carries no outline, so it is the drop shadow and this greyer
                       //   value that separate it from a light face and from a lamp disc — and
                       //   at full brightness a 6 mm block of white shouts louder than a jack
                       //   should on a panel you look at for hours.
  rgb: '#e0359b',      // video, three channels — magenta (black dashes read on it)
  // The NOTE BUNDLE is the one family that is not a hue: every colour is taken, and what is left
  // sits next to something. It is neutral instead, and inverts with the theme so it stands off the
  // face either way — and it carries a SECOND concentric ring, which is what actually identifies it.
  // Lightness alone would be far too weak a signal beside the neutral grey of unpainted jack art.
  noteDark: '#ececed',
  noteLight: '#141418',
  ring: '#000000',     // the direction dashes
  hole: '#2f2f33',     // centre plug-hole
  holeRim: '#cfcfd3',  // hair-thin light rim around the hole
  holeRimW: '0.15',
  bipolar: '#ffffff',  // the dot marking a jack that deals in a signal swinging either side of zero
  edge: '#111111',     // thin black edge on every jack (light panel only)
  edgeW: '0.22',
};

// A TRIM'S EYE TAKES ITS JACK'S COLOUR. An attenuverter trim sits beside the knAck whose centre jack
// it attenuates, and nothing tied the two together — it was house blue like every other knob on the
// panel, so it read as a control that happened to be nearby. It now carries a small disc at its
// centre painted from the SAME table that paints the jack, looked up through the port id the panel
// tagged it with: a knob with a coloured centre next to a knob with a coloured centre.
//
// The RIM was the first attempt and read as a different family of knob rather than as a relative of
// the one beside it. The outline says which family a control belongs to; the centre says which signal.
//
// A trim with no tag is left alone: the sequencer's voltage knobs and its ratchets are trims because
// the shape suits them, not because they attenuate anything.
function paintTrimAccents(svg, ports, dark) {
  for (const eye of svg.querySelectorAll('[data-wcoast-role="trim-accent"]')) {
    const g = eye.closest('[data-wcoast-accent-port]');
    const port = g && ports.get(g.getAttribute('data-wcoast-accent-port'));
    if (port && port.meta) eye.setAttribute('fill', jackFill(port.meta, dark));
  }
}

function isPitch(meta) { return meta.role === 'pitch' || meta.name === '1V/Oct'; }
function isNote(meta) { return meta.domain === 'note'; }
function jackFill(meta, dark) {
  if (isNote(meta)) return dark ? JACK.noteDark : JACK.noteLight;
  if (isPitch(meta)) return JACK.pitch;         // 1V/oct pitch stays green
  if (meta.domain === 'audio') return JACK.audio;
  if (meta.domain === 'trigger') return JACK.trigger;
  if (meta.domain === 'luma') return JACK.luma;
  if (meta.domain === 'rgb') return JACK.rgb;
  return JACK.cv;                               // control / CV
}

// Paint one jack: outer ring = type colour with a thin black edge on the light
// panel (defines every jack against the light face; black would be invisible on
// the dark panel, so it's dropped there); inner hole = dark grey with a hair-thin
// light rim.
function paintJack(port, dark) {
  // A VIDEO jack's body is a rounded square, not a circle — see vjack() in primitives.
  // It deliberately keeps NO outline in either theme: the drop shadow defines it, and a black
  // edge this close to the black direction dashes would read as one thick smudge.
  const body = port.element.querySelector('rect[data-wcoast-role="jackbody"]');
  if (body && port.meta) {
    const hole = port.element.querySelector('[data-wcoast-role="jackhole"]');
    body.setAttribute('fill', jackFill(port.meta, dark));
    body.setAttribute('stroke', 'none');
    if (hole) { hole.setAttribute('fill', JACK.hole); hole.setAttribute('stroke', JACK.holeRim); hole.setAttribute('stroke-width', JACK.holeRimW); }
    addSquareDirRing(port, body, hole);
    return;
  }
  const circles = panelCircles(port.element);
  if (!circles.length || !port.meta) return;
  let outer = circles[0], hole = circles[0], ro = -1, rh = Infinity;
  for (const c of circles) { const r = parseFloat(c.getAttribute('r')) || 0; if (r > ro) { ro = r; outer = c; } if (r < rh) { rh = r; hole = c; } }
  outer.setAttribute('fill', jackFill(port.meta, dark));
  if (!dark) { outer.setAttribute('stroke', JACK.edge); outer.setAttribute('stroke-width', JACK.edgeW); }
  else { outer.setAttribute('stroke', 'none'); outer.setAttribute('stroke-width', '0'); }
  if (hole !== outer) { hole.setAttribute('fill', JACK.hole); hole.setAttribute('stroke', JACK.holeRim); hole.setAttribute('stroke-width', JACK.holeRimW); }
  // A NOTE JACK CARRIES A SECOND RING, and its direction dashes invert. The family colour here is a
  // neutral, so lightness would be the only thing separating it from unpainted jack art — far too
  // weak on its own — and black dashes on the near-black light-mode face would say nothing at all.
  // The extra ring sits in the middle third, between the two the dashes can occupy, so a note socket
  // reads as two concentric rings whether it is an input or an output.
  const noteInk = isNote(port.meta) ? (dark ? JACK.noteLight : JACK.noteDark) : null;
  if (noteInk) addNoteRing(port, outer, ro, rh, noteInk);
  addDirRing(port, outer, ro, rh, noteInk || JACK.ring);
  // Only when there IS a hole: a jack drawn as a single circle has none, and sizing the dot from
  // the outer radius would fill the whole jack with white.
  addBipolarDot(port, hole !== outer ? hole : null);
}

// THE WHITE DOT: this jack deals in a signal that swings both ways.
//
// It is in the HOLE because the hole is the one part of a jack a cable never covers — a cord stops
// half a width outside the rim, so the mark is there whether the jack is empty or patched, and it is
// there at the moment it is wanted, which is when a hand is on the cable rather than after.
//
// ON OUTPUTS it says what you are about to send. ON INPUTS it says what this was built to be sent —
// and only where that is true by design, which is a short list: pan, symmetry, mod index, the
// coordinate field's signed controls, a rate that can run backwards. NOT on knАck inputs, whose
// attenuverter exists precisely to turn a unipolar signal into a swing, so a dot on all of those
// would appear on nearly every CV input in the rack and mean nothing.
//
// Painted here rather than drawn in the panel SVG, so a module whose polarity follows a control can
// have the dot come and go — see rack._applyPolarity.
function addBipolarDot(port, hole) {
  const old = port.element.querySelector('.jack-bipolar');
  if (old) old.remove();
  if (!port.meta || port.meta.polarity !== 'bipolar' || !hole) return;
  const cx = parseFloat(hole.getAttribute('cx')), cy = parseFloat(hole.getAttribute('cy'));
  const rh = parseFloat(hole.getAttribute('r'));
  if (!isFinite(cx) || !isFinite(cy) || !(rh > 0)) return;
  const dot = port.element.ownerDocument.createElementNS(SVG_NS, 'circle');
  dot.setAttribute('class', 'jack-bipolar');
  dot.setAttribute('cx', round3(cx)); dot.setAttribute('cy', round3(cy));
  dot.setAttribute('r', round3(rh * 0.34));
  dot.setAttribute('fill', JACK.bipolar);
  dot.style.pointerEvents = 'none';
  port.element.appendChild(dot);
}

// The second ring on a note jack: solid, the middle third of the coloured surround, in the inverse of
// the jack's own neutral. Idempotent, like the direction ring it sits beside.
function addNoteRing(port, outer, ro, rh, col) {
  const old = port.element.querySelector('.jack-note-ring');
  if (old) old.remove();
  if (!(ro > 0) || !(rh < ro)) return;
  const w = (ro - rh) / 3;
  const ring = port.element.ownerDocument.createElementNS(SVG_NS, 'circle');
  ring.setAttribute('class', 'jack-note-ring');
  ring.setAttribute('cx', outer.getAttribute('cx') || 0);
  ring.setAttribute('cy', outer.getAttribute('cy') || 0);
  ring.setAttribute('r', round3(rh + w * 1.5));
  ring.setAttribute('fill', 'none');
  ring.setAttribute('stroke', col);
  ring.setAttribute('stroke-width', round3(w * 0.62));
  port.element.appendChild(ring);
}

// The direction ring: a bold black dashed band a THIRD of the coloured surround
// wide, laid on the OUTER third (touching the outer edge) for an output and the
// INNER third (touching the hole) for an input — so one family colour reads as in
// or out. Dashes are equal and short, fitted to a whole number of periods so the
// ring closes cleanly. Idempotent: a re-paint (e.g. dark-mode toggle) replaces it.
function addDirRing(port, outer, ro, rh, col) {
  const old = port.element.querySelector('.jack-dir-ring');
  if (old) old.remove();
  if (!(ro > 0) || !(rh < ro) || !port.meta.dir) return;
  const band = ro - rh, w = band / 3;
  const cx = parseFloat(outer.getAttribute('cx')) || 0;
  const cy = parseFloat(outer.getAttribute('cy')) || 0;
  const ringR = port.meta.dir === 'out' ? ro - w / 2 : rh + w / 2;
  const circ = 2 * Math.PI * ringR;
  const n = Math.max(6, Math.round(circ / (w * 1.6)));   // dash+gap ≈ 1.6·w
  const seg = circ / (2 * n);                            // equal dash and gap
  const ring = port.element.ownerDocument.createElementNS(SVG_NS, 'circle');
  ring.setAttribute('class', 'jack-dir-ring');
  ring.setAttribute('cx', round3(cx)); ring.setAttribute('cy', round3(cy)); ring.setAttribute('r', round3(ringR));
  ring.setAttribute('fill', 'none');
  ring.setAttribute('stroke', col || JACK.ring);
  ring.setAttribute('stroke-width', round3(w));
  ring.setAttribute('stroke-dasharray', round3(seg) + ' ' + round3(seg));
  port.element.appendChild(ring);
}

// The direction mark on a SQUARE video jack. Same rule as the round ones, applied to the
// shape the jack actually has: an OUTPUT's dashes hug the outer boundary — which here is the
// square, so they trace a rounded rectangle just inside it — and an INPUT's hug the round
// hole, so those stay a circle. One dashed element per jack, outward or inward, exactly as
// every other jack on the panel. Idempotent: a re-paint replaces it.
function addSquareDirRing(port, body, hole) {
  const old = port.element.querySelector('.jack-dir-ring');
  if (old) old.remove();
  if (!port.meta.dir) return;
  const x = parseFloat(body.getAttribute('x')), y = parseFloat(body.getAttribute('y'));
  const wd = parseFloat(body.getAttribute('width')), ht = parseFloat(body.getAttribute('height'));
  const rr = parseFloat(body.getAttribute('rx')) || 0;
  const rh = hole ? parseFloat(hole.getAttribute('r')) || 0 : 0;
  const half = wd / 2;
  if (!(half > 0) || !(rh < half)) return;
  const band = half - rh, w = band / 3;               // same third-of-the-surround weight
  const doc = port.element.ownerDocument;
  let ring;
  if (port.meta.dir === 'out') {
    const inset = w / 2;
    const rx2 = x + inset, ry2 = y + inset, rw = wd - w, rhh = ht - w;
    const per = 2 * (rw + rhh);                       // close the dash cycle on the perimeter
    const n = Math.max(8, Math.round(per / (w * 1.6)));
    const seg = per / (2 * n);
    ring = doc.createElementNS(SVG_NS, 'rect');
    ring.setAttribute('x', round3(rx2)); ring.setAttribute('y', round3(ry2));
    ring.setAttribute('width', round3(rw)); ring.setAttribute('height', round3(rhh));
    ring.setAttribute('rx', round3(Math.max(0, rr - inset)));
    ring.setAttribute('stroke-dasharray', round3(seg) + ' ' + round3(seg));
  } else {
    const ringR = rh + w / 2;
    const circ = 2 * Math.PI * ringR;
    const n = Math.max(6, Math.round(circ / (w * 1.6)));
    const seg = circ / (2 * n);
    ring = doc.createElementNS(SVG_NS, 'circle');
    ring.setAttribute('cx', round3(x + half)); ring.setAttribute('cy', round3(y + ht / 2));
    ring.setAttribute('r', round3(ringR));
    ring.setAttribute('stroke-dasharray', round3(seg) + ' ' + round3(seg));
  }
  ring.setAttribute('class', 'jack-dir-ring');
  ring.setAttribute('fill', 'none');
  ring.setAttribute('stroke', JACK.ring);
  ring.setAttribute('stroke-width', round3(w));
  port.element.appendChild(ring);
}

// Paint a knAck's centre (a knob a cable plugs into): leave the knob art alone,
// but ring its black centre hole with the signal-family colour and lay the INPUT
// direction dashes on that band — so the hole reads as a jack of the right type
// (orange CV here) without disturbing the knob. Idempotent (re-run on a dark toggle).
function paintKnAck(port, dark) {
  const hole = port.element.querySelector('[data-wcoast-role="jackhole"]');
  if (!hole || !port.meta) return;
  const cx = parseFloat(hole.getAttribute('cx')), cy = parseFloat(hole.getAttribute('cy'));
  const rh = parseFloat(hole.getAttribute('r'));
  if (!isFinite(cx) || !isFinite(cy) || !(rh > 0)) return;
  // A knAck knob face is MEDIUM blue over most of its surface. Framing the jack: a thin light-blue
  // ring, then a NARROW dark-blue ring just outside it (softly shaded), then a light-blue line
  // separating that from the medium face. The calibrations (drawn by the rack) sit on the medium
  // face, never on the dark ring.
  const KN_MED = '#0f6cad', KN_DARK = '#063f63', KN_LIGHT = '#ffffff';
  // NOT the hit circle. It is transparent and it is deliberately the largest circle in the group —
  // the scroll area reaches past the dial — so "the biggest circle" is no longer "the knob's face".
  // Painting it drew a blue disc a band wider than every knАck on the rack.
  const kcircles = panelCircles(port.element);
  const outerRing = kcircles.reduce((a, c) => (parseFloat(c.getAttribute('r')) || 0) > (parseFloat(a.getAttribute('r')) || 0) ? c : a, kcircles[0]);
  const cap = kcircles.find((c) => /knobCap/.test(c.getAttribute('fill') || ''));
  const KR = outerRing ? (parseFloat(outerRing.getAttribute('r')) || 5) : 5;
  // Blue face = the house radial crossfade (light centre → dark edge) — the SAME url(#blueRing)
  // gradient the Complex Oscillator's big frequency/mod rings use. Keep the ring's gradient and
  // clear the cap so one continuous fade spans the whole face. (Guarded: a knАck panel that
  // doesn't define blueRing falls back to the flat medium face.)
  const svgRoot = port.element.closest('svg');
  const faceFill = (svgRoot && svgRoot.querySelector('#blueRing')) ? 'url(#blueRing)' : KN_MED;
  // The rim is DRAWN BY THE PANEL now — a knurled path, blue-filled, no outline. What is left at the
  // outer radius is an invisible circle the geometry is measured from (data-wcoast-role="rim"), and
  // painting it puts a full white circle straight over the knurl, which is the busy perimeter we were
  // trying to get rid of. So measure from it and leave it alone. Older panels that still carry a real
  // drawn ring are painted as before.
  if (outerRing && outerRing.getAttribute('data-wcoast-role') !== 'rim') {
    outerRing.setAttribute('fill', faceFill); outerRing.setAttribute('stroke', KN_LIGHT);
    outerRing.setAttribute('stroke-width', round3((parseFloat(outerRing.getAttribute('stroke-width')) || 0.355) * 0.5));
  }
  if (cap) { cap.setAttribute('fill', 'none'); cap.setAttribute('stroke', 'none'); }
  const ro = rh + 1.0;   // orange band outer radius (the jack)
  for (const old of port.element.querySelectorAll('.knack-accent')) old.remove();
  const kdoc = port.element.ownerDocument, kspan = KR - ro;
  // ONE thin white line hugging the jack — its inner edge sits right against the orange, so no blue
  // shows between the jack and the line. (The old dark grip ring and second white line are gone.)
  const kw = Math.max(0.13, kspan * 0.045);
  const c = kdoc.createElementNS(SVG_NS, 'circle'); c.setAttribute('class', 'knack-accent');
  c.setAttribute('cx', round3(cx)); c.setAttribute('cy', round3(cy)); c.setAttribute('r', round3(ro + kw / 2));
  c.setAttribute('fill', 'none'); c.setAttribute('stroke', KN_LIGHT); c.setAttribute('stroke-width', round3(kw)); c.style.pointerEvents = 'none';
  port.element.appendChild(c);
  const old = port.element.querySelector('.knack-band'); if (old) old.remove();
  // Coloured band UNDER the hole, so the hole covers its centre and only the ring shows.
  const band = port.element.ownerDocument.createElementNS(SVG_NS, 'circle');
  band.setAttribute('class', 'knack-band');
  band.setAttribute('cx', round3(cx)); band.setAttribute('cy', round3(cy)); band.setAttribute('r', round3(ro));
  band.setAttribute('fill', jackFill(port.meta, dark));
  if (!dark) { band.setAttribute('stroke', JACK.edge); band.setAttribute('stroke-width', JACK.edgeW); }   // thin black edge on the light face only
  port.element.insertBefore(band, hole);
  addDirRing(port, band, ro, rh);   // input dashes hugging the hole (dir='in' → inner third)
  // A knАck usually needs no bipolar dot: its attenuverter is there precisely to turn a unipolar
  // signal into a swing, so marking every one of them would mark nearly every CV input in the rack.
  // The Coordinate Field is the exception that makes this worth drawing — its knАcks dropped their
  // depth params, so there is no trim to convert with and the signed ones are signed by design.
  addBipolarDot(port, hole);
}

// The lit-button gradient: a red LED core fading to the gray button body, so an
// ON button reads as a dark-gray disc with a glowing centre. Injected once per
// panel so showStep can reference url(#ledLit).
// The LED lens fills the WHOLE button (a glowing dome, bright centre → deep edge) —
// no gray rim; the only ring is the thin outline the button already has. Green and
// orange are the same dome in another hue, for panels that need lamps sitting side
// by side to mean different things.
const LED_LIT = {
  ledLit: [['0', '#ff7a5a'], ['0.5', '#ee2a10'], ['0.82', '#d21010'], ['1', '#8f0c0c']],
  ledLitGreen: [['0', '#8dff9e'], ['0.5', '#1dc93f'], ['0.82', '#12a531'], ['1', '#0a6b1f']],
  ledLitOrange: [['0', '#ffd08a'], ['0.5', '#ff9312'], ['0.82', '#e87a00'], ['1', '#944d00']],
};

function ensureLedGradient(svg) {
  const doc = svg.ownerDocument;
  let defs = svg.querySelector('defs');
  if (!defs) { defs = doc.createElementNS(SVG_NS, 'defs'); svg.insertBefore(defs, svg.firstChild); }
  for (const [id, stops] of Object.entries(LED_LIT)) {
    if (svg.querySelector('#' + id)) continue;
    const g = doc.createElementNS(SVG_NS, 'radialGradient');
    g.setAttribute('id', id);
    for (const [off, col] of stops) {
      const s = doc.createElementNS(SVG_NS, 'stop'); s.setAttribute('offset', off); s.setAttribute('stop-color', col); g.appendChild(s);
    }
    defs.appendChild(g);
  }
}

// ---- Module identity strip -------------------------------------------------
// A set of coloured stripes down the title column, whose colour(s) are the signal type(s) the module
// OUTPUTS — the same palette as the jacks — so a rack's structure reads at a glance from the pattern
// of module colours. Derived from the module's output ports (primary = the type it outputs most),
// unless the descriptor names it explicitly via `signalIdentity` (an ordered list like
// ['cv','trigger']). The stripes run SIDE BY SIDE, each the full height of the module (primary on the
// LEFT), so every colour spans the whole module and reads as one identity — not a top vs a bottom.
// They break around the vertical title so they never run behind the label.
const IDENTITY_KEY_COLOR = { audio: JACK.audio, cv: JACK.cv, control: JACK.cv, trigger: JACK.trigger, gate: JACK.trigger, pitch: JACK.pitch };

// The band is a large block of colour, so it reads brighter than the small jacks that use the same
// palette. Knock the band's brightness down (hue and saturation kept: every channel scaled equally)
// so it sits back without changing which colour it is. The jacks/cables keep the full palette.
const BAND_DIM = 0.8;
function dimColor(hex, f) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  if (!m) return hex;
  const to = (v) => Math.round(parseInt(v, 16) * f).toString(16).padStart(2, '0');
  return '#' + to(m[1]) + to(m[2]) + to(m[3]);
}

function moduleIdentityColors(descriptor, ports, dark) {
  const decl = descriptor && descriptor.signalIdentity;
  if (Array.isArray(decl) && decl.length) return decl.map((k) => IDENTITY_KEY_COLOR[k] || JACK.cv).slice(0, 3);
  const tally = new Map();
  for (const p of ports.values()) {
    if (!p.meta || p.meta.dir !== 'out') continue;
    const c = jackFill(p.meta, dark);
    tally.set(c, (tally.get(c) || 0) + 1);
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 3);   // primary (most outputs) first
}

// [a,b] with the label gap [ga,gb] cut out → 0, 1 or 2 sub-intervals.
function minusGap(a, b, ga, gb) {
  if (gb <= ga || gb <= a || ga >= b) return [[a, b]];
  const out = [];
  if (a < ga) out.push([a, Math.min(ga, b)]);
  if (b > gb) out.push([Math.max(gb, a), b]);
  return out;
}

let stripClipSeq = 0;   // clipPath ids are document-global; keep each panel's unique

function drawIdentityStrip(svg, descriptor, ports, name, dark) {
  const old = svg.querySelector('.module-identity');
  if (old) old.remove();
  const colors = moduleIdentityColors(descriptor, ports, dark);
  const doc = svg.ownerDocument;
  const g = doc.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'module-identity');
  g.setAttribute('pointer-events', 'none');
  const face = svg.querySelector('rect');
  const vb0 = (svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
  const W0 = vb0.length === 4 ? vb0[2] : 142;
  const faceRx = (face && parseFloat(face.getAttribute('rx'))) || 2.5;
  // Clip the whole strip to a round-topped shape so the colour band follows the panel's rounded
  // upper corners (the clip reaches below the face top, where the face art covers it, so only the
  // TOP corners round). Then paint the backdrop in the face's own colour — the strip sits above
  // the face art in the revealed gutter, so without it the page background would show through.
  const clipId = `title-strip-clip-${stripClipSeq++}`;
  const clip = doc.createElementNS(SVG_NS, 'clipPath'); clip.setAttribute('id', clipId);
  const cr = doc.createElementNS(SVG_NS, 'rect');
  cr.setAttribute('x', round3(FACE_LEFT_MM)); cr.setAttribute('y', round3(FACE_TOP_MM - TITLE_STRIP_MM));
  cr.setAttribute('width', round3(W0)); cr.setAttribute('height', round3(TITLE_BAR_MM + faceRx));
  cr.setAttribute('rx', round3(faceRx));
  clip.appendChild(cr); g.appendChild(clip);
  g.setAttribute('clip-path', `url(#${clipId})`);
  {
    const bg = doc.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('x', round3(FACE_LEFT_MM)); bg.setAttribute('y', round3(FACE_TOP_MM - TITLE_STRIP_MM));
    bg.setAttribute('width', round3(W0)); bg.setAttribute('height', TITLE_BAR_MM);
    bg.setAttribute('fill', '#000000');   // the strip field is BLACK in both themes; only 8mm colour segments flank the name
    g.appendChild(bg);
  }
  if (!colors.length) { svg.appendChild(g); return; }
  // The colour band must stop at the INNER edge of the border line (the backdrop keeps the face's
  // 0.5mm margin outside the line, like the face itself). Border: 0.5 inset, 0.5 stroke -> inner
  // edge at 0.75; its inner corner radius is the border rx minus half the stroke.
  const inset = 0.75;
  const innerClipId = `title-strip-inner-${stripClipSeq++}`;
  const iclip = doc.createElementNS(SVG_NS, 'clipPath'); iclip.setAttribute('id', innerClipId);
  const icr = doc.createElementNS(SVG_NS, 'rect');
  icr.setAttribute('x', round3(FACE_LEFT_MM + inset)); icr.setAttribute('y', round3(FACE_TOP_MM - TITLE_STRIP_MM + inset));
  icr.setAttribute('width', round3(W0 - 2 * inset)); icr.setAttribute('height', round3(TITLE_BAR_MM + faceRx));
  icr.setAttribute('rx', round3(Math.max(0, faceRx - inset)));
  iclip.appendChild(icr); g.appendChild(iclip);
  const bandG = doc.createElementNS(SVG_NS, 'g');
  bandG.setAttribute('clip-path', `url(#${innerClipId})`);
  g.appendChild(bandG);
  const N = colors.length;
  // The colour band is two 8mm segments HUGGING the name (one each side); the rest of the strip
  // stays black. N stripes stack within the band height (PRIMARY at the BOTTOM, nearest the face).
  const vb = (svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
  const W = vb.length === 4 ? vb[2] : 142;
  const left = FACE_LEFT_MM, right = left + W, centerX = left + W / 2;
  const stripTop = FACE_TOP_MM - TITLE_STRIP_MM, stripBot = stripTop + TITLE_BAR_MM;
  // A shelf line in the BORDER's colour runs the full width directly below (touching) the bands.
  const frame0 = svg.querySelector('rect[fill="none"][stroke]');
  const shelfCol = (frame0 && frame0.getAttribute('stroke')) || '#7d7d7d';
  const shelfH = parseFloat((frame0 && frame0.getAttribute('stroke-width')) || '0.5');
  const bandH = TITLE_BAR_MM - shelfH;      // bands sit ON the shelf line
  const segTop = stripTop + inset;          // top edge touches the upper border line's inner edge
  const segH = bandH - inset;
  const h = segH / N;                       // stripe height
  // The name's width — estimated at ~1.5mm/char (a detached SVG can't measure text) — with a small
  // pad so the segments HUG the name.
  let gapL = centerX, gapR = centerX;
  if (name) { const half = (name.length * 2.25) / 2 + 0.8; gapL = Math.max(left, centerX - half); gapR = Math.min(right, centerX + half); }
  // ONE colour segment, LEFT of the name only — 12mm long, all four corners rounded (the stripes
  // are clipped to a rounded rect over the segment).
  const SEG_MM = 12, SEG_SHIFT = 1;         // the pill sits 1mm left of the name's gap edge
  const segs = [];
  const segEnd = gapL - SEG_SHIFT;
  // The banner grows leftward from the name to the strip's left edge, or 12 mm, whichever comes
  // first. It used to stop clear of a hamburger at that end; with the hamburger gone it can run
  // the full width the module allows.
  const segL = Math.max(left, segEnd - SEG_MM);
  if (segEnd - segL > 0.3) segs.push([segL, segEnd]);
  const segClipId = `title-seg-clip-${stripClipSeq++}`;
  const sclip = doc.createElementNS(SVG_NS, 'clipPath'); sclip.setAttribute('id', segClipId);
  const scr = doc.createElementNS(SVG_NS, 'rect');
  scr.setAttribute('x', round3(segL)); scr.setAttribute('y', round3(segTop));
  scr.setAttribute('width', round3(segEnd - segL)); scr.setAttribute('height', round3(segH));
  scr.setAttribute('rx', '1');
  sclip.appendChild(scr); g.appendChild(sclip);
  const segG = doc.createElementNS(SVG_NS, 'g');
  segG.setAttribute('clip-path', `url(#${segClipId})`);
  bandG.appendChild(segG);
  const shelf = doc.createElementNS(SVG_NS, 'rect');
  shelf.setAttribute('x', round3(left)); shelf.setAttribute('y', round3(stripBot - shelfH));
  shelf.setAttribute('width', round3(W)); shelf.setAttribute('height', round3(shelfH));
  shelf.setAttribute('fill', shelfCol);
  bandG.appendChild(shelf);
  for (let i = 0; i < N; i++) {
    const y = round3(segTop + i * h);
    const col = colors[N - 1 - i];            // reversed: primary at the bottom, nearest the face
    for (const [a, b] of segs) {
      const r = doc.createElementNS(SVG_NS, 'rect');
      r.setAttribute('x', round3(a)); r.setAttribute('y', y);
      r.setAttribute('width', round3(b - a)); r.setAttribute('height', round3(h));
      r.setAttribute('fill', dimColor(col, BAND_DIM));
      segG.appendChild(r);
    }
  }
  svg.appendChild(g);   // above the faceplate art, below the title text (appended next)
}

function decoratePanel(parsed, descriptor, opts) {
  const { svg, controls, ports } = parsed;
  ensureLedGradient(svg);
  for (const b of controls.values()) b.dark = opts.dark;   // showStep picks the button edge by mode
  // A knAck (an element carrying BOTH a param and a port — a knob a cable plugs
  // into) keeps its knob art: paint only its centre (signal-coloured band + input
  // dashes around the black hole), not the whole element as a jack.
  for (const port of ports.values()) {
    if (port.element.hasAttribute('data-wcoast-param')) paintKnAck(port, opts.dark);
    else paintJack(port, opts.dark);
  }
  paintTrimAccents(svg, ports, opts.dark);
  // Horizontal title in the 4mm strip above the face, centred on the module's width.
  const name = (descriptor && descriptor.name) || '';
  drawIdentityStrip(svg, descriptor, ports, name, opts.dark);   // colour band in the title strip (breaks around the label below)
  if (name) {
    const vbT = (svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
    const wT = vbT.length === 4 ? vbT[2] : 142;
    const t = svg.ownerDocument.createElementNS(SVG_NS, 'text');
    t.setAttribute('x', round2(FACE_LEFT_MM + wT / 2));
    t.setAttribute('y', round2(FACE_TOP_MM - TITLE_STRIP_MM + (TITLE_BAR_MM - 0.5) / 2 + 1.67));   // baseline so the glyph block centres in the bar
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-size', '4.65');
    t.setAttribute('font-weight', '700');
    t.setAttribute('letter-spacing', '0.2');
    t.setAttribute('fill', '#ffffff');   // the strip field is black in both themes
    t.setAttribute('class', 'module-title');
    t.setAttribute('opacity', '0.9');
    t.setAttribute('pointer-events', 'auto');   // the title is the delete/move handle (right-click for its menu)
    t.textContent = name;
    svg.appendChild(t);

  }
  // The light panel border now wraps the TITLE STRIP too: retire the authored frame (which ran
  // around the face only, drawing a line UNDER the title bar) and draw one border around the
  // whole module — slightly rounded corners at the strip's upper left and right.
  // Find the authored frame by WHAT IT IS, not by where it sits or what order it comes in.
  // "First unfilled stroked rect anywhere" picks up any stroked outline inside a control — a
  // video output's dashed direction ring matches it exactly, and was getting its stroke
  // stripped as though it were the frame. "Direct child only" is no better: only one of the
  // five panels authors its frame at the top level, so it silently dropped the border from
  // the other four. What actually identifies a frame is its SIZE: it spans the face.
  const frame = (() => {
    const vb = (svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
    const faceW = vb.length === 4 && vb[2] > 0 ? vb[2] : 0;
    for (const r of svg.querySelectorAll('rect[fill="none"][stroke]')) {
      const st = r.getAttribute('stroke');
      if (!st || st === 'none') continue;                       // already retired by an earlier paint
      if (r.closest('[data-wcoast-param],[data-wcoast-port]')) continue;   // part of a control
      const w = parseFloat(r.getAttribute('width'));
      if (!(w > 0)) continue;
      if (faceW && w < faceW * 0.8) continue;                   // a frame spans the face
      return r;
    }
    return null;
  })();
  if (frame) {
    const vbF = (svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
    const wF = vbF.length === 4 ? vbF[2] : 142;
    const b = svg.ownerDocument.createElementNS(SVG_NS, 'rect');
    b.setAttribute('x', round2(FACE_LEFT_MM + 0.5));
    b.setAttribute('y', round2(FACE_TOP_MM - TITLE_STRIP_MM + 0.5));
    b.setAttribute('width', round2(wF - 1));
    b.setAttribute('height', round2(FACE_H_MM + TITLE_STRIP_MM - 1));
    b.setAttribute('rx', frame.getAttribute('rx') || '2.2');
    b.setAttribute('fill', 'none');
    b.setAttribute('stroke', frame.getAttribute('stroke'));
    b.setAttribute('stroke-width', frame.getAttribute('stroke-width') || '0.5');
    b.setAttribute('class', 'module-frame');
    b.setAttribute('pointer-events', 'none');
    frame.setAttribute('stroke', 'none');
    svg.appendChild(b);   // last = on top, so the band never covers the border line
  }
}

// Fetch the panel SVG, parse it, and bind it. The URL is used as-is — RELATIVE to
// the document — so it resolves whether the page is served at the origin root
// (Electron's app:// scheme) or under a sub-path (e.g. GitHub Pages). `opts.dark`
// selects the dark decoration (the caller has already chosen the dark file URL).
export async function loadPanel(url, descriptor, opts = {}) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`panel fetch ${url} failed: ${res.status}`);
  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const err = doc.querySelector('parsererror');
  if (err) throw new Error(`panel SVG parse error: ${err.textContent.trim()}`);
  const svg = doc.documentElement;
  cropToFace(svg);   // show only the functional face; crop the mounting rim
  const parsed = parsePanel(svg, descriptor);
  decoratePanel(parsed, descriptor, opts);
  return parsed;
}
