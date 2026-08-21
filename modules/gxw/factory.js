// factory.js — GXW on the rack.
//
// The module is thin on purpose. GXW is a finished application with its own window, its own menu and
// its own transport; what this file does is give it a context to run on, a node to sound through, a
// place to draw, and four jacks' worth of rack manners. Everything it knows about GXW is the small
// surface `createGXW` exposes — see main.js in the GXW checkout.
//
// WHERE GXW COMES FROM. Under the DRACK shell, `gxw://project/…` serves the GXW checkout where it
// stands, so both projects stay editable and nothing is copied. Plain DreamRack has no such scheme, so
// the import fails and the module says so plainly rather than sitting there dead. When GXW ships
// inside DreamRack its source is synced into this repository and this constant changes; the rest of
// the file does not. See design/drack.md §4.
'use strict';

import { loadSuperdough } from '../../host/superdough.js';

const GXW_ENTRY = 'gxw://project/main.js';

// One at a time, and one only. Superdough is a singleton, and so is a page: two GXWs would be two
// applications fighting over one window and one output stage.
let loadPromise = null;
function loadGXW() {
  if (!loadPromise) {
    loadPromise = import(/* @vite-ignore */ GXW_ENTRY).catch((e) => {
      loadPromise = null;
      throw new Error('GXW is not being served here — run the DRACK shell, which serves the GXW '
        + `checkout as ${GXW_ENTRY}. (${(e && e.message) || e})`);
    });
  }
  return loadPromise;
}

export function create(ctx, _services) {
  // GXW'S SOUND, ON ITS WAY TO THE JACKS. superdough is stereo and pans its voices, so the pair is
  // split rather than summed — one jack into one mixer channel would throw the panning away. The same
  // shape the Strudel module uses, for the same reason.
  const doughOut = ctx.createGain();
  const doughSplit = ctx.createChannelSplitter(2);
  const doughL = ctx.createGain();
  const doughR = ctx.createGain();
  doughOut.connect(doughSplit);
  doughSplit.connect(doughL, 0);
  doughSplit.connect(doughR, 1);

  let gxw = null;             // the mounted application, once it is up
  let pane = null;            // the full-window element it draws into
  let report = null;          // how the module tells the rack what it is doing
  let lastError = null;
  let running = false;
  let score = '';

  const say = (status) => { if (report) report('status', status); };

  // THE ENGINE, SUPPLIED RATHER THAN IMPORTED. This is the whole reason GXW can be a module: handed
  // DreamRack's superdough, it plays through the rack; left to import its own it would start a second
  // one, with its own output stage and its own registered sounds, neither aware of the other.
  //
  // Pointed at this module's own output as it is handed over, so its voices arrive at the jacks.
  const engineForGXW = async () => loadSuperdough(ctx, doughOut);

  // MOUNTED ONCE, LAZILY. Nothing loads until the module is asked to do something — a patch with a
  // GXW module on it that is never run should not pay for GXW's boot.
  let mountPromise = null;
  function mount() {
    if (mountPromise) return mountPromise;
    say('loading');
    mountPromise = loadGXW().then(async (mod) => {
      if (typeof mod.createGXW !== 'function') throw new Error('GXW exports no createGXW');
      pane = document.createElement('div');
      pane.className = 'gxw-pane';
      // OFF-SCREEN UNTIL OPENED, not unmounted. GXW keeps running while its window is shut — that is
      // what lets RUN on the faceplate work with the window never open — so it needs somewhere real
      // to live and a real size to lay itself out into. Hidden by moving it, not by `display: none`,
      // which would collapse its canvas to nothing and make reopening a re-layout every time.
      pane.style.cssText = 'position:fixed;inset:0;z-index:1500;background:#111;visibility:hidden;'
        + 'pointer-events:none';
      document.body.appendChild(pane);
      gxw = await mod.createGXW({
        element: pane,
        audioContext: ctx,        // the rack's own, so GXW and the rack are one graph
        output: doughOut,         // ...and its sound arrives at this module's jacks
        loadStrudel: engineForGXW,
      });
      lastError = null;
      say('ok');
      if (score) applyScore(score);
      return gxw;
    }).catch((e) => {
      mountPromise = null;
      lastError = (e && e.message) || String(e);
      say('error');
      console.warn('[gxw] ' + lastError);
      throw e;
    });
    return mountPromise;
  }

  // A score arriving from the patch. GXW may not be mounted yet, in which case it is held and applied
  // when it is — a patch load happens long before anyone presses a button.
  function applyScore(text) {
    score = String(text || '');
    if (!gxw || !score) return;
    if (typeof gxw.loadScoreText === 'function') {
      try { gxw.loadScoreText(score); } catch (e) { console.warn('[gxw] score refused:', e.message); }
    }
  }

  function setOpen(open) {
    if (!pane) return;
    pane.style.visibility = open ? 'visible' : 'hidden';
    pane.style.pointerEvents = open ? 'auto' : 'none';
    // The rack's own chrome stays out of the way while GXW has the window, and comes back after.
    document.body.classList.toggle('gxw-open', open);
  }

  return {
    getOutput: (id) => {
      if (id === 'audioOutL') return { node: doughL, index: 0 };
      if (id === 'audioOutR') return { node: doughR, index: 0 };
      // THE EIGHT VOICE JACKS ARE DECLARED AND NOT YET FED. Notes travel a note cable as messages,
      // not as signal, and the path that carries them — GXW's firing engine into the rack's note
      // protocol — is the next piece of work. Returning null here means a cable to a voice tab will
      // not connect yet, which is honest: a jack that accepts a cable and stays silent would look
      // like a broken patch rather than an unfinished module.
      return null;
    },
    getInput: () => null,
    getParam: () => null,

    setParam: (id, value) => {
      if (id === 'score') { applyScore(value); return; }
      // GXW's transport has play() and pause() and no stop(): pausing is what the rack's RUN switch
      // means when it goes off, since a patch that is switched back on should carry on rather than
      // start the piece again from the top.
      if (id === 'run') {
        running = value === 'on';
        // MOUNTING ON FIRST USE. Pressing RUN is what a patch does to start the sequence with the
        // window never open, so it has to be able to bring GXW up by itself.
        mount().then(() => {
          if (!gxw || !gxw.transport) return;
          if (running) gxw.transport.play(); else gxw.transport.pause();
        }).catch(() => { /* already reported through status */ });
        return;
      }
      if (id === 'open') {
        if (value !== 'on') return;         // momentary: only the press means anything
        mount().then(() => setOpen(true)).catch(() => { /* already reported */ });
        return;
      }
    },

    supports: (id) => ['run', 'open', 'score', 'status'].includes(id),

    dispose: () => {
      try { if (gxw && typeof gxw.dispose === 'function') gxw.dispose(); } catch (_e) { /* going anyway */ }
      try { if (pane) pane.remove(); } catch (_e) { /* already gone */ }
      document.body.classList.remove('gxw-open');
      try { doughOut.disconnect(); doughSplit.disconnect(); doughL.disconnect(); doughR.disconnect(); } catch (_e) { /* gone */ }
      gxw = null; pane = null; mountPromise = null;
    },

    // How the rack hands the module its reporting channel — the name the rack actually calls, the
    // same one the Strudel module takes.
    onValueChange: (fn) => { report = fn; say(lastError ? 'error' : (gxw ? 'ok' : 'idle')); },
  };
}
