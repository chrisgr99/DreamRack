// lpg-292-processor.js — the Quad Low Pass Gate DSP.
//
// Four independent vactrol gates plus a shared internal clock, in one process()
// loop. Each gate:
//
//   vactrol  v -> chases a target (the CV input, clamped 0..1) with a fast
//                 attack and a SLOW, level-dependent release. A strike snaps v
//                 to 1; it then releases toward the CV level, and the release
//                 slows as v falls (the opto tail) — this is the pluck/bloom
//                 that makes a low pass gate sound struck rather than switched.
//   filter   two one-pole lowpasses (12 dB/oct) whose cutoff tracks v.
//   VCA      a gain that tracks v.
//   MODE     LP uses v for the cutoff (else the filter is wide open); VCA uses v
//            for the gain (else unity). Both on = the combined bloom; both off =
//            a clean pass-through.
//   LEVEL    scales the channel output.
//
// A gate is struck three ways: the panel STRIKE button (a 'strike' message), a
// rising edge on its trigger input, or the internal clock when the channel's ON
// is set and the running tick count hits its DIVIDE value. Outputs are the four
// gates, the odd (A+C) and even (B+D) sums, and a clock pulse.
//
// ZERO ALLOCATION in process(): all per-channel state is preallocated typed
// arrays; the loop only reads/writes samples.

'use strict';

const NCH = 4;
const ODD = [true, false, true, false];   // A,C odd; B,D even

// Control-value -> physical mappings.
const CUT_LO = 40, CUT_SPAN = 350;         // cutoff 40 Hz .. 14 kHz (40 * 350)
const RATE_LO = 0.15, RATE_SPAN = 133;     // clock 0.15 .. ~20 Hz
const DEC_LO = 0.02, DEC_SPAN = 90;        // release tau 20 ms .. 1.8 s
const ATTACK_TAU = 0.0025;                 // vactrol attack (fast, fixed)
// HOW LONG A STRIKE HOLDS THE GATE OPEN WHILE THE VACTROL CATCHES UP. A strike used to assign the
// envelope straight to 1, which is a step — in the VCA's gain and in the filter's cutoff — and a step
// is a click. Measured: a trigger moved the output 0.35 in one sample with a tone running through it,
// twenty-four times the largest step that tone can make on its own. A CV gate never did, because the
// CV path CHASES its target through the attack.
//
// So a strike does the same thing: it asks for 1 and lets the same attack get there. The hold is
// capped rather than run to completion so a strike cannot outlast a short decay, and it ends early
// once the envelope has effectively arrived.
const STRIKE_CAP_TAU = 5;                  // at most five attack time constants
const STRIKE_DONE = 0.995;                 // ...or as soon as the vactrol is this close to open
const CLK_PULSE_S = 0.004;                 // clock-out / strike pulse width

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

