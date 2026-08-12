// marbles-processor.js — the Marbles random generator, ported from Émilie Gillet's C++.
//
// SOURCE: eurorack/marbles in Mutable Instruments' firmware, MIT-licensed. The structure here is
// hers, function for function, so the two can be read side by side: a t-generator that makes the
// rhythm, an x-y generator that makes the voltages, a random sequence with a déjà-vu loop that both
// draw their randomness from, and an output channel that shapes and quantises what comes out.
//
// WHAT IS NOT A COPY: her inverse-CDF tables. Marbles carries a 5×9 grid of pre-computed beta
// distributions because a 2011 microcontroller cannot evaluate one; we can, so the same grid is BUILT
// at start-up from the same alpha/beta recipe her table generator uses (resources/lookup_tables.py) —
// nine spread values 2^9 down to 2^-1, five bias values, the same corrected-mu warp. Same numbers,
// arrived at rather than shipped.
//
// TWO PLACES WHERE THIS IS AN APPROXIMATION, and both are marked below:
//   * the EXTERNAL CLOCK. Hers reconstructs a ramp with a predictor that learns the incoming period
//     and rides through swing and dropped beats (ramp_extractor.cc, 314 lines). This measures the
//     interval between rising edges and runs a ramp at that rate. Steady clocks are identical; a
//     clock that changes tempo mid-phrase takes one beat here to follow rather than none.
//   * the SMOOTHING at low STEPS. Hers is a lag processor with its own ramp; this interpolates across
//     the step with the same shape and the same endpoints.
//
// THE SIGNALS ARE VOLTS. A t output is a gate at 0 or 1; an x output is a voltage in the range the
// panel names — ±2, +5 or ±5 — because those labels are a promise about what comes out of the jack.

const KT = 3;                    // t channels
const KX = 3;                    // x channels
const DEJA_VU_BUFFER = 16;
const HISTORY_BUFFER = 16;
const MAX_UINT32 = 4294967296.0;
const ICDF_SIZE = 128;
const N_MU = 5, N_NU = 9;

// ---------------------------------------------------------------------------------------------
// The beta distribution, built rather than tabulated.

