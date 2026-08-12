// clock-processor.js — the Clock's engine, in one AudioWorkletProcessor.
//
// A master and three sub-clocks. Ported from the Clock class in Clkd, Impromptu Modular, © Marc Boulé,
// GPL-3.0 — which is the licence this project carries.
//
// THE IDEA WORTH PORTING is not the counting. It is that a sub-clock is defined as
//
//     length × iterations + syncWait
//
// — it runs a whole number of its own periods and then WAITS, in a small guard region at the end of
// its last one, until the master comes round and resets. Only then does it start its next frame. So a
// clock multiplied by seven does not accumulate a seventh of a period of error every bar; it lands on
// the master's beat every time, exactly, however long the patch runs.
//
// A clock that merely counted samples per period would drift, and the drift is worst where it is most
// audible: at high multiplications, against a slow master.
//
// RATIOS ARE HELD DOUBLED — 1.5 is carried as 3, 2.5 as 5 — so every period and iteration count is
// integer arithmetic on whole numbers. That is why the half-ratios work at all: a ratio of 1.5 is two
// iterations of a period two-thirds as long, and both of those are exact.
//
// TEMPO CHANGES STRETCH RATHER THAN RESTART. Turn the knob mid-bar and every clock's current step and
// period are scaled by the same factor, so a beat that is 70% through stays 70% through. Restarting
// them instead is what makes most clocks unusable while playing.
//
// EVERYTHING IS SAMPLE-ACCURATE. The clocks step once per sample inside the render quantum rather than
// once per block: a gate edge that snapped to a 128-sample boundary would be up to 2.7ms late at 48k,
// which is audible as sloppiness on a fast clock and is exactly the fault a clock module exists to
// avoid.
'use strict';

// The ratio table, from the original. A knob index selects one; the sign says multiply or divide.
const RATIOS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 23,
  24, 29, 31, 32, 37, 41, 43, 47, 48, 53, 59, 61, 64, 96];

const BPM_MIN = 30, BPM_MAX = 300;
const LEN_MAX = 60 / BPM_MIN, LEN_MIN = 60 / BPM_MAX;
// The sync window at the end of a sub-clock's last period. It must be low through this region, and it
// is where it waits for the master. Half a millisecond, as in the original: long enough to be reached
// on any sample rate, short enough that nothing is heard to hesitate.
const GUARD = 0.0005;
const PPQN = [2, 4, 8, 12, 16, 24];
// Long enough to SEE. Forty milliseconds is long enough to measure and too short to read: at a
// glance it registered as a faint flicker or as nothing at all. A hundred and twenty is a quarter of a
// beat at 120 BPM — unmistakable, and still short enough that consecutive beats stay separate up to
// about 240 BPM, past which a clock reads better as a glow anyway.
const LAMP_MS = 120;   // minimum time a lamp stays lit after a beat
// The delay knob's eight positions, as fractions of the clock's own period — the original's table.
const DELAYS = [0, 1 / 16, 1 / 8, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4];

// A ratio knob's value is an INDEX into RATIOS, negative for division. Returned DOUBLED, so 1.5 comes
// back as 3 and everything downstream is integers.
function ratioDoubled(knob) {
  let i = Math.round(knob), div = false;
  if (i < 0) { i = -i; div = true; }
  if (i >= RATIOS.length) i = RATIOS.length - 1;
  const r = Math.round(RATIOS[i] * 2);
  return div ? -r : r;
}

// One clock. `sync` is the master for a sub-clock, null for the master itself.
class Clock {
  constructor(sync) {
    this.sync = sync;
    this.step = -1;        // -1 means stopped or between frames; otherwise seconds into the period
    this.remainder = 0;    // what the master overshot its period by, carried into the next frame
    this.length = 0;       // period, in seconds
    this.iterations = 0;
    this.pw = 0.5;         // fraction of the period the gate stays high
    this.swing = 0;        // -1..1: how far every second pulse is dragged early or late
    this.odd = false;      // which of the swung pair this period is
    this.delayLeft = 0;    // seconds still to wait before this frame's first pulse
  }
  isReset() { return this.step === -1; }
  reset(remainder = 0) { this.step = -1; this.remainder = remainder; }
  // `odd` SURVIVES THE FRAME. The master runs one period per frame, so resetting the swing phase on
  // every start meant every period took the long branch — a tempo 50% slower, not a swing. The pair is
  // what swings, and a pair spans two frames.
  start() { this.step = this.remainder; }
  // SWING LENGTHENS ONE PERIOD AND SHORTENS THE NEXT by the same amount, so a pair of pulses still
  // occupies the time two straight ones would. That is what makes swing a feel rather than a tempo
  // change, and it is why the pair is the unit rather than the beat.
  get effLength() { return this.length * (this.odd ? 1 - this.swing : 1 + this.swing); }
  setup(length, iterations) { this.length = length; this.iterations = iterations; }

