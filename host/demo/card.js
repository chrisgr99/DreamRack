// host/demo/card.js — the narration card a scripted demo speaks through (design/scripted-demo.md).
//
// One text place, floating OVER the rack rather than docked beside it: docking would take space
// from the very thing being demonstrated, and a separate window would not appear in a recording
// (the recorder captures the contents of the app window). So it is a layer inside the window,
// above the rack, taking no layout space and no pointer events.
//
// IT IS PLACED, NOT DRAGGED. The script knows every step's target in advance, so the runner hands
// this the region a note's steps are going to touch and the card takes a berth clear of it. The
// berth is chosen once per note and does not move while that note is up — a card that shuffles
// about while you are reading it is worse than one that briefly overlaps something. An author can
// pin a note to a named berth when the computed one reads badly.
'use strict';

// Six berths, in preference order. Bottom centre first: it is furthest from the tab bar and from
// the module titles, and it is where the eye already expects narration to be.
export const BERTHS = ['bottom', 'top', 'bottom-left', 'bottom-right', 'top-left', 'top-right'];

const MARGIN = 18;        // px from the window edge
const CLEAR = 12;         // px of daylight required between the card and the region it avoids
const STEP = 20;          // grid coarseness when searching for somewhere to stand

const CSS = `
  .demo-card { position: fixed; z-index: 4001; pointer-events: none; box-sizing: border-box;
    max-width: min(460px, 52vw); padding: 12px 20px; border-radius: 12px;
    background: rgba(20,17,13,0.92); color: #f2ead9; text-align: center;
    font: 600 23px/1.35 -apple-system, system-ui, sans-serif; border: 1px solid rgba(242,234,217,0.18);
    opacity: 0; transition: opacity 0.3s ease; }
  .demo-card.show { opacity: 1; }
  /* CAPTION MODE: one fixed place, never berthed. The berth search exists because a spoken note is
     glanced at; a caption is the ONLY channel, so the eye returns to it at every step and a card
     that moves each time costs a hunt. Bigger type, one line, and it sits where a lower third sits
     in any other video. */
  .demo-card.caption { max-width: min(900px, 86vw); padding: 10px 26px; border-radius: 10px;
    font: 600 30px/1.25 -apple-system, system-ui, sans-serif; white-space: nowrap;
    transition: opacity 0.16s ease; }
  /* NEAR THE ACTION. A caption at the bottom of the window is stable but far from the control it is
     about, and with a line on every step the eye pays that distance twice a step. So the chip parks
     beside the target and a leader points at it: white text, grey border, black enough to read over
     a panel. Smaller than the strip because it stands among the modules rather than under them. */
  .demo-card.chip { max-width: min(340px, 34vw); padding: 7px 14px; border-radius: 8px;
    white-space: normal; text-align: left; color: #fff;
    background: rgba(8,8,10,0.93); border: 1px solid #8b8b93;
    font: 600 19px/1.28 -apple-system, system-ui, sans-serif;
    transition: opacity 0.14s ease, left 0.22s ease, top 0.22s ease; }
  /* THE OPENING FRAME. Big enough to be read from across a room and from a phone in a feed, which is
     what an opening title is for; it appears once, over the picture, and nothing else competes. */
  .demo-card.title { max-width: min(1000px, 80vw); padding: 14px 26px; border-radius: 12px;
    white-space: normal; text-align: center; color: #fff;
    background: rgba(8,8,10,0.82); border: 1px solid #8b8b93;
    font: 700 54px/1.15 -apple-system, system-ui, sans-serif; }
  .demo-lead { position: fixed; inset: 0; z-index: 4000; pointer-events: none; }
  .demo-lead line { stroke: #8b8b93; stroke-width: 2; }
  .demo-lead circle { fill: none; stroke: #8b8b93; stroke-width: 2; }
`;

