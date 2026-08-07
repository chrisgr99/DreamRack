// knob-readout.js — the number, at the pointer, while you turn a knob.
//
// A gauge shows you where a control sits in its travel. It cannot tell you that the frequency is
// 246 Hz, and on a knob whose printed scale is six numbers wide that is the thing you actually want.
// So a small chip follows the pointer with the value in it, standing on the pointer's tip.
//
// THE POINTER STAYS. An early version hid it, on the idea that the chip was standing in for it — but
// where exactly you are pointing on a knob decides how fast a scroll moves it, so losing the arrow
// costs you something you need. The chip sits above the tip and the arrow shows through.
//
// It also fades in after a second of just hovering, without scrolling, so you can read a patch by
// pointing at it rather than by turning things. That one is deliberately slow: appearing instantly
// on hover would put numbers over the panel every time you crossed it on your way somewhere.
//
// NOT A CURSOR IMAGE. A custom cursor is a static picture, so tracking a value means building and
// decoding a new image on every wheel tick. This is an ordinary element, positioned at the pointer,
// which costs nothing to update and can be styled like the rest of the app.
//
// ONE CHIP FOR THE WHOLE APP. Only one knob is ever being turned, so there is one element, moved and
// refilled, rather than one per control.

'use strict';

export const READOUT_ENABLED = true;   // the whole feature, for when the numbers get in the way

const HOVER_DELAY_MS = 1000;   // how long the pointer must be on a knob before it appears unasked
const LINGER_MS = 750;         // how long it stays where nothing is holding it up (a fader drag)
const FADE_MS = 140;
// Its BOTTOM CENTRE sits on the pointer: the number stands directly above where you are pointing,
// so it never falls under the hand holding the mouse.
const READOUT_GREEN = '#5cf07a';

let chip = null;
let hideTimer = 0, showTimer = 0;
// STICKY: once the number is up for a knob it stays up, following the pointer, until the pointer
// leaves the control. It is a readout, not a notification — it should not vanish while you are still
// looking at the thing it describes.
let sticky = false;

export function readoutLive() { return sticky; }

function ensureChip() {
  if (chip) return chip;
  chip = document.createElement('div');
  chip.className = 'knob-readout';
  Object.assign(chip.style, {
    // INLINE-BLOCK, or it is a block-level div that stretches to the width of the window — and
    // then centring it on the pointer puts it off the left edge of the screen.
    position: 'fixed', display: 'inline-block', zIndex: '9000', pointerEvents: 'none',
    padding: '3px 7px', borderRadius: '4px',
    // TRANSLUCENT, both the panel and the number, so the control you are adjusting stays visible
    // underneath. A solid chip on top of a knob hides the thing the number is describing.
    background: 'rgba(16,18,20,0.55)', color: READOUT_GREEN,
    border: '1px solid rgba(92,240,122,0.35)',
    font: '600 13px ui-monospace, SFMono-Regular, Menlo, monospace',
    whiteSpace: 'nowrap', opacity: '0',
    transition: `opacity ${FADE_MS}ms ease-out`,
  });
  document.body.appendChild(chip);
  return chip;
}

// WHICH CORNER SITS ON THE POINTER. Bottom centre out in the open. Near an edge of the window the
// chip swings inward instead of being squashed against it: by the right-hand edge its bottom RIGHT
// corner takes the pointer, so it hangs back into the window; by the left-hand edge its bottom LEFT
// corner does, so it hangs forward. The pointer keeps touching the chip either way, which is what
// ties the number to the control it belongs to.
//
// IT KEYS OFF THE POINTER, not off the control. The control can be anywhere; what has to stay
// visible is the chip, and where the chip lands is decided by where you are pointing. That also
// matters under magnification, where only a small part of the window is on screen at once.
//
// The zone is wide — a good deal wider than the chip. Swinging only when the chip would actually
// cross the edge means it swings within about half a chip's width of it, far too late to help you
// see both of its edges when you are zoomed in near the side of the window.
//
// Exported and pure so it can be checked against window widths other than this one's.
export const EDGE_MARGIN = 4;
export const EDGE_ZONE = 160;   // how near the pointer must be to an edge for the chip to swing in
export function anchorLeft(x, w, W) {
  if (!(W > 0)) return x - w / 2;                          // a window with no size: nothing to be near
  const zone = Math.min(EDGE_ZONE, W / 4);                 // ...and nothing to be near in a narrow one
  if (x < zone || x - w / 2 < EDGE_MARGIN) return x;       // left: bottom left corner on the pointer
  if (x > W - zone || x + w / 2 > W - EDGE_MARGIN) return x - w;   // right: bottom right corner
  return x - w / 2;                                        // out in the open: bottom centre
}

