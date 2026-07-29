// knob-hover.js — the hover mark on a knob: what your scroll will do, here.
//
// While the pointer is inside a knob's scroll area, a translucent green wedge is drawn
// hugging the OUTSIDE of that area. It says four things at once:
//
//   - WHERE the knob can be turned. The wedge spans the knob's travel and is absent across
//     the dead sector, so the sweep and its direction are visible without turning anything.
//   - WHICH WAY is more. The wedge tapers from nothing at the low end to its full thickness
//     at the high end.
//   - HOW FAST a scroll will move it FROM THIS SPOT. Knobs scroll at full rate near the
//     centre and a quarter rate at the rim, and that is invisible until you try it. The
//     wedge's thick end is 1 mm where scrolling is slowest and 3 mm where it is fastest, and
//     it redraws as the pointer moves, so the speed is legible before you commit to it.
//   - WHERE THE KNOB IS NOW. An orange bar crosses the wedge at the pointer's own angle.
//
// It hangs off the knob's permanent circular hit area — the same element the wheel handler
// hit-tests against — so the mark appears exactly where scrolling works. The two cannot
// disagree, which is the point: an affordance drawn from a separate guess at the geometry is
// how you get a knob that looks scrollable in a place where it is not.
//
// PAINTING ORDER. The mark lives in the knob's OWN group, drawn in that group's coordinates.
// An attempt to move it into a shared layer beneath the panel's artwork — so legends and scale
// numerals would paint over it — is deliberately NOT here: it stopped the mark appearing at
// all, for a reason not yet found. Keeping it in the group is the arrangement known to work.

'use strict';

const SVG_NS = 'http://www.w3.org/2000/svg';

const GREEN = '#00ff66';
const ORANGE = '#ff7300';     // the CV orange used for callouts and knAck jacks
const OPACITY = 0.3;          // the translucent green used throughout
const THIN_MM = 1.0;          // thick end when scrolling is at its slowest (the rim)
const THICK_MM = 3.0;         // thick end when scrolling is at its fastest (the centre)
const GAP_MM = 0.35;          // clear of the dial edge, so the mark reads as separate
const BAR_MM = 2.0;           // the value bar's width around the arc
const BAR_MIN_MM = 0.8;       // ...and its shortest radial length, so it never vanishes
const ARC_STEP_DEG = 3;       // wedge outline resolution

// The radial fine/coarse law the wheel handlers use: full rate at the centre, a quarter at
// the rim. Kept in step with them by construction — if that law changes, this mark lies.
function radialFactor(r, R) { return Math.max(0.25, 1 - 0.75 * Math.min(1, r / R)); }

// Scroll speed -> the wedge's thick end, in mm.
function thicknessFor(factor) {
  const t = (factor - 0.25) / 0.75;                    // 0 at the rim, 1 at the centre
  return THIN_MM + Math.max(0, Math.min(1, t)) * (THICK_MM - THIN_MM);
}

// A knob's angle 0 points UP and grows clockwise (SVG rotate about the pivot).
function pt(px, py, rad, deg) {
  const a = (deg * Math.PI) / 180;
  return [px + rad * Math.sin(a), py - rad * Math.cos(a)];
}

// Is this a bipolar control — one whose meaningful zero is the middle of its travel, like an
// attenuverter or a pan? Those swell from the centre outward in BOTH directions, because a
// taper rising from the minimum would say the centre was "half of something", which is wrong.
function bipolarCentre(meta) {
  if (!(meta.min < 0 && meta.max > 0)) return null;
  return (0 - meta.min) / (meta.max - meta.min);        // position of zero along the travel
}

// The wedge's radial height at one angle. Shared with the value bar, so the bar always spans
// exactly the band it crosses rather than an independently computed guess at it.
function heightAt(deg, a0, a1, T, centrePos) {
  const span = a1 - a0;
  if (centrePos == null) return T * ((deg - a0) / span);
  const aC = a0 + centrePos * span;
  return deg >= aC
    ? T * ((deg - aC) / Math.max(1e-6, a1 - aC))
    : T * ((aC - deg) / Math.max(1e-6, aC - a0));
}

