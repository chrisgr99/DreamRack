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
// IT COMES UP WHEN YOU TURN, and stands centred just above the control rather than on the pointer. It
// used to need a click, on the idea that you could tweak in peace and watch the gauge — but the number
// is the thing you are usually after, and asking for it every time is a gesture spent on nothing. A
// click still PINS it, which is how you read a setting you have no intention of changing; clicking
// again, or leaving the control, sends it home.
//
// THE VALUE ALONE, with no parameter name. The chip stands on the control it belongs to, so the name
// was answering a question the position already answers.
//
// The earlier hover version is gone for good. Every version that did — after a
// second, after a settling pause, after a longer pause — put numbers over the panel while the pointer
// was on its way somewhere else, and the jack in the middle of a knАck made it worse: crossing one to
// drop a cable in flashed a number up and took it away again. Turning a control is unambiguous, so
// that is the only thing that shows it. It also means the jack needs no special case: point at it and
// nothing happens, scroll on it and you get whatever that scroll moved.
//
// NOT A CURSOR IMAGE. A custom cursor is a static picture, so tracking a value means building and
// decoding a new image on every wheel tick. This is an ordinary element, positioned at the pointer,
// which costs nothing to update and can be styled like the rest of the app.
//
// ONE CHIP FOR THE WHOLE APP. Only one knob is ever being turned, so there is one element, moved and
// refilled, rather than one per control.

'use strict';

const SVG_NS = 'http://www.w3.org/2000/svg';

export const READOUT_ENABLED = true;   // the whole feature, for when the numbers get in the way

const LINGER_MS = 750;         // how long it stays where nothing is holding it up (a fader drag)
// It goes home a second after you STOP TURNING, whether or not the pointer is still on the control.
// Following the pointer does not count — the number is about the turning, so the turning is what
// keeps it up.
const IDLE_MS = 500;
// IT DOES NOT FADE. It emerges as a dot at the top centre of the band the number is about, then
// grows and flies to its home with its bottom edge on the pointer; going away runs the same thing
// backwards. Where it comes FROM is the indication of what it is reading — the value band on a knob,
// the attenuverter's own ring on a knАck, the handle on a fader.
// SLOW ON PURPOSE. Two seconds each way: long enough to watch where the number came out of and
// where it went back into, which is the whole point of animating it rather than fading it.
const GROW_MS = 2000;
const SHRINK_MS = 1000;
const SEED = 0.06;             // how small it starts and ends: a dot at the origin
// Its BOTTOM CENTRE sits on the pointer: the number stands directly above where you are pointing,
// so it never falls under the hand holding the mouse.
const READOUT_GREEN = '#5cf07a';
// The control's own name, over the number, at half the size. It answers the question the number on
// its own cannot when two knobs sit side by side: which of them is this.
const NAME_SIZE = '0.75em';
const NAME_OPACITY = '0.85';
// The rate arrow is set MUCH larger than the text beside it. At the same size as the digits it is a
// small tick nobody reads as an arrow at all; at this size it is unmistakably a measure of travel and
// stands a little taller than the number. Its line height is held down so the chip grows by less than
// the arrow does.
// A DRAWN ARROW, NOT A LETTER. As a font character its stroke scales with its size, so at nearly
// three times the text it came with three times the weight and read as a blob. Drawn, the height and
// the stroke are independent — and the line and the heads can be weighted separately if the heads
// still read heavy.
const RATE_ARROW = '↕';          // the marker in the text; replaced by the drawing
const ARROW_H = 20;              // pixels tall, matching what the glyph gave
const ARROW_STROKE = 2;          // in the drawing's own units — about half the glyph's stroke
const ARROW_HEAD_STROKE = 2;
const ARROW_VB_W = 10, ARROW_VB_H = 26;

