// library.js — the module library: pick a module by looking at it.
//
// A menu of names asks you to remember what each name is. A rack is a visual instrument and the
// modules are already drawings, so the library shows the drawings. Every thumbnail is the module's
// own panel.svg — the same file the rack loads — which means there is no second set of artwork to
// keep in step, and a panel that changes shows its change here the next time the panels are
// generated.
//
// SCALED TO A UNIFORM HEIGHT, NATURAL WIDTH. Faceplates are all one rack row tall and differ only in
// width, from 3 HP to 34 HP. Scaling them all to the same height keeps those widths true, so the grid
// tells you at a glance that the Complex Oscillator takes four times the space of the Octave shifter.
// Fixed-width cards would have shrunk the wide modules to a smear and given the narrow ones a pool of
// empty space, and would have thrown away real information in the process.
//
// AN IMAGE TAG, NOT A DRAWING. A faceplate is several hundred SVG shapes — every knob is circles, a
// pointer, tick marks and a label. Inlined, twenty-five of them is north of twenty thousand live page
// elements for the browser to lay out and hit-test, and it would be exactly as sluggish as it sounds.
// Pointed at by an <img>, the browser rasterises each file once and keeps the picture: twenty-five
// elements, and the cost is the same whether the module is a noise source or a 34 HP oscillator.
//
// The window is built ONCE and hidden, not rebuilt on every open, and searching hides thumbnails
// rather than reconstructing the grid — same reasoning.
'use strict';

const CATEGORIES = [
  ['source', 'Sound sources'],
  ['processor', 'Processors'],
  ['modulation', 'Modulation'],
  ['sequencing', 'Sequencing'],
  ['utility', 'Utility'],
  ['video', 'Video'],
];
const FALLBACK = 'utility';        // a module with no category still appears, rather than vanishing

const PREF_KEY = 'wcoast.library';

// SIZED SO THE LINES SURVIVE. A stroke thinner than one device pixel cannot be drawn as a pixel: the
// browser spreads it over two and dims both, so the whole panel goes faint. The rack draws modules at
// about 3.37 px/mm, and the thumbnails were at 1.32 — where a 0.355mm section rule lands at 0.47px and
// is rendered at half strength. That is the faintness, and it is arithmetic rather than eyesight.
//
// A thumbnail is 128.5mm tall (the full 3U row), so these heights are:
//
//     230px = 1.79 px/mm    compact
//     300px = 2.33 px/mm
//     365px = 2.84 px/mm    every structural stroke at or above one pixel — the default
//     433px = 3.37 px/mm    exactly the size a module draws in the rack
//
// The very finest hairlines — a lamp outline at 0.2366mm — stay under a pixel even at rack size, so
// they are not what to size for. The lines that define a panel are its frame, its section rules, its
// jack rings and its knob pointers, and at 365px all of those are whole pixels.
// The crop, as fractions of the 3U row the panel files are drawn in. Mirrors panel-loader.js:
// the rack shows FACE_TOP - TITLE_STRIP (3.0994mm) down through FACE_H + TITLE_STRIP (117.5912mm).
const TOP_FRAC = 3.0994 / 128.5;
const FACE_FRAC = 117.5912 / 128.5;

const SIZES = [230, 300, 365, 433];
const DEFAULT_SIZE = 2;            // index into SIZES

