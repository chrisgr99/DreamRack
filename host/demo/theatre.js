// host/demo/theatre.js — the visible surface of a scripted demo (design/scripted-demo.md).
//
// Pure presentation, no behaviour: a synthetic pointer that eases between points, a badge beside
// it naming the gesture about to happen, a click ripple, and a brief glow on the control being
// acted on. The narration itself lives in card.js — this file draws only what happens at the
// pointer. The real OS cursor is hidden during playback so only the synthetic one is captured.
//
// THE BADGE names the gesture in the app's own terms, and there are exactly seven of them (see
// GESTURES). It is generated from the step, never authored: an author says "patch this to that"
// and the runner expands it into move pointer / left click / move pointer / left click. The badge
// appears BEFORE the action and holds a beat, so you read what is about to happen and then watch
// it happen — announce, then do. That ordering, rather than a slower rate, is what makes a demo
// followable.
//
// Timing is slaved to the AudioContext clock so replays match, but every loop is driven by a
// TIMER as well as by animation frames: a hidden or occluded window stops delivering frames, and
// a demo that silently parks itself mid-step is worse than one that finishes without its
// in-between positions drawn. Frames are used when they arrive; the timer carries the timeline
// when they don't.
'use strict';

// TWICE the size it was. This pointer is being watched from across the room, or through a magnified
// view, and at 26 pixels it was the smallest thing on screen while being the thing to follow.
const CURSOR_SVG =
  '<svg width="52" height="52" viewBox="0 0 26 26" aria-hidden="true">' +
  '<path d="M3 2 L3 21 L8 16 L11.5 23 L14.5 21.8 L11 15 L17.5 15 Z" ' +
  'fill="#ffffff" stroke="#111111" stroke-width="1.3" stroke-linejoin="round"/></svg>';

// The whole vocabulary. A demo that needs an eighth word needs a discussion, not a new string.
export const GESTURES = ['move pointer', 'left click', 'right click', 'button down', 'drag', 'button up', 'scroll-wheel'];

const BADGE_OFF = 15;   // px from the pointer to the near corner of the badge

const CSS = `
  html.demo-playing, html.demo-playing * { cursor: none !important; }
  .demo-cursor { position: fixed; z-index: 4000; pointer-events: none; margin: -4px 0 0 -6px;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.55)); will-change: left, top; }
  .demo-cursor svg { display: block; }
  .demo-cursor.press svg { animation: demo-press 0.18s ease; }
  @keyframes demo-press { 0% { transform: scale(1); } 45% { transform: scale(0.78); } 100% { transform: scale(1); } }
  /* The gesture badge wears the same clothes as a cable's hover flag: black, a hairline border,
     lettering pinned to the height the capitals actually need. One look for "a small label the
     app is showing you about the thing under the pointer". */
  .demo-badge { position: fixed; z-index: 4002; display: none; pointer-events: none;
    background: #000; border: 1px solid #cfcfcf; color: #fff;
    font: 600 14px/11px system-ui, -apple-system, sans-serif;
    padding: 3px 8px 4px; border-radius: 3px; white-space: nowrap; }
  /* RADIATING RINGS. One ring was a blink you could miss; three, staggered, read as a press even out
     of the corner of the eye — which is what the convention is for in every screen recording that
     uses it. They start at the pointer and travel outwards. */
  .demo-ripple { position: fixed; z-index: 3999; pointer-events: none; width: 14px; height: 14px;
    margin: -7px 0 0 -7px; border-radius: 50%; border: 2.5px solid var(--accent, #e0a353);
    animation: demo-ripple 0.75s cubic-bezier(0.2, 0.6, 0.3, 1) forwards; }
  @keyframes demo-ripple { 0% { opacity: 0.95; transform: scale(0.35); } 100% { opacity: 0; transform: scale(5); } }
  .demo-hot { filter: drop-shadow(0 0 4px var(--accent, #e0a353)) drop-shadow(0 0 9px var(--accent, #e0a353)); }
  /* A MENU HIGHLIGHT MUST FOLLOW THE SYNTHETIC POINTER, NOT THE REAL ONE. The reader's own mouse is
     lying still wherever they left it, and a menu that opens under it lights whichever row it
     happens to cover — so the pointer is on "First drone" while "Save As" is picked out, and the
     reader believes the pointer, or the highlight, or neither. Real hover is switched off for the
     duration and the demo says which row it is on. */
  html.demo-playing .rack-menu-item:hover { background: transparent; color: var(--ink); }
  html.demo-playing .rack-menu-item:hover .rack-menu-check,
  html.demo-playing .rack-menu-item:hover .rack-menu-arrow { color: inherit; }
  html.demo-playing .rack-menu-item.demo-hover { background: var(--accent); color: var(--accent-ink); }
  html.demo-playing .rack-menu-item.demo-hover .rack-menu-check,
  html.demo-playing .rack-menu-item.demo-hover .rack-menu-arrow { color: var(--accent-ink); }
`;

