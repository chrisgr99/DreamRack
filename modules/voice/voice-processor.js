// voice-processor.js — the unbundler, now that a note is an event rather than seven channels.
//
// It was a ChannelSplitter, which was exactly right while the bundle was channels. A note is now a
// message — a handle, the sample it began on, and what it holds — so this end has to turn a stream of
// those back into the voltages a page is patched from: gate, pitch, bend, level, duration, pan.
//
// WHY THE CABLE IS STILL A WEB AUDIO CONNECTION. It carries one channel of silence and no data. Two
// reasons, and the first is not negotiable: a worklet that reaches the destination through nothing is
// not rendered, so a Sequence Out whose only link to this module was a message port would simply stop
// being called. The second is that the patchbay, the patch file, the cable and the tab port all go on
// meaning what they meant — the edge is still an edge.
//
// THE EVENTS ARRIVE ON THEIR OWN PORT, handed to both ends by the rack when the cable is made. Worklet
// to worklet, never through the main thread, whose scheduling jitter under load is measured in
// milliseconds and would land on every note.
//
// AND THEY ARE PLACED BY THEIR TIMESTAMP, ONE BLOCK LATE. A gate edge at sample i cannot be known
// before its block has been processed, so acting on arrival makes a note late by however far into the
// block the edge fell — nothing to 2.7ms, and VARIABLE, which smears rhythm rather than delaying it.
// Deferring by exactly one block and placing each event at its own sample turns that into constant
// latency, which nobody can hear.

'use strict';

const DEFER = 128;          // one block: what buys the schedule its accuracy
const RAMP = 128;           // samples an update takes to reach its value — one update interval
const OUT = { GATE: 0, PITCH: 1, BEND: 2, LEVEL: 3, DUR: 4, PAN: 5 };

class VoiceProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._q = [];             // events waiting for their sample
    this._note = null;        // the one sounding note (mono until allocation lands)
    this._bend = 0; this._bendTo = 0; this._bendStep = 0; this._bendLeft = 0;
    this._pitch = 0; this._level = 0; this._dur = 0; this._pan = 0;
    // The rack hands us one end of a channel to Sequence Out. Until then nothing plays, which is
    // correct: an unpatched Voice In has no notes to make.
    this.port.onmessage = (e) => {
      const d = e.data || {};
      if (d.noteIn) {
        this._in = d.noteIn;
        this._in.onmessage = (ev) => { const m = ev.data; if (m) this._q.push(m); };
        this._in.start && this._in.start();
      }
      if (d.noteIn === null && this._in) { this._in.onmessage = null; this._in = null; this._q.length = 0; }
    };
  }

  _apply(m) {
    if (m.t === 'on') {
      this._note = { handle: m.handle, endFrame: m.time + Math.round(m.duration * sampleRate) };
      this._pitch = m.pitch; this._level = m.level; this._dur = m.duration; this._pan = m.pan;
      // Bend belongs to the note that is starting, so it begins at nothing however the last one ended.
      this._bend = 0; this._bendTo = 0; this._bendLeft = 0; this._bendStep = 0;
    } else if (m.t === 'off') {
      if (this._note && this._note.handle === m.handle) this._note = null;
    } else if (m.t === 'u') {
      if (!this._note || this._note.handle !== m.handle) return;
      // Linear over one update interval, so the steps between updates never reach the output. A
      // filter would lag and blunt a fast move; this only delays it by the interval itself.
      if (m.k === 'bend') { this._bendTo = m.v; this._bendLeft = RAMP; this._bendStep = (m.v - this._bend) / RAMP; }
    }
  }

  process(_inputs, outputs) {
    const out = outputs[0] ? outputs : null;
    if (!out || !outputs[OUT.GATE] || !outputs[OUT.GATE][0]) return true;
    const n = outputs[OUT.GATE][0].length;
    const base = (typeof currentFrame === 'number' ? currentFrame : 0);

    const g = outputs[OUT.GATE][0], p = outputs[OUT.PITCH][0], b = outputs[OUT.BEND][0];
    const l = outputs[OUT.LEVEL][0], d = outputs[OUT.DUR][0], pn = outputs[OUT.PAN][0];

    for (let i = 0; i < n; i++) {
      const f = base + i;
      // Everything due by now, in the order it was sent. The queue is short — a few events a second —
      // so scanning it per sample costs nothing and keeps the placement exact.
      while (this._q.length && this._q[0].time + DEFER <= f) this._apply(this._q.shift());

      // DURATION ENDS A NOTE THAT WAS NEVER ENDED. It is the failsafe the protocol is built on: an
      // off that never arrives cannot leave a voice sounding for ever.
      if (this._note && f >= this._note.endFrame + DEFER) this._note = null;

      if (this._bendLeft > 0) { this._bend += this._bendStep; this._bendLeft--; if (this._bendLeft === 0) this._bend = this._bendTo; }

      g[i] = this._note ? 1 : 0;
      // The held values stay on the wire after the gate closes: a voice reading pitch during its own
      // release should find the note it is releasing, not silence.
      p[i] = this._pitch; b[i] = this._bend; l[i] = this._level; d[i] = this._dur; pn[i] = this._pan;
    }
    return true;
  }
}

registerProcessor('wcoast-voice', VoiceProcessor);