function wedgePath(px, py, R, a0, a1, T, centrePos) {
  const outer = [], inner = [];
  const span = a1 - a0;
  const steps = Math.max(8, Math.ceil(Math.abs(span) / ARC_STEP_DEG));
  for (let i = 0; i <= steps; i++) {
    const deg = a0 + (span * i) / steps;
    inner.push(pt(px, py, R + GAP_MM, deg));
    outer.push(pt(px, py, R + GAP_MM + heightAt(deg, a0, a1, T, centrePos), deg));
  }
  const d = ['M ' + inner[0][0].toFixed(2) + ' ' + inner[0][1].toFixed(2)];
  for (let i = 1; i < inner.length; i++) d.push('L ' + inner[i][0].toFixed(2) + ' ' + inner[i][1].toFixed(2));
  for (let i = outer.length - 1; i >= 0; i--) d.push('L ' + outer[i][0].toFixed(2) + ' ' + outer[i][1].toFixed(2));
  d.push('Z');
  return d.join(' ');
}

// The value bar: 2 mm wide around the arc, crossing the wedge from its inner to its outer
// edge at `deg`. At the thin end of the taper the wedge is nearly nothing, so the bar is
// given a floor — otherwise the indicator would disappear exactly at the knob's minimum.
function barPath(px, py, R, deg, h) {
  const rIn = R + GAP_MM;
  const rOut = rIn + Math.max(BAR_MIN_MM, h);
  const rMid = (rIn + rOut) / 2;
  const half = ((BAR_MM / 2 / Math.max(1e-6, rMid)) * 180) / Math.PI;
  const p = [pt(px, py, rIn, deg - half), pt(px, py, rIn, deg + half),
    pt(px, py, rOut, deg + half), pt(px, py, rOut, deg - half)];
  return 'M ' + p.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ') + ' Z';
}

// A knАck's attenuverter band is a HEMISPHERE, not a ring: its travel is plus and minus ninety
// degrees about straight down, where depth is zero. In this module's angle convention (zero
// points up, growing clockwise) that is 90° through 270°, with the zero at 180° — so it is the
// ordinary bipolar wedge, just spanning a different arc at a different radius.
const AV_A0 = 90, AV_A1 = 270;

