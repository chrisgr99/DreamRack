// strudel-processor.js — the far end of the pattern: notes placed at the sample they belong to.
//
// Strudel runs on the MAIN THREAD, in the same page, sharing this rack's audio context. It hands each
// pattern event to us with the context time it should sound at (see design/strudel-module.md). This
// worklet holds those events until their sample arrives and then posts them down the note cable.
//
// WHY A WORKLET AT ALL, when the pattern is already scheduled on the main thread: because the note
// cable is a worklet-to-worklet port, and because "when to sound" has to become a SAMPLE. Main-thread
// timers are late by a variable few milliseconds, which is exactly the smear the note transport was
// built to remove; a queue drained per block turns that into an exact position.

'use strict';

class StrudelProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Scheduled events, each already converted to a sample frame. Kept sorted by time — patterns are
    // handed to us in order, and an out-of-order arrival is rare enough to cost one insertion.
    this._q = [];
    // EVERY DESTINATION, PER JACK. Eight note outputs, V1 to V8, and each of them fans out — one
    // pattern can play eight instruments, and any one of those jacks can feed two tabs at once. So
    // this is a map of jack to (cable to port) rather than a single list: `.rack(3)` has to reach the
    // cables on V3 and no others.
    this._byPort = new Map();
    this.port.onmessage = (e) => {
      const d = e.data || {};
      if (d.noteOut) {
        const id = d.port || 'noteOut';
        if (!this._byPort.has(id)) this._byPort.set(id, new Map());
        this._byPort.get(id).set(d.edge, d.noteOut);
        if (d.noteOut.start) d.noteOut.start();
        return;
      }
      if (d.noteOutOff) {
        for (const m of this._byPort.values()) m.delete(d.noteOutOff);
        return;
      }
      if (d.events) {
        for (const ev of d.events) this._insert(ev);
        return;
      }
      // A pattern stopped, or the module was cleared: drop what has not sounded yet and silence what
      // has. Anything already sounding ends by its own duration, which is the failsafe.
      if (d.flush) this._q.length = 0;
    };
  }

  _insert(ev) {
    const q = this._q;
    let i = q.length;
    while (i > 0 && q[i - 1].at > ev.at) i--;
    q.splice(i, 0, ev);
  }

  // A voice number is a jack. TWO NAMES ARE ACCEPTED FOR THE FIRST ONE, because two modules use this
  // processor and they name that jack differently:
  //
  //   noteOut1  the plain numbering, which a module written after there were eight of them uses.
  //   noteOut   what the Strudel module's first jack has always been called, kept so a patch made
  //             before there were eight still finds its cable.
  //
  // Reconstructing only the second meant a note for voice 1 from a module using the first went
  // looking for cables that were registered under the other name and found none — the jack accepted
  // a cable, the scope on the far end read nothing, and voices 2 to 8 worked perfectly, which is
  // about as misleading as a fault can be.
  _post(voice, m) {
    const n = !voice ? 1 : voice;
    const outs = this._byPort.get('noteOut' + n)
      || (n === 1 ? this._byPort.get('noteOut') : null);
    if (!outs) return;                         // nothing patched to that jack; the note simply has nowhere to go
    for (const p of outs.values()) p.postMessage(m);
  }

  process(_inputs, outputs, _params) {
    // One channel of silence, for the same reason Sequence Out renders one: a worklet with no path to
    // the destination is not called at all, and this one must be called to deliver its queue.
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const n = out[0].length;
    const now = (typeof currentFrame === 'number' ? currentFrame : 0);
    const end = now + n;

    while (this._q.length && this._q[0].at < end) {
      const ev = this._q.shift();
      // LATE IS BETTER THAN MISSING. An event whose sample has already passed — the main thread was
      // busy, or a pattern was evaluated a moment too late — goes out at the start of this block
      // rather than being dropped. A note slightly late is a note; a note dropped is a hole.
      const at = ev.at < now ? now : ev.at;
      if (ev.off) this._post(ev.voice, { t: 'off', handle: ev.handle, time: at });
      else {
        this._post(ev.voice, { t: 'on', handle: ev.handle, time: at, pitch: ev.pitch, level: ev.level,
          duration: ev.duration, pan: ev.pan, bendRange: 2,
          // Only when the pattern asked: a lane nobody named should stay where the patch has it.
          ...(ev.timbre == null ? {} : { timbre: ev.timbre }),
          ...(ev.pressure == null ? {} : { pressure: ev.pressure }) });
        // The note flash on the cable, on the main thread's own port — one message per note, off the
        // audio path, exactly as Sequence Out does it.
        this.port.postMessage({ note: { handle: ev.handle } });
      }
    }
    return true;
  }
}

registerProcessor('wcoast-strudel', StrudelProcessor);
