// oscillator-processor.js — the Oscillator's DSP, in one AudioWorkletProcessor.
//
// One phase accumulator drives all four outputs, so the shapes are phase-coherent: patch the sine and
// the pulse into a mixer and they line up. That is also why this is a single processor rather than
// four — per the one-module-one-worklet rule, and because separate processors could not share phase.
//
// BAND LIMITING. Saw and pulse are discontinuous, and a naive one aliases badly. Both get a polyBLEP
// correction at every discontinuity: the saw at its wrap, the pulse at both of its edges. Sine and
// triangle need none — the sine has no discontinuity at all and the triangle's is in the slope, which
// is far quieter.
//
// THROUGH-ZERO LINEAR FM. The linear FM signal adds a signed offset in Hz — scaled by the base
// frequency, so the timbre stays put as you play up the keyboard — and that offset is allowed to
// exceed the base and drive the frequency negative. The phase then runs backwards. Everything here is
// written to survive that: the wrap is two-sided, and the polyBLEP dt uses the magnitude of the
// increment. An oscillator that clamps at zero instead produces a dead spot exactly where FM gets
// interesting.
//
// FEEDBACK is phase modulation by the oscillator's own last sine sample. Raising it takes a sine
// through a saw-like shape and then into something harsher. It reads the PREVIOUS sample, which is
// the one-sample delay every feedback FM oscillator has; without it the expression would be circular.
//
// ZERO ALLOCATION: process() allocates nothing. Everything it needs is a field or a local.
'use strict';

const LN2 = Math.LN2;
const TWO_PI = Math.PI * 2;

// How far linear FM can push the frequency, as a multiple of the base. Four is enough to get well
// through zero at full depth with a full-scale modulator, which is where the interesting timbres are.
const LIN_FM_RANGE = 4;
// Exponential FM range, in octaves at full depth and full-scale input.
const EXP_FM_OCTAVES = 5;
// Feedback depth in radians of phase at full knob. ONE radian, deliberately: phase-modulation
// feedback becomes chaotic once the modulation's slope exceeds the carrier's, which is exactly at
// depth 1. Measured at 1.6 the knob did nothing much for three quarters of its travel and then fell
// off a cliff into noise; at 1.0 the whole sweep is useful and the extreme sits at the very top.
const FB_DEPTH = 1.0;

const SYNC_SOFT = 0;
const SYNC_HARD = 1;