// The knob's CURRENT angle, read straight off the indicator's rotate() — so the bar tracks the
// value with no second copy of the value to keep in step.
function indicatorAngle(binding) {
  const t = binding.indicator && binding.indicator.getAttribute('transform');
  const m = t && /rotate\(\s*(-?[\d.]+)/.exec(t);
  return m ? parseFloat(m[1]) : null;
}

// binding needs: group, hitArea, pivot, indicator, angleMin, angleMax, meta.
// binding.hoverProbe, if the host sets one, answers "what would a scroll HERE do?" for a
// pointer event: { mode: 'value' | 'av', factor, avOuter, knobR, avAngle }. A knАck sets it,
// because a scroll in its attenuverter band moves CV depth rather than the value, on its own
// speed curve and over its own travel — so the mark describes a different control entirely.
export function attachKnobHover(binding) {
  const hit = binding.hitArea;
  if (!hit || !binding.pivot) return;
  const R = parseFloat(hit.getAttribute('r'));
  if (!(R > 0)) return;

  const px = binding.pivot.x, py = binding.pivot.y;
  const a0 = binding.angleMin, a1 = binding.angleMax;
  const meta = binding.meta;
  // A detent knob scrolls at the SAME rate wherever the pointer is — it accumulates to a
  // threshold and steps, with no radial fine control, because a control that only lands on
  // marks has nothing to fine-tune. So its wedge is fixed at the fast-scroll thickness.
  const isDetent = meta.curve === 'detent';
  const centrePos = bipolarCentre(meta);

  const doc = binding.group.ownerDocument;
  const g = doc.createElementNS(SVG_NS, 'g');
  g.style.display = 'none';
  const wedge = doc.createElementNS(SVG_NS, 'path');
  wedge.setAttribute('fill', GREEN);
  wedge.setAttribute('fill-opacity', String(OPACITY));
  const bar = doc.createElementNS(SVG_NS, 'path');
  bar.setAttribute('fill', ORANGE);
  g.append(wedge, bar);
  g.setAttribute('class', 'knob-hover');
  hit.parentNode.insertBefore(g, hit.nextSibling);

  const draw = (base, lo, hi, T, cPos, deg) => {
    wedge.setAttribute('d', wedgePath(px, py, base, lo, hi, T, cPos));
    if (deg == null) { bar.setAttribute('d', ''); return; }
    bar.setAttribute('d', barPath(px, py, base, deg, heightAt(deg, lo, hi, T, cPos)));
  };

  if (isDetent) draw(R, a0, a1, THICK_MM, centrePos, indicatorAngle(binding));

  let raf = 0, lastEv = null;
  const redraw = () => {
    raf = 0;
    const e = lastEv;
    if (!e) return;
    const probe = typeof binding.hoverProbe === 'function' ? binding.hoverProbe(e) : null;
    if (probe && probe.mode === 'av') {
      // Hug the OUTSIDE of the attenuverter band, not the knob's rim, and show ONLY this —
      // two tapers at once would be describing one thing the scroll does and one it doesn't.
      // Clamped to the room between the band and the rim so it never crosses the knob's edge
      // onto the panel, where the value taper lives.
      const base = probe.avOuter;
      const room = Math.max(0.4, (R - base) - GAP_MM);
      draw(base, AV_A0, AV_A1, Math.min(thicknessFor(probe.factor), room), 0.5, probe.avAngle);
      return;
    }
    let factor = probe ? probe.factor : null;
    if (factor == null) {
      const b = hit.getBoundingClientRect();
      const Rpx = b.width / 2 || 1;
      const r = Math.hypot(e.clientX - (b.left + b.width / 2), e.clientY - (b.top + b.height / 2));
      factor = radialFactor(r, Rpx);
    }
    // A detent knob's thickness is fixed: its scroll rate is the same everywhere on the dial.
    draw(R, a0, a1, isDetent ? THICK_MM : thicknessFor(factor), centrePos, indicatorAngle(binding));
  };

  // The bar has to follow the knob as it TURNS, not just as the pointer moves — scrolling
  // turns the knob while the pointer sits still, and momentum keeps it turning after the last
  // wheel event. Watching the indicator's own transform catches every one of those, from any
  // cause (scroll, momentum, double-click reset, undo, a CV-driven readout), with no idle work
  // when nothing is moving. Mutations can fire many times per frame, so they share the same
  // animation-frame throttle as pointer motion.
  const spin = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(redraw); });
  const watchIndicator = () => {
    if (binding.indicator) spin.observe(binding.indicator, { attributes: true, attributeFilter: ['transform'] });
    // A knАck has a SECOND pointer: the attenuverter's, which is what a scroll in the depth
    // band turns. The value indicator does not move then, so watching it alone left the bar
    // frozen while the depth swung underneath it.
    if (binding.hoverWatch) spin.observe(binding.hoverWatch, { attributes: true });
  };

  // Listen on the GROUP, not the hit circle: a knАck's jack and its metallic band are painted
  // over that circle and are hittable themselves, so crossing onto the hole would leave the
  // circle and hide the mark. The group covers every descendant.
  const on = binding.group;
  on.addEventListener('pointerenter', (e) => {
    g.style.display = '';
    lastEv = e;
    watchIndicator();
    redraw();                                          // detents included: the bar tracks value
  });
  on.addEventListener('pointermove', (e) => {
    lastEv = e;
    if (!raf) raf = requestAnimationFrame(redraw);
  });
  on.addEventListener('pointerleave', () => {
    g.style.display = 'none';
    spin.disconnect();
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    lastEv = null;
  });

  binding.hoverMark = g;
}
