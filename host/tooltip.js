// host/tooltip.js — a delayed tooltip, in the app's own clothes.
//
// The native `title` tooltip is the operating system's: it looks like nothing else here, its delay is
// not ours to set, and in a magnified view it can land somewhere the reader is not looking. This one
// is a small black chip with a hairline border — the same chip the demo's gesture badge and the
// tutorial's buttons wear — so a tip reads as part of the app.
//
// IT WAITS. A tooltip that appears the instant the pointer crosses a control is noise: you meet it
// constantly while doing something else. A short dwell means it only ever appears when you have
// stopped ON something, which is the moment you actually wanted to know what it was.
'use strict';

const DELAY_MS = 550;   // long enough that passing over a button never raises one
const GAP = 8;          // px between the control and the chip

const CSS = `
  .app-tip { position: fixed; z-index: 4200; pointer-events: none; display: none;
    background: #000; border: 1px solid #cfcfcf; color: rgba(255,255,255,0.92);
    font: 500 12px/1.25 -apple-system, system-ui, sans-serif;
    padding: 3px 8px 4px; border-radius: 4px; white-space: nowrap; }
  .app-tip.show { display: block; }
`;

let el = null, timer = 0, current = null;

function ensure() {
  if (el) return el;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  el = document.createElement('div');
  el.className = 'app-tip';
  document.body.appendChild(el);
  return el;
}

function place(target) {
  const r = target.getBoundingClientRect();
  const w = el.offsetWidth, h = el.offsetHeight;
  // Below by preference, above when there is no room. Kept on screen horizontally, which matters at
  // the left margin where the tutorial's buttons live.
  let x = Math.round(r.left + r.width / 2 - w / 2);
  let y = Math.round(r.bottom + GAP);
  if (y + h > window.innerHeight - 4) y = Math.round(r.top - h - GAP);
  x = Math.max(4, Math.min(window.innerWidth - w - 4, x));
  el.style.left = x + 'px';
  el.style.top = y + 'px';
}

function hide() {
  clearTimeout(timer); timer = 0; current = null;
  if (el) el.classList.remove('show');
}

// Give an element a tooltip. Removes any `title` so the OS one cannot double up.
export function tip(target, text) {
  if (!target || !text) return target;
  target.removeAttribute('title');
  target.addEventListener('pointerenter', () => {
    clearTimeout(timer);
    current = target;
    timer = setTimeout(() => {
      if (current !== target || !target.isConnected) return;
      ensure();
      el.textContent = text;
      el.classList.add('show');
      place(target);
    }, DELAY_MS);
  });
  for (const ev of ['pointerleave', 'pointerdown', 'blur']) target.addEventListener(ev, hide);
  return target;
}

export { hide as hideTip };
