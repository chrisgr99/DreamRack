// superdough.js — ONE superdough, started once, sending its voices where the host says.
//
// Superdough is a singleton by construction: one audio controller, one output stage, one registry of
// sounds. That was invisible while the Strudel module was the only thing that started it, so the
// knowledge of how to start it lived inside that module's factory. It cannot stay there. GXW makes
// sound through superdough too, and GXW arriving as a module means two callers — and, worse, two
// different copies if each imports its own (GXW's comes from npm, DreamRack's is vendored). Two
// copies is not one singleton with two owners; it is two singletons, each with its own output stage
// and its own registered sounds, neither aware of the other.
//
// So there is one place that knows: this file. It imports the vendored bundle, starts it on the
// context it is given, and points its output at the node it is given rather than at the speakers.
// The rack's group-singleton rule — only one of Strudel or GXW on a patch at a time — is what keeps
// the "where its output goes" answer unambiguous.
//
// LAZY, still. 113 kB that a patch playing nothing but rack voices never pays for, so nothing here
// runs until something asks for a sound superdough owns.

'use strict';

// Strudel's OWN sound engine. See vendor/README.md.
const SUPERDOUGH = '../vendor/superdough-dreamrack.mjs';
// The pattern language, whose evalScope is what puts `note`, `s` and the rest on globalThis.
const STRUDEL = '../vendor/strudel-dreamrack.mjs';
// A kit beside the bundle, when one has been dropped there: what makes the desktop build play a drum
// with no network. Absent, `samples()` in a pattern fetches a pack as it does in Strudel itself.
const LOCAL_SAMPLES = '../vendor/samples/';

let doughPromise = null;
// OFF THE SPEAKERS AND ONTO A JACK. superdough builds its own path to the destination on first use;
// this takes the last node of that path, disconnects it, and hands its signal to the caller instead.
//
// SEPARATE FROM THE LOADING, because the two happen at different times. The load happens once — it is
// memoised below — but the question of WHERE the sound goes is answered again every time the owner
// changes. Delete the Strudel module and add GXW, and superdough is already loaded; without this the
// new owner would inherit the deleted module's node and play into a gain nothing is listening to.
export function pointSuperdoughAt(sd, out) { return pointOutputAt(sd, out); }

function pointOutputAt(sd, out) {
  if (!sd || !out) return false;
  try {
    const ctl = sd.getSuperdoughAudioController && sd.getSuperdoughAudioController();
    const g = ctl && ctl.output && ctl.output.destinationGain;
    if (!g) { console.warn('[superdough] output stage not found; its voices go straight out'); return false; }
    try { g.disconnect(); } catch (_e) { /* not connected yet */ }
    g.connect(out);
    return true;
  } catch (_e) { return false; }   // older build: leave it as it is
}

// LOADED ONCE, POINTED EVERY TIME. A second call with a different node is not a mistake to ignore —
// it is the new owner asking for the sound, which is what the singleton rule allows one of at a time.
export function loadSuperdough(ctx, out) {
  if (doughPromise) return doughPromise.then((sd) => { pointOutputAt(sd, out); return sd; });
  if (!doughPromise) {
    doughPromise = import(SUPERDOUGH).then(async (sd) => {
      if (sd.setAudioContext) sd.setAudioContext(ctx);
      if (sd.initAudio) { try { await sd.initAudio(); } catch (_e) { /* the rack owns resuming */ } }
      // ITS SYNTHS HAVE TO BE REGISTERED. Without this, `s("sawtooth")` reports that the sound was
      // not found — the first thing anyone meets, and it looks like a broken bundle rather than a
      // missing line.
      try { sd.registerSynthSounds && sd.registerSynthSounds(); } catch (_e) { /* older build */ }
      try { sd.registerZZFXSounds && sd.registerZZFXSounds(); } catch (_e) { /* not in this build */ }
      // A PATTERN MAY LOAD ITS OWN SAMPLES, as it would in Strudel — `samples('github:...')` — so the
      // loader is put where a pattern can reach it rather than kept inside this module.
      for (const name of ['samples', 'registerSound', 'registerSynthSounds', 'aliasBank']) {
        if (typeof sd[name] === 'function') globalThis[name] = sd[name].bind(sd);
      }
      // OFF THE SPEAKERS AND ONTO THE JACK. superdough builds its own path to the destination on
      // first use; this takes the last node of it, disconnects that path, and hands its signal to the
      // rack instead. Done after init, because the output stage does not exist until then.
      pointOutputAt(sd, out);
      // A kit shipped beside the bundle, if there is one. Missing is the normal case in the browser.
      try {
        const url = new URL(LOCAL_SAMPLES + 'strudel.json', import.meta.url).href;
        const res = await fetch(url);
        if (res.ok) await sd.samples(await res.json(), new URL(LOCAL_SAMPLES, import.meta.url).href);
      } catch (_e) { /* no local kit; patterns can still fetch their own */ }
      return sd;
    }).catch((e) => { doughPromise = null; throw e; });
  }
  return doughPromise;
}


// ---- THE WHOLE ENGINE, not just its voices --------------------------------------------------------
//
// loadSuperdough above starts the SOUND. That is all the Strudel module needs from here, because it
// loads the pattern language itself. GXW needs both — and asking it for only half is what made it
// silent inside the rack: its runtime skips initStrudel when a host supplies an engine (calling it
// would set up a second output stage and undo the host's routing), then waits for `window.note` to
// appear, which superdough alone never registers. The wait timed out, the runtime never reached
// "loaded", and nothing GXW played reached anything at all.
//
// So a host that is handing an engine to something that expects @strudel/web hands it a whole one:
// the pattern scope registered, superdough started and pointed at the caller's node, and the two
// returned together under the names that package uses.
let enginePromise = null;

export function loadEngine(ctx, out) {
  if (enginePromise) return enginePromise.then((eng) => { pointOutputAt(eng, out); return eng; });
  enginePromise = (async () => {
    const S = await import(STRUDEL);
    // THE RACK'S OWN LANES, AND `rack`, as real controls. Without these a pattern using one dies with
    // "timbre is not a function" — and the same registration serves whatever asks for the scope.
    try { if (S.core && S.core.createParams) S.core.createParams('timbre', 'press', 'rack'); } catch (_e) { /* older build */ }
    // THE GLOBALS. `note`, `s`, `stack` and the rest have to exist before any pattern is evaluated —
    // and, for GXW, before its runtime will admit the engine started at all.
    await S.evalScope(S.core, S.mini);
    const sd = await loadSuperdough(ctx, out);
    // ONE OBJECT WEARING @strudel/web's NAMES. The caller reads `superdough` off it and looks for
    // `initStrudel`; the absence of initStrudel is deliberate and its own signal — this engine is
    // already started, and starting it again is exactly what must not happen.
    const engine = Object.create(null);
    for (const k of Object.keys(S)) { try { engine[k] = S[k]; } catch (_e) { /* a getter that objects */ } }
    engine.superdough = sd.superdough;
    engine.getSuperdoughAudioController = sd.getSuperdoughAudioController;
    engine.setAudioContext = sd.setAudioContext;
    engine.samples = sd.samples;
    engine.registerSound = sd.registerSound;
    engine.registerSynthSounds = sd.registerSynthSounds;
    engine.aliasBank = sd.aliasBank;
    return engine;
  })().catch((e) => { enginePromise = null; throw e; });
  return enginePromise;
}
