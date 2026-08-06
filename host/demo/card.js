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
`;

export function createDemoCard() {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'demo-card';
  document.body.appendChild(el);

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
  function show(text, { avoid = null, pin = null } = {}) {
    if (text == null || text === '') { hide(); return null; }
    el.textContent = text;
    el.classList.add('show');
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

  function hide() { el.classList.remove('show'); }
  // Where the card is standing, so the transport window can keep off it.
  const rect = () => { if (!el.classList.contains('show')) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  function destroy() { el.remove(); style.remove(); }

  return { show, hide, rect, destroy, el };
}
