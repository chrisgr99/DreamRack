// recorder.js — record the app window, with the patch's own audio, to a video file.
//
// Electron only. The picture comes from getDisplayMedia (the main process answers the
// surface prompt with our own window, so there is no picker). The SOUND is not captured
// from the screen at all — it is tapped straight off the audio graph through a
// MediaStreamAudioDestinationNode, which gives a sample-accurate feed of exactly what is
// reaching the speakers with no operating-system audio routing involved. That is both
// better quality than any screen-audio capture and the reason this works on macOS, where
// capturing system audio otherwise needs a virtual audio device.
//
// Data is streamed to disk a second at a time (see electron-main's record:* handlers)
// rather than accumulated and saved on stop, so a long take cannot exhaust memory.
//
// Output is WebM (VP9 + Opus where available). YouTube accepts WebM directly, so there
// is no conversion step.

'use strict';

// Screen content is the hard case for a video encoder: DreamRack is hairlines, 2 mm
// legends and thin cables, all of which smear at the bitrate a recorder picks by
// default. This is deliberately generous.
const VIDEO_BITS_PER_SECOND = 12_000_000;
const AUDIO_BITS_PER_SECOND = 192_000;
const CHUNK_MS = 1000;               // one file append per second

// Preference order. The first supported entry wins; an empty string lets the browser
// choose, which is the last resort rather than the default.
const MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  '',
];

function pickMime() {
  for (const m of MIME_CANDIDATES) {
    if (!m) return '';
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}`;
}

export class Recorder {
  // audioTaps() returns the AudioNodes that feed the speakers — every one of them is
  // connected to the recording destination, so the take contains what you actually
  // heard rather than only the mixer's master.
  constructor(ctx, audioTaps, { onState = () => {} } = {}) {
    this.ctx = ctx;
    this.audioTaps = audioTaps;
    this.onState = onState;
    this.recording = false;
    this.startedAt = 0;
    this.filePath = null;
    this._rec = null;
    this._dest = null;
    this._screen = null;
    this._tapped = [];
    this._pending = Promise.resolve();
  }

  available() { return !!(window.wcoast && window.wcoast.isElectron && window.wcoast.record && typeof MediaRecorder !== 'undefined'); }

  elapsedMs() { return this.recording ? Date.now() - this.startedAt : 0; }

  async start() {
    if (this.recording || !this.available()) return null;

    // Open the file first. It lands in Downloads under a timestamped name — no dialog at
    // either end, because the point of the shortcut is that a take starts the moment you
    // ask for it.
    const begun = await window.wcoast.record.begin(`DreamRack ${stamp()}.webm`);
    if (!begun || !begun.path) return null;
    this.filePath = begun.path;

    try {
      this._screen = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 60 },
        audio: false,                 // the graph supplies the sound, not the screen
      });
    } catch (err) {
      await window.wcoast.record.cancel();
      this.filePath = null;
      throw err;
    }

    // Tap the audio graph in parallel with the speakers. connect() is a fan-out, so
    // nothing about what you hear changes.
    this._dest = this.ctx.createMediaStreamDestination();
    this._tapped = [];
    for (const node of this.audioTaps() || []) {
      if (!node) continue;
      try { node.connect(this._dest); this._tapped.push(node); } catch (_e) { /* already gone */ }
    }

    const stream = new MediaStream([
      ...this._screen.getVideoTracks(),
      ...this._dest.stream.getAudioTracks(),
    ]);

    const mimeType = pickMime();
    this._rec = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
    });

    // Appends are serialised: MediaRecorder can deliver the next blob before the last
    // write resolves, and out-of-order appends would corrupt the file.
    this._rec.ondataavailable = (e) => {
      if (!e.data || !e.data.size) return;
      this._pending = this._pending
        .then(() => e.data.arrayBuffer())
        .then((buf) => window.wcoast.record.chunk(new Uint8Array(buf)))
        .catch(() => { /* a dropped chunk must not break the chain */ });
    };

    // The user can also stop the capture from the operating system's sharing UI; treat
    // that as a stop rather than leaving a recorder running against a dead track.
    for (const t of this._screen.getVideoTracks()) t.addEventListener('ended', () => { this.stop(); });

    this._rec.start(CHUNK_MS);
    this.recording = true;
    this.startedAt = Date.now();
    this.onState(this);
    return this.filePath;
  }

  async stop() {
    if (!this.recording) return null;
    this.recording = false;

    await new Promise((resolve) => {
      this._rec.onstop = resolve;
      try { this._rec.stop(); } catch (_e) { resolve(); }
    });
    await this._pending;                       // let the last appends land

    this._teardown();
    const done = await window.wcoast.record.end();
    const filePath = (done && done.path) || this.filePath;
    this.filePath = null;
    this.onState(this);
    return filePath;
  }

  _teardown() {
    for (const node of this._tapped) { try { node.disconnect(this._dest); } catch (_e) { /* gone */ } }
    this._tapped = [];
    if (this._screen) { for (const t of this._screen.getTracks()) { try { t.stop(); } catch (_e) { /* gone */ } } }
    this._screen = null;
    this._dest = null;
    this._rec = null;
  }
}
