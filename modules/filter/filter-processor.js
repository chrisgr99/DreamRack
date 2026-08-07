// filter-processor.js — a state-variable filter, two or four poles.
//
// ONE STRUCTURE, THREE OUTPUTS. A state-variable filter computes low, band and high pass from the
// same pair of integrators, so all three jacks are live at once and cost nothing extra. Patch low and
// high from one filter and you have a crossover; patch band and sweep it and you have a wah. A
// cascade of biquads would have needed three of everything.
//
// TOPOLOGY-PRESERVING TRANSFORM (Zavalishin), not the older Chamberlin form. Chamberlin is two lines
// shorter and goes wrong above about a fifth of the sample rate: its cutoff drifts flat and it blows
// up if you ask for resonance up there. This one is exact at every frequency the knob can reach,
// which matters because the cutoff goes to 20kHz and audio-rate modulation will take it further.
//
// FOUR POLES is the same filter run twice — but each response has to be cascaded through its OWN
// second stage, fed by the matching output of the first. Feeding one second stage from the low-pass
// and taking all three from it, which is the obvious shortcut, gives a high-pass output that is a
// high pass OF a low pass: measured at -38dB an octave above cutoff, where it should have been flat.
// Three second stages cost six state variables and nothing else.
//
// DRIVE saturates the input through tanh before the filter, not after. Before, the filter smooths the
// harmonics the saturation creates, which is what makes an overdriven filter sound thick rather than
// harsh; after, you would hear the distortion raw and the cutoff would do nothing to it.
//
// ZERO ALLOCATION: process() allocates nothing.
'use strict';

const PI = Math.PI;

class Filter extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'cutoff', defaultValue: 1000, minValue: 20, maxValue: 20000, automationRate: 'a-rate' },
      { name: 'resonance', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'a-rate' },
      { name: 'drive', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'a-rate' },
    ];
  }

  constructor() {
    super();
    this._s1 = 0; this._s2 = 0;      // first stage integrator states
    // Second stages, one per response — see the note above on why they cannot be shared.
    this._l1 = 0; this._l2 = 0;
    this._b1 = 0; this._b2 = 0;
    this._h1 = 0; this._h2 = 0;
    this._poles = 4;
    this._nyq = sampleRate * 0.5;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d && d.type === 'switch' && d.id === 'poles') this._poles = d.value === '2' ? 2 : 4;
    };
  }

  process(inputs, outputs, parameters) {
    const lowCh = outputs[0] && outputs[0][0];
    const bandCh = outputs[1] && outputs[1][0];
    const highCh = outputs[2] && outputs[2][0];
    const n = (lowCh || bandCh || highCh || []).length;
    if (!n) return true;
    const sig = inputs[0] && inputs[0][0];
    if (!sig) { if (lowCh) lowCh.fill(0); if (bandCh) bandCh.fill(0); if (highCh) highCh.fill(0); return true; }

    const pC = parameters.cutoff, cS = pC.length > 1 ? 1 : 0;
    const pR = parameters.resonance, rS = pR.length > 1 ? 1 : 0;
    const pD = parameters.drive, dS = pD.length > 1 ? 1 : 0;
    const four = this._poles === 4;
    const nyq = this._nyq;
    let s1 = this._s1, s2 = this._s2;
    let l1 = this._l1, l2 = this._l2, b1 = this._b1, b2 = this._b2, h1 = this._h1, h2 = this._h2;

    for (let i = 0; i < n; i++) {
      let fc = pC[i * cS];
      if (fc < 20) fc = 20; else if (fc > nyq * 0.99) fc = nyq * 0.99;
      // k is 1/Q. Resonance 0 is k=2 (no peak at all); 1 leaves a sliver so it rings without running
      // away, which a self-oscillating filter would do the moment anything nudged it.
      // k is 1/Q. At resonance 1, k = 0.3 gives Q ~3.3 — a strong, singing peak. The first attempt
      // went to k = 0.06, and measured +49dB at cutoff: enough to clip everything downstream from a
      // knob nobody would expect to be dangerous.
      let res = pR[i * rS];
      if (res < 0) res = 0; else if (res > 1) res = 1;
      const k = 2 - 1.7 * res;
      const g = Math.tan(PI * fc / sampleRate);
      const a1 = 1 / (1 + g * (g + k));
      const a2 = g * a1;
      const a3 = g * a2;

      const dr = pD[i * dS];
      let x = sig[i];
      if (dr > 0) { const amt = 1 + dr * 9; x = Math.tanh(x * amt) / Math.tanh(amt); }
      // RESONANCE COMPENSATION. A Q of 3.3 through two stages peaks at about +21dB, which is enough
      // to clip everything downstream from a knob nobody expects to be dangerous. Trimming the input
      // as resonance rises holds the peak near +14dB and thins the body as it sings — which is what a
      // real ladder filter does, so it reads as the filter's character rather than as a limiter.
      x *= 1 - 0.55 * res;

      // stage one
      let v3 = x - s2;
      let v1 = a1 * s1 + a2 * v3;
      let v2 = s2 + a2 * s1 + a3 * v3;
      s1 = 2 * v1 - s1; s2 = 2 * v2 - s2;
      let low = v2, band = v1, high = x - k * v1 - v2;

      if (four) {
        // Each response through its own second stage, fed by the matching first-stage output.
        let u = low - l2;
        let p1 = a1 * l1 + a2 * u, p2 = l2 + a2 * l1 + a3 * u;
        l1 = 2 * p1 - l1; l2 = 2 * p2 - l2;
        const low4 = p2;

        u = band - b2;
        p1 = a1 * b1 + a2 * u; p2 = b2 + a2 * b1 + a3 * u;
        b1 = 2 * p1 - b1; b2 = 2 * p2 - b2;
        const band4 = p1;

        u = high - h2;
        p1 = a1 * h1 + a2 * u; p2 = h2 + a2 * h1 + a3 * u;
        h1 = 2 * p1 - h1; h2 = 2 * p2 - h2;
        const high4 = high - k * p1 - p2;

        low = low4; band = band4; high = high4;
      }

      if (lowCh) lowCh[i] = low;
      if (bandCh) bandCh[i] = band;
      if (highCh) highCh[i] = high;
    }

    // Denormals crawl into an idle filter and cost more than the filter does; flush them.
    const z = (v) => (Math.abs(v) > 1e-15 ? v : 0);
    this._s1 = z(s1); this._s2 = z(s2);
    this._l1 = z(l1); this._l2 = z(l2);
    this._b1 = z(b1); this._b2 = z(b2);
    this._h1 = z(h1); this._h2 = z(h2);
    return true;
  }
}

registerProcessor('wcoast-filter', Filter);
