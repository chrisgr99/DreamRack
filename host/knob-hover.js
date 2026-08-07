// knob-hover.js — the hover mark on a knob: which control your scroll will move.
//
// ONE MARK, ON AN EDGE. While the pointer is in a knob's scroll area, a soft shaded ring grows
// around the OUTSIDE of the knob, covering exactly the band that can be scrolled on. That is all it
// says: this knob is live, and here is where.
//
// It used to say four things — a tapered wedge for the sweep and its direction, a thickness for the
// scroll speed at that spot, an orange bar for the current value — and together they were more to
// read than the control itself. The gauge already shows the sweep and the value, and the fine
// control near the rim is something you feel within one turn. So the wedge and the bar are gone.
//
// A knАck is the one case that still needs telling apart, because it has two controls under one
// pointer: the value out at the band, the attenuverter in at the jack. Nothing extra is drawn for
// that either — whichever of the two your scroll would move is the one that lights up. Outer zone:
// the ring outside the knob. Inner zone: the attenuverter's own ring, a shade lighter in place.
//
// PAINTING ORDER. The mark lives in the knob's OWN group, drawn in that group's coordinates. An
// attempt to move it into a shared layer beneath the panel's artwork — so legends and scale numerals
// would paint over it — is deliberately NOT here: it stopped the mark appearing at all, for a reason
// not yet found. Keeping it in the group is the arrangement known to work.

'use strict';

import { armReadout, cancelArmed, hideReadout, readoutLive, showReadout, formatParamValue } from './knob-readout.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Neutral, not the old green. Colour means SIGNAL on these panels now — green is 1V/oct — so the
// affordance is drawn in plain white at low opacity and stays out of that vocabulary.
const SHADE = '#ffffff';
const SHADE_OPACITY = 0.18;
// The attenuverter's EMPTY track while a scroll would move it. It has to stay clearly darker than
// the depth fill (#c3c9cf) — lifted to near-white, the empty part and the filled part matched and
// the ring read as a solid white disc, which said the depth was at maximum whatever it was.
const AV_SHADE = '#585d62';
const EDGE_DIMMED = '#808080';     // the knob's white outline while the shade is up — a true mid
                                   // grey, because a light one still reads as white against the band
const EDGE_W = 0.25;               // ...at the same weight the panel draws it
const GROW_MS = 120;