function place(x, y) {
  const c = ensureChip();
  const w = c.offsetWidth || 48, h = c.offsetHeight || 20;
  const W = window.innerWidth || 0, H = window.innerHeight || 0;
  let left = anchorLeft(x, w, W);
  // Backstop: a chip wider than the room it has left still stays on screen.
  if (W > 0) { if (left < EDGE_MARGIN) left = EDGE_MARGIN; else if (left + w > W - EDGE_MARGIN) left = W - EDGE_MARGIN - w; }
  let top = y - h;
  if (top < EDGE_MARGIN) top = y;   // no room above — drop it below the pointer instead
  c.style.left = `${Math.round(left)}px`;
  c.style.top = `${Math.round(top)}px`;
}

// The pointer is never hidden. Kept as a no-op pair rather than threaded out of every call site,
// and as the place to look if hiding it is ever wanted again.
function hideCursorOn() {}
function showCursor() {}

export function hideReadout() {
  clearTimeout(showTimer); showTimer = 0;
  clearTimeout(hideTimer); hideTimer = 0;
  sticky = false;
  showCursor();
  if (chip) chip.style.opacity = '0';
}

// Show it NOW, at the pointer, and keep it up for a moment after the last call. `hideCursor` is true
// while scrolling — then the chip really is standing in for the pointer — and false when it appeared
// on its own from hovering, where taking the cursor away would just lose it.
export function showReadout(text, x, y, hideCursor, opts = {}) {
  if (!READOUT_ENABLED || text == null) return;
  const c = ensureChip();
  clearTimeout(showTimer); showTimer = 0;
  c.textContent = text;
  place(x, y);
  c.style.opacity = '0.88';
  hideCursorOn(!!hideCursor);
  clearTimeout(hideTimer); hideTimer = 0;
  if (opts.sticky) sticky = true;
  // Only a show that nothing is holding up gets a timer — a fader being dragged, where there is no
  // hover watching for the pointer to leave.
  else if (!sticky) hideTimer = setTimeout(hideReadout, opts.lingerMs || LINGER_MS);
}

// Arm the unasked one: a second after the pointer arrives on a knob, the number appears and then
// follows it for as long as it stays. `get()` is asked at FIRING time, not now, so it reports where
// the pointer actually is and what it is over by then — a second is long enough to have moved.
export function armReadout(get) {
  if (!READOUT_ENABLED) return;
  clearTimeout(showTimer);
  showTimer = setTimeout(() => {
    const r = get();
    if (r && r.text != null) showReadout(r.text, r.x, r.y, false, { sticky: true });
  }, HOVER_DELAY_MS);
}

export function cancelArmed() {
  clearTimeout(showTimer); showTimer = 0;
}

// ---- formatting ---------------------------------------------------------
// What a number MEANS is in the descriptor — its unit, its curve, whether it crosses zero — so the
// readout is derived from the same declaration the control is, rather than from a second table that
// would drift the first time a parameter changed.
const sig = (v, n) => {
  if (!isFinite(v) || v === 0) return '0';
  const d = Math.max(0, n - 1 - Math.floor(Math.log10(Math.abs(v))));
  return v.toFixed(Math.min(6, d));
};

export function formatParamValue(meta, value) {
  if (meta == null || value == null) return null;
  const v = Number(value);
  if (!isFinite(v)) return String(value);
  const unit = (meta.unit || '').trim();
  const signed = typeof meta.min === 'number' && meta.min < 0;
  const plus = (s) => (v > 0 && signed ? '+' + s : s);

  // A LEVEL DECLARED 0..1 BUT CURVED IN DECIBELS reads in decibels. "0.29" on a mixer fader is the
  // position of the control, not a level anybody works in; -11 dB is the number you would say out
  // loud. Silence is -∞ rather than a very large negative number.
  if (meta.curve === 'gainDb') {
    if (v <= 0) return '−∞ dB';
    const db = 20 * Math.log10(v);
    return `${db > 0.05 ? '+' : ''}${db.toFixed(1)} dB`;   // unity is 0.0 dB, not +0.0
  }

  // Whole steps: octaves, clock ratios, repeat counts.
  if (meta.curve === 'detent') return plus(String(Math.round(v)));

  if (unit === 'Hz') {
    return v >= 1000 ? `${sig(v / 1000, 3)} kHz` : `${sig(v, 3)} Hz`;
  }
  if (unit === 's' || unit === 'sec' || unit === 'seconds') {
    return v < 1 ? `${sig(v * 1000, v * 1000 < 10 ? 2 : 3)} ms` : `${sig(v, 3)} s`;
  }
  if (unit === 'st' || unit === 'semitones') return plus(`${v.toFixed(2)} st`);

  // Everything else is a plain proportion — two decimals, signed if it crosses zero.
  return plus(v.toFixed(2)) + (unit ? ` ${unit}` : '');
}
