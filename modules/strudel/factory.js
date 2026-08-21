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

import { toNote, durationOf } from './adapter.js';
// ONE PLACE STARTS SUPERDOUGH, and it is no longer here — GXW needs the same one. See
// host/superdough.js.
import { loadSuperdough } from '../../host/superdough.js';

const PROCESSOR = 'wcoast-strudel';
const VENDOR = '../../vendor/strudel-dreamrack.mjs';

let strudelPromise = null;      // the module namespace, once
function loadStrudel() {
  if (!strudelPromise) strudelPromise = import(VENDOR);
  return strudelPromise;
}

// ---- Strudel's own voices ----------------------------------------------------------------------
// TWO DESTINATIONS, ONE CLOCK. A pattern's events go either to a voice tab in the rack or to
// superdough, Strudel's own engine — and both run on the rack's AudioContext, so a drum from one and
// a note from the other land on the same sample.
//
// WHICH ONE, decided per event and in this order: a part that names a rack jack goes to the rack; a
// part that names a SOUND is Strudel's; anything else is a bare note, which is what a rack voice has
// always played, so it keeps going there. That last rule is what lets every pattern written before
// this go on working unchanged.

export function create(ctx, _services) {
  const node = new AudioWorkletNode(ctx, PROCESSOR, {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1],
  });

  // Where Strudel's own voices arrive before the rack takes them, split into the two jacks the
  // faceplate offers — see the descriptor. Stereo in, two mono jacks out, which is how every other
  // stereo source on this rack presents itself.
  const doughOut = ctx.createGain();
  const doughSplit = ctx.createChannelSplitter(2);
  const doughL = ctx.createGain(), doughR = ctx.createGain();
  doughOut.connect(doughSplit);
  doughSplit.connect(doughL, 0);
  doughSplit.connect(doughR, 1);
  let S = null;                 // the Strudel namespace
  let started = false;          // initStrudel called
  let seq = 0;                  // handle counter
  const prefix = 'st' + Math.floor(Math.random() * 1e4);
  let lastError = null;
  let report = null;              // set by the rack: how a module tells it a value has changed
  let running = false;            // what the transport is doing, so the bar's button can show it
  let placement = '';             // the window's geometry as the patch has it
  let reportedCps = null;
  let setCps = null;              // what the panel last asked for, so a report cannot fight it
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
    const value = (hap && hap.value) || {};
    // WHOSE EVENT IS THIS. A part that names a rack jack is the rack's; a part that names a sound is
    // Strudel's; a bare note is the rack's, as it always has been.
    const named = value.rack !== undefined || value.orbit !== undefined;
    if (!named && value.s !== undefined) {
      loadSuperdough(ctx, doughOut).then((sd) => {
        // superdough takes the event, the time to sound at, and how long — the same three things the
        // note bundle carries, in its own units.
        try { sd.superdough(value, t, durationOf(value, hap.whole ? Number(hap.whole.end) - Number(hap.whole.begin) : 0, cps)); }
        catch (e) { lastError = (e && e.message) || String(e); }
      }).catch((e) => { lastError = `superdough: ${(e && e.message) || e}`; });
      return;
    }
    const n = toNote(hap, cps, t, {
      noteToMidi: S.noteToMidi,
      sampleAt,
      handle: prefix + ':' + (seq++),
    });
    if (!n) return;             // nothing playable in this event
    node.port.postMessage({ events: [
      { at: n.at, handle: n.handle, voice: n.voice, pitch: n.pitch, level: n.level, duration: n.duration,
        pan: n.pan, timbre: n.timbre, pressure: n.pressure },
      { at: n.offAt, handle: n.handle, voice: n.voice, off: true },
    ] });
  };

  let replInstance = null;

  async function ensure() {
    if (started) return S;
    S = await loadStrudel();
    // THE SCOPE FIRST. `note`, `s` and the rest have to exist as globals before any pattern can be
    // evaluated — by us or by the editor — and evalScope is what puts them there. An editor built
    // without it mounts perfectly and then evaluates nothing, with no error to show for it.
    // THE RACK'S OWN LANES, REGISTERED AS CONTROLS. `.timbre(0.7)` has to BE a method: the bundled
    // build has no catch-all for unknown control names, so a pattern using one dies with "timbre is
    // not a function". createParams makes them real, and registering before the scope is evaluated
    // means they can also be used bare — timbre("0.2 0.8") — like any other control.
    // `rack` is registered the same way: it is how a pattern says which voice jack a part leaves by.
    try { if (S.core.createParams) S.core.createParams('timbre', 'press', 'rack'); } catch (_e) { /* older build */ }
    await S.evalScope(S.core, S.mini);
    // SAMPLES() HAS TO EXIST BEFORE A PATTERN IS READ, and superdough is not loaded until an event
    // needs it — so what goes into scope is a forwarder: call it and the engine loads, then the call
    // is made. Without this, a pattern whose first line is `samples('github:…')` throws while being
    // evaluated, and a pattern that fails to evaluate plays NOTHING — not even the parts bound for
    // the rack, which is a silence that looks nothing like a missing drum kit.
    for (const name of ['samples', 'registerSound', 'registerSynthSounds', 'aliasBank', 'initAudio']) {
      if (typeof globalThis[name] === 'function') continue;
      globalThis[name] = (...args) => loadSuperdough(ctx, doughOut).then((sd) => (sd[name] ? sd[name](...args) : undefined));
    }
    // Our own repl, for playing without the editor open. Its output is ours and its clock is the
    // rack's, so an event's deadline is already in the right domain.
    replInstance = S.repl({ defaultOutput: output, getTime: () => ctx.currentTime, transpiler: S.transpiler });
    started = true;
    // THE PANEL IS NEVER BLANK. Until something reports a tempo the readout has no value to show, and
    // scrolling an empty readout starts from the bottom of the range — which is how it came up at 0.05.
    reportState();
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

  // WARM ON ARRIVAL. Strudel is a 1.7MB package and its scope has to be evaluated before a pattern
  // can run, and none of that used to begin until the first press of PLAY — so the first press was
  // followed by a second or two of silence while the module fetched and built what it needed. Started
  // here, in the background, it is ready long before anyone reaches for the button. Failure is not
  // reported: if it cannot load now it will be tried again by the press, which is where an error
  // belongs.
  setTimeout(() => { ensure().catch(() => {}); }, 0);

  // Once a second is enough for a tempo readout, and it costs nothing.
  const stateTimer = setInterval(reportState, 1000);
  // Strudel's own default is half a cycle a second; say so at once rather than when a pattern first
  // runs, or the panel spends its first minutes empty.
  setTimeout(() => { if (report && reportedCps == null) { reportedCps = 0.5; report('cps', 0.5); } }, 0);
  // WHERE IT SPRINGS FROM. The CODE button on this module's own faceplate — found in the document
  // because the factory never sees its own panel. One Strudel module is the normal case; with two, the
  // animation starts from the first, which is wrong in a way nobody will notice.
  function buttonRect() {
    const el = document.querySelector('[data-wcoast-param="edit"]');
    return el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
  }

  // Slower coming than going: arriving is the moment worth watching, leaving should just be gone.
  const OPEN_MS = 1000, CLOSE_MS = 500;

  // WHAT THE PANEL SHOWS. The tempo lives in the pattern, not on a knob, so the rack has to be told
  // when it changes; the status is how a half-typed pattern says so without the window open.
  function reportState() {
    if (!report) return;
    const c = api.cps();
    // Only when the PATTERN has moved it somewhere else — otherwise the panel and the pattern take
    // turns overwriting each other a second at a time.
    if (c != null && Math.abs(c - (reportedCps ?? -1)) > 1e-6 && (setCps == null || Math.abs(c - setCps) > 1e-6)) {
      reportedCps = c; setCps = null; report('cps', Math.round(c * 100) / 100);
    }
    report('status', lastError ? 'error' : 'ok');
    const bar = pane && pane.querySelector('.strudel-err');
    if (bar) bar.textContent = lastError ? lastError.slice(0, 90) : '';
    if (pane) pane.classList.toggle('has-error', !!lastError);
  }

  // Grow out of the button, or shrink back into it. Cheap: one transform on one element.
  function springFrom(rect, reverse) {
    if (!pane || !rect || !pane.animate) return null;
    const p = pane.getBoundingClientRect();
    const dx = rect.left + rect.width / 2 - p.left;
    const dy = rect.top + rect.height / 2 - p.top;
    const small = { transform: `translate(${dx}px, ${dy}px) scale(0.04)`, opacity: 0.25 };
    const full = { transform: 'translate(0, 0) scale(1)', opacity: 1 };
    return pane.animate(reverse ? [full, small] : [small, full], {
      duration: reverse ? CLOSE_MS : OPEN_MS,
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
    savePlacement();
    const done = () => { pane.classList.remove('open'); };
    if (anim) anim.onfinish = done; else done();
  }

  // The size and place you left it, across a hide and across a restart: a window you have to resize
  // every time is a window you stop opening.
  // The geometry travels in a param, so it saves with the patch and belongs to THIS module rather
  // than to the machine. Debounced: a drag is a stream of moves, not a stream of patch edits.
  let placeTimer = null;
  // THE LAST GEOMETRY IT ACTUALLY HAD. A hidden element measures as nothing — zero size at the origin
  // — and closing the window fires the resize observer on the way out, so reading the pane at that
  // moment saved 0,0 and the window came back in the top left corner every time. What is remembered
  // is the last measurement taken while it was on screen.
  let lastGeom = null;
  function savePlacement() {
    if (!pane || !report) return;
    if (pane.offsetWidth > 0 && pane.offsetHeight > 0) {
      lastGeom = { left: pane.offsetLeft, top: pane.offsetTop, w: pane.offsetWidth, h: pane.offsetHeight };
    }
    if (!lastGeom) return;
    clearTimeout(placeTimer);
    placeTimer = setTimeout(() => {
      report('window', JSON.stringify({ ...lastGeom, open: pane.classList.contains('open') }));
    }, 300);
  }
  function applyPlacement(json) {
    if (!pane || !json) return;
    try {
      const p = JSON.parse(json);
      if (!p) return;
      // CLAMPED, so a window saved on a bigger screen is not lost off the edge of a smaller one — the
      // patch may have been written somewhere else entirely.
      if (typeof p.left === 'number') pane.style.left = Math.max(0, Math.min(p.left, window.innerWidth - 120)) + 'px';
      if (typeof p.top === 'number') pane.style.top = Math.max(0, Math.min(p.top, window.innerHeight - 60)) + 'px';
      if (p.w) pane.style.width = Math.min(p.w, window.innerWidth) + 'px';
      if (p.h) pane.style.height = Math.min(p.h, window.innerHeight) + 'px';
    } catch (_e) { /* a patch written by an older build */ }
  }

  async function openEditor(on) {
    if (!on) { closeEditor(); return; }
    const s = await ensure();
    if (!pane) {
      pane = document.createElement('div');
      pane.className = 'strudel-pane';
      pane.innerHTML = '<div class="strudel-pane-bar"><span>Strudel</span>'
        + '<span class="strudel-play-label">Play</span>'
        + '<span class="strudel-play" title="play / stop"></span>'
        + '<span class="strudel-err"></span><span class="strudel-close">×</span></div>'
        + '<div class="strudel-root"></div>';
      document.body.appendChild(pane);
      // The frame follows the rack's theme, the way every other floating card does. Read from the
      // document rather than passed in: the factory has no line to the rack's own dark-mode state.
      const theme = () => pane.classList.toggle('theme-dark', document.body.classList.contains('wcoast-dark'));
      theme();
      new MutationObserver(theme).observe(document.body, { attributes: true, attributeFilter: ['class'] });
      applyPlacement(placement);
      addGrips();
      // A resize or a drag is worth remembering the moment it happens, not only when the pane is put
      // away — the app may be closed with it open.
      if (window.ResizeObserver) new ResizeObserver(() => savePlacement()).observe(pane);
      pane.querySelector('.strudel-close').onclick = () => closeEditor();
      // THE SAME SWITCH AS THE FACEPLATE'S, within reach of the hand that is typing. It reports the
      // run param rather than starting the pattern itself, so the panel button and this one are one
      // state seen twice — press either and both show it.
      const playDot = pane.querySelector('.strudel-play');
      playDot.classList.toggle('on', running);       // the window may be opened mid-pattern
      playDot.onpointerdown = (e) => { e.preventDefault(); e.stopPropagation(); };
      playDot.onclick = (e) => {
        e.stopPropagation();
        if (report) report('run', running ? 'off' : 'on');
      };
      // Dragged by its bar, like every other floating thing in the rack.
      const bar = pane.querySelector('.strudel-pane-bar');
      bar.onpointerdown = (e) => {
        // DRAGGING THE WINDOW DOES NOT TAKE THE CURSOR OUT OF IT. Without this, grabbing the bar to
        // move the window costs you your place in the pattern.
        e.preventDefault();
        // MOVED BY TRANSFORM, NOT BY left/top. Writing left/top on every pointer move relayouts the
        // page — the rack, the cables and a two-megabyte editor subtree with it — which is why
        // dragging felt like wading while a patch played. A transform is a compositor move: nothing
        // is laid out again, and the rack underneath is not repainted, only re-composited. The
        // position is written back once, on release.
        const x0 = e.clientX, y0 = e.clientY;
        const l0 = pane.offsetLeft, t0 = pane.offsetTop;
        pane.style.willChange = 'transform';
        document.dispatchEvent(new CustomEvent('wcoast:ui-busy', { detail: { busy: true } }));
        const move = (ev) => {
          pane.style.transform = `translate(${ev.clientX - x0}px, ${ev.clientY - y0}px)`;
        };
        const up = (ev) => {
          pane.style.transform = '';
          pane.style.willChange = '';
          pane.style.left = (l0 + (ev.clientX - x0)) + 'px';
          pane.style.top = (t0 + (ev.clientY - y0)) + 'px';
          savePlacement();
          document.dispatchEvent(new CustomEvent('wcoast:ui-busy', { detail: { busy: false } }));
          document.removeEventListener('pointermove', move);
          document.removeEventListener('pointerup', up);
        };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
      };
      mirror = new s.StrudelMirror({
        defaultOutput: output,
        getTime: () => ctx.currentTime,
        transpiler: s.transpiler,
        root: pane.querySelector('.strudel-root'),
        initialCode: code,
        prebake: async () => {},
        // THE HIGHLIGHT NEEDS A WINDOW TO LOOK THROUGH. StrudelMirror defaults to drawTime [0,0] —
        // zero width — so it asks which events are active between now and now, and catches one only
        // when a note begins on the very frame it happens to look. That is why the playing symbols lit
        // up occasionally and seemed to depend on what you had just done. A tenth of a second either
        // side is enough for every event to be seen, and short enough that what lights up is what you
        // are hearing.
        drawTime: [-0.1, 0.1],
        autodraw: true,
      });
      mirror.setCode(code);
      // NO WHITE WASH OVER THE CODE. Strudel acknowledges an evaluation by decorating the whole
      // document with a white background and inverting the text for a fifth of a second, which at
      // this size is the entire window flashing black-on-white each time a pattern is run. The
      // acknowledgement is worth keeping; the form is not, so it becomes a brief pulse of the pane's
      // own edge instead — the same event, said at the edge of vision rather than in the text.
      try {
        mirror.flash = () => {
          pane.classList.add('flash');
          setTimeout(() => pane.classList.remove('flash'), 200);
        };
      } catch (_e) { /* not this build */ }
      // THE PATTERN IS SAVED WITH THE PATCH. Debounced: a keystroke is not a patch edit, and the
      // autosave should not run on every character. Half a second after you stop typing, it is stored.
      let codeTimer = null;
      const noteCode = () => {
        clearTimeout(codeTimer);
        codeTimer = setTimeout(() => {
          const now = mirror.code || '';
          if (now === code) return;
          code = now;
          if (report) report('code', code);
        }, 500);
      };
      pane.addEventListener('keyup', noteCode);
      pane.addEventListener('input', noteCode);
    }
    pane.classList.add('open');
    const anim = springFrom(buttonRect(), false);
    savePlacement();
    // Opening it puts the cursor in it — that is what you opened it for. And CodeMirror has to be told
    // to measure itself again: it was display:none, so everything it knew about its own size is stale.
    //
    // AFTER THE SPRING, NOT DURING IT. The window arrives by scaling up from the button, so for a
    // second the pane is a fraction of its size — and a measurement taken then gives CodeMirror line
    // heights a twenty-fifth of what they should be, which is what put the first few lines on top of
    // each other. Measuring when the animation finishes measures the window that is actually there.
    const content = pane.querySelector('.cm-content');
    const measure = () => {
      try { if (mirror && mirror.editor && mirror.editor.requestMeasure) mirror.editor.requestMeasure(); } catch (_e) { /* fine */ }
    };
    if (anim) anim.onfinish = () => { measure(); if (content) content.focus({ preventScroll: true }); };
    else setTimeout(() => { measure(); if (content) content.focus({ preventScroll: true }); }, 0);
    // And once more a beat later: a font that arrives late, or a window resized while it was away,
    // both leave the first measurement stale.
    setTimeout(measure, OPEN_MS + 120);

    // THE PATTERN MOVES INTO THE EDITOR. Playing with the window shut runs the module's own repl,
    // which knows nothing about CodeMirror — so opening the window mid-pattern used to leave you
    // watching an editor that was not the thing making the sound, with no highlighting to show for
    // it. Handing the pattern over on open is what makes the highlight follow whatever is playing,
    // whichever button started it.
    if (running && mirror) {
      // AND IF THE EDITOR WILL NOT TAKE IT, THE MODULE GOES ON PLAYING. The old repl is stopped only
      // once the editor has actually started the pattern: stopping first and then failing — which is
      // what an editor still being built does — left the module lit, reporting no error, and silent,
      // with nothing to restart it. The failure is also recorded now rather than swallowed, so the
      // ERR lamp says what happened.
      try {
        await mirror.evaluate();
        try { replInstance && replInstance.stop(); } catch (_e) { /* it was not playing */ }
        lastError = null;
      } catch (e) {
        lastError = (e && e.message) || String(e);
      }
      reportState();
    }
  }

  // The pattern text lives here between edits, so RUN plays whatever the patch last saved.
  let code = 'note("<c3 eb3 g3 bb3>").sustain(0.4)';

  const api = {
    node,
    // ALL EIGHT JACKS SHARE ONE CHANNEL OF SILENCE. The audio connection exists only to keep both
    // worklets in the rendering graph — the notes themselves travel as messages — so eight jacks need
    // eight ports in the descriptor and no extra outputs on the node.
    getOutput: (id) => {
      if (id === 'audioOutL') return { node: doughL, index: 0 };
      if (id === 'audioOutR') return { node: doughR, index: 0 };
      return (id === 'noteOut' || /^noteOut[2-8]$/.test(id)) ? { node, index: 0 } : null;
    },
    getInput: () => null,
    getParam: () => null,
    // The panel's buttons arrive here as stepped params, which is how the rack drives everything.
    setParam: (id, value) => {
      if (id === 'code') {
        code = String(value || '');
        // A patch loading, or an undo: the editor should show what the rack now holds.
        if (mirror && mirror.code !== code) mirror.setCode(code);
        return;
      }
      if (id === 'window') {
        placement = String(value || '');
        applyPlacement(placement);
        // A patch that was saved with the editor open opens it again — the window is part of the
        // piece, not part of the session.
        try {
          const st = placement ? JSON.parse(placement) : null;
          if (st && st.open && (!pane || !pane.classList.contains('open'))) setTimeout(() => openEditor(true), 0);
        } catch (_e) { /* nothing to reopen */ }
        return;
      }
      if (id === 'status') return;                       // reported BY us; nothing to obey
      if (id === 'cps') {
        // Turning it on the panel sets the running pattern's tempo. Remembered so the report below
        // does not immediately push our own value back at us and fight the knob.
        const v = Number(value);
        if (!isFinite(v) || v <= 0) return;
        setCps = v; reportedCps = v;
        try { (mirror ? mirror.repl : replInstance)?.setCps?.(v); } catch (_e) { /* not running yet */ }
        return;
      }
      // THE TRANSPORT AND THE ENGINE STAY SEPARATE. Tying them together was tried and undone: the
      // engine is the whole rack's switch, so a pattern's stop button silenced everything else on it.
      if (id === 'run') {
        running = value === 'on';
        if (running) api.play(code); else api.stop();
        const dot = pane && pane.querySelector('.strudel-play');
        if (dot) dot.classList.toggle('on', running);
      }
      // Momentary: every press arrives as 'on', so the press itself is the toggle.
      if (id === 'edit' && value === 'on') {
        if (pane && pane.classList.contains('open')) closeEditor(); else openEditor(true);
      }
    },
    supports: (id) => ['code', 'run', 'edit', 'cps', 'status', 'window'].includes(id),
    // The rack hands this in when the module is placed (see rack.js): how to report a value it did
    // not set — the pattern you typed, the tempo the pattern asked for, whether it evaluated.
    onValueChange: (fn) => { report = fn; },
    // The rack hands the note cable's port in when one is patched, exactly as it does for Sequence Out
    // — with WHICH JACK it was plugged into, since this module has eight of them.
    attachNoteOut: (port, edge, portId) => {
      if (port) node.port.postMessage({ noteOut: port, edge, port: portId || 'noteOut' }, [port]);
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
        if (mirror) { await mirror.evaluate(); code = mirror.code || code; if (report) report('code', code); }
        else await replInstance.evaluate(src, true);
        lastError = null;
      } catch (e) { lastError = (e && e.message) || String(e); }
      reportState();
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
      try { clearInterval(stateTimer); } catch (_e) { /* gone */ }
      try { document.removeEventListener('keydown', focusToggle, true); } catch (_e) { /* gone */ }
      try { if (pane) pane.remove(); } catch (_e) { /* gone */ }
      try { node.port.onmessage = null; node.disconnect(); } catch (_e) { /* gone */ }
      try { doughOut.disconnect(); doughSplit.disconnect(); doughL.disconnect(); doughR.disconnect(); } catch (_e) { /* gone */ }
    },
  };
  return api;
}
