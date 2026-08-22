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

import { loadEngine } from '../../host/superdough.js';
import { midiToVolts } from '../strudel/adapter.js';

// THE NOTE CABLE'S WORKLET, shared with the Strudel module. A note travels a note cable as a message
// rather than as signal, and this processor is what holds an event until its sample arrives; the
// audio connection exists only to keep it in the rendering graph. The host loads worklets by path and
// skips one it already has, so naming the same file twice costs nothing.
//
// It lives under modules/strudel because that module was the only thing that needed it. It is not
// Strudel's — it is the note cable's — and it should move to a shared place, the way starting
// superdough did. Left where it is for now rather than disturbing a working module late.
const NOTE_PROCESSOR = 'wcoast-strudel';

const GXW_ENTRY = 'gxw://project/main.js';

// ONE GXW PER PAGE, enforced here rather than hoped for. GXW is an application — a canvas, a render
// loop, resize observers, a transport — and two of them in one document do not merely duplicate: they
// peg the renderer between them. A patch carrying a GXW module, restored while another is already
// mounted, is exactly how that happens, and the page stops answering with no clue as to why.
//
// So the second one refuses and says so. The rack's group-singleton rule (only one of Strudel or GXW
// on a patch) will make this unreachable in normal use; this is the backstop for the case the rule
// does not cover, which is a module added while another is mid-mount.
let mounted = 0;

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
  // ONE NODE FOR ALL EIGHT JACKS. The notes are messages, so eight jacks need eight ports in the
  // descriptor and no extra outputs on the node — every jack hands out the same channel of silence,
  // which is only there to keep the worklet running.
  const noteNode = new AudioWorkletNode(ctx, NOTE_PROCESSOR, {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1],
  });
  let seq = 0;
  const handlePrefix = 'gxw' + Math.floor(ctx.currentTime * 1000).toString(36);
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

  const state = {};           // the pane watcher lives here so dispose can stop it
  let gxw = null;             // the mounted application, once it is up
  let pane = null;            // the full-window element it draws into
  let report = null;          // how the module tells the rack what it is doing
  let lastError = null;
  let running = false;
  let drivingTransport = false;   // true while the module is the one moving GXW's transport
  let driveTimer = 0;
  // HELD ACROSS THE EVENT, not just the call. GXW emits its transport change asynchronously, so a
  // flag cleared the moment play() returns is already false when the echo arrives — and the echo then
  // reports the old state back over the one the rack just set, which is why RUN would not switch off.
  // A short window covers the round trip without leaving the guard up long enough to swallow a real
  // change made inside GXW.
  const drive = (fn) => {
    drivingTransport = true;
    clearTimeout(driveTimer);
    try { fn(); } catch (_e) { /* GXW not up yet */ }
    driveTimer = setTimeout(() => { drivingTransport = false; }, 400);
  };
  let score = '';

  const say = (status) => { if (report) report('status', status); };

  // THE ENGINE, SUPPLIED RATHER THAN IMPORTED. This is the whole reason GXW can be a module: handed
  // DreamRack's superdough, it plays through the rack; left to import its own it would start a second
  // one, with its own output stage and its own registered sounds, neither aware of the other.
  //
  // Pointed at this module's own output as it is handed over, so its voices arrive at the jacks.
  // THE WHOLE ENGINE, not just the voices. GXW's runtime skips initStrudel for a host-supplied engine
  // and then waits for the pattern globals to appear; handed superdough alone it waited for something
  // superdough never registers, timed out, and never reached "loaded" — so nothing it played reached
  // anything. loadEngine starts the pattern scope AND superdough, pointed at this module's own jacks.
  const engineForGXW = async () => loadEngine(ctx, doughOut);

  // A NOTE FROM GXW, ONTO THE CABLE. GXW hands over what it knows — which jack, when, how long, what
  // pitch — and this puts it in the rack's units: volts rather than MIDI, with 0V at middle C, and an
  // explicit note-off so a voice tab knows when to release.
  //
  // The handle pairs the on with the off. Without one, two notes of the same pitch overlapping on one
  // jack would release together on the first off.
  const onNote = (n) => {
    if (!n || !Number.isFinite(n.at)) return;
    const midi = typeof n.note === 'number' ? n.note : null;
    if (midi === null) return;                       // a named pitch is GXW's to resolve, not ours
    const handle = handlePrefix + ':' + (seq++);
    const duration = Math.max(0.01, Number(n.duration) || 0.25);
    const level = typeof n.gain === 'number' ? Math.max(0, Math.min(1, n.gain)) : 0.8;
    // IN SAMPLE FRAMES, NOT SECONDS. The worklet compares an event's `at` against currentFrame, and a
    // context time handed over as seconds is a number so much smaller that every note reads as
    // already past: it fires at the top of the current block, and its note-off — also seconds —
    // fires in that SAME block. The pitch changes, because the note is applied; the gate rises and
    // falls inside one render quantum, so nothing downstream ever sees it. An envelope patched to
    // that gate simply never triggers, which is exactly how the fault presents.
    const frame = (t) => Math.round(t * ctx.sampleRate);
    noteNode.port.postMessage({ events: [
      { at: frame(n.at), handle, voice: n.voice, pitch: midiToVolts(midi), level, duration,
        pan: typeof n.pan === 'number' ? n.pan : 0 },
      { at: frame(n.at + duration), handle, voice: n.voice, off: true },
    ] });
  };

  // MOUNTED ONCE, LAZILY. Nothing loads until the module is asked to do something — a patch with a
  // GXW module on it that is never run should not pay for GXW's boot.
  let mountPromise = null;
  function mount() {
    if (mountPromise) return mountPromise;
    say('loading');
    if (mounted > 0) {
      mountPromise = null;
      lastError = 'another GXW is already open in this window; only one can run at a time';
      say('error');
      console.warn('[gxw] ' + lastError);
      return Promise.reject(new Error(lastError));
    }
    mounted++;
    mountPromise = loadGXW().then(async (mod) => {
      if (typeof mod.createGXW !== 'function') throw new Error('GXW exports no createGXW');
      pane = document.createElement('div');
      pane.className = 'gxw-pane';
      // OFF-SCREEN UNTIL OPENED, and off-screen means MOVED — not hidden, not collapsed. GXW keeps
      // running while its window is shut, which is what lets RUN work with the window never open, so
      // it needs somewhere real to live at a real size.
      //
      // `visibility: hidden` was not that. A hidden element still has a box, but revealing one is a
      // layout change, and GXW answers a layout change by resizing its canvas — which is itself a
      // layout change. The two chased each other: the renderer filled with "ResizeObserver loop
      // completed with undelivered notifications" and stopped answering altogether, so hard that the
      // debugger could not interrupt it. Mounting was never the problem; REVEALING was.
      //
      // Translating it costs no layout at all: the box keeps its size and position in the flow, and
      // only the compositor moves. Nothing resizes, so nothing observes a resize.
      pane.style.cssText = 'position:fixed;inset:0;z-index:1500;background:#111;'
        + 'transform:translateX(-200vw);pointer-events:none';
      document.body.appendChild(pane);
      gxw = await mod.createGXW({
        element: pane,
        audioContext: ctx,        // the rack's own, so GXW and the rack are one graph
        output: doughOut,         // ...and its sound arrives at this module's jacks
        loadStrudel: engineForGXW,
        onNote,
      });
      // AFTER GXW HAS PAINTED, not before. createGXW fills the element with GXW's own furniture by
      // setting innerHTML, which discards anything already inside it — the close bar included. It was
      // being added and then silently swept away.
      // Into GXW's toolbar if it has one; otherwise the floating strip. See closeButton.
      const toolbar = pane.querySelector('#canvas-toolbar');
      if (toolbar) {
        // AT THE FRONT, not the end. The toolbar is wider than the pane and clips, so a control
        // appended to it is off the right-hand edge and unreachable — which is worse than sitting on
        // top of something. The left end is always in view; it goes beside the hamburger, where the
        // two controls that are about leaving this view sit together.
        const btn = closeButton().firstChild;
        btn.style.marginRight = '10px';
        const hamburger = toolbar.querySelector('.gxw-menu-button');
        toolbar.insertBefore(btn, hamburger ? hamburger.nextSibling : toolbar.firstChild);
      } else {
        pane.appendChild(closeButton());
      }

      // IF THE PANE LEAVES THE DOCUMENT, GXW GOES WITH IT. The module's own dispose tears GXW down
      // properly, but nothing guarantees dispose is what removed the pane — a script, a stray
      // innerHTML, some future bit of chrome. When it was not, the element vanished and the
      // application carried on: transport counting, engine scheduling, notes still arriving at these
      // jacks, and no window anywhere to stop it from. That is a genuinely baffling fault to meet, so
      // the element's removal is treated as the same event as deleting the module.
      const watcher = new MutationObserver(() => {
        if (pane && !pane.isConnected) {
          watcher.disconnect();
          state.watcher = null;
          try { if (gxw && typeof gxw.dispose === 'function') gxw.dispose(); } catch (_e) { /* going anyway */ }
          mounted = Math.max(0, mounted - 1);
          mountPromise = null;
          gxw = null;
        }
      });
      watcher.observe(document.body, { childList: true });
      state.watcher = watcher;

      lastError = null;
      say('ok');
      if (score) applyScore(score);

      // ONE TRANSPORT, TWO VIEWS. The faceplate's RUN and GXW's own play control are the same state,
      // so GXW tells the module when it moves. The guard stops the echo: a change the module ITSELF
      // asked for must not be reported back as news, or the two drive each other in circles — which
      // is the same fault that made "Back to the rack" bounce, and it is worth only ever fixing once.
      if (typeof gxw.onTransport === 'function') {
        gxw.onTransport((playing) => {
          if (drivingTransport) return;
          running = playing;
          if (report) report('run', playing ? 'on' : 'off');
        });
      }
      return gxw;
    }).catch((e) => {
      mountPromise = null;
      mounted = Math.max(0, mounted - 1);
      lastError = (e && e.message) || String(e);
      say('error');
      console.warn('[gxw] ' + lastError);
      throw e;
    });
    return mountPromise;
  }

  // WHICH SCORE, NOT A COPY OF IT. The patch records the path of the score GXW has open; the score
  // itself lives in the shared library on disk, where the standalone app reads and writes the same
  // file. Storing the content here would make the patch a second, staler copy of something that
  // already has a home — and the two builds would then disagree about which was the real one.
  //
  // Held until GXW is up: a patch loads long before anyone presses a button, and the module mounts
  // lazily by design.
  function applyScore(path) {
    score = String(path || '');
    if (!gxw || !score) return;
    if (typeof gxw.openScorePath !== 'function') return;
    Promise.resolve(gxw.openScorePath(score))
      .catch((e) => console.warn('[gxw] could not open ' + score + ': ' + ((e && e.message) || e)));
  }

  // ONE DIRECTION ONLY, deliberately. Reporting GXW's path back to the rack fed itself: the report
  // was stored, a stored param is re-applied, applying it reopened the score, and reopening resolved
  // the path against the scores folder again — so each pass grew the string and the patch ended up
  // holding a path with the same folder in it six times over.
  //
  // Catching a score opened from GXW's own File menu needs a "score changed" signal from GXW and a
  // path that is stable under a round trip. Until both exist, the patch says which score to open and
  // does not try to follow along afterwards.

  // A WAY BACK. Opening was the whole gesture and there was nothing to undo it — GXW took the window
  // and kept it. It gets a strip of its own rather than borrowing GXW's chrome, because GXW's menu is
  // GXW's and a rack control does not belong inside it.
  function closeButton() {
    // IN GXW'S OWN TOOLBAR WHEN THERE IS ONE, floating only as a fallback. Floated over the top-right
    // it sat on the inspector's tabs and hid two of them — and there is nowhere on a full-window pane
    // to float it that is not on top of something. Costing a band of height instead would take back
    // exactly what hiding the menu bar just gave. So it joins the row of controls GXW already has,
    // beside the hamburger: no overlap, no height, and it reads as what it is — the way out.
    const bar = document.createElement('div');
    bar.className = 'gxw-pane-bar';
    bar.style.cssText = 'position:absolute;top:0;right:0;z-index:10;display:flex;align-items:center;'
      + 'gap:8px;padding:4px 8px;font:12px/1 -apple-system,system-ui,sans-serif;color:#c9c9d0';
    const btn = document.createElement('button');
    btn.type = 'button';
    // SHORT, AND IT MUST NOT WRAP. In GXW's toolbar the slot is narrow, and "Back to the rack" broke
    // across four lines and made the whole toolbar tall. The full sentence lives in the tooltip.
    btn.textContent = '\u21A9 Rack';
    btn.title = 'Back to the rack';
    btn.style.cssText = 'font:12px/1 -apple-system,system-ui,sans-serif;padding:5px 10px;'
      + 'white-space:nowrap;flex:0 0 auto;'
      + 'border-radius:5px;border:1px solid #6a6a72;background:#17171b;color:#c9c9d0;cursor:pointer';
    btn.addEventListener('click', () => setOpen(false));
    bar.appendChild(btn);
    return bar;
  }

  // ESCAPE CLOSES IT TOO, which is what a hand reaches for before it finds a button. Bound while the
  // window is open and unbound when it is not, so it cannot swallow an Escape meant for the rack.
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };

  // Two frames and a beat: long enough for GXW's own layout — its dividers, its editor — to reach a
  // size it agrees with, so that showing it is not also the first time anything measures it.
  const settled = () => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 350)));
  });

  function setOpen(open) {
    if (!pane) return;
    // See the pane's own comment: moved, never hidden or collapsed.
    pane.style.transform = open ? 'none' : 'translateX(-200vw)';
    pane.style.pointerEvents = open ? 'auto' : 'none';
    // The rack's own chrome stays out of the way while GXW has the window, and comes back after.
    document.body.classList.toggle('gxw-open', open);
    if (open) window.addEventListener('keydown', onKey, true);
    else window.removeEventListener('keydown', onKey, true);
    // NOTHING IS REPORTED BACK. Telling the rack `open: 'on'` made it STORE that, and a stored value
    // is re-applied — so closing the window put it back a moment later, which is exactly the loop
    // "Back to the rack" appeared to be stuck in. The window's openness lives here, in the module's
    // own state, and nowhere else; the param is a command, not a mirror.
  }

  return {
    getOutput: (id) => {
      if (id === 'audioOutL') return { node: doughL, index: 0 };
      if (id === 'audioOutR') return { node: doughR, index: 0 };
      // All eight share the one node; which jack a note leaves by rides in the message, not in the
      // connection. See onNote.
      return /^noteOut[1-8]$/.test(id) ? { node: noteNode, index: 0 } : null;
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
        // ONLY 'ON' BRINGS IT UP. This mounted on every application of the param, including the 'off'
        // the rack applies to every default when a module is added or a patch is loaded — so merely
        // having GXW on a patch booted the whole application, which is the opposite of the laziness
        // the mount was written for. A module that is already up still gets its pause.
        if (!running) {
          drive(() => gxw && gxw.pause && gxw.pause());
          return;
        }
        // MOUNTING ON FIRST USE. Pressing RUN is what a patch does to start the sequence with the
        // window never open, so it has to be able to bring GXW up by itself.
        mount().then(() => {
          drive(() => gxw && gxw.play && gxw.play());
        }).catch(() => { /* already reported through status */ });
        return;
      }
      if (id === 'open') {
        // No guard against a patch load is needed: `open` is declared TRANSIENT, so it is never
        // written into a patch and never applied by one. See the descriptor.
        if (value !== 'on') { setOpen(false); return; }
        // REVEALED ONLY ONCE IT HAS SETTLED. Showing GXW the instant createGXW resolved pegged the
        // renderer: its editor is a CodeMirror view whose scroller is still 0x0 at that moment, and
        // measuring one as it becomes visible sets off a resize loop the page never gets out of —
        // far enough under that the debugger cannot interrupt it. Mounting was never the problem and
        // neither was the reveal itself; the two together, with no frame in between, were.
        mount().then(settled).then(() => setOpen(true))
          .catch(() => { /* already reported through status */ });
        return;
      }
    },

    supports: (id) => ['run', 'open', 'score', 'status'].includes(id),

    dispose: () => {
      try { if (state.watcher) state.watcher.disconnect(); } catch (_e) { /* never made */ }
      try { if (gxw && typeof gxw.dispose === 'function') gxw.dispose(); } catch (_e) { /* going anyway */ }
      try { window.removeEventListener('keydown', onKey, true); } catch (_e) { /* never bound */ }
      try { if (pane) pane.remove(); } catch (_e) { /* already gone */ }
      document.body.classList.remove('gxw-open');
      try { noteNode.port.postMessage({ type: 'dispose' }); noteNode.disconnect(); } catch (_e) { /* gone */ }
      try { doughOut.disconnect(); doughSplit.disconnect(); doughL.disconnect(); doughR.disconnect(); } catch (_e) { /* gone */ }
      if (mountPromise) mounted = Math.max(0, mounted - 1);
      gxw = null; pane = null; mountPromise = null;
    },

    // How the rack hands the module its reporting channel — the name the rack actually calls, the
    // same one the Strudel module takes.
    onValueChange: (fn) => { report = fn; say(lastError ? 'error' : (gxw ? 'ok' : 'idle')); },

    // THE CABLE, HANDED IN WHEN IT IS PLUGGED. This is how a note reaches anything: the worklet keeps
    // a map of jack to cable, and the rack fills that map by calling this whenever one is patched or
    // a patch is loaded. Without it the map stays empty — so every note arrived at the worklet
    // correctly converted and was dropped for want of anywhere to go. A jack that accepts a cable, a
    // scope on the far end reading nothing, and no error anywhere to say why.
    //
    // WHICH JACK matters, because this module has eight of them. The id goes straight through; the
    // worklet files voice 1 under either `noteOut1` or `noteOut`, since the two modules that share
    // that processor name their first jack differently.
    attachNoteOut: (port, edge, portId) => {
      if (port) noteNode.port.postMessage({ noteOut: port, edge, port: portId || 'noteOut1' }, [port]);
      else noteNode.port.postMessage({ noteOutOff: edge });
    },
  };
}
