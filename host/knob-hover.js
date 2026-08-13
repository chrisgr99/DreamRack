// knob-hover.js — the mark that appears while the pointer is on a knob.
//
// A translucent wedge hugging the OUTSIDE of the dial, spanning the control's travel and tapering
// from nothing at the low end to its full thickness at the high end. It says two things at once:
// where the knob can go, and which way is more. The dead sector needs no drawing — the wedge simply
// is not there.
//
// ONLY WHILE THE POINTER IS ON THE KNOB. Drawn permanently it would put a mark round every control on
// the rack; drawn on hover it answers the question at the moment you are asking it. A knАck's
// attenuverter ring sits in the same band and is drawn over the top: they overlap in a small arc and
// still read, because one is a thin orange line and the other a soft white field.
//
// IT USED TO SAY MORE, AND WAS WORSE FOR IT. An earlier version varied its thickness with how fast a
// scroll would move from that spot, and carried an orange bar at the current value. The speed is a
// held key now and the value is on the knob's own pointer, so the wedge is back to the one thing only
// it can say.
//
// PAINTING ORDER. The mark lives in the knob's OWN group, drawn in that group's coordinates. An
// attempt to move it into a shared layer beneath the panel's artwork — so legends and scale numerals
// would paint over it — is deliberately NOT here: it stopped the mark appearing at all, for a reason
// not yet found. Keeping it in the group is the arrangement known to work.

'use strict';

import { hideReadout, readoutLive, readoutRegion } from './knob-readout.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// White at low opacity. Not the green it once was — green means 1V/oct on these panels now, and an
// affordance has no business borrowing a signal's colour.
const SHADE = '#ffffff';
const SHADE_OPACITY = 0.3;
const GAP_MM = 0.35;          // clear of the dial's edge, so the wedge reads as separate from it
const THICK_MM = 2.4;         // the wedge at its thick end
const ARC_STEP_DEG = 3;       // outline resolution

// A knob's angle 0 points UP and grows clockwise (SVG rotate about the pivot).
function pt(px, py, rad, deg) {
  const a = (deg * Math.PI) / 180;
  return [px + rad * Math.sin(a), py - rad * Math.cos(a)];
}

// Is this a bipolar control — one whose meaningful zero is the middle of its travel, like a pan or a
// fine tune? Those swell from the centre outward in BOTH directions, because a taper rising from the
// minimum would say the centre was "half of something", which is wrong.
function bipolarCentre(meta) {
  if (!(meta && meta.min < 0 && meta.max > 0)) return null;
  return (0 - meta.min) / (meta.max - meta.min);        // position of zero along the travel
}

// The wedge's radial height at one angle.
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

// binding needs: group, hitArea, pivot, dialR, angleMin, angleMax, meta.
// binding.hoverProbe, if the host sets one, answers which of a knАck's two controls the pointer is
// over: { mode: 'value' | 'av' }. It is used to carry the readout, not to draw anything.
export function attachKnobHover(binding) {
  const hit = binding.hitArea;
  if (!hit || !binding.pivot) return;
  const R = binding.dialR || parseFloat(hit.getAttribute('r'));
  if (!(R > 0)) return;

  const doc = binding.group.ownerDocument;
  const wedge = doc.createElementNS(SVG_NS, 'path');
  wedge.setAttribute('fill', SHADE);
  wedge.setAttribute('fill-opacity', String(SHADE_OPACITY));
  wedge.setAttribute('class', 'knob-hover');
  wedge.style.pointerEvents = 'none';
  wedge.style.display = 'none';
  wedge.setAttribute('d', wedgePath(binding.pivot.x, binding.pivot.y, R,
    binding.angleMin, binding.angleMax, THICK_MM, bipolarCentre(binding.meta)));
  // FIRST in the group, so a knАck's attenuverter ring — added later, out in the same band — lies
  // over it rather than under.
  binding.group.insertBefore(wedge, binding.group.firstChild);

  // THE NUMBER IS NOT SHOWN FROM HERE. Clicking a control is what shows it; this side only carries it
  // about and sends it home. THE CHIP NO LONGER FOLLOWS: it stands centred over the control, so there
  // is nothing to carry — only the case where the pointer crosses into the OTHER half of a knАck,
  // where a number describing the value has stopped describing what is under your hand.
  const zoneNow = (e) => (typeof binding.hoverProbe === 'function' ? binding.hoverProbe(e).mode : 'value');
  const carryReadout = (e) => {
    if (!readoutLive()) return;
    const r = readoutRegion();
    if (r && zoneNow(e) !== r) hideReadout();
  };

  const on = binding.group;
  on.addEventListener('pointerenter', () => { wedge.style.display = ''; });
  on.addEventListener('pointermove', (e) => carryReadout(e));
  on.addEventListener('pointerleave', () => {
    wedge.style.display = 'none';
    hideReadout();   // the number belongs to the control you are on, and you have left it
  });

  binding.hoverMark = wedge;
}
