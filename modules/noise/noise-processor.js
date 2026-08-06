// noise-processor.js — five noise colours from one generator.
//
// ONE SOURCE, FIVE VIEWS. White is generated; the other four are filters of it, computed in the same
// sample loop. That makes them correlated on purpose — patch red into a filter's cutoff and white
// into its input and the two move together, which is the behaviour a hardware noise source has and
// which you lose if each jack runs its own generator.
//
// The generator is xorshift32 rather than Math.random: it is faster, it allocates nothing, and it is
// deterministic from a seed, so a bug here can be reproduced instead of merely observed.
//
// SLOPES. Pink uses Paul Kellet's three-pole economy filter, which tracks −3 dB/oct to within about a
// third of a dB from 10 Hz up and costs three multiply-adds. Red is a leaky integrator: the leak is
// what keeps it from wandering off as a random walk would. Blue and violet are first differences of
// pink and white, which is exactly the +3 and +6 counterpart of those integrations.
//
// LEVELS. Each output is trimmed so the five have the SAME RMS, because switching from one jack to
// another should change the colour and nothing else. They are nowhere near equal at unity —
// differentiating and integrating each move the energy by an order of magnitude — and the numbers
// below are MEASURED, not derived. First pass was derived, and blue came out three times too loud
// and peaking past 1.0, which is how you find out that guessing at a filter's gain does not work.
//
// Matched RMS is not the whole story, because the five have different CREST FACTORS — how far the
// peaks sit above the average. Red is the worst: its energy is all low, so it wanders slowly and far,
// and at equal RMS it peaked at 1.004 and would have clipped anything downstream. So the shared level
// is set by red: its peak is held at 0.8 and the other four follow it down. White ends up a little
// quieter than an oscillator, which is where a noise source belongs anyway.
//
// ZERO ALLOCATION: process() allocates nothing.
'use strict';

const TRIM_WHITE = 0.320;
const TRIM_PINK = 0.1096;
const TRIM_RED = 3.288;      // the leaky integrator loses ~26 dB, and this puts it back
const TRIM_BLUE = 0.1787;
const TRIM_VIOLET = 0.2264;

class Noise extends AudioWorkletProcessor {
  constructor() {
    super();
    // Any non-zero seed will do; a fixed one makes the module reproducible from a cold start.
    this._s = 0x9e3779b9;
    this._b0 = 0; this._b1 = 0; this._b2 = 0;   // pink filter state
    this._red = 0;                              // leaky integrator state
    this._prevWhite = 0; this._prevPink = 0;    // for the two differentiators
  }

  process(_inputs, outputs) {
    const violet = outputs[0] && outputs[0][0];
    const blue = outputs[1] && outputs[1][0];
    const white = outputs[2] && outputs[2][0];
    const pink = outputs[3] && outputs[3][0];
    const red = outputs[4] && outputs[4][0];
    const n = (violet || blue || white || pink || red || []).length;
    if (!n) return true;

    let s = this._s;
    let b0 = this._b0, b1 = this._b1, b2 = this._b2;
    let redState = this._red, prevW = this._prevWhite, prevP = this._prevPink;

    for (let i = 0; i < n; i++) {
      // xorshift32, mapped to [-1, 1)
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      const w = (s / 0x80000000) - 1;

      // pink: three one-pole sections summed (Kellet)
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      const p = b0 + b1 + b2 + w * 0.1848;

      // red: leaky integration of white. The leak (0.98) is what stops a pure integrator from
      // wandering away as a random walk and eventually pinning the output.
      redState = 0.98 * redState + 0.02 * w;

      if (white) white[i] = w * TRIM_WHITE;
      if (pink) pink[i] = p * TRIM_PINK;
      if (red) red[i] = redState * TRIM_RED;
      if (violet) violet[i] = (w - prevW) * TRIM_VIOLET;
      if (blue) blue[i] = (p - prevP) * TRIM_BLUE;

      prevW = w; prevP = p;
    }

    this._s = s;
    this._b0 = b0; this._b1 = b1; this._b2 = b2;
    this._red = redState; this._prevWhite = prevW; this._prevPink = prevP;
    return true;
  }
}

registerProcessor('wcoast-noise', Noise);
