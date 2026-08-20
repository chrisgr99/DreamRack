// host/demo/voice.js — playing the pre-rendered narration.
//
// Fragments are rendered ahead of time (tools/render-speech.mjs) and shipped with the app, so
// playback never shells out to anything and never depends on which voices the listener has
// installed — which also means the browser build gets narration, where the Mac's own speech
// synthesiser does not exist.
//
// NOTHING IS EVER TIME-STRETCHED. A fragment plays at its natural speed and the timeline waits for
// it: the speech sets the floor, and a demo's rate multiplier squeezes the silences around it. That
// is why the narration is cut into small fragments — one per note, plus the gesture phrases — so
// each can be placed on cue instead of one long track everything has to stay in sync with.
//
// The voice goes through the audio graph rather than straight to the speakers, so a recorded reel
// contains it: the node registers itself as one of the rack's recording taps.
'use strict';

import { speechId } from './speech-id.js';

const INDEX_URL = 'demos/speech/index.json';
const FILE_DIR = 'demos/speech/';

// VOLUME ABOVE UNITY, THEN A LIMITER. The rendered speech is quiet — `say` leaves plenty of headroom —
// and it plays against a patch, so at 0.9 it sat under the music.
//
// The lift used to be 2.2, and that was past the ceiling. Fragments peak at about -3 dB, so 0.7 of
// full scale; 0.7 x 2.2 is 1.5, and everything above 1.0 arrives at the output as a flat top. A take
// measured 3.35% of its samples pinned there, in 2,520 flat runs of ten samples or more — heard as a
// buzz riding the voice and stopping when the voice stops. It was in the app as well as in the
// recordings, since this is the signal both are fed from.
//
// So the lift is smaller and a limiter stands behind it. The limiter is the part that matters: it
// means no fragment can clip regardless of how hot it was rendered, which a fixed number alone can
// never promise — the next voice, or the next `say` version, renders at whatever level it likes.
export function createVoice(getCtx, { register = null, volume = 1.3 } = {}) {
  let index = null;                  // id -> { file, secs, text }
  let loading = null;
  let gain = null;         // the head of the narration chain: gain -> limiter -> ceiling -> out
  const buffers = new Map();         // id -> AudioBuffer (decoded on first use)
  let current = null;                // the source now playing, so it can be cut off
  // PAUSING A SENTENCE. A buffer source cannot be frozen — it can only be stopped — so a pause notes
  // which line was speaking and how far in, and a resume starts the same buffer again from that
  // offset. The line is heard from where it left off rather than from the top, which is what the
  // viewer expects when they stop to look at something mid-sentence.
  let held = null;                   // { buf, offset, resolve } while paused mid-line
  let enabled = true;

  // FRESH AT THE START OF EVERY RUN. The index was read once and kept for the life of the window, so a
  // line rendered while the app was open stayed silent until the app was restarted — and a silent line
  // is indistinguishable from a demo that did not change. Authoring is exactly the case this exists
  // for, so the index is re-read per run and the decoded buffers are dropped with it.
  const reload = () => { index = null; loading = null; buffers.clear(); };

  // BUILT NOW, NOT AT THE FIRST WORD. The recorder collects what it should capture when it starts, and
  // this node used to be created by the first line spoken — after that moment — so a take carried the
  // patch and none of the narration. It costs one silent gain node to have it waiting.
  const prime = () => { try { out(); } catch (_e) { /* no context yet; out() will build it later */ } };

  const ready = () => {
    if (!loading) {
      loading = fetch(`${INDEX_URL}?t=${Date.now()}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { index = (j && j.fragments) || null; })
        .catch(() => { index = null; });   // no narration rendered yet is a normal state, not an error
    }
    return loading;
  };

  function out() {
    const ctx = getCtx();
    if (!ctx) return null;
    if (!gain) {
      gain = ctx.createGain();
      gain.gain.value = volume;

      // Peaks held down before they reach the ceiling. Fast enough to catch a plosive, slow enough
      // to release between words rather than pumping on every syllable.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;

      // AND A CEILING BEHIND THE LIMITER. A compressor has attack time, so the very first edge of a
      // sharp transient passes before it acts; this curve is a soft saturation that cannot output
      // more than 1 whatever it is given, so that edge rounds instead of squaring off. It is doing
      // nothing at all on ordinary speech, which is the point — it is the backstop, not the sound.
      const ceiling = ctx.createWaveShaper();
      const n = 2048, curve = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        curve[i] = Math.tanh(x * 1.4) / Math.tanh(1.4);
      }
      ceiling.curve = curve;
      ceiling.oversample = '4x';

      gain.connect(limiter); limiter.connect(ceiling); ceiling.connect(ctx.destination);
      // THE RECORDING TAPS THE END OF THE CHAIN, not the gain. Registering the gain would have put
      // the unlimited signal in the take — the very thing that was being fixed — while the speakers
      // heard the limited one.
      if (register) register(ceiling);
    }
    return gain;
  }

  async function bufferFor(id) {
    if (buffers.has(id)) return buffers.get(id);
    const ctx = getCtx();
    const entry = index && index[id];
    if (!ctx || !entry) return null;
    try {
      const res = await fetch(FILE_DIR + entry.file);
      if (!res.ok) return null;
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      buffers.set(id, buf);
      return buf;
    } catch (_e) { buffers.set(id, null); return null; }
  }

  // How long `text` takes to say, from the index — known before a note goes up, which is what lets
  // a note's hold default to the length of its own narration.
  async function secondsFor(text) {
    if (!text || !enabled) return 0;
    await ready();
    const e = index && index[speechId(text)];
    return e ? Number(e.secs) || 0 : 0;
  }

  // Speak `text` and resolve when it has finished. Resolves immediately, and silently, when the
  // fragment has not been rendered — an unrendered line should not stall a demo.
  async function speak(text) {
    if (!text || !enabled) return 0;
    await ready();
    const id = speechId(text);
    const buf = await bufferFor(id);
    const ctx = getCtx(), dst = out();
    if (!buf || !ctx || !dst) return 0;
    // A SUSPENDED CONTEXT MAKES THE WHOLE DEMO SILENT, and silently so: the buffer plays into
    // nothing, the backstop timer resolves on schedule, and the run looks like a demo whose
    // narration was never rendered. The context is suspended until something asks for sound, and a
    // demo that turns no sound on — a video demo has nothing to hear — never asks. Narration is not
    // the patch's sound and must not depend on it, so resume here. Pressing Run is the user gesture
    // that permits it.
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (_e) { /* speak silently */ } }
    stop();
    return new Promise((resolve) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(dst);
      src._startedAt = ctx.currentTime;      // so a pause knows how far in the line had got
      src._resolve = resolve;
      current = src;
      src.onended = () => { if (current === src) current = null; resolve(buf.duration); };
      src.start();
      // onended does not fire if the context is suspended or the node is cut short by stop(); the
      // timer is the backstop so a demo never parks waiting on a voice that has gone quiet.
      // The backstop cannot fire blind any more: a line held by a pause has not finished, and
      // resolving it would let the demo walk on while the sentence was still waiting to be resumed.
      setTimeout(() => { if (held) return; if (current === src) { current = null; } resolve(buf.duration); }, (buf.duration + 0.5) * 1000);
    });
  }

  function stop() { held = null; if (current) { try { current.stop(); } catch (_e) { /* already done */ } current = null; } }

  // Freeze or restart the voice. Returns whether it is now paused.
  function setPaused(on) {
    const ctx = getCtx();
    if (on) {
      if (current && ctx) {
        const played = ctx.currentTime - (current._startedAt || ctx.currentTime);
        held = { buf: current.buffer, offset: Math.max(0, Math.min(current.buffer.duration - 0.01, played)), resolve: current._resolve };
        try { current.onended = null; current.stop(); } catch (_e) { /* already done */ }
        current = null;
      }
      return true;
    }
    if (held && ctx) {
      const dst = out();
      const src = ctx.createBufferSource();
      src.buffer = held.buf; src.connect(dst);
      src._startedAt = ctx.currentTime - held.offset;
      src._resolve = held.resolve;
      const done = held.resolve;
      src.onended = () => { if (current === src) current = null; if (done) done(held ? 0 : 0); };
      current = src;
      src.start(0, held.offset);
      held = null;
    }
    return false;
  }
  function setEnabled(on) { enabled = !!on; if (!enabled) stop(); }
  function isAvailable() { return !!index; }

  return { speak, secondsFor, stop, setPaused, setEnabled, isAvailable, ready, reload, prime };
}