function arrowSvg(doc) {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${ARROW_VB_W} ${ARROW_VB_H}`);
  svg.setAttribute('height', String(ARROW_H));
  svg.setAttribute('width', String(Math.round(ARROW_H * ARROW_VB_W / ARROW_VB_H)));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.style.verticalAlign = 'middle';
  const shaft = doc.createElementNS(SVG_NS, 'line');
  shaft.setAttribute('x1', 5); shaft.setAttribute('y1', 3);
  shaft.setAttribute('x2', 5); shaft.setAttribute('y2', 23);
  shaft.setAttribute('stroke-width', ARROW_STROKE);
  svg.appendChild(shaft);
  for (const d of ['M 2 7 L 5 3 L 8 7', 'M 2 19 L 5 23 L 8 19']) {
    const head = doc.createElementNS(SVG_NS, 'path');
    head.setAttribute('d', d);
    head.setAttribute('stroke-width', ARROW_HEAD_STROKE);
    svg.appendChild(head);
  }
  return svg;
}

let chip = null;
let hideTimer = 0, showTimer = 0;
// STICKY: once the number is up for a knob it stays up, following the pointer, until the pointer
// leaves the control. It is a readout, not a notification — it should not vanish while you are still
// looking at the thing it describes.
let sticky = false;
let visible = false;
let anchor = null;      // where the pointer is: the point the chip is pinned to
let region = null;
// PINNED: put up by a click, and staying until another click or until the pointer leaves. Nothing
// times it out, and turning the control updates it in place rather than putting up a new one.
let pinned = false, pinToken = null;

export function readoutPinned(token, reg) {
  if (!pinned) return false;
  if (token !== undefined && token !== pinToken) return false;
  return reg === undefined || reg === region;
}      // which part of a control the number is about: its value, or its depth
let originFn = null;    // ASKED AGAIN at hide time, so the number goes back into where the value is
                        // NOW rather than where it was when the chip appeared

export function readoutLive() { return sticky; }
// Which part of a control the number on screen is about — so a pointer wandering onto the other part
// can send it home.
export function readoutRegion() { return region; }

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
  });
  document.body.appendChild(chip);
  return chip;
}

// The chip's content: plain text, except that the rate arrow is given its own span so it can be set
// large. Assembled from text nodes rather than markup — nothing here is ever parsed as HTML.
function setText(c, text, name) {
  c.textContent = '';
  if (name) {
    const n = c.ownerDocument.createElement('div');
    n.textContent = name;
    n.style.cssText = `font-size:${NAME_SIZE};opacity:${NAME_OPACITY};text-align:center;letter-spacing:0.04em;`;
    c.append(n);
  }
  const line = c.ownerDocument.createElement('div');
  line.style.cssText = 'text-align:center;';
  const i = text.indexOf(RATE_ARROW);
  if (i < 0) line.textContent = text;
  else {
    if (i > 0) line.append(text.slice(0, i));
    line.append(arrowSvg(c.ownerDocument));
    const rest = text.slice(i + RATE_ARROW.length);
    if (rest) line.append(rest);
  }
  c.append(line);
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
  // CENTRED ON THE CONTROL. anchorLeft dodges the pointer — bottom-left corner on it near the left
  // edge, bottom-right near the right — which is what you want from a chip standing on your hand and
  // wrong for one standing on a knob, where centred is the only position that reads as belonging.
  let left = x - w / 2;
  // Backstop: a chip wider than the room it has left still stays on screen.
  if (W > 0) { if (left < EDGE_MARGIN) left = EDGE_MARGIN; else if (left + w > W - EDGE_MARGIN) left = W - EDGE_MARGIN - w; }
  let top = y - h;
  const below = top < EDGE_MARGIN;
  if (below) top = y;   // no room above — drop it below the pointer instead
  c.style.left = `${Math.round(left)}px`;
  c.style.top = `${Math.round(top)}px`;
  // The corner the pointer is touching. It is what the growth scales about, so the chip always comes
  // out of the pointer rather than out of a corner that is nowhere near it.
  const hx = Math.abs(left - x) < 1 ? 'left' : Math.abs(left + w - x) < 1 ? 'right' : 'center';
  c.style.transformOrigin = `${hx} ${below ? 'top' : 'bottom'}`;
  anchor = { x, y };
}

// The pointer is never hidden. Kept as a no-op pair rather than threaded out of every call site,
// and as the place to look if hiding it is ever wanted again.
function hideCursorOn() {}
function showCursor() {}

// CROSSING FROM ONE PART OF A CONTROL TO THE OTHER — a knАck's attenuverter to its value, or back —
// the old number does not simply change. It leaves, into the setting it was describing, while the new
// one arrives out of the setting IT describes, both at once. That needs two chips on screen for a
// moment, so the outgoing one is cloned and left to fly home on its own while the real chip re-grows.
function retire(originOfOld) {
  if (!chip || !visible) return;
  const ghost = chip.cloneNode(true);
  ghost.style.transition = 'none';
  ghost.style.transform = 'none';
  document.body.appendChild(ghost);
  void ghost.getBoundingClientRect();
  const o = typeof originOfOld === 'function' ? originOfOld() : originOfOld;
  const a = anchor;
  ghost.style.transition = `transform ${SHRINK_MS}ms ease-in`;
  ghost.style.transform = (o && a)
    ? `translate(${Math.round(o.x - a.x)}px, ${Math.round(o.y - a.y)}px) scale(${SEED})`
    : `scale(${SEED})`;
  setTimeout(() => ghost.remove(), SHRINK_MS + 60);
  visible = false;   // the real chip now grows afresh, out of the part just moved to
}

// The reverse of the growth: back to a dot at the point it came from. Nothing to run if it was never
// up — which is the common case, since crossing a row of knobs never gets past the delay.
export function hideReadout() {
  clearTimeout(showTimer); showTimer = 0;
  clearTimeout(hideTimer); hideTimer = 0;
  sticky = false;
  region = null;
  pinned = false; pinToken = null;
  showCursor();
  if (!chip) return;
  if (!visible) { chip.style.opacity = '0'; return; }
  // ALWAYS ON A COPY. The outgoing number flies home by itself, which frees the real chip to appear
  // somewhere else immediately — so moving from one control to the next shows the old one going back
  // into its setting at the same time as the new one comes out of its own.
  retire(originFn);
  chip.style.transition = 'none';
  chip.style.transform = 'none';
  chip.style.opacity = '0';
}

// Show it NOW, at the pointer, and keep it up for a moment after the last call. `hideCursor` is true
// while scrolling — then the chip really is standing in for the pointer — and false when it appeared
// on its own from hovering, where taking the cursor away would just lose it.
// The anchor argument is either a point — { x, y }, the place the chip's bottom centre should sit — or an x with a
// separate y, which is what the older pointer-following callers pass.
export function showReadout(text, at, y, hideCursor, opts = {}) {
  if (!READOUT_ENABLED || text == null) return;
  if (!at) return;
  const x = typeof at === 'object' ? at.x : at;
  if (typeof at === 'object') y = at.y;
  const c = ensureChip();
  clearTimeout(showTimer); showTimer = 0;
  // Moved to another part of the same control: send the old number home before drawing the new one.
  if (visible && opts.region && region && opts.region !== region) retire(originFn);
  region = opts.region || region;
  setText(c, text, opts.name);
  place(x, y);
  c.style.opacity = '0.88';
  hideCursorOn(!!hideCursor);
  clearTimeout(hideTimer); hideTimer = 0;
  if (!visible) {
    // The way in. Start as a dot at the origin, settle a frame there, then let it fly. Reading a
    // layout value is what makes that frame happen — an animation frame would do it too, except that
    // a window which is not visible never gives one.
    visible = true;
    originFn = opts.origin || { x, y };
    const o = typeof originFn === 'function' ? originFn() : originFn;
    c.style.transition = 'none';
    c.style.transform = o
      ? `translate(${Math.round(o.x - x)}px, ${Math.round(o.y - y)}px) scale(${SEED})`
      : `scale(${SEED})`;
    void c.getBoundingClientRect();
    c.style.transition = `transform ${GROW_MS}ms cubic-bezier(.2,.85,.3,1)`;
    c.style.transform = 'none';
  } else if (opts.origin) {
    originFn = opts.origin;   // it moved between regions; it will go back into the current one
  }
  if (opts.sticky) sticky = true;
  if (opts.pin) { pinned = true; pinToken = opts.token; }
  // A pinned number has no clock on it. Everything else goes when it goes quiet.
  // NO TIMER WHEN THE CONTROL HOLDS IT. A chip raised by turning a knob stays up until the pointer
  // leaves that knob — the control's own pointerleave sends it home — so a countdown alongside would
  // take it away while you were still looking at the thing it describes. The jack in a knАck's middle
  // is inside the same group, so crossing it does not count as leaving.
  //
  // Everything else keeps the timer: a chip nothing is standing over has to retire itself.
  if (!pinned && !opts.hold) hideTimer = setTimeout(hideReadout, opts.sticky ? IDLE_MS : (opts.lingerMs || LINGER_MS));
}


// Update a PINNED number in place — new value, same pin, same origin. Turning a knob you have pinned
// keeps one chip that counts along with you; turning one you have not pinned shows nothing at all.

// ---- formatting ---------------------------------------------------------
// What a number MEANS is in the descriptor — its unit, its curve, whether it crosses zero — so the
// readout is derived from the same declaration the control is, rather than from a second table that
// would drift the first time a parameter changed.
const sig = (v, n) => {
  if (!isFinite(v) || v === 0) return '0';
  const d = Math.max(0, n - 1 - Math.floor(Math.log10(Math.abs(v))));
  return v.toFixed(Math.min(6, d));
};

// `values` is the module's whole value map, for the parameters whose NUMBER depends on another
// control. The complex oscillator's modulation frequency is the case: its range switch divides it by
// 128, so the same knob reads 220 Hz in high range and 1.72 Hz in low. A module declares that with a
// `readout(value, values)` on the parameter — the knowledge belongs to the module, not here.
export function formatParamValue(meta, value, values) {
  if (meta == null || value == null) return null;
  let v = Number(value);
  if (!isFinite(v)) return String(value);
  // A PARAM WHOSE VALUE IS NOT A NUMBER TO THE PLAYER. A clock ratio knob holds an index — 12 — and
  // means a musical fact: ×11. Showing the index is showing the implementation. `readout` cannot help,
  // since it maps a number to another number; this maps it to whatever the control actually says.
  if (typeof meta.readoutText === 'function') {
    const t = meta.readoutText(v);
    if (t != null) return String(t);
  }
  if (typeof meta.readout === 'function') {
    const eff = Number(meta.readout(v, values));
    if (isFinite(eff)) v = eff;
  }
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

  // Whole steps: octaves, clock ratios, repeat counts. The unit comes along if the param declared one
  // — a tempo reading '120' says less than '120 BPM', and costs three characters to say it.
  if (meta.curve === 'detent') return plus(String(Math.round(v))) + (unit ? ' ' + unit : '');

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