  advance(sampleTime) {
    // DELAY HOLDS THE WHOLE FRAME BACK, counted down before the first pulse of it is allowed. Delaying
    // each pulse instead would change the clock's rate, which is not what a delay control means.
    if (this.delayLeft > 0) { this.delayLeft -= sampleTime; return; }
    if (this.step < 0) return;
    this.step += sampleTime;
    // THE SYNC WAIT. On its last iteration, once inside the guard region, a sub-clock stops advancing
    // its frame and simply waits for the master to reset. This is the whole mechanism.
    if (this.sync && this.iterations === 1 && this.step > this.effLength - GUARD) {
      if (this.sync.isReset()) this.reset();
      return;
    }
    if (this.step >= this.effLength) {
      this.iterations--;
      this.step -= this.effLength;
      this.odd = !this.odd;
      // Only the master carries its overshoot forward. A sub-clock does not: it is about to be handed
      // a fresh frame by the master, and carrying a remainder into that would be the drift this whole
      // arrangement exists to prevent.
      if (this.iterations <= 0) this.reset(this.sync ? 0 : this.step);
    }
  }
  isHigh() { return this.delayLeft <= 0 && this.step >= 0 && this.step < this.effLength * this.pw; }
  stretch(factor) { if (this.step !== -1) this.step *= factor; this.length *= factor; }
}