function polyBlep(t, dt) {
  if (dt <= 0) return 0;
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

function blepSaw(phase, dt) {
  return (2 * phase - 1) - polyBlep(phase, dt);
}

// A pulse of arbitrary width: the naive square with a BLEP at each edge — one at the wrap, one at the
// width point. Width is clamped away from 0 and 1 so there is always a pulse to hear.
function blepPulse(phase, dt, width) {
  const naive = phase < width ? 1 : -1;
  let off = phase - width;
  if (off < 0) off += 1;
  return naive + polyBlep(phase, dt) - polyBlep(off, dt);
}

function triangle(phase) {
  let t = phase * 2;
  if (t > 1) t = 2 - t;
  return t * 2 - 1;
}

class Oscillator extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      // a-rate: coarse can be swept, and pulse width has a CV input landing on it.
      { name: 'coarse', defaultValue: 220, minValue: 1, maxValue: 20000, automationRate: 'a-rate' },
      { name: 'pulseWidth', defaultValue: 0.5, minValue: 0.02, maxValue: 0.98, automationRate: 'a-rate' },
      // The FM depths are a-rate so a demo (or a hand) can move them without stepping.
      { name: 'linFm', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'a-rate' },
      { name: 'expFm', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'a-rate' },
      { name: 'feedback', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'a-rate' },
      // Fine is k-rate: it is a tuning control, set and left.
      { name: 'fine', defaultValue: 0, minValue: -3.5, maxValue: 3.5, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this._phase = 0;
    this._dir = 1;              // +1 forward, -1 after a soft-sync reversal
    this._invSampleRate = 1 / sampleRate;
    this._syncMode = SYNC_SOFT;
    this._syncPrev = 0;
    this._fbLast = 0;           // previous sine sample, for feedback phase modulation
    this._trim = 0.4;           // same output trim as the 259t, so the modules sit at one level

    this.port.onmessage = (e) => {
      const d = e.data;
      if (!d || d.type !== 'switch') return;
      if (d.id === 'syncMode') this._syncMode = d.value === 'hard' ? SYNC_HARD : SYNC_SOFT;
    };
  }

  process(inputs, outputs, parameters) {
    const out = outputs[0];
    if (!out || out.length === 0) return true;
    const sineCh = out[0], triCh = outputs[1] && outputs[1][0];
    const sawCh = outputs[2] && outputs[2][0], pulseCh = outputs[3] && outputs[3][0];
    const n = sineCh.length;

    // An unconnected input arrives as an empty array, so every read is guarded once here rather than
    // per sample.
    const pitchIn = inputs[0] && inputs[0][0];
    const linFmIn = inputs[1] && inputs[1][0];
    const expFmIn = inputs[2] && inputs[2][0];
    const syncIn = inputs[3] && inputs[3][0];

    const pCoarse = parameters.coarse, coarseStride = pCoarse.length > 1 ? 1 : 0;
    const pWidth = parameters.pulseWidth, widthStride = pWidth.length > 1 ? 1 : 0;
    const pLin = parameters.linFm, linStride = pLin.length > 1 ? 1 : 0;
    const pExp = parameters.expFm, expStride = pExp.length > 1 ? 1 : 0;
    const pFb = parameters.feedback, fbStride = pFb.length > 1 ? 1 : 0;
    const fineFactor = Math.pow(2, parameters.fine[0] / 12);

    const invSr = this._invSampleRate;
    const trim = this._trim;
    const syncMode = this._syncMode;
    let phase = this._phase, dir = this._dir;
    let syncPrev = this._syncPrev, fbLast = this._fbLast;

    for (let i = 0; i < n; i++) {
      // ---- sync, before anything else this sample ----
      if (syncIn) {
        const s = syncIn[i];
        if (syncPrev <= 0 && s > 0) {          // rising through zero
          if (syncMode === SYNC_HARD) { phase = 0; dir = 1; } else { dir = -dir; }
        }
        syncPrev = s;
      }

      // ---- frequency ----
      // 1V/oct on the pitch input; exponential FM adds to the same exponent, which is why it detunes
      // as the depth rises. Both are summed before the single exp, so they compose properly.
      let oct = 0;
      if (pitchIn) oct += pitchIn[i];
      if (expFmIn) oct += pExp[i * expStride] * EXP_FM_OCTAVES * expFmIn[i];
      const baseHz = pCoarse[i * coarseStride] * fineFactor * (oct !== 0 ? Math.exp(oct * LN2) : 1);

      // Linear FM last, as a signed Hz offset proportional to the base. Not clamped: through zero is
      // the point.
      const hz = linFmIn ? baseHz + pLin[i * linStride] * LIN_FM_RANGE * baseHz * linFmIn[i] : baseHz;

      const inc = hz * invSr * dir;
      const dt = inc < 0 ? -inc : inc;

      // ---- feedback: phase modulation by the previous sine sample ----
      const fb = pFb[i * fbStride];
      let ph = phase;
      if (fb > 0) {
        ph += fb * FB_DEPTH * fbLast / TWO_PI;
        ph -= Math.floor(ph);                  // one wrap, whichever way it went
      }

      // ---- the four shapes, all from the one phase ----
      const sine = Math.sin(ph * TWO_PI);
      fbLast = sine;
      if (sineCh) sineCh[i] = sine * trim;
      if (triCh) triCh[i] = triangle(ph) * trim;
      if (sawCh) sawCh[i] = blepSaw(ph, dt) * trim;
      if (pulseCh) pulseCh[i] = blepPulse(ph, dt, pWidth[i * widthStride]) * trim;

      // ---- advance, wrapping both ways so a negative increment is legal ----
      phase += inc;
      if (phase >= 1) phase -= Math.floor(phase);
      else if (phase < 0) phase -= Math.floor(phase);
    }

    this._phase = phase;
    this._dir = dir;
    this._syncPrev = syncPrev;
    this._fbLast = fbLast;
    return true;
  }
}

registerProcessor('wcoast-oscillator', Oscillator);
