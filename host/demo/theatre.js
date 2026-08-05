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

const CURSOR_SVG =
  '<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">' +
  '<path d="M3 2 L3 21 L8 16 L11.5 23 L14.5 21.8 L11 15 L17.5 15 Z" ' +
  'fill="#ffffff" stroke="#111111" stroke-width="1.3" stroke-linejoin="round"/></svg>';

// The whole vocabulary. A demo that needs an eighth word needs a discussion, not a new string.
export const GESTURES = ['move pointer', 'left click', 'right click', 'button down', 'drag', 'button up', 'scroll-wheel'];

const BADGE_OFF = 15;   // px from the pointer to the near corner of the badge

const CSS = `
  html.demo-playing, html.demo-playing * { cursor: none !important; }
  .demo-cursor { position: fixed; z-index: 4000; pointer-events: none; margin: -2px 0 0 -3px;
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.55)); will-change: left, top; }
  .demo-cursor svg { display: block; }
  .demo-cursor.press svg { animation: demo-press 0.18s ease; }
  @keyframes demo-press { 0% { transform: scale(1); } 45% { transform: scale(0.78); } 100% { transform: scale(1); } }
  /* The gesture badge wears the same clothes as a cable's hover flag: black, a hairline border,
     lettering pinned to the height the capitals actually need. One look for "a small label the
     app is showing you about the thing under the pointer". */
  .demo-badge { position: fixed; z-index: 4002; display: none; pointer-events: none;
    background: #000; border: 1px solid #cfcfcf; color: #fff;
    font: 600 14px/11px system-ui, -apple-system, sans-serif;
    padding: 3px 8px 4px; border-radius: 3px; white-space: nowrap;
    box-shadow: 0 1px 4px rgba(0,0,0,.55); }
  .demo-ripple { position: fixed; z-index: 3999; pointer-events: none; width: 10px; height: 10px;
    margin: -5px 0 0 -5px; border-radius: 50%; border: 2px solid var(--accent, #e0a353);
    animation: demo-ripple 0.5s ease-out forwards; }
  @keyframes demo-ripple { 0% { opacity: 0.9; transform: scale(0.4); } 100% { opacity: 0; transform: scale(4.2); } }
  .demo-hot { filter: drop-shadow(0 0 4px var(--accent, #e0a353)) drop-shadow(0 0 9px var(--accent, #e0a353)); }
`;

// ease-in-out (quadratic): accelerate away, settle on arrival.
const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

export function createDemoTheatre(getCtx) {
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
  function begin(hideOS = true) {
    ensure(); cancelled = false;
    document.documentElement.classList.toggle('demo-playing', !!hideOS);
    cursorEl.style.display = 'block';
    place(px, py);
  }
  function end() {
    cancelled = true;
    tracker = null;
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
  function span(demoSecs, onFrame) {
    return new Promise((resolve) => {
      const c = getCtx();
      const dur = instant ? 0 : Math.max(0, demoSecs) / rate;
      if (cancelled || dur <= 0) { if (onFrame) onFrame(1); resolve(); return; }
      const now = () => (c ? c.currentTime : performance.now() / 1000);
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
    const rip = document.createElement('div');
    rip.className = 'demo-ripple';
    rip.style.left = px + 'px'; rip.style.top = py + 'px';
    document.body.appendChild(rip);
    rip.addEventListener('animationend', () => rip.remove());
    setTimeout(() => rip.remove(), 1200);   // animationend never fires in a window that is not painting
    cursorEl.classList.remove('press'); void cursorEl.offsetWidth; cursorEl.classList.add('press');
  }

  // A scroll-wheel gesture reads as a run of small pulses — one per notch — so the wheel is seen
  // TURNING rather than seen to have jumped. Spread across the time the value takes to move.
  function wheelTicks(demoSecs, notches = 6) {
    const n = Math.max(1, notches | 0);
    let fired = 0;
    return span(demoSecs, (u) => { const want = Math.min(n, Math.ceil(u * n)); while (fired < want) { fired++; click(); } });
  }

  // Briefly glow the control being acted on.
  function highlight(el) {
    if (!el || instant) return;
    el.classList.add('demo-hot');
    setTimeout(() => el.classList.remove('demo-hot'), 550);
  }

  return { begin, end, place, moveTo, click, wheelTicks, highlight, badge, sleep, span, setRate, setInstant,
    setTracker, get pos() { return { x: px, y: py }; } };
}