class Lpg292 extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    const p = [];
    for (let i = 0; i < NCH; i++) {
      const L = 'ABCD'[i];
      p.push({ name: `level${L}`, defaultValue: 0.8, minValue: 0, maxValue: 1, automationRate: 'k-rate' });
      p.push({ name: `decay${L}`, defaultValue: 0.4, minValue: 0, maxValue: 1, automationRate: 'k-rate' });
      // knAck CV-depth (attenuverter) per modulatable knob: value = base + depth × CV.
      // DEPTHS DEFAULT TO 1, matching the descriptor. They disagreed before — the descriptor said 0
      // and so did this — and either way a patched CV did nothing. Keeping the two in step matters
      // even though the host writes the descriptor's value at init: a worklet that starts somewhere
      // else is a block of silence or of full modulation before the first message lands.
      p.push({ name: `levelDepth${L}`, defaultValue: 1, minValue: -1, maxValue: 1, automationRate: 'k-rate' });
      p.push({ name: `decayDepth${L}`, defaultValue: 1, minValue: -1, maxValue: 1, automationRate: 'k-rate' });
      p.push({ name: `ratioDepth${L}`, defaultValue: 1, minValue: -1, maxValue: 1, automationRate: 'k-rate' });
    }
    p.push({ name: 'rate', defaultValue: 0.35, minValue: 0, maxValue: 1, automationRate: 'k-rate' });
    p.push({ name: 'rateDepth', defaultValue: 1, minValue: -1, maxValue: 1, automationRate: 'k-rate' });
    return p;
  }

  constructor() {
    super();
    this.v = new Float32Array(NCH);
    this.s1 = new Float32Array(NCH);
    this.s2 = new Float32Array(NCH);
    this.prevTrig = new Float32Array(NCH);
    // Samples of "hold the target at 1" still owed to a strike — see the strike method.
    this.strikeLeft = new Int32Array(NCH);
    this.strikeSamples = Math.max(1, Math.round(ATTACK_TAU * STRIKE_CAP_TAU * sampleRate));
    this.lp = [true, true, true, true];
    this.vca = [true, true, true, true];
    this.clkOn = [false, false, false, false];
    // Per-channel clock ratio, now CV-modulatable. The base ratio (1..8), divide/multiply mode,
    // and quantize flag arrive by message; the effective rate FACTOR (1/k divide, k multiply) is
    // computed each block from base + ratioDepth × ratioCv, so voltage can sweep or step the ratio.
    this.baseDiv = new Float32Array([1, 1, 1, 1]);
    this.mul = [false, false, false, false];
    this.quant = [true, true, true, true];
    this._factor = new Float32Array([1, 1, 1, 1]);
    this.chPhase = new Float32Array(NCH);
    this.chPulse = new Int32Array(NCH);   // per-channel clock-out pulse (samples remaining)
    this.run = false;
    this.clockPhase = 0;
    this.clkPulse = 0;            // samples remaining of the master clock-out pulse

    const CI = { A: 0, B: 1, C: 2, D: 3 };
    this.port.onmessage = (e) => {
      const m = e.data || {};
      if (m.type === 'switch') {
        if (m.id === 'run') {
          const on = m.value === 'on';
          // Fresh start: re-zero every phase so divided channels line up with the master
          // downbeat (both master and channel phases begin at 0 and stay aligned).
          if (on && !this.run) { this.clockPhase = 0; for (let i = 0; i < NCH; i++) this.chPhase[i] = 0; }
          this.run = on; return;
        }
        const ch = CI[m.id.slice(-1)];
        if (ch === undefined) return;
        if (m.id.startsWith('lp')) this.lp[ch] = m.value === 'on';
        else if (m.id.startsWith('vca')) this.vca[ch] = m.value === 'on';
        else if (m.id.startsWith('clkOn')) this.clkOn[ch] = m.value === 'on';
        else if (m.id.startsWith('ratioQuant')) this.quant[ch] = m.value === 'on';
      } else if (m.type === 'strike') {
        if (m.ch >= 0 && m.ch < NCH) this.strike(m.ch);
      } else if (m.type === 'clk') {
        if (m.ch >= 0 && m.ch < NCH) { this.baseDiv[m.ch] = Math.max(1, m.baseDiv | 0); this.mul[m.ch] = !!m.mul; }
      }
    };
  }

  // FIRED BY ALL THREE: the panel's STRIKE button, a rising edge on the trigger input, and the
  // internal clock. One road in, so none of them can click while the others do not.
  strike(ch) { this.strikeLeft[ch] = this.strikeSamples; }

  process(inputs, outputs, parameters) {
    const sr = sampleRate;
    const n = outputs[0][0].length;
    const attackCoef = 1 - Math.exp(-1 / (ATTACK_TAU * sr));
    const pulseLen = Math.max(1, (CLK_PULSE_S * sr) | 0);

    // Precompute per-channel constants for this block.
    // knAck CV is read block-rate (its [0] sample) — these are control parameters, not audio.
    const cvAt = (idx) => { const inp = inputs[idx]; return (inp && inp.length && inp[0].length) ? inp[0][0] : 0; };
    const releaseCoef = this._rc || (this._rc = new Float32Array(NCH));
    const level = this._lv || (this._lv = new Float32Array(NCH));
    const factor = this._factor;
    for (let ch = 0; ch < NCH; ch++) {
      const L = 'ABCD'[ch];
      // decay = base + depth × CV  (decayCv at input 16+ch)
      const d = clamp01(parameters[`decay${L}`][0] + parameters[`decayDepth${L}`][0] * cvAt(16 + ch));
      const tau = DEC_LO * Math.pow(DEC_SPAN, d);
      releaseCoef[ch] = 1 - Math.exp(-1 / (tau * sr));
      // level = base + depth × CV  (levelCv at input 12+ch) — voltage-controllable loudness / velocity
      level[ch] = clamp01(parameters[`level${L}`][0] + parameters[`levelDepth${L}`][0] * cvAt(12 + ch));
      // clock ratio = base + depth × CV × range, clamped 1..8, optionally quantized to whole ratios,
      // then applied as divide (1/k) or multiply (k). ratioCv at input 20+ch.
      let eff = this.baseDiv[ch] + parameters[`ratioDepth${L}`][0] * cvAt(20 + ch) * 7;
      if (eff < 1) eff = 1; else if (eff > 8) eff = 8;
      if (this.quant[ch]) eff = Math.round(eff);
      factor[ch] = this.mul[ch] ? eff : 1 / eff;
    }
    // rate = base + depth × CV  (rateCv at input 24)
    const rateEff = clamp01(parameters.rate[0] + parameters.rateDepth[0] * cvAt(24));
    const rateHz = RATE_LO * Math.pow(RATE_SPAN, rateEff);
    const clkInc = rateHz / sr;

    const oddOut = outputs[4][0], evenOut = outputs[5][0], clkOut = outputs[6][0];
    // Per-channel clock outputs (indices 7..10, one per channel).
    const chClkOut = this._cco || (this._cco = new Array(NCH));
    for (let ch = 0; ch < NCH; ch++) chClkOut[ch] = outputs[7 + ch][0];

    for (let i = 0; i < n; i++) {
      // --- internal clock: master phase drives clk-out; each channel accrues its OWN phase
      // at the master rate scaled by its factor (1/k divide = slower, k multiply = faster),
      // and strikes its gate when that phase wraps ---
      if (this.run) {
        this.clockPhase += clkInc;
        if (this.clockPhase >= 1) { this.clockPhase -= 1; this.clkPulse = pulseLen; }
        for (let ch = 0; ch < NCH; ch++) {
          // Each channel's clock always runs while RUN is on so its CLK-out jack is live even
          // when it isn't striking its own gate; CLK ON only gates the local strike.
          this.chPhase[ch] += clkInc * factor[ch];
          if (this.chPhase[ch] >= 1) {
            this.chPhase[ch] -= 1;
            this.chPulse[ch] = pulseLen;
            if (this.clkOn[ch]) this.strike(ch);
          }
        }
      }
      clkOut[i] = this.clkPulse > 0 ? 1 : 0;
      if (this.clkPulse > 0) this.clkPulse--;

      let odd = 0, even = 0;
      for (let ch = 0; ch < NCH; ch++) {
        // emit this channel's clock pulse on its own jack
        chClkOut[ch][i] = this.chPulse[ch] > 0 ? 1 : 0;
        if (this.chPulse[ch] > 0) this.chPulse[ch]--;

        // strike on rising trigger edge
        const trigIn = inputs[8 + ch];
        const t = (trigIn && trigIn.length) ? trigIn[0][i] : 0;
        if (t > 0.5 && this.prevTrig[ch] <= 0.5) this.strike(ch);
        this.prevTrig[ch] = t;

        // vactrol chases the CV level: fast up, slow (level-dependent) down
        const cvIn = inputs[4 + ch];
        let target = clamp01((cvIn && cvIn.length) ? cvIn[0][i] : 0);
        let v = this.v[ch];
        // A STRUCK GATE IS A GATE ASKING FOR ALL OF IT, until it has essentially got there. The same
        // attack, the same road: nothing here can move the envelope faster than the vactrol does.
        if (this.strikeLeft[ch] > 0) {
          this.strikeLeft[ch]--;
          if (v >= STRIKE_DONE) this.strikeLeft[ch] = 0;
          if (target < 1) target = 1;
        }
        if (target > v) {
          v += (target - v) * attackCoef;
        } else {
          v += (target - v) * releaseCoef[ch] * (0.25 + 0.75 * v);
        }
        this.v[ch] = v;

        // mode: LP uses v for cutoff, VCA uses v for gain
        const filterAmt = this.lp[ch] ? v : 1;
        const gainAmt = this.vca[ch] ? v : 1;

        const audIn = inputs[ch];
        const x = (audIn && audIn.length) ? audIn[0][i] : 0;
        let fc = CUT_LO * Math.pow(CUT_SPAN, filterAmt);
        if (fc > sr * 0.45) fc = sr * 0.45;
        const a = 1 - Math.exp(-2 * Math.PI * fc / sr);
        const s1 = this.s1[ch] + a * (x - this.s1[ch]);
        const s2 = this.s2[ch] + a * (s1 - this.s2[ch]);
        this.s1[ch] = s1; this.s2[ch] = s2;

        const y = s2 * gainAmt * level[ch];
        outputs[ch][0][i] = y;
        if (ODD[ch]) odd += y; else even += y;
      }
      oddOut[i] = odd;
      evenOut[i] = even;
    }
    return true;
  }
}

registerProcessor('lpg-292', Lpg292);