class ClockEngine extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'bpm', defaultValue: 120, minValue: BPM_MIN, maxValue: BPM_MAX, automationRate: 'k-rate' },
      { name: 'bpmFine', defaultValue: 0, minValue: -9, maxValue: 9, automationRate: 'k-rate' },
      { name: 'ratio1', defaultValue: 0, minValue: -34, maxValue: 34, automationRate: 'k-rate' },
      { name: 'ratio2', defaultValue: 0, minValue: -34, maxValue: 34, automationRate: 'k-rate' },
      { name: 'ratio3', defaultValue: 0, minValue: -34, maxValue: 34, automationRate: 'k-rate' },
      { name: 'swing', defaultValue: 0, minValue: -1, maxValue: 1, automationRate: 'k-rate' },
      { name: 'pw', defaultValue: 0.5, minValue: 0.02, maxValue: 0.98, automationRate: 'k-rate' },
      ...[1, 2, 3].flatMap((n) => [
        { name: 'swing' + n, defaultValue: 0, minValue: -1, maxValue: 1, automationRate: 'k-rate' },
        { name: 'pw' + n, defaultValue: 0.5, minValue: 0.02, maxValue: 0.98, automationRate: 'k-rate' },
        { name: 'delay' + n, defaultValue: 0, minValue: 0, maxValue: 7, automationRate: 'k-rate' },
      ]),
    ];
  }

  constructor() {
    super();
    this._master = new Clock(null);
    this._subs = [new Clock(this._master), new Clock(this._master), new Clock(this._master)];
    this._all = [this._master, ...this._subs];
    this._ratios = [2, 2, 2];        // doubled; recomputed at each master frame
    this._pending = [true, true, true];
    this._running = false;
    this._masterLength = 0.5;        // 120 BPM
    this._sampleTime = 1 / sampleRate;
    this._bpmMode = 'cv';
    this._ppqn = 4;
    // Edge detection on the two transport inputs, and the reset pulse we emit.
    this._runPrev = 0;
    this._resetPrev = 0;
    this._resetPulse = 0;            // samples of reset output still to emit
    // External clock detection: the interval between incoming edges gives the tempo.
    this._extPrev = 0;
    this._extLast = -1;              // seconds since the last external edge, -1 while unmeasured
    this._extPeriod = 0;
    // THE LAMPS BLINK, THEY DO NOT FOLLOW THE GATE. A clock at x96 and 300 BPM pulses 480 times a
    // second: nothing can show that, and a lamp following the true gate would also dim as the pulse
    // width narrowed, so a 2% pulse would be invisible. A fixed minimum on-time means a slow clock
    // winks and a fast one glows — which is the honest reading of both.
    this._lampLeft = [0, 0, 0, 0];   // samples each lamp still owes
    this._lampOn = [false, false, false, false];
    this._edgePrev = [false, false, false, false];

    this.port.onmessage = (e) => {
      const d = e.data || {};
      if (d.run !== undefined) this._setRunning(!!d.run);
      if (d.reset) this._doReset();
      if (d.bpmMode) this._bpmMode = d.bpmMode;
      if (d.ppqn !== undefined) this._ppqn = PPQN[Math.max(0, Math.min(PPQN.length - 1, Math.round(d.ppqn)))] || 4;
    };
  }

  _setRunning(on) {
    if (on === this._running) return;
    this._running = on;
    // STOPPING RESETS. A clock that resumed mid-beat would be in a phase relationship with everything
    // else that nobody chose and nobody could predict, which is worse than starting again.
    if (!on) for (const c of this._all) c.reset();
    else { for (const c of this._all) c.reset(); this._pending = [true, true, true]; }
    this.port.postMessage({ running: this._running });
  }

  _doReset() {
    for (const c of this._all) c.reset();
    this._pending = [true, true, true];
    this._resetPulse = Math.round(sampleRate * 0.001);   // a 1ms trigger on the reset output
  }

  process(inputs, outputs, parameters) {
    const runIn = inputs[0] && inputs[0][0];
    const resetIn = inputs[1] && inputs[1][0];
    const bpmIn = inputs[2] && inputs[2][0];
    const out = [outputs[0][0], outputs[1][0], outputs[2][0], outputs[3][0]];
    const runOut = outputs[4] && outputs[4][0];
    const resetOut = outputs[5] && outputs[5][0];
    const n = out[0] ? out[0].length : 128;
    const st = this._sampleTime;

    // The tempo for this block. A patched BPM input wins over the knob, the way it does on the panel:
    // the original prints "Ext." on the display when a cable is in, and this is that.
    // Coarse plus fine: the knob steps ten and the trim beside it adds the units, so any tempo in the
    // range is reachable and neither control has to be precise.
    let target = 60 / Math.max(BPM_MIN, Math.min(BPM_MAX, parameters.bpm[0] + parameters.bpmFine[0]));
    if (bpmIn && this._bpmMode === 'cv') {
      // 1V/oct for tempo: 120 BPM at zero, doubling per volt, so a pitch CV transposes tempo the same
      // way it transposes an oscillator. T = 60 / (120 * 2^V) = 0.5 / 2^V.
      target = 0.5 / Math.pow(2, bpmIn[0]);
    } else if (bpmIn && this._bpmMode === 'clock' && this._extPeriod > 0) {
      // Locked to an incoming clock: its measured period times the pulses per quarter note is a beat.
      target = this._extPeriod * this._ppqn;
    }
    target = Math.max(LEN_MIN, Math.min(LEN_MAX, target));
    if (target !== this._masterLength) {
      const factor = target / this._masterLength;
      for (const c of this._all) c.stretch(factor);
      this._masterLength = target;
    }

    // The shape controls, read once a block: none of them is a signal, and a pulse width that moved
    // within a block would put an edge somewhere nobody asked for.
    // Swing is halved on the way in: at full knob a pair becomes 3:1, which is as far as swing means
    // anything, and beyond it the short pulse is shorter than its own gate.
    // WATCH THE RATIO KNOBS. `_pending` was raised only when the clock started or reset, so a ratio was
    // read once at the first frame and never again — turning a ratio knob mid-run changed nothing at
    // all, which is exactly what it looked like. A change raises the flag; the frame boundary acts on
    // it, so the new ratio arrives on a beat rather than in the middle of a period.
    for (let k = 0; k < 3; k++) {
      if (ratioDoubled(parameters['ratio' + (k + 1)][0]) !== this._ratios[k]) this._pending[k] = true;
    }
    this._master.pw = parameters.pw[0];
    this._master.swing = parameters.swing[0] * 0.5;
    for (let k = 0; k < 3; k++) {
      this._subs[k].pw = parameters['pw' + (k + 1)][0];
      this._subs[k].swing = parameters['swing' + (k + 1)][0] * 0.5;
    }

    for (let i = 0; i < n; i++) {
      // ---- the transport inputs, as edges ----
      if (runIn) { const v = runIn[i]; if (this._runPrev <= 0 && v > 0) this._setRunning(!this._running); this._runPrev = v; }
      if (resetIn) { const v = resetIn[i]; if (this._resetPrev <= 0 && v > 0) this._doReset(); this._resetPrev = v; }

      // ---- an external clock, measured between its rising edges ----
      if (bpmIn && this._bpmMode === 'clock') {
        const v = bpmIn[i];
        if (this._extPrev <= 0 && v > 0) {
          if (this._extLast > 0 && this._extLast < 4) this._extPeriod = this._extLast;
          this._extLast = 0;
        } else if (this._extLast >= 0) this._extLast += st;
        this._extPrev = v;
      }

      if (this._running) {
        // A frame begins when a clock has reset. The master takes its period; each sub-clock takes a
        // period and an iteration count derived from its ratio, and a ratio changed mid-run is picked
        // up here — at a frame boundary, never in the middle of one.
        if (this._master.isReset()) {
          for (let k = 0; k < 3; k++) {
            if (!this._pending[k]) continue;
            this._subs[k].reset();
            this._ratios[k] = ratioDoubled(parameters['ratio' + (k + 1)][0]);
            this._pending[k] = false;
          }
          this._master.setup(this._masterLength, 1);
          this._master.start();
        }
        for (let k = 0; k < 3; k++) {
          const c = this._subs[k];
          if (!c.isReset()) continue;
          let rd = this._ratios[k], length, iterations;
          if (rd < 0) {
            // DIVISION: a longer period. An odd doubled ratio — 1.5, 2.5 — needs two iterations to
            // come back into phase with the master, which is what the remainder term counts.
            rd = -rd;
            length = this._masterLength * rd / 2;
            iterations = 1 + (rd % 2);
          } else {
            // MULTIPLICATION: a shorter period, run this many times per master frame.
            length = (2 * this._masterLength) / rd;
            iterations = rd / (2 - (rd % 2));
          }
          c.setup(length, iterations);
          c.start();
          c.delayLeft = DELAYS[Math.max(0, Math.min(7, Math.round(parameters['delay' + (k + 1)][0])))] * length;
        }
      }

      for (let k = 0; k < 4; k++) {
        const high = this._running && this._all[k].isHigh();
        if (out[k]) out[k][i] = high ? 1 : 0;
        // The RISING edge starts a blink; the lamp then stays lit for its minimum however short the
        // gate was, and re-triggers while it is still lit, so a fast clock never goes dark.
        if (high && !this._edgePrev[k]) this._lampLeft[k] = LAMP_MS * sampleRate / 1000;
        this._edgePrev[k] = high;
        if (this._lampLeft[k] > 0) this._lampLeft[k]--;
      }
      if (runOut) runOut[i] = this._running ? 1 : 0;
      if (resetOut) { resetOut[i] = this._resetPulse > 0 ? 1 : 0; if (this._resetPulse > 0) this._resetPulse--; }

      if (this._running) for (const c of this._all) c.advance(st);
    }

    // The panel's readout follows the engine, not the knob: with a cable in the BPM input the number
    // shown has to be the tempo actually running.
    // Lamp state goes out whenever it CHANGES, not on a timer: reporting every sixteenth block put the
    // message rate and the blink length within a few milliseconds of each other, and the two beat
    // against one another into a flicker that had nothing to do with the clock.
    let lampsMoved = false;
    for (let k = 0; k < 4; k++) {
      const on = this._lampLeft[k] > 0 && this._running;
      if (on !== this._lampOn[k]) { this._lampOn[k] = on; lampsMoved = true; }
    }
    this._tick = (this._tick || 0) + 1;
    if (lampsMoved) this.port.postMessage({ lamps: this._lampOn.slice() });
    if ((this._tick & 15) === 0) this.port.postMessage({ bpm: 60 / this._masterLength, running: this._running });
    return true;
  }
}

registerProcessor('wcoast-clock', ClockEngine);