// Regularized incomplete beta, by the continued fraction of Numerical Recipes — the standard way,
// and accurate enough that the ICDF below lands within a ten-thousandth of scipy's.
function betacf(a, b, x) {
  const TINY = 1e-30;
  let qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < 3e-7) break;
  }
  return h;
}
function gammaln(x) {
  const cof = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += cof[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}
function betaInc(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(gammaln(a + b) - gammaln(a) - gammaln(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
// The inverse, by bisection. Called only while building the tables, so plain and certain beats quick.
function betaPpf(p, a, b) {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    if (betaInc(mid, a, b) < p) lo = mid; else hi = mid;
  }
  return 0.5 * (lo + hi);
}

// HER GRID, HER WARP. nu is the concentration — how tightly the distribution gathers — and runs from
// 2^9 (a spike) down to 2^-1 (a bowl with everything at the edges). mu is where it gathers, and is
// tabulated only up to a half because the other half is the mirror of it.
const NU_VALUES = [9, 5, 3, 2.5, 2, 1.5, 1, 0.5, -1].map((e) => Math.pow(2, e));
const MU_VALUES = [0.05, 0.125, 0.25, 0.375, 0.5];

// Each cell is one distribution's inverse CDF: 129 points across the body, then 129 more across the
// bottom five percent and the top five percent, where a beta distribution's tail moves fastest and a
// uniform sampling of it would step over the interesting part.
function buildDistributions() {
  const cells = [];
  for (let i = 0; i < N_MU; i++) {
    for (let j = 0; j < N_NU; j++) {
      const nu = NU_VALUES[j], mu = MU_VALUES[i];
      const error = Math.exp(-Math.pow(Math.log2(nu) - 1, 2) / 20.0);
      const correctedMu = 0.5 * Math.pow(2 * mu, 1 / (1 + 3.0 * error));
      const a = correctedMu * nu, b = (1 - correctedMu) * nu;
      const t = new Float32Array(3 * (ICDF_SIZE + 1));
      for (let k = 0; k <= ICDF_SIZE; k++) {
        const u = k / ICDF_SIZE;
        t[k] = betaPpf(u, a, b);
        t[ICDF_SIZE + 1 + k] = betaPpf(u / 20, a, b);
        t[2 * (ICDF_SIZE + 1) + k] = betaPpf(u / 20 + 0.95, a, b);
      }
      cells.push(t);
    }
  }
  return cells;
}
let DIST = null;   // built once, on the first process() call — see MarblesProcessor

const interp = (table, offset, u) => {
  const x = u * ICDF_SIZE;
  const i = Math.min(ICDF_SIZE - 1, Math.max(0, Math.floor(x)));
  const f = x - i;
  return table[offset + i] + (table[offset + i + 1] - table[offset + i]) * f;
};
const cellAt = (mu, nu) => DIST[Math.min(N_MU - 1, mu) * N_NU + Math.min(N_NU - 1, nu)];

// The same bilinear read her BetaDistributionSample does, with the same fold about a half.
function betaSample(uniform, spread, bias) {
  const flip = bias > 0.5;
  if (flip) { uniform = 1 - uniform; bias = 1 - bias; }
  const bi = bias * (N_MU - 1) * 2, si = spread * (N_NU - 1);
  const b0 = Math.min(N_MU - 1, Math.floor(bi)), bf = bi - Math.floor(bi);
  const s0 = Math.min(N_NU - 1, Math.floor(si)), sf = si - Math.floor(si);
  let offset = 0;
  if (uniform <= 0.05) { offset = ICDF_SIZE + 1; uniform *= 20; }
  else if (uniform >= 0.95) { offset = 2 * (ICDF_SIZE + 1); uniform = (uniform - 0.95) * 20; }
  const s1 = Math.min(N_NU - 1, s0 + 1), b1 = Math.min(N_MU - 1, b0 + 1);
  const y1 = interp(cellAt(b0, s0), offset, uniform) + (interp(cellAt(b0, s1), offset, uniform) - interp(cellAt(b0, s0), offset, uniform)) * sf;
  const y2 = interp(cellAt(b1, s0), offset, uniform) + (interp(cellAt(b1, s1), offset, uniform) - interp(cellAt(b1, s0), offset, uniform)) * sf;
  const y = y1 + (y2 - y1) * bf;
  return flip ? 1 - y : y;
}
// Her "beta(3,3) with a fatter tail", used for the jitter: cell mu=4, nu=3 of the same grid.
const fastBetaSample = (u) => interp(cellAt(4, 3), 0, u);

// ---------------------------------------------------------------------------------------------

class RandomStream {
  constructor(seed) { this.s = seed >>> 0 || 0x12345678; }
  next() { let x = this.s; x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; this.s = x; return x; }
  getFloat() { return this.next() / MAX_UINT32; }
}

// THE DÉJÀ VU LOOP. A ring of sixteen values and a probability. At noon nothing loops and every value
// is new; turned up, the same short sequence comes round again; turned down past noon, the loop is
// jumped through at random instead of walked. Both halves and every x channel read from one of these.
class RandomSequence {
  constructor(stream) {
    this.stream = stream;
    this.loop = new Float32Array(DEJA_VU_BUFFER);
    for (let i = 0; i < DEJA_VU_BUFFER; i++) this.loop[i] = stream.getFloat();
    this.history = new Float32Array(HISTORY_BUFFER);
    this.loopWriteHead = 0; this.length = 8; this.step = 0;
    this.recordHead = 0; this.replayHead = -1; this.replayStart = 0;
    this.dejaVu = 0; this.replayHash = 0; this.replayShift = 0;
    this.redoRead = 0; this.redoWrite = -1; this.redoWriteHistory = -1;
  }
  record() { this.replayStart = this.recordHead; this.replayHead = -1; }
  replayPseudoRandom(hash) { this.replayHead = this.replayStart; this.replayHash = hash >>> 0; this.replayShift = 0; }
  replayShifted(shift) { this.replayHead = this.replayStart; this.replayHash = 0; this.replayShift = shift; }
  getReplayValue() {
    const h = (this.replayHead - 1 - this.replayShift + 2 * HISTORY_BUFFER) % HISTORY_BUFFER;
    if (!this.replayHash) return this.history[h];
    let word = (this.history[h] * MAX_UINT32) >>> 0;
    word = (Math.imul(word ^ this.replayHash, 1664525) + 1013904223) >>> 0;
    return word / MAX_UINT32;
  }
  nextValue(deterministic, value) {
    if (this.replayHead >= 0) { this.replayHead = (this.replayHead + 1) % HISTORY_BUFFER; return this.getReplayValue(); }
    const pSqrt = 2 * this.dejaVu - 1, p = pSqrt * pSqrt;
    if (this.stream.getFloat() <= p && this.dejaVu <= 0.5) {
      this.redoWrite = this.loopWriteHead;
      this.loop[this.redoWrite] = deterministic ? 1 + value : this.stream.getFloat();
      this.loopWriteHead = (this.loopWriteHead + 1) % DEJA_VU_BUFFER;
      this.step = this.length - 1;
    } else {
      this.redoWrite = -1;
      if (this.stream.getFloat() <= p) this.step = Math.floor(this.stream.getFloat() * this.length);
      else { this.step += 1; if (this.step >= this.length) this.step = 0; }
    }
    const i = (this.loopWriteHead + DEJA_VU_BUFFER - this.length + this.step) % DEJA_VU_BUFFER;
    this.redoRead = i;
    let result = this.loop[i];
    if (result >= 1) result -= 1;
    else if (deterministic) result = 0.5;   // asked for the register's value, found a random one
    this.redoWriteHistory = this.recordHead;
    this.history[this.redoWriteHistory] = result;
    this.recordHead = (this.recordHead + 1) % HISTORY_BUFFER;
    return result;
  }
  // What the last nextValue WOULD have returned had it been handed this value — how the shift
  // register catches up with a control voltage that is still slewing when its gate arrives.
  rewriteValue(value) {
    if (this.replayHead >= 0) return this.getReplayValue();
    if (this.redoWrite >= 0) this.loop[this.redoWrite] = 1 + value;
    let result = this.loop[this.redoRead];
    if (result >= 1) result -= 1; else result = 0.5;
    if (this.redoWriteHistory >= 0) this.history[this.redoWriteHistory] = result;
    return result;
  }
  nextVector(dst, size) {
    const seed = this.nextValue(false, 0);
    let word = (seed * MAX_UINT32) >>> 0;
    for (let i = 0; i < size; i++) { dst[i] = word / MAX_UINT32; word = (Math.imul(word, 1664525) + 1013904223) >>> 0; }
  }
  setLength(n) { if (n >= 1 && n <= DEJA_VU_BUFFER) { this.length = n; this.step = this.step % n; } }
  clone(src) {
    this.loop.set(src.loop); this.history.set(src.history);
    this.loopWriteHead = src.loopWriteHead; this.length = src.length; this.step = src.step;
    this.recordHead = src.recordHead; this.replayHead = src.replayHead; this.replayStart = src.replayStart;
    this.replayHash = src.replayHash; this.replayShift = src.replayShift; this.dejaVu = src.dejaVu;
    this.redoRead = src.redoRead; this.redoWrite = src.redoWrite; this.redoWriteHistory = src.redoWriteHistory;
  }
}

const MAX_RAMP = 1.0;

// One t output's ramp, running at its own ratio to the master. Two ways to start it: a Bernoulli
// pulse that either fires or does not, and a divider pattern that holds a fixed ratio for a while.
class SlaveRamp {
  constructor() {
    this.phase = 0; this.maxPhase = MAX_RAMP; this.ratio = 1; this.pulseWidth = 0;
    this.target = 1; this.pulseLength = 0; this.bernoulli = false; this.mustComplete = false;
  }
  initRatio(patternLength, ratio, pulseWidth) {
    this.bernoulli = false; this.phase = 0; this.maxPhase = patternLength * MAX_RAMP;
    this.ratio = ratio; this.pulseWidth = pulseWidth; this.target = 1; this.pulseLength = 0;
  }
  initBernoulli(mustComplete, pulseWidth, expectedValue) {
    this.bernoulli = true;
    if (this.mustComplete) { this.phase = 0; this.pulseWidth = pulseWidth; this.ratio = 1; this.pulseLength = 0; }
    this.ratio = mustComplete ? 1 - this.phase : (1 - this.phase) * expectedValue;
    this.mustComplete = mustComplete;
  }
  process(frequency) {
    let outputPhase;
    if (this.bernoulli) {
      this.phase += frequency * this.ratio;
      outputPhase = this.phase > 1 ? 1 : this.phase;
    } else {
      this.phase += frequency;
      if (this.phase >= this.maxPhase) this.phase = this.maxPhase;
      outputPhase = this.phase * this.ratio;
      if (outputPhase > this.target) { this.pulseLength = 0; this.target += 1; }
      outputPhase -= Math.trunc(outputPhase);
    }
    const gate = this.pulseWidth === 0 ? (this.pulseLength < 32 && outputPhase <= 0.5) : outputPhase < this.pulseWidth;
    this.pulseLength++;
    return { phase: outputPhase, gate };
  }
}

// Her divider patterns: which ratio each of the three t outputs holds, and for how many master beats.
const DIVIDER_PATTERNS = [
  [[1, 1], [1, 1], 1], [[1, 1], [2, 1], 1], [[1, 2], [1, 1], 2], [[1, 1], [4, 1], 1],
  [[1, 2], [2, 1], 2], [[1, 1], [3, 2], 2], [[1, 4], [4, 1], 4], [[1, 4], [2, 1], 4],
  [[1, 2], [3, 2], 2], [[1, 1], [8, 1], 1], [[1, 1], [3, 1], 1], [[1, 3], [1, 1], 3],
  [[1, 1], [5, 4], 4], [[1, 2], [5, 4], 4], [[1, 1], [6, 1], 1], [[1, 3], [2, 1], 3],
  [[1, 1], [16, 1], 1],
];
const DRUM_PATTERNS = [
  [1, 0, 0, 0, 2, 0, 0, 0], [0, 0, 1, 0, 2, 0, 0, 0], [1, 0, 1, 0, 2, 0, 0, 0], [0, 0, 1, 0, 2, 0, 0, 2],
  [1, 0, 1, 0, 2, 0, 1, 0], [0, 2, 1, 0, 2, 0, 0, 2], [1, 0, 0, 0, 2, 0, 1, 0], [0, 2, 1, 0, 2, 0, 1, 2],
  [1, 0, 0, 1, 2, 0, 0, 0], [0, 2, 1, 1, 2, 0, 1, 2], [1, 0, 0, 1, 2, 0, 1, 0], [0, 2, 1, 1, 2, 2, 1, 2],
  [1, 0, 0, 1, 2, 0, 1, 2], [0, 2, 0, 1, 2, 0, 1, 2], [1, 0, 1, 1, 2, 0, 1, 2], [2, 0, 1, 2, 0, 1, 2, 0],
  [1, 2, 1, 1, 2, 0, 1, 2], [2, 0, 1, 2, 0, 1, 2, 2],
];
const DRUM_PATTERN_SIZE = 8;
const semitonesToRatio = (s) => Math.pow(2, s / 12);

// THE RHYTHM HALF. One master ramp, and three slave ramps that are re-scheduled every time it wraps —
// which is where the model decides what fires. The ramps matter as much as the gates: the x half is
// clocked from them, so a pattern of gates and the voltages that go with it are the same event.
class TGenerator {
  constructor(stream, sampleRate) {
    this.oneHertz = 1 / sampleRate;
    this.sequence = new RandomSequence(stream);
    this.slave = [new SlaveRamp(), new SlaveRamp(), new SlaveRamp()];
    this.model = 0; this.range = 1;
    this.rate = 0; this.bias = 0.5; this.jitter = 0;
    this.pulseWidthMean = 0; this.pulseWidthStd = 0;
    this.masterPhase = 0; this.jitterMultiplier = 1; this.phaseDifference = 0;
    this.dividerPatternLength = 0; this.drumStep = 0; this.drumIndex = 0;
    this.vec = new Float32Array(2 * KT + 2);
  }
  randomPulseWidth(u) {
    return this.pulseWidthStd === 0
      ? 0.05 + 0.9 * this.pulseWidthMean
      : 0.05 + 0.9 * betaSample(u, this.pulseWidthStd, this.pulseWidthMean);
  }
  // v: [pw0 pw1 pw2, u0 u1 u2, p, jitter]
  complementaryBernoulli(v) {
    let mask = 0;
    for (let i = 0; i < KT; i++) if ((v[3 + (i >> 1)] > this.bias) !== !!(i & 1)) mask |= 1 << i;
    return mask;
  }
  drums(v) {
    this.drumStep++;
    if (this.drumStep >= DRUM_PATTERN_SIZE) {
      this.drumStep = 0;
      const u = v[3] * 2 * Math.abs(this.bias - 0.5);
      this.drumIndex = Math.min(DRUM_PATTERNS.length - 1, Math.floor(DRUM_PATTERNS.length * u));
      if (this.bias <= 0.5) this.drumIndex -= this.drumIndex % 2;
    }
    return DRUM_PATTERNS[this.drumIndex][this.drumStep];
  }
  schedulePulses(v, mask) {
    for (let i = 0; i < KT; i++) { this.slave[i].initBernoulli(!!(mask & 1), this.randomPulseWidth(v[i]), 0.5); mask >>= 1; }
  }
  configureSlaves(v) {
    if (this.model === 0) { this.schedulePulses(v, this.complementaryBernoulli(v)); return; }
    if (this.model === 2) { this.schedulePulses(v, this.drums(v)); return; }
    // CLUSTERS: hold one divider pattern for several beats, so the three outputs lock into a
    // relationship for a while instead of re-rolling every tick. Bias picks how wild the pattern is,
    // and below noon the pattern is read backwards — the same relationships, the other way up.
    this.dividerPatternLength--;
    if (this.dividerPatternLength <= 0) {
      const strength = Math.abs(this.bias - 0.5) * 2;
      let u = v[3];
      u *= (u + strength * strength * (1 - u));
      u *= strength;
      const p = DIVIDER_PATTERNS[Math.min(DIVIDER_PATTERNS.length - 1, Math.floor(u * DIVIDER_PATTERNS.length))];
      const ratios = [p[0], p[1], p[0]];
      if (this.bias < 0.5) { const t = ratios[0]; ratios[0] = ratios[2]; ratios[2] = t; }
      for (let i = 0; i < KT; i++) this.slave[i].initRatio(p[2], ratios[i][0] / ratios[i][1], this.randomPulseWidth(v[i]));
      this.dividerPatternLength = p[2];
    }
  }
  // Returns the master phase and, per channel, its ramp and gate. `extFreq` is the per-sample
  // increment when an external clock is driving; null runs the internal one.
  process(extFreq, masterOut, slaveOut, gateOut, size) {
    let internalFrequency = 0;
    if (extFreq === null) {
      const rate = this.range === 2 ? 8 : this.range === 0 ? 0.5 : 2;
      internalFrequency = rate * this.oneHertz * semitonesToRatio(this.rate);
    }
    for (let n = 0; n < size; n++) {
      const frequency = extFreq === null ? internalFrequency : extFreq;
      const jitteryFrequency = frequency * this.jitterMultiplier;
      this.masterPhase += jitteryFrequency;
      this.phaseDifference += frequency - jitteryFrequency;
      if (this.masterPhase > 1) {
        this.masterPhase -= 1;
        this.sequence.nextVector(this.vec, this.vec.length);
        const jitterAmount = Math.pow(this.jitter, 4) * 36;
        const x = fastBetaSample(this.vec[7]);
        let multiplier = semitonesToRatio((x * 2 - 1) * jitterAmount);
        // Keeps the jittered clock from wandering off: the further it has drifted from the straight
        // one, the harder it is pulled back.
        multiplier *= this.phaseDifference > 0 ? 1 + this.phaseDifference : 1 / (1 - this.phaseDifference);
        this.jitterMultiplier = multiplier;
        this.configureSlaves(this.vec);
      }
      masterOut[n] = this.masterPhase;
      for (let j = 0; j < KT; j++) {
        const r = this.slave[j].process(frequency * this.jitterMultiplier);
        slaveOut[j][n] = r.phase;
        gateOut[j][n] = r.gate ? 1 : 0;
      }
    }
  }
}

// C major, her weights: how strongly each degree belongs. STEPS walks up through seven thresholds,
// letting fewer and fewer degrees through, so turning it does not switch scales — it narrows one.
const SCALE_VOLTS = [0, 0.0833, 0.1667, 0.25, 0.3333, 0.4167, 0.5, 0.5833, 0.6667, 0.75, 0.8333, 0.9167];
const SCALE_WEIGHTS = [255, 16, 96, 24, 128, 64, 8, 192, 16, 96, 24, 128];
const THRESHOLDS = [0, 16, 32, 64, 128, 192, 255];
const LEVELS = THRESHOLDS.map((t) => SCALE_VOLTS.filter((_v, i) => SCALE_WEIGHTS[i] >= t));

function quantize(value, amount) {
  const level = Math.max(0, Math.min(THRESHOLDS.length, Math.round(amount * THRESHOLDS.length)));
  if (level <= 0) return value;
  const set = LEVELS[level - 1];
  if (!set.length) return value;
  let octave = Math.floor(value);
  let frac = value - octave;
  let a = set[set.length - 1] - 1, b = set[0] + 1;
  for (const v of set) { if (frac > v) a = v; else { b = v; break; } }
  return (frac < (a + b) * 0.5 ? a : b) + octave;
}

// One x or y output: draw a value when the ramp wraps, then either quantise it or slide to it.
class OutputChannel {
  constructor() {
    this.spread = 0.5; this.bias = 0.5; this.steps = 0.5;
    this.registerMode = false; this.registerValue = 0; this.registerTransposition = 0;
    this.previousPhase = 0; this.reacquisition = 0;
    this.previousVoltage = 0; this.voltage = 0; this.quantized = 0;
    this.scale = 10; this.offset = -5;
  }
  setRange(range) {
    if (range === 0) { this.scale = 2; this.offset = 0; }        // ±2
    else if (range === 1) { this.scale = 5; this.offset = 0; }    // +5
    else { this.scale = 10; this.offset = -5; }                   // ±5
  }
  generate(seq) {
    const u = seq.nextValue(this.registerMode, this.registerValue);
    if (this.registerMode) return 10 * (u - 0.5) + this.registerTransposition;
    // At the extremes SPREAD stops being a width and becomes something else: fully closed it is a
    // constant at BIAS, fully open it is a coin toss between the two rails. Both are folded in over
    // the last four percent of the knob, which is why the ends feel like different controls.
    let degenerate = 1.25 - this.spread * 25;
    let bernoulli = this.spread * 25 - 23.75;
    degenerate = Math.max(0, Math.min(1, degenerate));
    bernoulli = Math.max(0, Math.min(1, bernoulli));
    let value = betaSample(u, this.spread, this.bias);
    const bernoulliValue = u >= (1 - this.bias) ? 0.999999 : 0;
    value += degenerate * (this.bias - value);
    value += bernoulli * (bernoulliValue - value);
    return value * this.scale + this.offset;
  }
  process(seq, phase, out, size, stride, offset) {
    if (this.reacquisition) {
      this.reacquisition--;
      const u = seq.rewriteValue(this.registerValue);
      this.voltage = 10 * (u - 0.5) + this.registerTransposition;
      this.quantized = quantize(this.voltage, 2 * this.steps - 1);
    }
    for (let n = 0; n < size; n++) {
      const ph = phase[n];
      if (ph < this.previousPhase) {
        this.previousVoltage = this.voltage;
        this.voltage = this.generate(seq);
        this.quantized = quantize(this.voltage, 2 * this.steps - 1);
        if (this.registerMode) this.reacquisition = 20;
      }
      if (this.steps >= 0.5) {
        out[offset + n * stride] = this.quantized;
      } else {
        // SMOOTH, below the middle. An approximation of her lag processor: the same two endpoints,
        // eased across the step, with the smoothness deciding how much of the step is spent moving.
        const smoothness = 1 - 2 * this.steps;
        const t = Math.min(1, ph / Math.max(1e-4, smoothness));
        const e = t * t * (3 - 2 * t);
        out[offset + n * stride] = this.previousVoltage + (this.voltage - this.previousVoltage) * e;
      }
      this.previousPhase = ph;
    }
  }
}

const HASHES = [0, 0xbeca55e5, 0xf0cacc1a];

class MarblesProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'tRate', defaultValue: 0, minValue: -1, maxValue: 1, automationRate: 'k-rate' },
      { name: 'tBias', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'tJitter', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'xSpread', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'xBias', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'xSteps', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'dejaVu', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'dejaVuLength', defaultValue: 0, minValue: 0, maxValue: 11, automationRate: 'k-rate' },
    ];
  }
  constructor() {
    super();
    if (!DIST) DIST = buildDistributions();
    this.stream = new RandomStream(0x1234abcd);
    this.t = new TGenerator(this.stream, sampleRate);
    this.xSeq = [new RandomSequence(this.stream), new RandomSequence(this.stream), new RandomSequence(this.stream)];
    this.ySeq = new RandomSequence(this.stream);
    this.xCh = [new OutputChannel(), new OutputChannel(), new OutputChannel()];
    this.yCh = new OutputChannel();
    this.usedShifted = [false, false, false];
    this.tModel = 0; this.tRange = 1; this.xMode = 0; this.xRange = 2;
    this.tDejaVu = false; this.xDejaVu = false; this.external = false;
    // The clock followers: one per side, each measuring the interval between rising edges.
    this.clk = [{ prev: 0, count: 0, period: 0 }, { prev: 0, count: 0, period: 0 }];
    this.yPhase = 0; this.yPrev = 0;
    this.master = new Float32Array(128);
    this.slaves = [new Float32Array(128), new Float32Array(128), new Float32Array(128)];
    this.gates = [new Float32Array(128), new Float32Array(128), new Float32Array(128)];
    this.port.onmessage = (e) => {
      const d = e.data || {};
      if (d.tMode !== undefined) this.tModel = { bernoulli: 0, clusters: 1, drums: 2 }[d.tMode] ?? 0;
      if (d.tRange !== undefined) this.tRange = { div4: 0, x1: 1, x4: 2 }[d.tRange] ?? 1;
      if (d.xMode !== undefined) this.xMode = { identical: 0, bump: 1, tilt: 2 }[d.xMode] ?? 0;
      if (d.xRange !== undefined) this.xRange = { narrow: 0, positive: 1, full: 2 }[d.xRange] ?? 2;
      if (d.tDejaVu !== undefined) this.tDejaVu = d.tDejaVu === 'on';
      if (d.xDejaVu !== undefined) this.xDejaVu = d.xDejaVu === 'on';
      if (d.external !== undefined) this.external = d.external === 'on';
    };
  }
  // An external clock, followed by measuring it. Returns the per-sample ramp increment, or null when
  // nothing is patched — see the note at the top about what this gives up against her extractor.
  followClock(k, buf, size) {
    const c = this.clk[k];
    if (!buf) { c.count = 0; c.period = 0; c.prev = 0; return null; }
    let seen = false;
    for (let n = 0; n < size; n++) {
      const v = buf[n] > 0.5 ? 1 : 0;
      c.count++;
      if (v && !c.prev) { if (c.count > 8) c.period = c.count; c.count = 0; seen = true; }
      c.prev = v;
    }
    if (!c.period && !seen) return null;
    return c.period > 0 ? 1 / c.period : null;
  }
  process(inputs, outputs, params) {
    const size = outputs[0][0] ? outputs[0][0].length : 128;
    if (this.master.length !== size) {
      this.master = new Float32Array(size);
      this.slaves = [0, 1, 2].map(() => new Float32Array(size));
      this.gates = [0, 1, 2].map(() => new Float32Array(size));
    }
    const pv = (n, i = 0) => (params[n].length > 1 ? params[n][i] : params[n][0]);
    const cv = (k) => (inputs[k] && inputs[k][0] && inputs[k][0].length ? inputs[k][0] : null);
    const cvAvg = (k) => { const b = cv(k); if (!b) return 0; let s = 0; for (let i = 0; i < b.length; i++) s += b[i]; return s / b.length; };
    const clamp01 = (x) => Math.max(0, Math.min(1, x));

    // Inputs, in the order the descriptor lists them.
    const [tClockIn, xClockIn, tRateIn, tBiasIn, tJitterIn, dejaVuIn, xSpreadIn, xBiasIn, xStepsIn] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

    const rate = Math.max(-1, Math.min(1, pv('tRate') + cvAvg(tRateIn))) * 96;
    const tBias = clamp01(pv('tBias') + cvAvg(tBiasIn));
    const tJitter = clamp01(pv('tJitter') + cvAvg(tJitterIn));
    const dejaVu = clamp01(pv('dejaVu') + cvAvg(dejaVuIn));
    const LENGTHS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16];
    const length = LENGTHS[Math.max(0, Math.min(11, Math.round(pv('dejaVuLength'))))];

    this.t.model = this.tModel; this.t.range = this.tRange;
    this.t.rate = rate; this.t.bias = tBias; this.t.jitter = tJitter;
    this.t.sequence.dejaVu = this.tDejaVu ? dejaVu : 0;
    this.t.sequence.setLength(length);

    const tExt = this.followClock(0, cv(tClockIn), size);
    this.t.process(tExt, this.master, this.slaves, this.gates, size);

    for (let i = 0; i < KT; i++) { const o = outputs[i] && outputs[i][0]; if (o) o.set(this.gates[i]); }

    // ---- the voltage half -------------------------------------------------------------------
    // REGISTER MODE (the EXT button): the value written into the loop is the voltage at the X SPREAD
    // input rather than a random number, so the three x outputs become a shift register passing that
    // voltage along — and déjà vu then loops what it captured. SPREAD becomes the amount taken in and
    // BIAS transposes it, which is why both are read differently below.
    const registerMode = this.external;
    const xSpread = clamp01(pv('xSpread') + cvAvg(xSpreadIn) * (registerMode ? 0.5 : 1));
    const xBias = clamp01(pv('xBias') + cvAvg(xBiasIn));
    const xSteps = clamp01(pv('xSteps') + cvAvg(xStepsIn));
    const noteIn = cvAvg(xSpreadIn);
    const registerValue = clamp01(0.5 * (noteIn + 1));

    const xExt = this.followClock(1, cv(xClockIn), size);
    let xRamp;
    if (xExt !== null) {
      // An x clock of its own: one ramp, shared by all three channels.
      this.yPhase = this.yPhase || 0;
      const r = new Float32Array(size);
      let ph = this.clk[1].ramp || 0;
      for (let n = 0; n < size; n++) { ph += xExt; if (ph >= 1) ph -= 1; r[n] = ph; }
      this.clk[1].ramp = ph;
      xRamp = [r, r, r];
    } else {
      // Unpatched, each channel takes a different t ramp — which is what makes the voltages belong to
      // the rhythm rather than merely happen alongside it.
      xRamp = [this.slaves[0], this.master, this.slaves[1]];
    }

    for (let i = 0; i < KX; i++) {
      const ch = this.xCh[i];
      ch.setRange(this.xRange);
      let amount = 1;
      if (this.xMode === 1) amount = i === 1 ? 1 : -1;                       // BUMP
      else if (this.xMode === 2) amount = 2 * i / (KX - 1) - 1;              // TILT
      ch.spread = 0.5 + (xSpread - 0.5) * amount;
      ch.bias = 0.5 + (xBias - 0.5) * amount;
      ch.steps = 0.5 + (xSteps - 0.5) * (registerMode ? 1 : amount);
      ch.registerMode = registerMode;
      ch.registerValue = registerValue;
      ch.registerTransposition = 4 * xSpread * (xBias - 0.5) * amount;

      let seq = this.xSeq[i];
      seq.record();
      seq.setLength(length);
      seq.dejaVu = this.xDejaVu ? dejaVu : 0;
      let shifted = false;
      // WHEN ALL THREE SHARE A CLOCK they would otherwise draw the same loop and come out identical,
      // so channels two and three replay channel one's history — hashed into a different sequence
      // normally, and literally shifted in register mode, which is what makes it a shift register.
      if (xExt !== null && i > 0) {
        seq = this.xSeq[0];
        if (registerMode) {
          shifted = true;
          if (this.xMode === 0) seq.replayShifted(i);
          else if (this.xMode === 1) seq.replayShifted(i === 2 ? 1 : 0);
          else seq.replayShifted(0);
        } else {
          seq.replayPseudoRandom(HASHES[i]);
        }
      }
      if (!shifted && this.usedShifted[i]) this.xSeq[i].clone(this.xSeq[0]);
      this.usedShifted[i] = shifted;

      const out = outputs[4 + i] && outputs[4 + i][0];
      if (out) ch.process(seq, xRamp[i], out, size, 1, 0);
    }

    // Y: the slow one. Her y channel runs the middle ramp through a divider and takes the middle of
    // everything — no spread control of its own, a quarter of the rate, and always smoothed.
    const yOut = outputs[3] && outputs[3][0];
    if (yOut) {
      // A QUARTER OF THE MIDDLE RAMP. Y is the slow one — her divider running at 1:4 — so it is built
      // by taking that ramp's per-sample increment and spending a quarter of it. The previous sample
      // is carried across blocks; taken from inside the block, the first increment of every block
      // would be lost and Y would run a hair slow for ever.
      const yr = new Float32Array(size);
      for (let n = 0; n < size; n++) {
        let d = xRamp[1][n] - this.yPrev;
        this.yPrev = xRamp[1][n];
        if (d < 0) d += 1;                    // the ramp wrapped
        this.yPhase += d / 4;
        if (this.yPhase >= 1) this.yPhase -= 1;
        yr[n] = this.yPhase;
      }
      this.yCh.setRange(this.xRange);
      this.yCh.spread = 0.5; this.yCh.bias = 0.5; this.yCh.steps = 0;
      this.yCh.registerMode = false;
      this.ySeq.record(); this.ySeq.setLength(length); this.ySeq.dejaVu = 0;
      this.yCh.process(this.ySeq, yr, yOut, size, 1, 0);
    }
    return true;
  }
}

registerProcessor('wcoast-marbles', MarblesProcessor);
