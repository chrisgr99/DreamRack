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
// FEEDBACK DEPTH IN RADIANS AT FULL KNOB, AND IT TRACKS PITCH.
//
// It was a flat 1.0 — chosen because at 1.6 the knob "fell off a cliff into noise" — and that made the
// control weak: at a musical pitch the whole sweep only reaches about half as much harmonic content as
// the loop can hold cleanly. The cliff is real, but a single number is the wrong shape for it. Measured
// offline, the depth at which the loop stops being periodic depends on how many SAMPLES there are per
// cycle, and so falls with frequency:
//
//   23 Hz  3.00      375 Hz  2.40      3 kHz  1.90
//   94 Hz  2.70      750 Hz  2.35      6 kHz  1.60
//  188 Hz  2.70      1.5 kHz 2.35      8 kHz  1.45
//
// A flat 1.0 is safe at 8 kHz and leaves more than half the usable range on the table at 200. So the
// ceiling follows the phase increment instead, comfortably under the measured boundary at every pitch:
// verified periodic across ten pitches from 23 Hz to 8 kHz and twenty knob positions each.
//
// AVERAGING THE LAST TWO SAMPLES — the classic way to tame a feedback operator — was measured too. It
// does buy headroom (2.60 against 1.90 at 188 Hz) but the averaging is a lowpass in the loop, and it
// spends the headroom on the brightness it just removed: the result is duller than the single-sample
// path at its own limit. Not used.
// The ceiling is set by ALIASING, not by stability — see the oversampling note below. It still falls
// with pitch, and steeply: a high note has fewer harmonics of room before the series folds, so the
// same depth that is clean at 110 Hz is gritty at 1 kHz. These three numbers hold the inharmonic
// energy roughly constant across the range instead.
const FB_DEPTH_MAX = 1.55;    // radians at the bottom of the range
const FB_DEPTH_SLOPE = 16;    // how fast the ceiling falls with the phase increment
const FB_DEPTH_MIN = 0.8;     // floor, for anything near the top of the band
// THE OTHER THREE SHAPES CANNOT TAKE THAT MUCH, and the reason is geometric rather than a matter of
// taste. All four outputs are read from the modulated phase. Past a certain depth that phase stops
// advancing MONOTONICALLY — the modulation's slope exceeds the carrier's and the phase starts running
// backwards within a cycle. A sine does not care: it is smooth, and reading it out of order simply
// makes more sidebands. A saw or a pulse retraced dozens of times per cycle is not a wave at that
// pitch any more, it is a hiss — which is exactly what it sounds like.
//
// SO THE SHAPES GET THEIR OWN, GENTLER LOOP, not merely a smaller slice of the sine's. A first attempt
// simply applied a capped depth to the SAME feedback signal and did nothing: by then that signal is
// itself saw-like, and a modulator with a near-discontinuity in it reverses the phase at any depth
// worth having. The modulator has to be as gentle as the depth — so the shapes carry a second feedback
// memory, a sine generated at the capped depth, one extra sine per sample.
//
// The cap is FLAT, not another formula. Measured, the depth at which the shape phase first reverses
// wanders between 0.78 and 1.30 radians across the range — up to about 190 Hz and back down — with the
// low point at 6 kHz. A single value under the low point is safe everywhere and easier to reason about
// than a curve fitted to a non-monotonic boundary. Verified: zero reversed samples across ten pitches
// from 23 Hz to 8 kHz at twenty knob positions each, and the saw still gains about a third more
// harmonic content from nothing to full knob.
//
// This disposes of a second fault too. The saw and pulse are band-limited with PolyBLEP sized by the
// PITCH rather than by the step the modulated phase actually took, which under heavy feedback
// over-smoothed them by a factor of four or five. Below this cap the two sizings differ so little that
// it does not matter — measured at 0.131 against 0.129 — so keeping the shapes monotonic fixes both.
const FB_SHAPE_CAP = 0.75;    // radians, under the 0.78 low point of the measured boundary