export function createDemoCard() {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'demo-card';
  document.body.appendChild(el);

  // The leader: one line from the chip to the control, with a ring round the control itself. Drawn
  // in its own overlay under the chip so the chip's own background always wins.
  const lead = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  lead.setAttribute('class', 'demo-lead');
  lead.style.display = 'none';
  document.body.appendChild(lead);
  const leadLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  const leadRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  lead.append(leadLine, leadRing);
  const hideLead = () => { lead.style.display = 'none'; };

  // Where the chip stands relative to its target. Below-right first: it is the side least likely to
  // cover the module's own labels, which sit above and to the left of most controls.
  const SIDES = [
    { dx: 16, dy: 14 }, { dx: -16, dy: 14, flipX: true },
    { dx: 16, dy: -14, flipY: true }, { dx: -16, dy: -14, flipX: true, flipY: true },
  ];
  let lastSpot = null, lastTarget = null;

  // Where each berth would put a card of this size.
  function berthRect(name, w, h) {
    const W = window.innerWidth, H = window.innerHeight;
    const mid = Math.round((W - w) / 2);
    const top = MARGIN, bot = H - h - MARGIN;
    switch (name) {
      case 'top': return { x: mid, y: top };
      case 'bottom-left': return { x: MARGIN, y: bot };
      case 'bottom-right': return { x: W - w - MARGIN, y: bot };
      case 'top-left': return { x: MARGIN, y: top };
      case 'top-right': return { x: W - w - MARGIN, y: top };
      default: return { x: mid, y: bot };
    }
  }

  const overlaps = (r, w, h, a) => !!a
    && r.x - CLEAR < a.x + a.w && r.x + w + CLEAR > a.x
    && r.y - CLEAR < a.y + a.h && r.y + h + CLEAR > a.y;
  // `avoid` may be one rect or several: the region the demo is about to work in, AND the transport
  // window, which the reader needs to be able to see and press while the card is up.
  const clashes = (r, w, h, avoid) =>
    (Array.isArray(avoid) ? avoid : [avoid]).some((a) => overlaps(r, w, h, a));

  // Show `text`, berthed clear of `avoid` — the module the note is describing, and the transport
  // window. Standing on some OTHER module is fine: the card only has to stay off what is being talked
  // about, and treating the whole rack as out of bounds only drove it into odd corners.
  //
  // `pin` forces a berth by name. Returns the berth actually used.
  // The pointer's tail, in the cursor graphic's own pixels: the arrow is drawn from its point at the
  // top left and runs about this far down and across.
  const TAIL_X = 14, TAIL_Y = 20;
  let followRaf = 0;
  function startFollow(getPos, w, h) {
    hideLead();
    const place = () => {
      const p = getPos && getPos();
      if (!p) return;
      const W = window.innerWidth, H = window.innerHeight;
      const r = el.getBoundingClientRect();
      const cw = r.width || w, ch = r.height || h;
      // Below-right by default, flipping only at an edge — so a caption never leaves the window and
      // never has to be hunted for at the far side of the pointer without warning.
      let x = p.x + TAIL_X, y = p.y + TAIL_Y;
      if (x + cw > W - MARGIN) x = Math.max(MARGIN, p.x - cw - 6);
      if (y + ch > H - MARGIN) y = Math.max(MARGIN, p.y - ch - 6);
      el.style.left = Math.round(x) + 'px';
      el.style.top = Math.round(y) + 'px';
    };
    place();
    el.style.visibility = '';
    if (!followRaf) {
      const tick = () => { if (!el.classList.contains('show')) { followRaf = 0; return; } place(); followRaf = requestAnimationFrame(tick); };
      followRaf = requestAnimationFrame(tick);
    }
  }
  const stopFollow = () => { if (followRaf) { cancelAnimationFrame(followRaf); followRaf = 0; } };

  // WHERE THE CHIP STANDS. Below-right of the target, flipping only to stay on screen — and holding
  // still when the next target is close to the last, because a hop of a few pixels reads as a twitch
  // rather than as a move and the reader has to re-find a caption that never really went anywhere.
  const STAY = 90;    // px: closer than this to the previous target and the chip does not move
  const GAP = 16;     // px of daylight between the chip and the panel it stands beside
  function chipSpot(t, w, h, keepOff) {
    const W = window.innerWidth, H = window.innerHeight;
    if (lastSpot && lastTarget && Math.hypot(t.x - lastTarget.x, t.y - lastTarget.y) < STAY) return lastSpot;
    // CLEAR OF THE MODULE, not merely clear of the control. The first version stood the chip a few
    // pixels from the knob it was pointing at, which put it squarely over that module's other
    // controls — including, on the Colorizer, the very list of palettes the caption was about.
    const box = (Array.isArray(keepOff) ? keepOff : [keepOff]).filter(Boolean);
    const fits = (x, y) => x >= MARGIN && y >= MARGIN && x + w <= W - MARGIN && y + h <= H - MARGIN
      && !box.some((b) => x - GAP < b.x + b.w && x + w + GAP > b.x && y - GAP < b.y + b.h && y + h + GAP > b.y);
    // Beside the panel first — right, then left — then under or over it, each time lined up with the
    // control so the leader is short and obviously joins the two.
    const cands = [];
    for (const b of box.length ? box : [{ x: t.x, y: t.y, w: t.w || 0, h: t.h || 0 }]) {
      const midY = Math.round(Math.min(Math.max(t.y - h / 2, MARGIN), H - h - MARGIN));
      const midX = Math.round(Math.min(Math.max(t.x - w / 2, MARGIN), W - w - MARGIN));
      cands.push({ x: Math.round(b.x + b.w + GAP), y: midY });
      cands.push({ x: Math.round(b.x - w - GAP), y: midY });
      cands.push({ x: midX, y: Math.round(b.y + b.h + GAP) });
      cands.push({ x: midX, y: Math.round(b.y - h - GAP) });
    }
    for (const s of SIDES) {   // and failing that, hard against the control itself
      cands.push({ x: Math.round(s.flipX ? t.x - (t.w || 0) / 2 - GAP - w : t.x + (t.w || 0) / 2 + GAP),
        y: Math.round(s.flipY ? t.y - (t.h || 0) / 2 - h : t.y + (t.h || 0) / 2) });
    }
    const hit = cands.find((c) => fits(c.x, c.y));
    if (hit) return hit;
    return { x: Math.round(Math.min(Math.max(MARGIN, t.x - w / 2), W - w - MARGIN)),
      y: Math.round(Math.min(Math.max(MARGIN, t.y + (t.h || 0) / 2 + 14), H - h - MARGIN)) };
  }

  // The leader runs from the chip's nearest edge to the target, with a ring round the target when the
  // step names one control. A whole module gets no ring: an arrow into the middle of a panel points
  // at nothing in particular, and the chip standing against it already says which module.
  function drawLead(spot, w, h, t, ring) {
    lead.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
    lead.style.display = '';
    const fromX = Math.min(Math.max(t.x, spot.x + 8), spot.x + w - 8);
    const fromY = spot.y + (t.y < spot.y ? 0 : h);
    const r = Math.max(10, Math.min(26, Math.max(t.w || 0, t.h || 0) / 2 + 6));
    const dx = t.x - fromX, dy = t.y - fromY, len = Math.hypot(dx, dy) || 1;
    const stopAt = ring ? Math.max(0, len - r) : len;
    leadLine.setAttribute('x1', fromX); leadLine.setAttribute('y1', fromY);
    leadLine.setAttribute('x2', fromX + dx * (stopAt / len));
    leadLine.setAttribute('y2', fromY + dy * (stopAt / len));
    leadRing.style.display = ring ? '' : 'none';
    if (ring) { leadRing.setAttribute('cx', t.x); leadRing.setAttribute('cy', t.y); leadRing.setAttribute('r', r); }
  }

  function show(text, { avoid = null, pin = null, caption = false, near = null, arrow = false, follow = null } = {}) {
    if (text == null || text === '') { hide(); return null; }
    el.textContent = text;
    el.classList.toggle('caption', !!caption);
    el.classList.add('show');
    // THE OPENING FRAME IS ITS OWN THING, and not a variety of caption: big letters, centred, and the
    // same in a narrated run as in a silent one. It was inside the caption branch, so a narrated demo
    // drew its title in the running-commentary card at the foot of the window.
    if (pin === 'title') {
      el.classList.remove('caption', 'chip');
      el.classList.add('title');
      hideLead(); stopFollow(); lastSpot = null; lastTarget = null;
      el.style.visibility = 'hidden';
      el.style.left = '0px'; el.style.top = '0px';
      const tw = el.offsetWidth, th = el.offsetHeight;
      el.style.left = Math.round((window.innerWidth - tw) / 2) + 'px';
      el.style.top = Math.round((window.innerHeight - th) / 2) + 'px';
      el.style.visibility = '';
      return 'title';
    }
    el.classList.remove('title');
    // A CAPTION IS PLACED, NOT SEARCHED FOR: one strip, low and centred, whatever the step touches.
    // Overlapping a module for a second is the smaller cost; a caption that has to be found again
    // every step is the larger one.
    if (caption) {
      el.classList.toggle('title', pin === 'title');
      el.classList.toggle('chip', !!near && pin !== 'title');
      el.style.visibility = 'hidden';
      el.style.left = '0px'; el.style.top = '0px';
      const w = el.offsetWidth, h = el.offsetHeight;
      // NOTHING TO POINT AT — a page switch, a remark about the patch as a whole — goes to the strip
      // at the bottom, where the eye already expects a caption. A chip floating in open rack with no
      // leader would be worse than either.
      if (pin === 'title') {
        hideLead(); stopFollow(); lastSpot = null; lastTarget = null;
        el.style.left = Math.round((window.innerWidth - w) / 2) + 'px';
        el.style.top = Math.round((window.innerHeight - h) / 2) + 'px';
        el.style.visibility = '';
        return 'title';
      }
      if (follow && pin !== 'middle') { el.classList.add('chip'); startFollow(follow, w, h); return 'follow'; }
      if (!near) {
        hideLead();
        // THE OPENING CARD SITS IN THE MIDDLE, over the picture it is about. Everywhere else a
        // targetless caption goes to the strip, which is where the eye expects one; an opening
        // title is the exception, because there is nothing else on screen to compete with it.
        if (pin === 'middle') {
          lastSpot = null; lastTarget = null;
          el.style.left = Math.round((window.innerWidth - w) / 2) + 'px';
          el.style.top = Math.round((window.innerHeight - h) / 2) + 'px';
          el.style.visibility = '';
          return 'middle';
        }
        lastSpot = null; lastTarget = null;
        el.style.left = Math.round((window.innerWidth - w) / 2) + 'px';
        el.style.top = Math.round(window.innerHeight - h - MARGIN * 2) + 'px';
        el.style.visibility = '';
        return 'caption';
      }
      // FOLLOWING THE POINTER. A caption parked beside the target still costs a glance away from
      // the pointer and back; hung off the pointer itself it is read where the eye already is, and
      // it travels to the next control WITH the thing it is describing. Top-left corner just under
      // the arrow's tail, so the arrow's own tip stays clear to point with.
      if (follow) { startFollow(follow, w, h); return 'follow'; }
      const spot = chipSpot(near, w, h, avoid);
      // MEASURED AGAIN AFTER PLACING. The height is taken before the chip is anywhere, and a line
      // that wraps once it has a position makes that figure a lie — which is how a caption ended up
      // hanging off the bottom of the window. Clamp on the real box, not the predicted one.
      el.style.left = spot.x + 'px';
      el.style.top = spot.y + 'px';
      const real = el.getBoundingClientRect();
      spot.x = Math.round(Math.min(Math.max(MARGIN, spot.x), window.innerWidth - real.width - MARGIN));
      spot.y = Math.round(Math.min(Math.max(MARGIN, spot.y), window.innerHeight - real.height - MARGIN));
      el.style.left = spot.x + 'px';
      el.style.top = spot.y + 'px';
      el.style.visibility = '';
      drawLead(spot, w, h, near, !!arrow);
      lastSpot = spot; lastTarget = near;
      return 'chip';
    }
    el.style.visibility = 'hidden';                       // measure before committing to a berth
    el.style.left = '0px'; el.style.top = '0px';
    const w = el.offsetWidth, h = el.offsetHeight;

    let chosen = 'bottom', rect = berthRect('bottom', w, h);
    if (pin) {
      rect = berthRect(pin, w, h); chosen = pin;
    } else {
      // SEARCH, not a shortlist. Six fixed berths were never going to find the gap on a full rack —
      // the free space is wherever the modules happen not to be, which moves with the patch. So try a
      // coarse grid of positions, nearest the preferred berth first, and take the first that is clear
      // of everything. Only if nothing at all is clear of the rack do we settle for clear-of-`avoid`.
      const home = berthRect('bottom', w, h);
      const spots = [];
      const W = window.innerWidth, H = window.innerHeight;
      for (let y = MARGIN; y <= H - h - MARGIN; y += STEP) {
        for (let x = MARGIN; x <= W - w - MARGIN; x += STEP) spots.push({ x, y });
      }
      spots.sort((a, b) => (Math.hypot(a.x - home.x, a.y - home.y) - Math.hypot(b.x - home.x, b.y - home.y)));
      rect = spots.find((r) => !clashes(r, w, h, avoid)) || home;
      chosen = 'searched';
    }
    el.style.left = Math.round(rect.x) + 'px';
    el.style.top = Math.round(rect.y) + 'px';
    el.style.visibility = '';
    return chosen;
  }

  function hide() { el.classList.remove('show'); hideLead(); stopFollow(); lastSpot = null; lastTarget = null; }
  // Where the card is standing, so the transport window can keep off it.
  const rect = () => { if (!el.classList.contains('show')) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  function destroy() { el.remove(); lead.remove(); style.remove(); }

  return { show, hide, rect, destroy, el };
}