// ease-in-out (quadratic): accelerate away, settle on arrival.
const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

export function createDemoTheatre() {
  let styleEl = null, cursorEl = null, badgeEl = null;
  let rate = 1, cancelled = false, instant = false;
  let px = Math.round(window.innerWidth / 2), py = Math.round(window.innerHeight / 2);

  function ensure() {
    if (!styleEl) { styleEl = document.createElement('style'); styleEl.textContent = CSS; document.head.appendChild(styleEl); }
    if (!cursorEl) { cursorEl = document.createElement('div'); cursorEl.className = 'demo-cursor'; cursorEl.innerHTML = CURSOR_SVG; cursorEl.style.display = 'none'; document.body.appendChild(cursorEl); }
    if (!badgeEl) { badgeEl = document.createElement('div'); badgeEl.className = 'demo-badge'; document.body.appendChild(badgeEl); }
  }

  // Something that must follow the pointer every frame — a cable being carried, which the rack
  // itself draws. Set while the cord is in hand, cleared on the drop.
  let tracker = null;
  const setTracker = (fn) => { tracker = fn || null; };

  function place(x, y) {
    px = x; py = y;
    if (cursorEl) { cursorEl.style.left = Math.round(x) + 'px'; cursorEl.style.top = Math.round(y) + 'px'; }
    placeBadge();
    if (tracker) tracker(x, y);
  }

  // The badge sits BELOW-RIGHT of the pointer by default and flips to whichever side keeps it on
  // screen. `badgeAway` is where the pointer is about to travel: given a choice the badge takes the
  // opposite side, so it never covers the thing you are being shown next.
  let badgeAway = null;
  function placeBadge() {
    if (!badgeEl || badgeEl.style.display === 'none') return;
    const w = badgeEl.offsetWidth, h = badgeEl.offsetHeight;
    let right = true, below = true;
    if (badgeAway) {
      if (badgeAway.x > px) right = false;
      if (badgeAway.y > py) below = false;
    }
    if (right && px + BADGE_OFF + w > window.innerWidth - 4) right = false;
    if (!right && px - BADGE_OFF - w < 4) right = true;
    if (below && py + BADGE_OFF + h > window.innerHeight - 4) below = false;
    if (!below && py - BADGE_OFF - h < 4) below = true;
    badgeEl.style.left = Math.round(right ? px + BADGE_OFF : px - BADGE_OFF - w) + 'px';
    badgeEl.style.top = Math.round(below ? py + BADGE_OFF : py - BADGE_OFF - h) + 'px';
  }

  // Show (or clear) the gesture badge. `awayFrom` biases which side of the pointer it takes.
  function badge(word, awayFrom) {
    ensure();
    badgeAway = awayFrom || null;
    if (!word) { badgeEl.style.display = 'none'; return; }
    badgeEl.textContent = word;
    badgeEl.style.display = 'block';
    placeBadge();
  }

  // `hideOS` hides the real pointer, which is what a RUN wants — only the synthetic one should be in
  // the recording. Stepping through while authoring passes false: the synthetic cursor still shows
  // where the demo is pointing, but you keep your own pointer to work with.
  // `home` puts the pointer back to the middle of the window. A run otherwise starts wherever the
  // last one left off — which meant a demo could open with its pointer already sitting on the very
  // terminal it was about to travel to, so the first move looked like nothing at all.
  const home = () => { px = Math.round(window.innerWidth / 2); py = Math.round(window.innerHeight / 2); };

  function begin(hideOS = true, fromHome = false) {
    ensure(); cancelled = false;
    if (fromHome) home();
    document.documentElement.classList.toggle('demo-playing', !!hideOS);
    cursorEl.style.display = 'block';
    place(px, py);
  }
  function end() {
    cancelled = true;
    tracker = null;
    hoverItem(null);
    if (cursorEl) cursorEl.style.display = 'none';
    if (badgeEl) badgeEl.style.display = 'none';
    document.documentElement.classList.remove('demo-playing');
  }
  function setRate(r) { if (Number(r) > 0) rate = Number(r); }
  // Step-through: every wait collapses to nothing and every animation jumps to its end state. The
  // author stepping one step at a time is not watching the choreography, and neither is a test.
  function setInstant(on) { instant = !!on; }

  // ---- the demo clock ------------------------------------------------------
  // One helper behind every wait and every animation. It reads elapsed time off the AudioContext
  // (falling back to wall clock when there is no context yet) and calls `onFrame(u)` with progress
  // 0..1. Animation frames drive it when they arrive; a timer drives it when they don't.
  // THE CHOREOGRAPHY RUNS ON WALL-CLOCK TIME, NOT THE AUDIO CLOCK. This used to read
  // `ctx.currentTime`, on the reasoning that motion should be in step with sound. It is not worth
  // what it costs: `currentTime` only advances while the context is RUNNING, so the moment anything
  // stops the audio clock — and silencing a patch as it loads can — `u` never reaches 1, the promise
  // never resolves, and the demo freezes mid-step with no error and no way out. Nothing here needs
  // sample accuracy anyway: narration is a separate promise that the step waits on in its own right.
  function span(demoSecs, onFrame) {
    return new Promise((resolve) => {
      const dur = instant ? 0 : Math.max(0, demoSecs) / rate;
      if (cancelled || dur <= 0) { if (onFrame) onFrame(1); resolve(); return; }
      const now = () => performance.now() / 1000;
      const t0 = now();
      let done = false, timer = 0;
      const tick = () => {
        if (done) return;
        if (cancelled) { done = true; clearTimeout(timer); resolve(); return; }
        const u = Math.min(1, (now() - t0) / dur);
        if (onFrame) onFrame(u);
        if (u >= 1) { done = true; clearTimeout(timer); resolve(); return; }
        requestAnimationFrame(tick);
        clearTimeout(timer); timer = setTimeout(tick, 40);   // the carrier, for when frames stop
      };
      tick();
    });
  }
  const sleep = (demoSecs) => span(demoSecs, null);

  // Move the pointer to (x, y) over `demoSecs`, eased.
  function moveTo(x, y, demoSecs) {
    const sx = px, sy = py;
    badgeAway = { x, y };
    return span(demoSecs, (u) => { const e = ease(u); place(sx + (x - sx) * e, sy + (y - sy) * e); });
  }

  // A visible click at the current pointer: an expanding ripple plus a press pulse.
  function click() {
    if (!cursorEl || instant) return;
    const x = px, y = py;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const rip = document.createElement('div');
        rip.className = 'demo-ripple';
        rip.style.left = x + 'px'; rip.style.top = y + 'px';
        document.body.appendChild(rip);
        rip.addEventListener('animationend', () => rip.remove());
        // animationend never fires in a window that is not painting, so sweep it either way
        setTimeout(() => rip.remove(), 1600);
      }, i * 130);
    }
    cursorEl.classList.remove('press'); void cursorEl.offsetWidth; cursorEl.classList.add('press');
  }

  // A scroll-wheel gesture reads as a run of small pulses — one per notch — so the wheel is seen
  // TURNING rather than seen to have jumped. Spread across the time the value takes to move.
  function wheelTicks(demoSecs, notches = 6) {
    const n = Math.max(1, notches | 0);
    let fired = 0;
    return span(demoSecs, (u) => { const want = Math.min(n, Math.ceil(u * n)); while (fired < want) { fired++; click(); } });
  }

  // Which menu row the synthetic pointer is standing on — see the CSS above. Only ever one, and it
  // is cleared when the demo ends, so a stopped demo never leaves a row lit.
  let hovered = null;
  function hoverItem(el) {
    if (hovered) hovered.classList.remove('demo-hover');
    hovered = el || null;
    if (hovered) hovered.classList.add('demo-hover');
  }

  // Briefly glow the control being acted on.
  function highlight(el) {
    if (!el || instant) return;
    el.classList.add('demo-hot');
    setTimeout(() => el.classList.remove('demo-hot'), 550);
  }

  return { begin, end, place, moveTo, click, wheelTicks, highlight, hoverItem, badge, sleep, span, setRate, setInstant,
    setTracker, home, get pos() { return { x: px, y: py }; } };
}