const CSS = `
  .lib-win { position: fixed; z-index: 3300; display: none; flex-direction: column;
    background: var(--panel, #1c1c20); color: var(--ink, #e8e8ea);
    /* A light edge, as the app's other floating windows have: against a black rack background a dark
       border leaves the window with no outline at all and it reads as a hole rather than a panel. */
    /* NO SHADOW. A shadow's job on a floating window is to separate it from what is behind it, and
       the white border already does that — which is why it is there. A blurred shadow across a
       1220x840 window is a large soft area the browser re-blends whenever anything inside repaints,
       including a hover outline, so it was paying a real cost for nothing. */
    border: 1px solid #cfcfcf; border-radius: 8px;
    font: 13px/1.35 -apple-system, system-ui, sans-serif; overflow: hidden; }
  /* ONE layer for the whole window, only while it is shown. The rack underneath is a very large tree
     of inline SVG; without this, repainting anything in the library — a hover outline, a scroll — can
     drag the region beneath it into the work. One promoted layer isolates the window from all of it.
     One, note: fourteen promoted cards were tried and made hovering slower, which is the usual result
     of scattering layer hints around instead of placing a single deliberate one. */
  .lib-win.open { display: flex; will-change: transform; }
  /* One divider colour for the whole window — under the title bar, beside the category column, and
     under each section heading — so every division reads as the same kind of line. */
  .lib-bar { display: flex; align-items: center; gap: 10px; padding: 7px 8px 7px 12px;
    background: #26262b; border-bottom: 1px solid #6a6a72; cursor: move; user-select: none; }
  .lib-title { font-weight: 600; letter-spacing: .2px; }
  .lib-spacer { flex: 1; }
  .lib-x { width: 24px; height: 24px; border-radius: 5px; border: 1px solid #55555c;
    background: #000; color: #d8d8dc; font-size: 15px; line-height: 1; cursor: pointer; }
  .lib-x:hover { background: #3a3a41; }
  .lib-body { display: flex; min-height: 0; flex: 1; }
  .lib-side { width: 152px; flex: none; padding: 10px 12px 10px 12px; border-right: 1px solid #6a6a72;
    overflow: auto; }
  .lib-side h4 { margin: 0 0 7px; font-size: 11px; letter-spacing: .8px; text-transform: uppercase;
    color: #9a9aa2; font-weight: 600; }
  .lib-cat { display: flex; align-items: center; gap: 7px; padding: 3px 0; cursor: pointer; }
  .lib-cat input { width: 15px; height: 15px; accent-color: var(--accent, #e0a353); cursor: pointer; }
  .lib-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .lib-tools { display: flex; align-items: center; gap: 10px; padding: 10px 12px 6px; }
  .lib-search { flex: 1; min-width: 0; padding: 6px 9px; border-radius: 6px; border: 1px solid #55555c;
    background: #111; color: inherit; font: inherit; }
  .lib-size { display: flex; gap: 4px; }
  .lib-size button { width: 26px; height: 24px; border-radius: 5px; border: 1px solid #55555c;
    background: #000; color: #d8d8dc; cursor: pointer; font-size: 12px; }
  .lib-size button.on { border-color: var(--accent, #e0a353); color: var(--accent, #e0a353); }
  .lib-size button.wide { width: auto; padding: 0 7px; }
  /* SCROLLING. Nothing here runs JavaScript on a wheel event and nothing blocks it, so what is left
     is compositing, and these lines are what keep it off the main thread.
     overscroll-behavior stops the scroll chaining out to the rack behind: with nested scrollers the
     browser has to resolve which one wins before it can move anything, and that resolution is felt
     as a stall at the start of every gesture.
     will-change and paint containment were tried here and taken out again: measured, script costs
     0.03ms per pointer move and hit-testing 0.004ms, so nothing was waiting on JavaScript — and both
     of those force extra compositing layers, which makes a hover repaint slower rather than faster.
     Simpler turned out to be quicker. */
  .lib-grid { flex: 1; overflow: auto; padding: 4px 12px 14px; overscroll-behavior: contain; }
  .lib-group { margin-top: 12px; }
  /* The heading and the rule beneath it read as one thing — the header OF the section below, rather
     than a caption floating between two groups. */
  .lib-group h3 { margin: 0 0 5px; padding-bottom: 4px; border-bottom: 1px solid #6a6a72;
    font-size: 11px; letter-spacing: .8px; text-transform: uppercase; color: #9a9aa2; font-weight: 600; }
  /* THUMBNAILS TOUCH, side by side, the way modules do in the rack. Each panel draws its own frame
     border, so they still read as separate modules without any gap between them — and the space saved
     is horizontal space, which is what the grid is short of. Rows keep a gap so a name never sits
     against the panel below it. */
  .lib-items { display: flex; flex-wrap: wrap; gap: 14px 0; align-items: flex-end; }
  .lib-card { display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer;
    border: 0; padding: 0 0 1px; background: none; color: inherit; font: inherit; }
  /* An OUTLINE, not a border: a border would take layout space and push the neighbours apart, which is
     exactly what we just removed. */
  .lib-card:hover { outline: 2px solid var(--accent, #e0a353); outline-offset: -2px; }
  /* A CANVAS, NOT AN IMAGE. The panels are SVG, and an SVG image is re-drawn by the browser for each
     region that scrolls into view — the Complex Oscillator is some eight hundred shapes, so that is
     real work repeated on every scroll, and it is what the hesitation was. Drawn once into a canvas
     the thumbnail becomes a flat bitmap: scrolling it is pure compositing and costs nothing. The
     raster happens once per size or theme change, not per frame.
     The canvas also does the CROP. The panel files are a full 3U row, 128.5mm, with the faceplate
     inset inside mounting margins left over from when those were the rail attachment. The rack never
     shows them and crops to the face plus its title strip; the image is drawn into the canvas at an
     offset so the same thing happens here, instead of leaving dark bands above and below. */
  .lib-card canvas { display: block; }
  /* DIAGNOSTIC. A stand-in of exactly the same size as the thumbnail, with no picture in it at all —
     no canvas, no texture, nothing for the compositor to hold. Toggled by the "plain" button beside
     the sizes. If hovering and scrolling go crisp with this on, the pictures are what costs; if they
     are still late, the pictures are innocent and the cost is the window itself over the rack. */
  .lib-plain { display: none; background: #55555c; border-radius: 2px; }
  .lib-win.plain .lib-card canvas { display: none; }
  .lib-win.plain .lib-plain { display: block; }
  .lib-card span { font-size: 11.5px; color: #c9c9d0; text-align: center; padding: 0 4px; }
  .lib-card.taken { opacity: .35; cursor: default; }
  .lib-card.taken:hover { border-color: transparent; background: none; }
  .lib-empty { padding: 24px 4px; color: #8a8a92; }
`;

