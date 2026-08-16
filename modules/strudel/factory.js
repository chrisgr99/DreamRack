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
const VENDOR = '../../vendor/strudel-web.mjs';

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

  async function ensure() {
    if (started) return S;
    S = await loadStrudel();
    // OUR CONTEXT, AND OUR OUTPUT — both verified as supported options rather than assumed.
    S.initStrudel({ audioContext: ctx, defaultOutput: output });
    started = true;
    return S;
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
        await s.evaluate(src, true);
        lastError = null;
      } catch (e) { lastError = (e && e.message) || String(e); }
      return lastError;
    },
    stop: () => {
      try { if (S && S.hush) S.hush(); } catch (_e) { /* nothing playing */ }
      node.port.postMessage({ flush: true });
    },
    error: () => lastError,
    cps: () => {
      try { return (S && S.getTrigger && window.strudel?.scheduler?.cps) || null; } catch (_e) { return null; }
    },
    dispose: () => {
      try { if (S && S.hush) S.hush(); } catch (_e) { /* gone */ }
      try { node.port.onmessage = null; node.disconnect(); } catch (_e) { /* gone */ }
    },
  };
  return api;
}
