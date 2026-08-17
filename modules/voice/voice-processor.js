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
// A STOLEN VOICE FADES, IT IS NOT CUT. Taking a voice that is still sounding used to drop its gate for
// a millisecond and hand its level straight to the new note — and a millisecond is not a fade, it is a
// step with a delay in front of it. What you heard was a click on the onset of whatever did the
// stealing, and always on the slow notes, because the slow notes are the ones still holding voices.
//
// So the old note is taken down over FIVE MILLISECONDS first, and the new one starts when it is
// silent. The new note is therefore that much late, which nobody can hear, and the join cannot click
// because nothing steps.
// IN MILLISECONDS, converted against the real sample rate rather than written as sample counts: a
// constant of 240 samples is five milliseconds at 48k and two and a half at 96k, which is a fade that
// gets shorter on better hardware.
//
// AND LONG ENOUGH TO BE A FADE. A millisecond is a step with a delay in front of it — it still clicks,
// just less. Ten milliseconds is inaudible as a fade and unmistakable as the absence of a click.
const STEAL_FADE_MS = 10;   // the voice being stolen, down to silence
const LEVEL_RISE_MS = 10;   // every note's level, up to its own value
const PAN_MOVE_MS = 10;     // ...and its place in the stereo field
// A FADE IS MEASURED IN CYCLES, NOT MILLISECONDS. Ten milliseconds is nine cycles of a 900Hz note and
// HALF A CYCLE of a 58Hz one — and half a cycle means ramping what is effectively a DC level down to
// zero, which is a thump rather than a fade. Every bass note was being ended that way, which is why
// the artefact followed the slow notes.
//
// So each fade lasts at least three cycles of the note's own fundamental, with the millisecond value
// as a floor and a ceiling so a very low note cannot fade for ever.
const FADE_CYCLES = 3;
const FADE_MAX_MS = 60;
// The pitch on the wire is VOLTS, which are relative — an oscillator multiplies its own frequency by
// two to the power of them — so the frequency here is an estimate against the same middle-C anchor the
// Strudel adapter uses. It is a good estimate, not a promise: an oscillator tuned elsewhere, or under
// FM, is doing something this end cannot see. Hence the floor and the ceiling.
const ANCHOR_HZ = 261.626;
// A FINISHED VOICE FALLS SILENT. Pitch is held after a note ends, so a voice in its release still
// reads the note it is releasing — but LEVEL is an amplitude, and holding that up means a voice whose
// note is over goes on sounding for ever. With the level lane driving a gate, that is voices piling
// up on each other rather than a line of notes. It falls over a couple of milliseconds rather than
// at once, because a step to zero is a click.
const LEVEL_FALL = 96;
const RAMP = 128;           // samples an update takes to reach its value — one update interval
const OUT = { GATE: 0, PITCH: 1, BEND: 2, BENDV: 3, LEVEL: 4, DUR: 5, PAN: 6, PRESSURE: 7, TIMBRE: 8 };
const LANES = 9;
const MAX_VOICES = 8;       // the panel's ceiling, and how many output groups this node carries
// THE PAGE'S AUDIO DOES NOT COME HERE. It did — each copy scaled by its note's level, placed at its
// note's pan and summed — and that is the Poly to Stereo module now. This end deals in events and lanes
// only. What made the move safe is that the LEVEL lane below already carries the exact value the
// internal gain used, including the legato crossfade and the fall at the end of a note, so an
// external amp driven by that lane does what the internal one did, sample for sample.

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
    this._q = [];
    const ms = (t) => Math.max(8, Math.round((t / 1000) * sampleRate));
    this._stealFade = ms(STEAL_FADE_MS);
    this._levelRise = ms(LEVEL_RISE_MS);
    this._panMove = ms(PAN_MOVE_MS);
    this._fadeMax = ms(FADE_MAX_MS);             // events waiting for their sample
    // One slot per possible voice. `note` is what it is playing, `started` when, and the ramp state
    // belongs to the slot rather than to the module, since each is bending its own note.
    this._v = Array.from({ length: MAX_VOICES }, () => ({
      note: null, started: -1,
      pitch: 0, level: 0, dur: 0, pan: 0,
      pitchTo: 0, pitchStep: 0, pitchLeft: 0,   // the glide, when a voice is carried to a new note
      levelTo: 0, levelStep: 0, levelLeft: 0,   // the crossfade, over the overlap
      bendV: 0,                                 // the same bend in volts per octave
      scale: 1 / 6,                             // volts per unit of bend — the note's own bend range
      pressure: 0, pressTo: 0, pressStep: 0, pressLeft: 0,
      timbre: 0, timbTo: 0, timbStep: 0, timbLeft: 0,
      hold: 0,                                  // samples this voice keeps its gate up after being left
      retrig: 0,                                // samples the gate is held low, to make an edge
      panTo: 0, panLeft: 0, panStep: 0,         // the note's place, travelled to rather than jumped to
      freedAt: -Infinity,                       // the frame its last note ended — never used sorts first
      steal: null,                              // a note waiting for this voice to fade out
      stealLeft: 0,                             // samples of that fade still to run
      stealRise: false,                         // the next note begins from silence
      bend: 0, bendTo: 0, bendStep: 0, bendLeft: 0,
    }));
    this._last = -1;          // which voice took the last note, for LEGATO's round-robin
    // ---- WHICH COPIES ARE WORTH RUNNING ------------------------------------------------------
    // A page duplicated eight times runs eight oscillators, eight filters and eight envelopes whether
    // or not there are eight notes, and an idle copy costs very nearly what a sounding one costs: its
    // oscillator still computes a waveform for a VCA to multiply by nothing. This is the only place
    // that knows which voices are actually in use, so it is the place that says so.
    //
    // The rack is told on a TRANSITION only, never per block, and it passes it to the copies.
    this._awake = new Array(MAX_VOICES).fill(true);
    // NEVER USED SORTS AS LONG AGO, so a page comes up with its unused voices already asleep rather
    // than running for the first few seconds of every session.
    this._busyAt = new Array(MAX_VOICES).fill(-Infinity);
    this._peakUse = 0;                              // most voices sounding at once, lately
    this._peakAt = 0;
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

  // How long a fade should last for a note at this pitch, in samples: three cycles, floored at the
  // millisecond value and capped so a very low note does not fade for ever.
  _fadeFor(volts, floorSamples) {
    const hz = ANCHOR_HZ * Math.pow(2, volts || 0);
    const cycles = Math.round((FADE_CYCLES / Math.max(20, hz)) * sampleRate);
    return Math.min(this._fadeMax, Math.max(floorSamples, cycles));
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
    // THE FREE VOICE THAT HAS BEEN FREE LONGEST, not the lowest-numbered one.
    //
    // Lowest-first is the obvious rule and it is badly wrong in the case that matters. Hold a chord on
    // voices 0 to 3 and play a line over it, and EVERY note of that line takes voice 4: it is freed,
    // it is the lowest free, it is taken again, twelve times a second — while voices 5, 6 and 7 are
    // never used at all. A voice reused that fast still has its envelope in release, so each note
    // re-attacks a sounding one, and that is a click no amount of extra polyphony can fix, because the
    // extra voices are never reached.
    //
    // Least-recently-freed spreads the same notes across every idle voice, which is the whole reason a
    // polysynth has them: it buys each envelope the longest possible time to finish.
    let free = -1, freedAt = Infinity;
    for (let i = 0; i < poly; i++) {
      const v = this._v[i];
      if (v.note) continue;
      if (v.freedAt < freedAt) { freedAt = v.freedAt; free = i; }
    }
    if (free >= 0) return { i: free, legato: false };
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
      // TAKING A VOICE THAT IS STILL SOUNDING: fade it out first, and begin the new note when it is
      // silent. The pending note waits on the voice; the per-sample loop starts it when the fade ends.
      // A voice that was free needs none of this — its gate is already down and its level is zero.
      // NOT IN LEGATO, which manages its own joins: at two voices it crossfades over TIME, and at one
      // it BUTTS the notes deliberately — one ending exactly where the next begins is the whole point
      // of the mode, and a fade in front of it would be a fade the user did not ask for. This is for a
      // voice being TAKEN, which is a different event.
      if (v.note && !pick.legato && rollover === 'legato') v.retrig = RETRIG;   // butt: break the gate
      else if (v.note && !pick.legato) {
        v.steal = { m, glide, overlap };
        // ONE SAMPLE LONGER THAN THE RAMP. The hand-over is counted down before the level ramp runs in
        // the same sample, so a countdown of exactly the fade length begins the new note with its last step
        // of the fade still unspent — leaving the old voice at a three-hundredth of its level. Small,
        // but it is a step, and a step is the thing being fixed.
        // THE VOICE IS CLAIMED THE MOMENT IT IS TAKEN, not when the fade finishes. Its note is still
        // the old one until then, so without this it goes on looking like the oldest voice in the
        // rack — and a second steal arriving during the fade takes it AGAIN, throwing away the note
        // that was waiting. With longer fades that overlap is no longer rare.
        v.started = m.time;
        const fade = this._fadeFor(v.pitch, this._stealFade);
        v.stealLeft = fade + 1;
        v.retrig = fade;                             // gate down for the whole fade
        v.levelTo = 0; v.levelLeft = fade; v.levelStep = -v.level / fade;
        return;
      }
      this._begin(v, m, pick, glide, overlap);
      return;
    }
    this._applyRest(m);
  }

  // Start a note on a voice that is silent — either because it was free, or because it has just been
  // faded out for this note.
  _begin(v, m, pick, glide, overlap) {
      v.note = { handle: m.handle, endFrame: m.time + Math.round(m.duration * sampleRate), legato: pick.legato };
      v.started = m.time;
      // GLIDE: the pitch travels rather than jumps, over the same TIME. Only when this voice is being
      // CARRIED to the note — a voice starting fresh has nowhere to travel from.
      if (pick.legato && glide > 0) {
        v.pitchTo = m.pitch; v.pitchLeft = glide; v.pitchStep = (m.pitch - v.pitch) / glide;
      } else { v.pitch = m.pitch; v.pitchLeft = 0; }
      // THE LEVEL NEVER STEPS, at any note, in any mode. It used to be assigned outright here, and
      // that single line was a click in three different situations:
      //
      //   GLIDE and LEGATO — one voice sounds continuously while the pitch travels, so a level that
      //   jumps from one note's velocity to the next's is a jump in a signal you are listening to.
      //
      //   A REUSED VOICE — a note that has ended is taken down to silence by LEVEL_FALL, but whatever
      //   it feeds is still ringing its release. Restoring the level outright un-mutes that tail
      //   instantly, which is the click you hear at the rate of the SLOW notes: they are the ones
      //   whose tails are still sounding when their voice comes round again.
      //
      //   A FRESH VOICE — harmless in a patch whose envelope opens from zero, and not harmless in one
      //   that goes straight to a VCA.
      //
      // A millisecond and a third of ramp costs nothing musically and removes all three.
      if (pick.legato && overlap > 0) {
        v.level = 0; v.levelTo = m.level; v.levelLeft = overlap; v.levelStep = m.level / overlap;
      } else {
        // NEVER LONGER THAN A QUARTER OF THE NOTE. Ten milliseconds is the right fade for a note that
        // lasts, and it is a catastrophe for one that does not: a five-millisecond note would spend its
        // whole life climbing and never reach the velocity it was played at, so a fast pattern would
        // come out flat. Short notes take a short rise, which is also when a click matters least —
        // there is barely any tail to un-mute.
        const rise = Math.max(8, Math.min(this._fadeFor(m.pitch, this._levelRise),
          Math.round((m.duration * sampleRate) / 4)));
        v.levelTo = m.level; v.levelLeft = rise; v.levelStep = (m.level - v.level) / rise;
      }
      v.dur = m.duration;
      // THE SAME QUARTER-OF-THE-NOTE RULE AS THE LEVEL. A pan ramp longer than the note means a short
      // note never arrives where it was meant to sit — which for per-note pan is the whole point of
      // the lane.
      const pmove = Math.max(8, Math.min(this._fadeFor(m.pitch, this._panMove),
        Math.round((m.duration * sampleRate) / 4)));
      // PAN TRAVELS TOO, for exactly the reason the level does. A note's place is applied to a voice
      // that may still be sounding — in glide and legato it always is — and the equal-power gains at
      // the far end are computed per sample, so a jump from one side to the other is a discontinuity
      // in BOTH channels at once. A pattern that alternates hard left and hard right, which is a
      // normal thing to write, clicks on every note without this.
      v.panTo = m.pan; v.panLeft = pmove; v.panStep = (m.pan - v.pan) / pmove;
      // Bend belongs to the note that is starting, so it begins at nothing however the last one ended.
      v.bend = 0; v.bendTo = 0; v.bendLeft = 0; v.bendStep = 0; v.bendV = 0;
      // THE NOTE MAY ARRIVE WITH ITS OWN COLOUR. A source that says nothing leaves these at zero, as
      // they always were; one that names them — a Strudel pattern writing `.timbre("0.2 0.8")` — has
      // each note start where it asked, which is what lets one voice tab play many colours.
      v.pressure = typeof m.pressure === 'number' ? m.pressure : 0; v.pressLeft = 0;
      v.timbre = typeof m.timbre === 'number' ? m.timbre : 0; v.timbLeft = 0;
      // The note carries the range it was made with, so the volts lane can be recovered from the
      // normalised one without this end having to know what the sending knob says.
      v.scale = (m.bendRange || 2) / 12;
      // A note that follows a fade rises from silence rather than stepping to its level.
      if (v.stealRise) {
        v.level = 0; v.levelTo = m.level; v.levelLeft = this._levelRise; v.levelStep = m.level / this._levelRise;
        v.stealRise = false;
      }
  }

  _applyRest(m) {
    if (m.t === 'off') {
      const i = this._slotOf(m.handle);
      // WHEN it fell silent, so the allocator can leave it alone for as long as possible.
      if (i >= 0) { this._v[i].note = null; this._v[i].freedAt = m.time; }
    } else if (m.t === 'u') {
      const i = this._slotOf(m.handle);
      if (i < 0) return;
      const v = this._v[i];
      // Linear over one update interval, so the steps between updates never reach the output. A
      // filter would lag and blunt a fast move; this only delays it by the interval itself.
      // The update arrives in VOLTS. One ramp, on the volts; the control-voltage lane is derived from
      // it each sample against the note's range, so the range scales the CV and never the pitch.
      if (m.k === 'bend') { v.bendTo = m.v; v.bendLeft = RAMP; v.bendStep = (m.v - v.bendV) / RAMP; }
      else if (m.k === 'pressure') { v.pressTo = m.v; v.pressLeft = RAMP; v.pressStep = (m.v - v.pressure) / RAMP; }
      else if (m.k === 'timbre') { v.timbTo = m.v; v.timbLeft = RAMP; v.timbStep = (m.v - v.timbre) / RAMP; }
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
        if (v.note && f >= v.note.endFrame + DEFER) { v.note = null; v.freedAt = f; }
        // A FADE THAT HAS FINISHED HANDS OVER. The voice is silent now, so the note that stole it can
        // begin — from zero, with its own short rise, so the join has no step in it anywhere.
        if (v.stealLeft > 0 && --v.stealLeft === 0 && v.steal) {
          const st = v.steal;
          v.steal = null; v.stealRise = true; v.level = 0; v.levelLeft = 0;
          this._begin(v, st.m, { i: k, legato: false }, st.glide, st.overlap);
        }
        if (v.bendLeft > 0) { v.bendV += v.bendStep; v.bendLeft--; if (v.bendLeft === 0) v.bendV = v.bendTo; }
        // The CV lane is the volts measured against the range, and CLAMPED — a source that bends
        // further than the range says has run out of control voltage, but its pitch has not run out
        // of movement, so the volts lane keeps going.
        const bn = v.bendV / v.scale;
        v.bend = bn > 1 ? 1 : bn < -1 ? -1 : bn;
        if (v.pressLeft > 0) { v.pressure += v.pressStep; v.pressLeft--; if (v.pressLeft === 0) v.pressure = v.pressTo; }
        if (v.timbLeft > 0) { v.timbre += v.timbStep; v.timbLeft--; if (v.timbLeft === 0) v.timbre = v.timbTo; }
        if (v.pitchLeft > 0) { v.pitch += v.pitchStep; v.pitchLeft--; if (v.pitchLeft === 0) v.pitch = v.pitchTo; }
        if (v.levelLeft > 0) { v.level += v.levelStep; v.levelLeft--; if (v.levelLeft === 0) v.level = v.levelTo; }
        else if (!v.note && v.level !== 0) {
          // THE END OF EVERY NOTE, and the shortest of the three fades — it was two milliseconds, an
          // eighth of a cycle at 58Hz, which is the thump that tracked the bass notes.
          const fall = this._fadeFor(v.pitch, LEVEL_FALL);
          v.levelTo = 0; v.levelLeft = fall; v.levelStep = -v.level / fall;
        }
        // THE PAN RAMP GOES AFTER THE WHOLE LEVEL CHAIN, not in the middle of it. Slipped between the
        // level's `if` and its `else if`, it captured that else — so a finished voice only began its
        // fall to silence when the pan happened to be still, and re-armed the fall from whatever level
        // it had reached each time. What that sounds like is a note that never quite ends.
        if (v.panLeft > 0) { v.pan += v.panStep; v.panLeft--; if (v.panLeft === 0) v.pan = v.panTo; }
        const o = k * LANES;
        if (!outputs[o + OUT.PAN] || !outputs[o + OUT.PAN][0]) continue;
        if (v.retrig > 0) v.retrig--;
        outputs[o + OUT.GATE][0][i] = (v.note && v.retrig === 0) ? 1 : 0;
        // The held values stay on the wire after the gate closes: a voice reading pitch during its own
        // release should find the note it is releasing, not silence.
        outputs[o + OUT.PITCH][0][i] = v.pitch;
        outputs[o + OUT.BEND][0][i] = v.bend;
        outputs[o + OUT.BENDV][0][i] = v.bendV;
        outputs[o + OUT.PRESSURE][0][i] = v.pressure;
        outputs[o + OUT.TIMBRE][0][i] = v.timbre;
        outputs[o + OUT.LEVEL][0][i] = v.level;
        outputs[o + OUT.DUR][0][i] = v.dur;
        outputs[o + OUT.PAN][0][i] = v.pan;
      }
    }
    this._sleepUnused(base + n, poly, rollover);
    return true;
  }

  // WHAT STAYS AWAKE: everything sounding, everything still within reach of its own release, and
  // enough free voices to catch what is about to be played.
  //
  // THE SPARES ARE THE POINT. Waking a copy is a message to the main thread and back, which is far too
  // slow to do at a note — so a voice is never woken to play, it is woken to WAIT. How many spares is
  // read from what has been played: the largest chord seen lately, plus one. A monophonic line keeps
  // two voices warm and sleeps the other six; a four-note chord keeps five.
  //
  // THE GRACE is what protects a release. This knows when a note ended but nothing about the envelope
  // downstream, which may be a tenth of a second or ten seconds, so a voice stays awake for a good
  // while after its note — long enough for any ordinary release, and irrelevant to the case this is
  // for, which is voices that are not being used at all.
  _sleepUnused(f, poly, rollover) {
    const GRACE = sampleRate * 6;          // six seconds past its last note before a voice may sleep
    const PEAK_WINDOW = sampleRate * 8;    // and how long "lately" is, for the chord size
    let sounding = 0;
    for (let k = 0; k < poly; k++) {
      const v = this._v[k];
      if (v.note || v.level !== 0 || v.steal || v.stealLeft > 0) { sounding++; this._busyAt[k] = f; }
    }
    if (sounding >= this._peakUse) { this._peakUse = sounding; this._peakAt = f; }
    else if (f - this._peakAt > PEAK_WINDOW) { this._peakUse = sounding; this._peakAt = f; }

    // GLIDE and LEGATO decide their own voice count; anything else may spread across the whole page.
    const spares = rollover === 'glide' ? 0 : 1;
    let allowed = Math.min(poly, this._peakUse + spares);
    for (let k = 0; k < poly; k++) {
      const v = this._v[k];
      const busy = !!(v.note || v.level !== 0 || v.steal || v.stealLeft > 0);
      let want = busy || (f - this._busyAt[k] < GRACE);
      // Spares are taken in the order allocation will take them — lowest free first, which is what
      // _choose does — so the voice woken is the voice the next note lands on.
      if (!want && allowed > 0) { want = true; }
      if (want) allowed--;
      if (want !== this._awake[k]) {
        this._awake[k] = want;
        this.port.postMessage({ voiceAwake: { voice: k, awake: want } });
      }
    }
    // Voices above the current poly are not built at all; if the knob comes down, let them go.
    for (let k = poly; k < MAX_VOICES; k++) {
      if (this._awake[k]) { this._awake[k] = false; this.port.postMessage({ voiceAwake: { voice: k, awake: false } }); }
    }
  }
}

registerProcessor('wcoast-voice', VoiceProcessor);
