// programmer-8-processor.js — Sequencer/Programmer Eight DSP.
//
// The complete module. What is here:
//
//   playhead   an integer 0..7, advanced by a rising edge on Clock while Run is on.
//   window     a DIRECTED range: a start stage and an end stage, each its own
//              one-of-eight selector. Start before end plays forwards; start AFTER
//              end plays the range backwards, so start 6 with end 2 gives
//              6, 5, 4, 3, 2. Start equal to end is a single repeating stage.
//              Up/Down FLIPS whatever the range says, so both stay meaningful.
//   transport  Hold freezes everything; (P)Reset jumps to the START of the range,
//              or holds there, per the panel's mode switch.
//   outputs    Rows A and B hold the active stage's stored voltages between
//              clocks, and A−B is their difference computed at the output. They
//              keep outputting while stopped — this is a voltage programmer, and
//              holding the current stage with the clock halted is the point of
//              it, not a side effect. Trigger fires at every stage start; All
//              Gate answers intervention (a play button held, a latched address
//              landing) and never the clock.
//   per stage  a select input that latches that stage as the next address, and a
//              pulse output that fires when it becomes active — the pair that
//              makes non-linear and cross-coupled stage orders patchable.
//   play       the eight buttons jump the playhead immediately and hold All Gate,
//              so the column works as a simple keyboard.
//   ratchets   a per-stage repeat count 0..4. 0 silences that stage's Trigger
//              while the stage otherwise happens normally; 2..4 add that many
//              evenly spaced repeats, timed by dividing the immediately previous
//              clock interval. Repeats appear on Trigger only — that is the whole
//              reason Trigger exists, since a repeat is by definition a pulse the
//              main clock did not produce and would otherwise have no way out.
//   readout    the active stage, pushed to the UI. The window is NOT published:
//              start and end are ordinary params, so the host lights their lamps
//              itself and they save with the patch.
//
// Later work is the shared trigger-detector extraction (architecture requirement 7).
//
// Port order is fixed by the descriptor and asserted in factory.js:
//   inputs   0 clock  1 reset  2 updown  3 hold  4..11 sel1..sel8
//   outputs  0 outA   1 outB   2 outAB   3 allGate  4 trig  5..12 pulse1..pulse8
// Unwritten outputs stay silent — a worklet's output buffers arrive zero-filled.
//
// ZERO ALLOCATION in process(): the param key strings, the row buffer and the
// detectors are built once, so the block loop only reads and writes.

'use strict';

const N = 8;

// ---- edge detection ------------------------------------------------------
// Thresholds are RELATIVE to the signal actually arriving, not fixed levels.
// Fixed thresholds only worked for the house 0..1 pulse: an attenuated clock, or
// any audio source below the trigger point, produced nothing at all — and nothing
// at all reads as broken rather than as under-threshold. Tracking the observed
// swing means a ±1 square, a quiet sine and a 0..0.5 pulse all clock it alike.
const REL_HI = 0.6;          // fire at 60% of the observed swing...
const REL_LO = 0.4;          // ...re-arm below 40%. The gap is the hysteresis.
const ABS_HI = 0.6;          // fallback thresholds when there is no swing to
const ABS_LO = 0.4;          // measure — keeps the house 0..1 convention working.
const MIN_SPAN = 0.05;       // below this the input is silence or noise, not a clock
const ENV_TAU_S = 2.0;       // how slowly the observed swing is allowed to contract

// Fixed short width for every pulse this module emits, rather than a proportion of
// the stage: at a fast clock a proportional width would merge repeats into a gate.
const PULSE_S = 0.002;

// Cap on how often state is pushed to the UI. The module is specified to run at
// audio rate (clocks of 10 kHz and above are a first-class use), and at those
// speeds an unthrottled postMessage per stage change would flood the main thread
// with lamp updates nobody can see. ~33 Hz is faster than the eye.
const READOUT_MIN_S = 0.03;

// A Schmitt trigger that adapts to its input's range.
//
// The envelope expands the instant the signal exceeds it and contracts slowly, so
// a steady waveform is characterised within a cycle while a sparse pulse train
// keeps its measurement between pulses. A disconnected input sits at exactly zero,
// the span collapses, and the absolute fallback takes over — so silence can never
// self-trigger on its own noise floor.
//
// It starts ARMED HIGH: a freshly patched input must be seen low before it can
// fire. Without that, the first sample of a rising signal satisfies its own
// freshly-expanded threshold and emits one spurious trigger at patch time.
//
// Kept local to this processor for now. Architecture requirement 7 calls for ONE
// shared detector across the sequencer, the LPG and the function generator, and
// that is still the intent — but the other two carry their own inline copies, and
// a single consumer cannot settle a shared interface. Promote it when the second
// consumer adopts it; the move is mechanical at that point.
class TriggerEdge {
  constructor() { this.high = true; this.max = 0; this.min = 0; }