// binding needs: group, hitArea, pivot, dialR, hoverBand.
// binding.hoverProbe, if the host sets one, answers "what would a scroll HERE do?" for a pointer
// event: { mode: 'value' | 'av' }. A knАck sets it. binding.avRing, if the host sets one, is that
// knob's attenuverter ring: { track } — the element to lift while the pointer is over it.
export function attachKnobHover(binding) {
  const hit = binding.hitArea;
  if (!hit || !binding.pivot) return;
  const R = binding.dialR || parseFloat(hit.getAttribute('r'));
  const band = binding.hoverBand != null ? binding.hoverBand : 0;
  if (!(R > 0) || !(band > 0.05)) return;   // a knob with no room to reach into has nothing to draw

  const doc = binding.group.ownerDocument;
  const ring = doc.createElementNS(SVG_NS, 'circle');
  ring.setAttribute('cx', binding.pivot.x);
  ring.setAttribute('cy', binding.pivot.y);
  ring.setAttribute('fill', 'none');
  ring.setAttribute('stroke', SHADE);
  ring.setAttribute('stroke-opacity', String(SHADE_OPACITY));
  ring.setAttribute('class', 'knob-hover');
  ring.style.pointerEvents = 'none';
  ring.style.display = 'none';
  hit.parentNode.insertBefore(ring, hit.nextSibling);

  // THE SHADE REACHES IN AS FAR AS THE GAUGE. Its inner edge is the inner edge of the gauge band and
  // its outer edge is the limit of the scroll area, so the coloured arc sits ON the shade rather than
  // beside it — one lit region with the value drawn over it, instead of two rings to read.
  const track = binding.group.querySelector('[data-wcoast-role="gauge-track"]');
  const inner = track
    ? (parseFloat(track.getAttribute('r')) || R) - (parseFloat(track.getAttribute('stroke-width')) || 0) / 2
    : R;
  const outer = R + band;
  const width = Math.max(0.3, outer - inner);

  // It GROWS outward from the knob's edge rather than appearing whole, which is what makes it read
  // as belonging to the knob you have just arrived at. Geometry is set through style, not through
  // attributes, because that is what the transition can act on.
  // The knob's outline STAYS PUT and turns light grey. It has to be REDRAWN here rather than just
  // recoloured in place: the shade paints over the knob's own circle, and an 18% white wash over a
  // grey line takes it most of the way back to white — which is why recolouring it looked like
  // nothing had happened. So the real one is switched off and this one, at the same radius, is drawn
  // on top of the shade, where its colour is its own.
  const lip = doc.createElementNS(SVG_NS, 'circle');
  lip.setAttribute('cx', binding.pivot.x);
  lip.setAttribute('cy', binding.pivot.y);
  lip.setAttribute('fill', 'none');
  lip.setAttribute('stroke', EDGE_DIMMED);
  lip.setAttribute('stroke-width', EDGE_W);
  lip.setAttribute('class', 'knob-hover-lip');
  lip.style.pointerEvents = 'none';
  lip.style.display = 'none';
  ring.parentNode.insertBefore(lip, ring.nextSibling);

  lip.setAttribute('r', R);   // the knob's own edge, and it does not move
  const collapse = () => { ring.style.r = `${R}px`; ring.style.strokeWidth = '0px'; };
  const expand = () => { ring.style.r = `${(inner + outer) / 2}px`; ring.style.strokeWidth = `${width}px`; };
  collapse();

  // The knob's white outer circle is drawn straight across the shaded band, so it drops to a light
  // grey while the shade is up and comes back when the pointer leaves. Grey, not gone: the knob keeps
  // its outline, it just stops being the brightest thing inside a lit region.
  //
  // FOUND BY ITS COLOUR, not by size. It used to take binding.dial — the largest circle — which is
  // the right one on an ordinary knob and the wrong one wherever a panel draws its outline somewhere
  // else, so some knobs greyed and others stayed white for no reason you could see. The white circle
  // is the largest circle STROKED WHITE, and that is true on every panel including the hand-drawn
  // ones. (A knАck's metal centre is white-stroked too, and smaller, so it is not picked.)
  const edge = (() => {
    let best = null, br = -1;
    for (const c of binding.group.querySelectorAll('circle')) {
      if (c === ring || c === hit) continue;
      if ((c.getAttribute('stroke') || '').toLowerCase() !== '#ffffff') continue;
      const r = parseFloat(c.getAttribute('r'));
      if (isFinite(r) && r > br) { br = r; best = c; }
    }
    return best || binding.dial;
  })();
  let edgeWas = null;
  const hideEdge = () => {
    if (!edge || edgeWas !== null) return;
    edgeWas = edge.getAttribute('stroke') || 'none';
    edge.setAttribute('stroke', 'none');   // redrawn over the shade instead, in grey — see `lip`
  };
  const showEdge = () => {
    if (!edge || edgeWas === null) return;
    edge.setAttribute('stroke', edgeWas);
    edgeWas = null;
  };

  // UNDER the gauge fill, over the gauge track. The fill is made lazily the first time a value is
  // applied, which is after this runs, so the ring is put in its place at hover time rather than here.
  const stack = () => {
    const fill = binding.group.querySelector('.gauge-fill');
    if (!fill) return;
    // Both, and in this order: shade under the coloured arc, the grey outline over the shade. Moving
    // only the shade left the outline behind it, washed out by the very thing it had to sit on top of.
    if (ring.nextElementSibling !== lip || lip.nextElementSibling !== fill) {
      fill.parentNode.insertBefore(ring, fill);
      fill.parentNode.insertBefore(lip, fill);
    }
  };

  let avLifted = null;
  const dropAv = () => {
    if (!avLifted) return;
    if (avLifted.was == null) avLifted.el.removeAttribute('stroke');
    else avLifted.el.setAttribute('stroke', avLifted.was);
    avLifted = null;
  };
  const liftAv = () => {
    const el = binding.avRing && binding.avRing.track;
    if (!el || (avLifted && avLifted.el === el)) return;
    dropAv();
    avLifted = { el, was: el.getAttribute('stroke') };
    el.setAttribute('stroke', AV_SHADE);
  };

  // THE NUMBER, AFTER A SECOND OF RESTING. Scrolling shows it instantly (the wheel handlers do
  // that); this is the unasked one, for reading a patch by pointing at it. It is re-armed on every
  // move, so it only ever appears when you have actually stopped.
  //
  // NOT OVER A KNАCK'S JACK. That part of the control is a terminal — you go there to plug a cable
  // in — and a number appearing over it would be answering a question you did not ask. Scrolling
  // there still reports, because then you really are turning something.
  // THE NUMBER FOLLOWS THE POINTER while it is on this control. It is armed when the pointer ARRIVES
  // — a second later it appears and then stays, tracking the pointer, until the pointer leaves. It is
  // not re-armed as the pointer moves about: that made it flash up again every time you paused while
  // working on the same knob. Scrolling shows it at once, from the wheel handlers, and it is sticky
  // from then on too.
  //
  // NOT OVER A KNАCK'S JACK. That part of the control is a terminal — you go there to plug a cable in
  // — so the number steps aside while the pointer is on it and comes back when it leaves.
  const readoutAt = (e) => {
    if (!e) return null;
    if (binding.onTerminal && binding.onTerminal(e)) return null;
    const zone = (typeof binding.hoverProbe === 'function' && binding.hoverProbe(e).mode) || 'value';
    const text = typeof binding.readoutText === 'function'
      ? binding.readoutText(zone)
      : formatParamValue(binding.meta, binding.readValue && binding.readValue());
    return { text, x: e.clientX, y: e.clientY };
  };
  // Re-arms itself if the pointer happens to be on the jack when the second is up, rather than
  // giving up for the whole visit. Re-arming on every MOVE would be wrong — a moving pointer would
  // keep resetting the second and the number would never appear at all.
  const armOnEntry = () => armReadout(() => {
    const r = readoutAt(lastEv);
    if (!r) { armOnEntry(); return null; }
    return r;
  });
  const trackReadout = (e) => {
    if (!readoutLive()) return;
    const r = readoutAt(e);
    if (r && r.text != null) showReadout(r.text, r.x, r.y, true, { sticky: true });
    else hideReadout();   // over the jack: step aside, and re-arm so it returns when you move off
  };

  let raf = 0, lastEv = null;
  const redraw = () => {
    raf = 0;
    if (!lastEv) return;
    const probe = typeof binding.hoverProbe === 'function' ? binding.hoverProbe(lastEv) : null;
    if (probe && probe.mode === 'av') { ring.style.display = 'none'; lip.style.display = 'none'; showEdge(); liftAv(); return; }
    dropAv();
    if (ring.style.display !== 'none') return;
    stack();
    hideEdge();
    ring.style.display = '';
    lip.style.display = '';
    ring.style.transition = 'none';
    collapse();
    // The transition needs a settled starting state to run FROM. Reading a layout value forces the
    // style to be recalculated here and now, which is what makes the growth happen. An animation
    // frame would do the same, except that a hidden window never gives one — and then the ring stays
    // at zero width and the knob looks dead.
    void ring.getBoundingClientRect();
    ring.style.transition = `r ${GROW_MS}ms ease-out, stroke-width ${GROW_MS}ms ease-out`;
    expand();
  };

  // Listen on the GROUP, not the hit circle: a knАck's jack and its attenuverter are painted over
  // that circle and are hittable themselves, so crossing onto the hole would leave the circle and
  // hide the mark. The group covers every descendant.
  const on = binding.group;
  on.addEventListener('pointerenter', (e) => { lastEv = e; redraw(); armOnEntry(); });
  on.addEventListener('pointermove', (e) => {
    lastEv = e;
    if (readoutLive()) trackReadout(e);
    if (!raf) raf = requestAnimationFrame(redraw);
  });
  on.addEventListener('pointerleave', () => {
    ring.style.display = 'none';
    lip.style.display = 'none';
    ring.style.transition = 'none';
    collapse();
    showEdge();
    dropAv();
    cancelArmed();
    hideReadout();   // the number belongs to the control you are on, and you have left it
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    lastEv = null;
  });

  binding.hoverMark = ring;
}
