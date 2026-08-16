// factory.js — Strudel's realized instance: the pattern engine, the adapter, and the queue.
//
// STRUDEL IS LOADED ONCE FOR THE WHOLE APP and shared by every instance of this module. It installs
// globals (window.initStrudel, a repl, a scheduler) and there is one audio context, so a second copy
// would be a second scheduler fighting the first. One module drives it; a second module placed on the
// rack takes over when it plays.
//
// The vendored bundle has ZERO imports (design/strudel-module.md §4), so this is an ordinary dynamic
// import of a file in the repo — no bundler, no import map, and it works offline.

'use strict';

import { toNote } from './adapter.js';

const PROCESSOR = 'wcoast-strudel';
const VENDOR = '../../vendor/strudel-dreamrack.mjs';

let strudelPromise = null;      // the module namespace, once
function loadStrudel() {
  if (!strudelPromise) strudelPromise = import(VENDOR);
  return strudelPromise;
}

export function create(ctx, _services) {
  const node = new AudioWorkletNode(ctx, PROCESSOR, {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1],
  });

  let S = null;                 // the Strudel namespace
  let started = false;          // initStrudel called
  let seq = 0;                  // handle counter
  const prefix = 'st' + Math.floor(Math.random() * 1e4);
  let lastError = null;
  let onFlash = null;           // the rack lights the cable when a note goes out

  node.port.onmessage = (e) => { if (e.data && e.data.note && onFlash) onFlash(); };

  // A context TIME becomes a sample FRAME. currentTime and the frame counter share an origin, so the
  // conversion is the elapsed seconds times the rate — and this is the one place the live clock is
  // needed, which is why the adapter takes it as a function.
  const sampleAt = (t) => Math.round(t * ctx.sampleRate);

  // THE OUTPUT. Strudel calls this for every event of every pattern; we turn it into a note and hand
  // it to the worklet, which holds it until its sample arrives.
  const output = (hap, _deadline, duration, cps, t) => {
    if (!S) return;
    const n = toNote(hap, cps, t, {
      noteToMidi: S.noteToMidi,
      sampleAt,
      handle: prefix + ':' + (seq++),
    });
    if (!n) return;             // no note in this event — a sample trigger, not ours
    node.port.postMessage({ events: [
      { at: n.at, handle: n.handle, pitch: n.pitch, level: n.level, duration: n.duration, pan: n.pan },
      { at: n.offAt, handle: n.handle, off: true },
    ] });
  };

  let replInstance = null;

  async function ensure() {
    if (started) return S;
    S = await loadStrudel();
    // THE SCOPE FIRST. `note`, `s` and the rest have to exist as globals before any pattern can be
    // evaluated — by us or by the editor — and evalScope is what puts them there. An editor built
    // without it mounts perfectly and then evaluates nothing, with no error to show for it.
    await S.evalScope(S.core, S.mini);
    // Our own repl, for playing without the editor open. Its output is ours and its clock is the
    // rack's, so an event's deadline is already in the right domain.
    replInstance = S.repl({ defaultOutput: output, getTime: () => ctx.currentTime, transpiler: S.transpiler });
    started = true;
    return S;
  }

  // ---- the editor ------------------------------------------------------------------------------
  // A floating pane, like the scopes and the video output: the faceplate is the transport, the window
  // is where the pattern lives. The editor is Strudel's own CodeMirror — syntax highlighting, and the
  // play-position highlighting that is most of how you read a pattern while it runs.
  let pane = null, mirror = null;

  // OPTION+TAB MOVES BETWEEN THE PATTERN AND THE RACK, both ways, from either side. Live coding is two
  // places at once — you type a phrase, then you want a knob — and reaching for the mouse to cross
  // between them breaks the loop that makes it fun.
  //
  // Option+Tab because everything else is taken: Command+Tab is the system's, Control+Tab belongs to
  // tabbed apps, Tab and Shift+Tab are the editor's own indentation and reverse-tab, and Strudel binds
  // a row of other Option combinations but not this one. Capture phase, so it wins over CodeMirror.
  // The bar says when the editor has the keys — grey when the pane is up but the rack has them, which
  // happens if you click the rack rather than using the toggle.
  function markFocus() {
    if (!pane) return;
    const content = pane.querySelector('.cm-content');
    pane.classList.toggle('has-focus', !!(content && content.contains(document.activeElement)));
  }

  const focusToggle = (e) => {
    if (!e.altKey || e.key !== 'Tab' || e.metaKey || e.ctrlKey) return;
    e.preventDefault(); e.stopPropagation();
    // AWAY MEANS GONE, not dimmed. A translucent editor over the rack is a window you cannot read
    // through and cannot click past; the point of the toggle is to have the whole rack back.
    if (pane && pane.classList.contains('open')) {
      closeEditor();
      const rack = document.querySelector('.rack-viewport') || document.querySelector('.rack') || document.body;
      if (rack) { rack.setAttribute('tabindex', '-1'); rack.focus({ preventScroll: true }); }
      return;
    }
    openEditor(true);
  };
  document.addEventListener('keydown', focusToggle, true);
  // WHERE IT SPRINGS FROM. The CODE button on this module's own faceplate — found in the document
  // because the factory never sees its own panel. One Strudel module is the normal case; with two, the
  // animation starts from the first, which is wrong in a way nobody will notice.
  function buttonRect() {
    const el = document.querySelector('[data-wcoast-param="edit"]');
    return el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
  }

  const SPRING_MS = 500;

  // Grow out of the button, or shrink back into it. Cheap: one transform on one element.
  function springFrom(rect, reverse) {
    if (!pane || !rect || !pane.animate) return null;
    const p = pane.getBoundingClientRect();
    const dx = rect.left + rect.width / 2 - p.left;
    const dy = rect.top + rect.height / 2 - p.top;
    const small = { transform: `translate(${dx}px, ${dy}px) scale(0.04)`, opacity: 0.25 };
    const full = { transform: 'translate(0, 0) scale(1)', opacity: 1 };
    return pane.animate(reverse ? [full, small] : [small, full], {
      duration: SPRING_MS,
      // A touch of overshoot on the way out, none on the way back — a thing that springs open and
      // simply leaves reads better than one that bounces in both directions.
      easing: reverse ? 'cubic-bezier(.4,0,.9,.4)' : 'cubic-bezier(.2,.9,.25,1.15)',
    });
  }

  // EIGHT GRIPS, because CSS gives you one. Each names which edges it moves; dragging a side moves
  // that edge only, a corner moves both — and pulling a top or left edge has to move the pane's
  // position as well as its size, which is the whole reason this cannot be done with width alone.
  function addGrips() {
    const EDGES = { n: [1, 0, 0, 0], s: [0, 0, 1, 0], w: [0, 1, 0, 0], e: [0, 0, 0, 1],
      nw: [1, 1, 0, 0], ne: [1, 0, 0, 1], sw: [0, 1, 1, 0], se: [0, 0, 1, 1] };
    const MIN_W = 280, MIN_H = 140;
    for (const [name, [top, left, bottom, right]] of Object.entries(EDGES)) {
      const g = document.createElement('div');
      g.className = 'strudel-grip ' + name;
      pane.appendChild(g);
      g.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        const r = pane.getBoundingClientRect();
        const x0 = e.clientX, y0 = e.clientY;
        const move = (ev) => {
          const dx = ev.clientX - x0, dy = ev.clientY - y0;
          let l = r.left, t = r.top, w = r.width, h = r.height;
          if (right) w = Math.max(MIN_W, r.width + dx);
          if (bottom) h = Math.max(MIN_H, r.height + dy);
          if (left) { w = Math.max(MIN_W, r.width - dx); l = r.left + (r.width - w); }
          if (top) { h = Math.max(MIN_H, r.height - dy); t = r.top + (r.height - h); }
          pane.style.left = l + 'px'; pane.style.top = t + 'px';
          pane.style.width = w + 'px'; pane.style.height = h + 'px';
        };
        const up = () => {
          savePlacement();
          document.removeEventListener('pointermove', move);
          document.removeEventListener('pointerup', up);
        };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
      });
    }
  }

  function closeEditor() {
    if (!pane) return;
    savePlacement();
    const anim = springFrom(buttonRect(), true);
    const done = () => { pane.classList.remove('open'); };
    if (anim) anim.onfinish = done; else done();
  }

  // The size and place you left it, across a hide and across a restart: a window you have to resize
  // every time is a window you stop opening.
  const PLACE_KEY = 'wcoast.strudel.pane';
  function savePlacement() {
    if (!pane) return;
    try {
      localStorage.setItem(PLACE_KEY, JSON.stringify({
        left: pane.offsetLeft, top: pane.offsetTop, w: pane.offsetWidth, h: pane.offsetHeight }));
    } catch (_e) { /* no storage */ }
  }
  function loadPlacement() {
    try {
      const p = JSON.parse(localStorage.getItem(PLACE_KEY) || 'null');
      if (!p) return;
      // Clamped, so a window saved on a bigger screen is not lost off the edge of a smaller one.
      pane.style.left = Math.max(0, Math.min(p.left, window.innerWidth - 120)) + 'px';
      pane.style.top = Math.max(0, Math.min(p.top, window.innerHeight - 60)) + 'px';
      if (p.w) pane.style.width = p.w + 'px';
      if (p.h) pane.style.height = p.h + 'px';
    } catch (_e) { /* no storage */ }
  }

  async function openEditor(on) {
    if (!on) { closeEditor(); return; }
    const s = await ensure();
    if (!pane) {
      pane = document.createElement('div');
      pane.className = 'strudel-pane';
      pane.innerHTML = '<div class="strudel-pane-bar"><span>Strudel</span>'
        + '<span class="strudel-err"></span><span class="strudel-close">×</span></div>'
        + '<div class="strudel-root"></div>';
      document.body.appendChild(pane);
      loadPlacement();
      addGrips();
      // A resize or a drag is worth remembering the moment it happens, not only when the pane is put
      // away — the app may be closed with it open.
      if (window.ResizeObserver) new ResizeObserver(() => savePlacement()).observe(pane);
      pane.addEventListener('focusin', markFocus);
      pane.addEventListener('focusout', () => setTimeout(markFocus, 0));
      pane.querySelector('.strudel-close').onclick = () => closeEditor();
      // Dragged by its bar, like every other floating thing in the rack.
      const bar = pane.querySelector('.strudel-pane-bar');
      bar.onpointerdown = (e) => {
        const x0 = e.clientX - pane.offsetLeft, y0 = e.clientY - pane.offsetTop;
        const move = (ev) => { pane.style.left = (ev.clientX - x0) + 'px'; pane.style.top = (ev.clientY - y0) + 'px'; };
        const up = () => { savePlacement(); document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
        document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
      };
      mirror = new s.StrudelMirror({
        defaultOutput: output,
        getTime: () => ctx.currentTime,
        transpiler: s.transpiler,
        root: pane.querySelector('.strudel-root'),
        initialCode: code,
        prebake: async () => {},
      });
      mirror.setCode(code);
    }
    pane.classList.add('open');
    springFrom(buttonRect(), false);
    // Opening it puts the cursor in it — that is what you opened it for. And CodeMirror has to be told
    // to measure itself again: it was display:none, so everything it knew about its own size is stale.
    const content = pane.querySelector('.cm-content');
    setTimeout(() => {
      try { if (mirror && mirror.editor && mirror.editor.requestMeasure) mirror.editor.requestMeasure(); } catch (_e) { /* fine */ }
      if (content) content.focus({ preventScroll: true });
      markFocus();
    }, 0);
  }

  // The pattern text lives here between edits, so RUN plays whatever the patch last saved.
  let code = 'note("<c3 eb3 g3 bb3>").sustain(0.4)';

  const api = {
    node,
    getOutput: (id) => (id === 'noteOut' ? { node, index: 0 } : null),
    getInput: () => null,
    getParam: () => null,
    // The panel's buttons arrive here as stepped params, which is how the rack drives everything.
    setParam: (id, value) => {
      if (id === 'code') { code = String(value || ''); return; }
      if (id === 'run') { if (value === 'play') api.play(code); else api.stop(); }
      if (id === 'edit') openEditor(value === 'open');
    },
    supports: (id) => ['code', 'run', 'edit'].includes(id),
    // The rack hands the note cable's port in when one is patched, exactly as it does for Sequence Out.
    attachNoteOut: (port, edge) => {
      if (port) node.port.postMessage({ noteOut: port, edge }, [port]);
      else node.port.postMessage({ noteOutOff: edge });
    },
    onNoteFlash: (fn) => { onFlash = fn; },

    // ---- what the panel drives -------------------------------------------------------------------
    // Evaluate and play. An error is a NORMAL EVENT in live coding — a half-typed pattern is a
    // half-typed pattern, not a crash — so it is caught, remembered for the lamp, and the pattern that
    // was already playing goes on playing.
    play: async (src) => {
      try {
        const s = await ensure();
        // The EDITOR's copy is the truth when it is open — it is what you have been typing into.
        // The EDITOR's copy is the truth when it is open — it is what you have been typing into.
        if (mirror) { await mirror.evaluate(); }
        else await replInstance.evaluate(src, true);
        lastError = null;
      } catch (e) { lastError = (e && e.message) || String(e); }
      return lastError;
    },
    stop: () => {
      try { if (mirror) mirror.stop(); } catch (_e) { /* not open */ }
      try { if (replInstance) replInstance.stop(); } catch (_e) { /* nothing playing */ }
      node.port.postMessage({ flush: true });
    },
    error: () => lastError,
    cps: () => {
      try { return (mirror && mirror.repl.scheduler.cps) || (replInstance && replInstance.scheduler.cps) || null; }
      catch (_e) { return null; }
    },
    dispose: () => {
      try { if (mirror) mirror.stop(); } catch (_e) { /* gone */ }
      try { if (replInstance) replInstance.stop(); } catch (_e) { /* gone */ }
      try { document.removeEventListener('keydown', focusToggle, true); } catch (_e) { /* gone */ }
      try { if (pane) pane.remove(); } catch (_e) { /* gone */ }
      try { node.port.onmessage = null; node.disconnect(); } catch (_e) { /* gone */ }
    },
  };
  return api;
}
