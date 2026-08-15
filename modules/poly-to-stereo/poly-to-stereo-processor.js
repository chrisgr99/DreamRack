// poly-to-stereo-processor.js — a voice's exit: two gains multiplied, then an equal-power pan.
//
// Lifted out of voice-processor.js, where it was applied per copy inside the allocator. The numbers
// are the same ones; what changed is that they now arrive on cables, so the page can put anything it
// likes between the note and the gain.
//
// EVERYTHING IS PER SAMPLE, including the pan. Inside the voice worklet the pan gain was computed
// once per block because a note's pan was fixed for its life; here the pan input is an ordinary CV
// that can move at audio rate, and a gain recomputed once per 128 samples steps rather than slides —
// audible as a click on anything that moves quickly.

'use strict';

// EQUAL POWER, so a voice panned hard is no louder than one in the middle. A linear pan dips three
// decibels in the centre, which on a phrase walking across the field is an audible pumping.
const PAN_L = new Float32Array(257), PAN_R = new Float32Array(257);
for (let i = 0; i <= 256; i++) {
  const a = (i / 256) * (Math.PI / 2);
  PAN_L[i] = Math.cos(a); PAN_R[i] = Math.sin(a);
}

class PolyToStereoProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    // A-RATE, ALL OF THEM. These are what the CV cables drive, and a knob's value is just the offset
    // they sum onto; k-rate would quantise an envelope to one value per block.
    return [
      { name: 'levelA', defaultValue: 1, minValue: 0, maxValue: 2, automationRate: 'a-rate' },
      { name: 'levelB', defaultValue: 1, minValue: 0, maxValue: 2, automationRate: 'a-rate' },
      { name: 'pan', defaultValue: 0, minValue: -1, maxValue: 1, automationRate: 'a-rate' },
    ];
  }

  process(inputs, outputs, params) {
    const src = inputs[0] && inputs[0][0];
    const outL = outputs[0] && outputs[0][0];
    const outR = outputs[1] && outputs[1][0];
    const outM = outputs[2] && outputs[2][0];
    if (!outL) return true;
    const n = outL.length;
    if (!src || !src.length) return true;      // nothing patched in: the outputs stay at silence

    const la = params.levelA, lb = params.levelB, pn = params.pan;
    const laC = la.length === 1, lbC = lb.length === 1, pnC = pn.length === 1;

    for (let i = 0; i < n; i++) {
      // A NEGATIVE GAIN IS NOT AN INVERSION HERE. The AudioParam's own minimum already clamps a knob,
      // but a CV summed onto it goes below zero freely, and a level that swings negative flips the
      // signal's phase mid-note — which sounds like a click, not like a quieter note.
      let a = laC ? la[0] : la[i]; if (a < 0) a = 0;
      let b = lbC ? lb[0] : lb[i]; if (b < 0) b = 0;
      const g = a * b;
      let p = pnC ? pn[0] : pn[i];
      if (p < -1) p = -1; else if (p > 1) p = 1;
      const idx = (p + 1) * 128 | 0;
      const x = src[i] * g;
      outL[i] = x * PAN_L[idx];
      if (outR) outR[i] = x * PAN_R[idx];
      // The mono sum is the audio BEFORE it is placed — see the descriptor for why it is not L plus R.
      if (outM) outM[i] = x;
    }
    return true;
  }
}

registerProcessor('wcoast-poly-to-stereo', PolyToStereoProcessor);