export function createLibrary(opts = {}) {
  const types = opts.types || [];               // [{ descriptorId, name, hp, panelUrl, descriptor }]
  const onChoose = opts.onChoose || (() => {});
  const isTaken = opts.isTaken || (() => false);
  const isDark = opts.isDark || (() => true);

  let win = null, grid = null, search = null, cards = [];
  const RETURN_MS = 2000;   // long enough to see what you placed, short enough not to feel stuck
  let backTimer = null;
  let pref = { size: DEFAULT_SIZE, off: [], x: null, y: null, w: null, h: null, plain: false };
  try { Object.assign(pref, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch (_e) { /* no storage */ }
  const savePref = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(pref)); } catch (_e) { /* no storage */ } };

  const catOf = (t) => {
    const c = (t.descriptor && t.descriptor.category) || FALLBACK;
    return CATEGORIES.some(([id]) => id === c) ? c : FALLBACK;
  };

  function build() {
    if (win) return win;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    win = document.createElement('div');
    win.className = 'lib-win';
    win.innerHTML = `
      <div class="lib-bar"><span class="lib-title">Library</span><span class="lib-spacer"></span>
        <button class="lib-x" type="button" aria-label="Close">✕</button></div>
      <div class="lib-body">
        <div class="lib-side"><h4>Categories</h4></div>
        <div class="lib-main">
          <div class="lib-tools">
            <input class="lib-search" type="search" placeholder="Search modules" aria-label="Search modules">
            <span class="lib-size"></span>
          </div>
          <div class="lib-grid"></div>
        </div>
      </div>`;
    document.body.appendChild(win);

    grid = win.querySelector('.lib-grid');
    search = win.querySelector('.lib-search');
    win.querySelector('.lib-x').addEventListener('click', hide);
    search.addEventListener('input', apply);

    // category checkboxes
    const side = win.querySelector('.lib-side');
    for (const [id, name] of CATEGORIES) {
      const lab = document.createElement('label');
      lab.className = 'lib-cat';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !pref.off.includes(id);
      cb.addEventListener('change', () => {
        pref.off = CATEGORIES.filter(([c]) => !side.querySelector(`input[data-cat="${c}"]`).checked).map(([c]) => c);
        savePref(); apply();
      });
      cb.dataset.cat = id;
      lab.append(cb, document.createTextNode(name));
      side.appendChild(lab);
    }

    // thumbnail size
    const sizeBox = win.querySelector('.lib-size');
    SIZES.forEach((_px, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = 'S M L X'.split(' ')[i];
      b.title = 'Thumbnail size';
      b.addEventListener('click', () => { pref.size = i; savePref(); applySize(); });
      sizeBox.appendChild(b);
    });
    const plainBtn = document.createElement('button');
    plainBtn.type = 'button';
    plainBtn.className = 'wide';
    plainBtn.textContent = 'plain';
    plainBtn.title = 'Draw the thumbnails as plain rectangles — a test for what is costing time';
    plainBtn.addEventListener('click', () => {
      pref.plain = !pref.plain; savePref();
      win.classList.toggle('plain', !!pref.plain);
      plainBtn.classList.toggle('on', !!pref.plain);
      applySize();
    });
    sizeBox.appendChild(plainBtn);

    // one group per category, in a fixed order, so the grid never reflows into a different shape
    for (const [id, name] of CATEGORIES) {
      const g = document.createElement('div');
      g.className = 'lib-group';
      g.dataset.cat = id;
      g.innerHTML = `<h3>${name}</h3><div class="lib-items"></div>`;
      grid.appendChild(g);
    }
    const empty = document.createElement('div');
    empty.className = 'lib-empty';
    empty.textContent = 'Nothing matches.';
    empty.style.display = 'none';
    grid.appendChild(empty);

    for (const t of types) {
      if (t.hidden) continue;
      const g = grid.querySelector(`.lib-group[data-cat="${catOf(t)}"] .lib-items`);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'lib-card';
      const img = new Image();          // the SOURCE, never in the document
      // A thumbnail is the panel file itself, so it is always current and costs one element.
      //
      // NOT LAZY-LOADED, deliberately. Lazy loading is the right default for a page of photographs and
      // the wrong one here: fifteen small SVGs weigh nothing, and deferring them means each is fetched
      // AND rasterised at the moment it scrolls into view — a stall the instant you start scrolling,
      // every time. They are all fetched and decoded when the window is built instead, so scrolling
      // afterwards touches nothing but pictures that are already made.
      img.alt = '';
      img.dataset.light = t.panelUrl;
      img.dataset.dark = t.panelUrl.replace(/panel\.svg$/, 'panel.dark.svg');
      const canvas = document.createElement('canvas');
      const plain = document.createElement('span');
      plain.className = 'lib-plain';
      const span = document.createElement('span');
      span.textContent = t.name;
      card.append(canvas, plain, span);
      // Choosing a module puts it in your HAND, not on the rack — so the library gets out of the way
      // and comes back when you have placed it. It floats over the rack, and the place you want to
      // drop is as likely as not underneath it.
      card.addEventListener('click', () => {
        if (card.classList.contains('taken')) return;
        hide();
        // THE LIBRARY WAITS BEFORE COMING BACK. A module that lands and is instantly covered by the
        // window you chose it from is a placement you never got to see. Only after a real drop,
        // though: cancelling placed nothing, so there is nothing to look at and it returns at once.
        // Any later show/hide cancels the pending return, so it can never ambush you.
        onChoose(t.descriptorId, (placed) => {
          clearTimeout(backTimer);
          if (!placed) { show(); return; }
          backTimer = setTimeout(() => { backTimer = null; show(); }, RETURN_MS);
        });
      });
      g.appendChild(card);
      cards.push({ card, img, canvas, plain, t, search: (t.name + ' ' + (t.descriptor && t.descriptor.abbreviation || '')).toLowerCase() });
    }

    dragBy(win.querySelector('.lib-bar'));
    return win;
  }

  // Drag by the title bar, and remember where it was left.
  function dragBy(handle) {
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const r = win.getBoundingClientRect();
      const dx = e.clientX - r.left, dy = e.clientY - r.top;
      const move = (ev) => {
        const x = Math.max(0, Math.min(window.innerWidth - r.width, ev.clientX - dx));
        const y = Math.max(0, Math.min(window.innerHeight - r.height, ev.clientY - dy));
        win.style.left = x + 'px'; win.style.top = y + 'px';
        pref.x = x; pref.y = y;
      };
      const up = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        savePref();
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      e.preventDefault();
    });
  }

  // A TEXTURE BUDGET. Every canvas is a picture held on the GPU, and at full device resolution the
  // set came to 16.8 MB — enough that the compositor may drop them while you are not scrolling and
  // have to send them again when you start, which is felt as a stall at the beginning of every
  // gesture. So the backing store is scaled down uniformly, for all of them together, until the set
  // fits the budget. Uniformly, because thumbnails at different sharpnesses beside each other look
  // like a mistake. At 365px the panel's structural strokes are a whole CSS pixel wide, so even a
  // ratio of 1 keeps them solid — the ratio buys retina crispness, not legibility.
  const TEXTURE_BUDGET_PX = 2.1e6;          // ~8 MB at four bytes a pixel
  function textureRatio(px) {
    const dpr = window.devicePixelRatio || 1;
    let area = 0;
    for (const c of cards) {
      const iw = c.img.naturalWidth, ih = c.img.naturalHeight;
      if (iw && ih) area += Math.round(px * (iw / ih)) * Math.round(px * FACE_FRAC);
    }
    if (!area) return dpr;
    const fits = Math.sqrt(TEXTURE_BUDGET_PX / (area * dpr * dpr));
    return fits >= 1 ? dpr : Math.max(1, dpr * fits);
  }

  // Paint one thumbnail: the whole panel scaled to `px` tall, drawn into a canvas that is only the
  // face's worth of that — so the mounting margins fall outside and the panel fills the box.
  function paint(c, px, ratio) {
    const iw = c.img.naturalWidth, ih = c.img.naturalHeight;
    if (!iw || !ih) return false;
    if (pref.plain) {
      // Size the stand-in and leave the canvas empty — the point is to remove the picture entirely,
      // not to draw a cheaper one.
      const w = Math.round(px * (iw / ih)), h = Math.round(px * FACE_FRAC);
      c.plain.style.width = w + 'px';
      c.plain.style.height = h + 'px';
      c.canvas.width = 0; c.canvas.height = 0;
      return true;
    }
    const dpr = ratio || window.devicePixelRatio || 1;
    const drawW = Math.round(px * (iw / ih));            // the full panel at this height
    const boxH = Math.round(px * FACE_FRAC);             // ...cropped to the face plus title strip
    c.canvas.style.width = drawW + 'px';
    c.canvas.style.height = boxH + 'px';
    c.plain.style.width = drawW + 'px';
    c.plain.style.height = boxH + 'px';
    c.canvas.width = Math.round(drawW * dpr);
    c.canvas.height = Math.round(boxH * dpr);
    const g = c.canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, drawW, boxH);
    g.drawImage(c.img, 0, -Math.round(px * TOP_FRAC), drawW, px);
    return true;
  }

  function applySize() {
    const px = SIZES[pref.size] || SIZES[DEFAULT_SIZE];
    // ONE ratio for the whole set, computed from all of them together — see textureRatio. It can only
    // be right once every image has decoded, so anything painted before then is provisional and the
    // set is repainted when the last one arrives. Without that, the thumbnails decoded first get a
    // sharper ratio than the ones after them, and mismatched sharpness side by side reads as a fault.
    const ratio = textureRatio(px);
    let waiting = 0;
    for (const c of cards) {
      if (!paint(c, px, ratio)) {
        waiting++;
        c.img.addEventListener('load', () => { if (--waiting === 0) applySize(); }, { once: true });
      }
    }
    for (const [i, b] of [...win.querySelectorAll('.lib-size button')].entries()) b.classList.toggle('on', i === pref.size);
  }

  // Filtering HIDES rather than rebuilds: the grid is made once and never torn down.
  function apply() {
    const q = (search.value || '').trim().toLowerCase();
    let shown = 0;
    for (const c of cards) {
      const taken = !!(c.t.descriptor && c.t.descriptor.singleton && isTaken(c.t.descriptorId));
      c.card.classList.toggle('taken', taken);
      const ok = (!q || c.search.includes(q)) && !pref.off.includes(catOf(c.t));
      c.card.style.display = ok ? '' : 'none';
      if (ok) shown++;
    }
    for (const g of win.querySelectorAll('.lib-group')) {
      const any = [...g.querySelectorAll('.lib-card')].some((el) => el.style.display !== 'none');
      g.style.display = any ? '' : 'none';
    }
    win.querySelector('.lib-empty').style.display = shown ? 'none' : '';
  }

  function theme() {
    const dark = isDark();
    for (const c of cards) {
      const want = dark ? c.img.dataset.dark : c.img.dataset.light;
      if (c.img.getAttribute('src') !== want) {
        c.img.setAttribute('src', want);
        // Decode now rather than at first paint, then draw it into its canvas. Both happen once, on
        // open or on a theme change — never while scrolling.
        if (c.img.decode) c.img.decode().catch(() => { /* a missing panel is not worth a throw */ });
      }
    }
  }

  function show() {
    clearTimeout(backTimer); backTimer = null;
    build();
    theme();
    applySize();
    apply();
    win.classList.toggle('plain', !!pref.plain);
    const pb = win.querySelector('.lib-size button.wide');
    if (pb) pb.classList.toggle('on', !!pref.plain);
    win.classList.add('open');
    // Centred the first time; wherever you left it after that.
    const r = win.getBoundingClientRect();
    // Bigger thumbnails need a bigger window, or you see one and a half rows of them.
    const w = Math.min(1220, window.innerWidth - 40), h = Math.min(840, window.innerHeight - 60);
    win.style.width = w + 'px';
    win.style.height = h + 'px';
    const x = pref.x != null ? Math.min(pref.x, window.innerWidth - w) : Math.round((window.innerWidth - w) / 2);
    const y = pref.y != null ? Math.min(pref.y, window.innerHeight - h) : Math.round((window.innerHeight - h) / 2);
    win.style.left = Math.max(0, x) + 'px';
    win.style.top = Math.max(0, y) + 'px';
    search.value = '';
    search.focus();
    void r;
  }

  function hide() { clearTimeout(backTimer); backTimer = null; if (win) win.classList.remove('open'); }
  const isOpen = () => !!(win && win.classList.contains('open'));

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) { e.stopPropagation(); hide(); } }, true);
  // Clicking anywhere outside puts it away. Capture, so it happens before whatever was clicked acts.
  document.addEventListener('pointerdown', (e) => { if (isOpen() && win && !win.contains(e.target)) hide(); }, true);

  return { show, hide, isOpen, refreshTheme: theme };
}