  // Returns true on the sample the line crosses upward. `.high` is left holding
  // the current level, so the same detector serves gate inputs (Hold, Up/Down)
  // with the same hysteresis, rather than needing a second kind of reader.
  step(x, decay) {
    if (x > this.max) this.max = x; else this.max += (x - this.max) * decay;
    if (x < this.min) this.min = x; else this.min += (x - this.min) * decay;
    const span = this.max - this.min;
    let hi, lo;
    if (span >= MIN_SPAN) { hi = this.min + span * REL_HI; lo = this.min + span * REL_LO; }
    else { hi = ABS_HI; lo = ABS_LO; }
    if (!this.high) {
      if (x >= hi) { this.high = true; return true; }
    } else if (x <= lo) {
      this.high = false;
    }
    return false;
  }

  // Re-arm without discarding what has been learned about the signal's range.
  reset() { this.high = true; }
}

class Programmer8 extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    const p = [];
    for (let s = 1; s <= N; s++) {
      p.push({ name: `a${s}`, defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' });
      p.push({ name: `b${s}`, defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' });
    }
    return p;
  }

  constructor() {
    super();
    this.run = false;
    this.presetMode = false;
    this.stage = 0;                       // 0-based playhead; the panel numbers stages from 1

    // The loop window is a DIRECTED range: the stage the phrase starts on and the one
    // it ends on, each set independently from its own column of lamps. End before start
    // is not an error — it runs the range backwards.
    this.start = 0;
    this.end = N - 1;

    this.clockDet = new TriggerEdge();
    this.resetDet = new TriggerEdge();
    this.updownDet = new TriggerEdge();
    this.holdDet = new TriggerEdge();
    this.selDet = [];
    for (let s = 0; s < N; s++) this.selDet.push(new TriggerEdge());

    this.pending = -1;                    // latched next-address, or -1 for none
    // Seeded to the starting stage, NOT -1: placing the module must not fire a Trigger.
    // Stage 1 is where the playhead already is, not somewhere it has just arrived.
    this.lastActive = 0;
    this._firstClock = true;              // the first clock after Run sounds where we sit
    this.playHeld = new Uint8Array(N);    // which play buttons are down
    this.pulseCd = new Int32Array(N);     // samples remaining of each stage's pulse
    this.trigCd = 0;                      // samples remaining of the shared Trigger pulse
    this.gateCd = 0;                      // samples remaining of the All Gate intervention pulse

    // Ratchets. The count is seeded to 1 — an ordinary one-trigger stage — so a module
    // whose knob values have not yet arrived from the panel behaves normally rather
    // than silently (0 means "no Trigger from this stage").
    this.rpt = new Uint8Array(N).fill(1);
    this.clockInterval = 0;               // samples between the last two clock edges; 0 = not yet known
    this.sinceClock = 0;                  // samples since the last clock edge
    this.ratchetLeft = 0;                 // repeats still owed for the current stage
    this.ratchetPeriod = 0;               // samples between them
    this.ratchetCd = 0;                   // samples until the next one
    this._pulseOut = new Array(N);        // per-block cache of the output channels
    this._bKeys = [];
    for (let s = 1; s <= N; s++) this._bKeys.push(`b${s}`);
    this._b = new Float32Array(N);

    this._aKeys = [];                     // precomputed so process() builds no strings
    for (let s = 1; s <= N; s++) this._aKeys.push(`a${s}`);
    this._a = new Float32Array(N);

    this._sentStage = -1;
    this._sentLo = -1;
    this._sentHi = -1;
    this._sentAt = -1;

    this.port.onmessage = (e) => {
      const m = e.data || {};
      if (m.type === 'switch' && m.id === 'run') {
        const on = m.value === 'on';
        // A fresh start returns the playhead to the green marker, so running always
        // begins at the top of the loop rather than wherever a previous run stopped.
        // The detectors re-arm too: whatever level a clock line was left at must not
        // count as an edge on the first sample back.
        if (on && !this.run) {
          this.stage = this.start;
          this.pending = -1;              // a fresh start carries no stale address
          this._firstClock = true;
          this.clockDet.reset(); this.resetDet.reset();
        }
        this.run = on;
        this._publish(true);
      } else if (m.type === 'switch' && m.id === 'presetMode') {
        this.presetMode = m.value === 'on';
      } else if (m.type === 'window') {
        if (m.id === 'start') this.start = Math.max(0, Math.min(N - 1, m.stage | 0));
        else this.end = Math.max(0, Math.min(N - 1, m.stage | 0));
      } else if (m.type === 'play') {
        // A play button JUMPS the playhead immediately — unlike a select, which latches
        // for the next clock. That is deliberate and it is what the column of play
        // buttons being "a simple keyboard" requires: a key that sounded on the next
        // clock would not be a keyboard. It does not touch the loop window.
        const s = m.stage | 0;
        if (s >= 0 && s < N) {
          this.playHeld[s] = m.down ? 1 : 0;
          if (m.down) this.stage = s;      // the arrival is announced in process(), via lastActive
        }
        this._publish(true);
      } else if (m.type === 'rpt') {
        const s = m.stage | 0;
        if (s >= 0 && s < N) this.rpt[s] = Math.max(0, Math.min(4, m.count | 0));
      } else if (m.type === 'resetState') {
        // Everything that is NOT a param, back to how a freshly placed module starts.
        // The window itself is a param and has already been restored by the host, so the
        // playhead goes to whatever START now says.
        this.stage = this.start;
        this.lastActive = this.stage;   // no arrival: resetting must not fire a Trigger
        this.pending = -1;
        this._firstClock = true;
        this.ratchetLeft = 0;
        this.trigCd = 0; this.gateCd = 0;
        this.pulseCd.fill(0);
        this.playHeld.fill(0);
        this.clockDet.reset(); this.resetDet.reset();
        this._publish(true);
      } else if (m.type === 'republish') {
        this._publish(true);
      }
    };
  }

  _rangeLo() { return this.start < this.end ? this.start : this.end; }
  _rangeHi() { return this.start < this.end ? this.end : this.start; }

  // The range carries its own direction: start before end plays forwards, start AFTER
  // end plays backwards. Start 6 with end 2 gives 6, 5, 4, 3, 2 and repeats. The
  // Up/Down input then FLIPS whatever the range says, so both controls stay meaningful
  // — Up/Down high on a 6-to-2 range plays 2, 3, 4, 5, 6.
  _dir() {
    const base = this.start <= this.end ? 1 : -1;
    return this.updownDet.high ? -base : base;
  }

  // One step in the current direction.
  //
  // Inside the range the playhead wraps at its edges. OUTSIDE it — which happens when
  // the window is reshaped around a running playhead — it is NOT dragged back; it keeps
  // advancing in the same direction until it arrives inside, and repeats there from
  // then on. Reshaping the loop while playing therefore never causes an audible jump.
  _advance(dir) {
    const lo = this._rangeLo(), hi = this._rangeHi();
    if (this.stage >= lo && this.stage <= hi) {
      if (dir > 0) this.stage = (this.stage >= hi) ? lo : this.stage + 1;
      else this.stage = (this.stage <= lo) ? hi : this.stage - 1;
    } else {
      this.stage = (this.stage + dir + N) % N;
    }
  }

  process(inputs, outputs, parameters) {
    const outA = outputs[0][0], outB = outputs[1][0], outAB = outputs[2][0];
    const allGate = outputs[3][0], trigOut = outputs[4][0];
    const n = outA.length;
    const ch = (idx) => { const inp = inputs[idx]; return (inp && inp.length) ? inp[0] : null; };
    const clk = ch(0), rst = ch(1), ud = ch(2), hld = ch(3);

    // Stage voltages are control values, read once per block: a knob does not move
    // within 128 samples, and reading them k-rate keeps the loop cheap.
    const a = this._a, b = this._b;
    for (let s = 0; s < N; s++) {
      a[s] = parameters[this._aKeys[s]][0];
      b[s] = parameters[this._bKeys[s]][0];
    }

    // All Gate is high while ANY play button is held — the column works as a keyboard,
    // so holding two keys keeps the gate up until both are released.
    let anyPlay = 0;
    for (let s = 0; s < N; s++) anyPlay |= this.playHeld[s];

    const decay = 1 - Math.exp(-1 / (ENV_TAU_S * sampleRate));
    const pulseLen = Math.max(1, (PULSE_S * sampleRate) | 0);

    // Per-stage select inputs and pulse outputs, cached once per block.
    const sel = this._selIn || (this._selIn = new Array(N));
    const pulseOut = this._pulseOut;
    for (let s = 0; s < N; s++) { sel[s] = ch(4 + s); pulseOut[s] = outputs[5 + s][0]; }

    for (let i = 0; i < n; i++) {
      // Every detector runs every sample regardless of transport state, so each one
      // tracks its input's range continuously and none can be left mid-pulse.
      const clkEdge = this.clockDet.step(clk ? clk[i] : 0, decay);
      const rstEdge = this.resetDet.step(rst ? rst[i] : 0, decay);
      this.updownDet.step(ud ? ud[i] : 0, decay);
      this.holdDet.step(hld ? hld[i] : 0, decay);

      // Reset and Preset are the two readings of one jack, chosen by the panel switch.
      // RESET is edge-triggered: a pulse jumps to the green marker and the sequence
      // carries on. PRESET is a level: while the input is high the playhead is parked
      // at the green marker and the clock is ignored, so releasing it starts a phrase
      // from a known stage. (On hardware this was a solder jumper.)
      const parked = this.presetMode && this.resetDet.high;
      if (this.presetMode) {
        if (parked) {
          this.stage = this.start;
          // Re-arm the first-clock rule for every release, not just the first. Without
          // this, releasing Preset sounded the parked stage the first time and skipped
          // straight past it every time after — so the phrase you got depended on how
          // many times you had already used the switch, which defeats the point of
          // starting from a known stage.
          this._firstClock = true;
        }
      } else if (rstEdge) {
        this.stage = this.start;
      }

      // The clock edge is where the playhead moves, and a latched address takes
      // precedence over the normal advance. Hold freezes both, including the direction
      // the advance would have taken; parking (Preset held) freezes both too, and leaves
      // any pending address intact so releasing Preset honours it on the next clock.
      //
      // A pending address resolves even with Run OFF: addressing a stage is not
      // advancing the sequence, so a stopped-but-clocked sequencer can still be driven
      // entirely by its select jacks. The advance itself still requires Run.
      // Measure the clock interval continuously, whatever the transport is doing, so a
      // stage entered by a select or a play button has a real interval to ratchet from.
      // The measurement is the IMMEDIATELY PREVIOUS interval, not an average: with a
      // swung or deliberately irregular clock — very much in this module's spirit, since
      // these get clocked from slews and oscillators — the last interval tracks the
      // actual rhythm instead of smearing it.
      this.sinceClock++;
      if (clkEdge) { this.clockInterval = this.sinceClock; this.sinceClock = 0; }

      if (clkEdge && !this.holdDet.high && !parked) {
        // A honoured clock edge cancels any repeats still owed, so a burst can never
        // bleed into the following stage. A bad prediction can only spread the burst too
        // wide and lose its tail, or finish early and leave a gap — both harmless, both
        // self-correcting on the next stage.
        this.ratchetLeft = 0;

        if (this.pending >= 0) {
          this.stage = this.pending;
          this.pending = -1;
          // All Gate answers INTERVENTION, not the clock. A plain advance leaves it
          // alone; a latched address being taken is intervention arriving, so it gets a
          // pulse here. (With immediate selects this fired when the pulse landed; the
          // latch moved the moment the intervention actually takes effect to the clock
          // edge, and the gate follows the effect rather than the request.)
          this.gateCd = pulseLen;
          this._firstClock = false;
        } else if (this.run) {
          // The FIRST clock after Run sounds the stage the playhead is already sitting
          // on rather than advancing past it. Without this, stage 1 is held silently and
          // the first note you hear is stage 2 — the first stage of the sequence would
          // never get a trigger. Clearing lastActive announces the current stage through
          // the ordinary arrival path, so its pulse out and Trigger both fire.
          if (this._firstClock) this.lastActive = -1;
          else this._advance(this._dir());
          this._firstClock = false;
        }
      }

      // Stage select — LATCHED, not immediate. A pulse sets where the sequence goes
      // NEXT; it is taken at the following clock in place of the normal advance, and it
      // can address anywhere, including outside the window.
      //
      // Immediate jumping was tried first and is what the port table literally says, but
      // it makes the module's own premise unusable: patching stage 5's pulse out into
      // stage 2's select in recycled the sequence the instant stage 5 became active, so
      // stage 5 lasted one render block (~2.7 ms) and was never a step at all. Latching
      // is what hardware stage-addressing means, and it makes the five-then-four pattern
      // real. The cost, accepted deliberately: an external select fires on the next
      // clock rather than the moment you trigger it, and with no clock patched at all a
      // select does nothing.
      //
      // Latching also removes the instantaneous-cycle hazard outright — nothing can move
      // the playhead between clock edges, so a pulse-out-to-select-in loop cannot spin
      // within a sample. The first edge in a sample wins and later ones in the SAME
      // sample are ignored, purely so simultaneous selects resolve deterministically; a
      // later sample overwrites, so the most recent address is the one honoured. Every
      // detector still steps, so none loses its range tracking to the latch.
      let latched = false;
      for (let s = 0; s < N; s++) {
        const selEdge = this.selDet[s].step(sel[s] ? sel[s][i] : 0, decay);
        if (selEdge && !latched) { this.pending = s; latched = true; }
      }

      // A stage announces its arrival when it BECOMES active, by any route — a clock
      // advance, a latched address, Reset landing on it, or a play button. Comparing
      // against lastActive rather than the previous sample matters: a play button press
      // arrives as a message BETWEEN blocks, and a per-sample comparison would miss it
      // entirely. Re-addressing the stage already active is not an arrival and stays
      // silent, which is also what stops a stage patched to its own select from
      // free-running.
      if (this.stage !== this.lastActive) {
        this.lastActive = this.stage;
        this.pulseCd[this.stage] = pulseLen;

        // The stage's own pulse output always fires. Its TRIGGER is governed by the
        // repeat count: 0 stays silent — the stage still happens in every other way,
        // which gives a stage that changes pitch or timbre without sounding a note.
        const rpt = this.rpt[this.stage];
        if (rpt > 0) {
          this.trigCd = pulseLen;
          // 2..4 add that many EXTRA evenly spaced repeats after the stage-start
          // trigger, so 4 produces five pulses across the stage. Spacing comes from
          // dividing the last measured clock interval — a countdown, not a second
          // clock. With no previous interval (the first stage after start) there is
          // nothing to divide, so only the stage-start trigger fires and ratchets begin
          // working from the second stage.
          if (rpt >= 2 && this.clockInterval > 0) {
            this.ratchetPeriod = Math.max(1, (this.clockInterval / rpt) | 0);
            // +1 because the countdown below runs in THIS same sample iteration, so a
            // bare period would put the first repeat one sample early. Every later
            // reload happens on the sample it fires and needs no adjustment.
            this.ratchetCd = this.ratchetPeriod + 1;
            this.ratchetLeft = rpt - 1;
          } else {
            this.ratchetLeft = 0;
          }
        }
      }

      // Repeats. Frozen by Hold along with everything else, rather than running on
      // underneath it.
      if (this.ratchetLeft > 0 && !this.holdDet.high) {
        if (--this.ratchetCd <= 0) {
          this.trigCd = pulseLen;
          this.ratchetCd = this.ratchetPeriod;
          this.ratchetLeft--;
        }
      }

      for (let s = 0; s < N; s++) {
        const cd = this.pulseCd[s];
        pulseOut[s][i] = cd > 0 ? 1 : 0;
        if (cd > 0) this.pulseCd[s] = cd - 1;
      }

      trigOut[i] = this.trigCd > 0 ? 1 : 0;
      if (this.trigCd > 0) this.trigCd--;

      // All Gate: a level while a play button is held, plus a pulse when a latched
      // address lands. Both are intervention; the clock alone never raises it.
      allGate[i] = (anyPlay || this.gateCd > 0) ? 1 : 0;
      if (this.gateCd > 0) this.gateCd--;

      const av = a[this.stage], bv = b[this.stage];
      outA[i] = av;
      outB[i] = bv;
      outAB[i] = av - bv;                  // computed at the output, never stored
    }

    this._publish(false);
    return true;
  }

  // Push the playhead to the UI when it moves. Throttled, except when forced by a
  // transport change, where the lamp should answer the button immediately.
  //
  // The window is NOT published any more. Start and end are ordinary params now, so
  // the host lights their lamps from the param values the moment you click one — the
  // engine is a consumer of that state rather than its owner, which is also why the
  // window finally saves with the patch.
  _publish(force) {
    if (!force && this.stage === this._sentStage) return;
    if (!force && (currentTime - this._sentAt) < READOUT_MIN_S) return;   // retried next block
    this._sentStage = this.stage;
    this._sentAt = currentTime;
    this.port.postMessage({ type: 'active', stage: this.stage });
  }
}

registerProcessor('programmer-8', Programmer8);
