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
// A VOICE TAKEN WHILE IT IS STILL SOUNDING HAS TO RETRIGGER, and a gate that never falls is not an
// edge. Without this the note is replaced under a gate that stays up, nothing downstream strikes
// again, and what you hear is the FIRST note decaying while its successors pass silently through —
// which is exactly what a held sequence sounded like. So the gate breaks for a moment first.
//
// Not in GLIDE or LEGATO: not restarting the note is the whole point of both.
const RETRIG = 48;          // samples the gate is held low — a millisecond, enough for any trigger
// A FINISHED VOICE FALLS SILENT. Pitch is held after a note ends, so a voice in its release still
// reads the note it is releasing — but LEVEL is an amplitude, and holding that up means a voice whose
// note is over goes on sounding for ever. With the level lane driving a gate, that is voices piling
// up on each other rather than a line of notes. It falls over a couple of milliseconds rather than
// at once, because a step to zero is a click.
const LEVEL_FALL = 96;
const RAMP = 128;           // samples an update takes to reach its value — one update interval
const OUT = { GATE: 0, PITCH: 1, BEND: 2, LEVEL: 3, DUR: 4, PAN: 5 };
const LANES = 6;
const MAX_VOICES = 8;       // the panel's ceiling, and how many output groups this node carries

// ---- ALLOCATION -------------------------------------------------------------------------------
// One set of outputs per voice, in groups of six: group k is the note the k-th copy of the page is
// playing. The panel's own jacks are group ZERO, so a page that has not been duplicated behaves
// exactly as it did — which is what makes POLY 1 indistinguishable from before this existed.
//
// ROLLOVER is what gives when a note arrives and no voice is free — except for LEGATO, which changes
// ALLOCATION ITSELF and is the reason this is worth reading.
//
// GLIDE and LEGATO are two different things, and calling both of them legato is what confuses them.
//
//   GLIDE KEEPS ONE VOICE AND USES ONLY ONE, however high POLY is set. The gate stays up and the
//   pitch travels to each new note over TIME. Portamento.
//
//   Using one is the point: at two voices every other note would find the second one free, start
//   fresh with no glide at all, and half the line would slide while half jumped. A glide between two
//   independent voices is not a glide.
//
//   LEGATO HANDS OVER, BETWEEN TWO VOICES AND NO MORE. Notes alternate between a pair: the one being
//   left fades out while the new one fades in over TIME. Two is all the mode can use — a third voice
//   has nothing to do, because only one note is ever giving way to one other — so POLY above two is
//   ignored here rather than pretended into.
//
//   At POLY 1 there is no pair, so the notes simply BUTT: the old one ends exactly as the new one
//   begins. Clean, and the closest a single voice can come to a slur without a crossfade.
//
// The second is what a wind instrument actually does. Changing the length of a vibrating column does
// not move the pitch: one resonance dies while the next establishes, which is why a slurred saxophone
// line sounds nothing like a portamento. It is also the VL1-m's alternating mono mode, which is where
// the pair comes from.
//
// OLDEST at POLY 1 is simply retrigger, QUIETEST comes to the same, and IGNORE is a drum machine that
// cannot be interrupted.
const ROLLOVER = ['oldest', 'quietest', 'ignore', 'glide', 'legato'];

class VoiceProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'poly', defaultValue: 1, minValue: 1, maxValue: MAX_VOICES, automationRate: 'k-rate' },
      { name: 'rollover', defaultValue: 0, minValue: 0, maxValue: 4, automationRate: 'k-rate' },
      { name: 'time', defaultValue: 0.06, minValue: 0, maxValue: 2, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this._q = [];             // events waiting for their sample
    // One slot per possible voice. `note` is what it is playing, `started` when, and the ramp state
    // belongs to the slot rather than to the module, since each is bending its own note.
    this._v = Array.from({ length: MAX_VOICES }, () => ({
      note: null, started: -1,
      pitch: 0, level: 0, dur: 0, pan: 0,
      pitchTo: 0, pitchStep: 0, pitchLeft: 0,   // the glide, when a voice is carried to a new note
      levelTo: 0, levelStep: 0, levelLeft: 0,   // the crossfade, over the overlap
      hold: 0,                                  // samples this voice keeps its gate up after being left
      retrig: 0,                                // samples the gate is held low, to make an edge
      bend: 0, bendTo: 0, bendStep: 0, bendLeft: 0,
    }));
    this._last = -1;          // which voice took the last note, for LEGATO's round-robin
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

  _slotOf(handle) {
    for (let i = 0; i < MAX_VOICES; i++) if (this._v[i].note && this._v[i].note.handle === handle) return i;
    return -1;
  }

  // Which voice a new note takes. A free one if there is any — lowest first, so a monophonic page
  // always uses slot zero and its jacks are the ones the panel shows.
  _choose(poly, rollover) {
    // GLIDE is monophonic by nature — see above. One voice, always carried, never restarted.
    if (rollover === 'glide') return { i: 0, legato: !!this._v[0].note };
    for (let i = 0; i < poly; i++) if (!this._v[i].note) return { i, legato: false };
    if (rollover === 'ignore') return null;
    if (rollover === 'quietest') {
      // Furthest into its own decay: the note whose remaining life is shortest.
      let best = 0, least = Infinity;
      for (let i = 0; i < poly; i++) {
        const left = this._v[i].note.endFrame - this._v[i].started;
        if (left < least) { least = left; best = i; }
      }
      return { i: best, legato: false };
    }
    let best = 0, oldest = Infinity;
    for (let i = 0; i < poly; i++) if (this._v[i].started < oldest) { oldest = this._v[i].started; best = i; }
    return { i: best, legato: false };
  }

  // LEGATO's own allocation: alternate between two voices, and let the one before go. Used whatever is
  // free, which is what makes the hand-over happen on every note rather than only when full.
  _handOver(poly) {
    const pair = Math.min(2, poly);        // two is all this mode can use
    const i = (this._last + 1) % pair;
    // At one voice there is no pair to alternate with: the note is retriggered and the old one ends
    // exactly there, which is a butt join rather than a crossfade.
    return { i, legato: pair > 1, release: this._last };
  }

  _apply(m, poly, rollover, glide, overlap) {
    if (m.t === 'on') {
      const pick = rollover === 'legato' ? this._handOver(poly) : this._choose(poly, rollover);
      if (!pick) return;                     // IGNORE: the note is dropped, and nothing else changes
      // The voice being handed over from is RELEASED, not cut: its gate falls and its own envelope
      // takes it down while the new note comes up. That overlap is the legato.
      // THE OVERLAP IS A CROSSFADE, not a hold followed by a cut. The voice being left FADES OUT over
      // TIME while the new one FADES IN over the same span, both on the level lane — so what you hear
      // is one note giving way to another rather than two at full strength and then a drop.
      //
      // Holding the old note at full level and releasing it at the end was the first attempt, and it
      // sounded like exactly what it was.
      if (pick.release !== undefined && pick.release >= 0 && pick.release !== pick.i) {
        const prev = this._v[pick.release];
        if (prev.note) {
          if (overlap > 0) {
            prev.hold = overlap;
            prev.note = { ...prev.note, endFrame: m.time + overlap };
            prev.levelTo = 0; prev.levelLeft = overlap; prev.levelStep = -prev.level / overlap;
          } else prev.note = null;
        }
      }
      this._last = pick.i;
      const v = this._v[pick.i];
      // Taking a voice that is still sounding: break the gate so the strike happens again. A voice
      // that was free needs nothing — its gate is already down.
      if (v.note && !pick.legato) v.retrig = RETRIG;
      v.note = { handle: m.handle, endFrame: m.time + Math.round(m.duration * sampleRate), legato: pick.legato };
      v.started = m.time;
      // GLIDE: the pitch travels rather than jumps, over the same TIME. Only when this voice is being
      // CARRIED to the note — a voice starting fresh has nowhere to travel from.
      if (pick.legato && glide > 0) {
        v.pitchTo = m.pitch; v.pitchLeft = glide; v.pitchStep = (m.pitch - v.pitch) / glide;
      } else { v.pitch = m.pitch; v.pitchLeft = 0; }
      // Fading in over the same span, from silence, when this is a hand-over.
      if (pick.legato && overlap > 0) {
        v.level = 0; v.levelTo = m.level; v.levelLeft = overlap; v.levelStep = m.level / overlap;
      } else { v.level = m.level; v.levelLeft = 0; }
      v.dur = m.duration; v.pan = m.pan;
      // Bend belongs to the note that is starting, so it begins at nothing however the last one ended.
      v.bend = 0; v.bendTo = 0; v.bendLeft = 0; v.bendStep = 0;
    } else if (m.t === 'off') {
      const i = this._slotOf(m.handle);
      if (i >= 0) this._v[i].note = null;
    } else if (m.t === 'u') {
      const i = this._slotOf(m.handle);
      if (i < 0) return;
      const v = this._v[i];
      // Linear over one update interval, so the steps between updates never reach the output. A
      // filter would lag and blunt a fast move; this only delays it by the interval itself.
      if (m.k === 'bend') { v.bendTo = m.v; v.bendLeft = RAMP; v.bendStep = (m.v - v.bend) / RAMP; }
    }
  }

  process(_inputs, outputs, params) {
    if (!outputs[OUT.GATE] || !outputs[OUT.GATE][0]) return true;
    const n = outputs[OUT.GATE][0].length;
    const base = (typeof currentFrame === 'number' ? currentFrame : 0);
    const poly = Math.max(1, Math.min(MAX_VOICES, Math.round(params.poly ? params.poly[0] : 1)));
    const rollover = ROLLOVER[Math.round(params.rollover ? params.rollover[0] : 0)] || 'oldest';
    // One control, two readings of the same question — see the descriptor. In GLIDE it is how long the
    // pitch takes to travel; in LEGATO it is how long the voice being left goes on sounding.
    const timeS = params.time ? params.time[0] : 0;
    const samples = Math.max(0, Math.round(timeS * sampleRate));
    const glide = rollover === 'glide' ? samples : 0;
    // The crossfade needs two voices to fade between. At POLY 1 legato butts the notes instead.
    const overlap = (rollover === 'legato' && poly > 1) ? samples : 0;
    const groups = Math.min(MAX_VOICES, Math.floor(outputs.length / LANES));

    for (let i = 0; i < n; i++) {
      const f = base + i;
      // Everything due by now, in the order it was sent. The queue is short — a few events a second —
      // so scanning it per sample costs nothing and keeps the placement exact.
      while (this._q.length && this._q[0].time + DEFER <= f) this._apply(this._q.shift(), poly, rollover, glide, overlap);

      for (let k = 0; k < groups; k++) {
        const v = this._v[k];
        // DURATION ENDS A NOTE THAT WAS NEVER ENDED. It is the failsafe the protocol is built on: an
        // off that never arrives cannot leave a voice sounding for ever.
        if (v.note && f >= v.note.endFrame + DEFER) v.note = null;
        if (v.bendLeft > 0) { v.bend += v.bendStep; v.bendLeft--; if (v.bendLeft === 0) v.bend = v.bendTo; }
        if (v.pitchLeft > 0) { v.pitch += v.pitchStep; v.pitchLeft--; if (v.pitchLeft === 0) v.pitch = v.pitchTo; }
        if (v.levelLeft > 0) { v.level += v.levelStep; v.levelLeft--; if (v.levelLeft === 0) v.level = v.levelTo; }
        else if (!v.note && v.level !== 0) { v.levelTo = 0; v.levelLeft = LEVEL_FALL; v.levelStep = -v.level / LEVEL_FALL; }
        const o = k * LANES;
        if (!outputs[o + OUT.PAN] || !outputs[o + OUT.PAN][0]) continue;
        if (v.retrig > 0) v.retrig--;
        outputs[o + OUT.GATE][0][i] = (v.note && v.retrig === 0) ? 1 : 0;
        // The held values stay on the wire after the gate closes: a voice reading pitch during its own
        // release should find the note it is releasing, not silence.
        outputs[o + OUT.PITCH][0][i] = v.pitch;
        outputs[o + OUT.BEND][0][i] = v.bend;
        outputs[o + OUT.LEVEL][0][i] = v.level;
        outputs[o + OUT.DUR][0][i] = v.dur;
        outputs[o + OUT.PAN][0][i] = v.pan;
      }
    }
    return true;
  }
}

registerProcessor('wcoast-voice', VoiceProcessor);