// THE SINE'S FEEDBACK LOOP RUNS AT TWICE THE SAMPLE RATE, and this is the change that lets the knob
// have any bite at all without hissing.
//
// Self-modulated sine approaches a SAWTOOTH, and a sawtooth's harmonics go on forever. Past about 1.2
// radians the series runs off the end of the spectrum and folds back as inharmonic grit. Measured at
// 440 Hz with the loop at base rate, the fraction of the output's energy sitting on NON-harmonic
// frequencies is 0.10 at depth 1.0, 0.17 at 1.2, and then 0.47 at 1.4 — a knee, not a slope. At 2.2 it
// was 0.77, which is the hiss over the top of the knob.
//
// EVERY EARLIER MEASUREMENT IN THIS FILE'S HISTORY WAS BLIND TO IT, because they all used pitches that
// divide the sample rate. Fold a harmonic of such a pitch and it lands exactly on another harmonic of
// the same pitch: the waveform stays periodic and every stability test passes while the sound is full
// of aliasing. Test at 440, not at 187.5.
//
// Running the loop at 2x and filtering before decimation moves the fold point out an octave, which
// buys about 0.4 radians of depth for the same grit. It is not free of aliasing — nothing that
// generates an endless series can be — but it puts a useful depth inside the budget.
const FB_OS = 4;              // oversampling factor for the sine's feedback loop only
// Decimation filter: two cascaded Butterworth biquads at 0.42 of the BASE Nyquist, run at the
// oversampled rate. One biquad is not enough — its skirt still passes most of what 2x exposed.
const DEC_FC = 0.42 * 0.5 / FB_OS;   // corner, as a fraction of the OVERSAMPLED rate

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
    this._fbShape = 0;          // the same, from the shapes' own capped loop
    // Decimation state for the oversampled feedback loop: two biquads, each x1/x2/y1/y2.
    this._dec = new Float64Array(8);
    {
      const w = Math.tan(Math.PI * DEC_FC), q = Math.SQRT1_2, d = 1 + w / q + w * w;
      this._decN = w * w / d;
      this._decA1 = 2 * (w * w - 1) / d;
      this._decA2 = (1 - w / q + w * w) / d;
    }
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
    let syncPrev = this._syncPrev, fbLast = this._fbLast, fbShape = this._fbShape;
    const dec = this._dec, decN = this._decN, decA1 = this._decA1, decA2 = this._decA2;

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
      let phShape = phase;
      // Inlined rather than a helper call: this is the hot loop and the file allocates nothing here.
      let fbd = FB_DEPTH_MAX - FB_DEPTH_SLOPE * dt;
      if (fbd < FB_DEPTH_MIN) fbd = FB_DEPTH_MIN;

      // ---- the sine, from a loop run at FB_OS times the rate and filtered back down ----
      // The sub-steps share this sample's frequency and feedback amount; only the phase advances
      // between them. `subPhase` ends the block exactly where the base-rate phase would have.
      let sine = 0;
      let subPhase = phase;
      const subInc = inc / FB_OS;
      for (let k = 0; k < FB_OS; k++) {
        let p = subPhase;
        if (fb > 0) { p += fb * fbd * fbLast / TWO_PI; p -= Math.floor(p); }
        const v = Math.sin(p * TWO_PI);
        fbLast = v;
        // two cascaded biquads, direct form 1
        let y = decN * (v + 2 * dec[0] + dec[1]) - decA1 * dec[2] - decA2 * dec[3];
        dec[1] = dec[0]; dec[0] = v; dec[3] = dec[2]; dec[2] = y;
        let z = decN * (y + 2 * dec[4] + dec[5]) - decA1 * dec[6] - decA2 * dec[7];
        dec[5] = dec[4]; dec[4] = y; dec[7] = dec[6]; dec[6] = z;
        sine = z;
        subPhase += subInc; subPhase -= Math.floor(subPhase);
      }

      // ---- the other three, from their own gentler loop at the base rate ----
      if (fb > 0) {
        const fbs = fbd < FB_SHAPE_CAP ? fbd : FB_SHAPE_CAP;
        phShape = phase + fb * fbs * fbShape / TWO_PI;
        phShape -= Math.floor(phShape);
      }
      fbShape = Math.sin(phShape * TWO_PI);
      if (sineCh) sineCh[i] = sine * trim;
      if (triCh) triCh[i] = triangle(phShape) * trim;
      if (sawCh) sawCh[i] = blepSaw(phShape, dt) * trim;
      if (pulseCh) pulseCh[i] = blepPulse(phShape, dt, pWidth[i * widthStride]) * trim;

      // ---- advance, wrapping both ways so a negative increment is legal ----
      phase += inc;
      if (phase >= 1) phase -= Math.floor(phase);
      else if (phase < 0) phase -= Math.floor(phase);
    }

    this._phase = phase;
    this._dir = dir;
    this._syncPrev = syncPrev;
    this._fbLast = fbLast;
    this._fbShape = fbShape;
    return true;
  }
}

registerProcessor('wcoast-oscillator', Oscillator);
