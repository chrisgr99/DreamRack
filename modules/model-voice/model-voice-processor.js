// model-voice-processor.js — Macro Oscillator 2, stage 0: the seam.
//
// A port of Émilie Gillet's Plaits (MIT). This file is the SOCKET the engines plug into, and it is
// deliberately built and proved before any of them exist: the trigger, the internal decay envelope,
// the low pass gate, the pitch path and the two outputs. One plain engine is here so the whole chain
// makes a sound end to end; the rest arrive one at a time behind the same interface.
//
// WHY THIS ORDER. Every engine is a function from (frequency, harmonics, timbre, morph) to a pair of
// signals, and every one of them is worthless until something strikes it, shapes it and gets it out.
// Building the socket first means each engine can be judged on its own the day it lands, against a
// path that is already known to work.
//
// THE PATCHED FLAGS ARE THE DESIGN, and they are implemented here rather than in any engine: a CV
// input with nothing in it is driven by the internal envelope instead, scaled by that input's
// attenuverter. The host tells us which inputs have cables (see `patched` in the message port), so
// one cable into TRIG strikes the gate AND sweeps timbre, morph and pitch by whatever the trims say.
// That is what makes the module sound complete on its own.

'use strict';

const IN = { trig: 0, level: 1, pitch: 2, fm: 3, harmonics: 4, timbre: 5, morph: 6, model: 7 };
const OUT = { out: 0, aux: 1 };

// A trigger is an EDGE, not a level: rising past this arms the strike, and it must fall below the
// lower bound before another can fire. Two thresholds, because a gate with a slow edge or a little
// noise on it would otherwise strike several times on the way up.
const TRIG_HI = 0.4, TRIG_LO = 0.2;

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

// ---------------------------------------------------------------------------------------------
// STAGE 1 — THE PRIMITIVES EVERY ENGINE IS BUILT FROM.
//
// They live in this file rather than a shared one because an AudioWorklet is a single script: there
// is no import inside one, and a build step that stitched files together would be a build step to
// maintain and to get wrong. They are gathered here, at the top, so the engines below read as
// engines rather than as arithmetic.
//
// Ported from Émilie Gillet's stmlib (MIT), with the same names where the names are hers, so the
// C++ and this file can be read side by side.

// SOFT LIMIT — a gentle saturator: unity for small signals, compressing above them. x(27+x²)/(27+9x²).
//
// IT IS NOT A LIMITER, whatever its name suggests, and I had written here that it was. For large x it
// tends to x/9 — so it keeps growing, just nine times more slowly. It reaches 1.55 by x = 12, which
// is how the particle engine put 2.2 into a mixer that expects to see one. Where an output must be
// BOUNDED, use softClip below; this one is for taste, not for safety.
const softLimit = (x) => x * (27 + x * x) / (27 + 9 * x * x);
// ...and the same, clamped past the point where the curve turns over, for where a bound is REQUIRED.
// Below ±3 it is softLimit exactly; beyond it, ±1. Nothing that leaves this module can exceed one.
const softClip = (x) => (x < -3 ? -1 : x > 3 ? 1 : softLimit(x));

// SEMITONES TO A FREQUENCY RATIO. Called per block, not per sample, so Math.pow is affordable —
// the fast polynomial versions in the original exist for a 72MHz microcontroller and would only
// cost accuracy here.
const semitonesToRatio = (s) => Math.pow(2, s / 12);

// A ONE-POLE, as a filter you keep rather than a coefficient you recompute: `setCutoff` takes a
// frequency in hertz and remembers it, so a block that does not change cutoff does no maths.
class OnePole {
  constructor() { this.a = 0; this.z = 0; this.f = -1; }
  setCutoff(hz, sr) {
    if (hz === this.f) return;
    this.f = hz;
    this.a = 1 - Math.exp(-2 * Math.PI * clamp(hz, 1, sr * 0.49) / sr);
  }
  lp(x) { this.z += this.a * (x - this.z); return this.z; }
  hp(x) { this.z += this.a * (x - this.z); return x - this.z; }
  reset() { this.z = 0; }
}

// A STATE VARIABLE FILTER — the workhorse: two poles, resonant, and all three outputs from one pass.
// Chamberlin's topology with the tan() prewarp, which is what keeps its cutoff honest up near
// Nyquist where the naive form goes sharp and then unstable.
class Svf {
  constructor() { this.g = 0; this.r = 1; this.h = 1; this.s1 = 0; this.s2 = 0; this.f = -1; this.q = -1; }
  set(hz, q, sr) {
    if (hz === this.f && q === this.q) return;
    this.f = hz; this.q = q;
    this.g = Math.tan(Math.PI * clamp(hz, 1, sr * 0.49) / sr);
    this.r = 1 / Math.max(0.5, q);
    this.h = 1 / (1 + this.r * this.g + this.g * this.g);
  }
  // Returns [lp, bp, hp]; engines take the one they want and the others cost nothing extra.
  process(x) {
    const hp = (x - (this.r + this.g) * this.s1 - this.s2) * this.h;
    const bp = this.g * hp + this.s1;
    this.s1 = this.g * hp + bp;
    const lp = this.g * bp + this.s2;
    this.s2 = this.g * bp + lp;
    return [lp, bp, hp];
  }
  reset() { this.s1 = 0; this.s2 = 0; }
}

// NOISE. A 32-bit xorshift, because Math.random cannot be seeded and a demo that sounds different
// every run is a demo you cannot compare against itself. Returns -1..1.
class Prng {
  constructor(seed = 0x1234567) { this.s = seed >>> 0 || 1; }
  next() {
    let x = this.s;
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    this.s = x;
    return x / 0x80000000 - 1;
  }
  // DUST: mostly silence with occasional impulses, at a density of `p` per sample. The particle and
  // percussion engines are built on it.
  dust(p) { return (this.next() * 0.5 + 0.5) < p ? this.next() : 0; }
}

// A DELAY LINE with fractional reads — the string models are nothing but this plus a filter. Read
// with Catmull-Rom rather than linearly: a plucked string's pitch is its delay length, and linear
// interpolation is a lowpass whose corner moves with the fraction, so a string tuned between two
// samples would be duller than one tuned on a sample.
class DelayLine {
  constructor(maxSamples) { this.buf = new Float32Array(Math.max(4, maxSamples | 0)); this.w = 0; }
  write(x) { this.buf[this.w] = x; this.w = (this.w + 1) % this.buf.length; }
  read(delay) {
    const N = this.buf.length;
    const d = clamp(delay, 1, N - 3);
    const base = this.w - d;
    const i = Math.floor(base), f = base - i;
    const at = (k) => this.buf[((k % N) + N) % N];
    const y0 = at(i - 1), y1 = at(i), y2 = at(i + 1), y3 = at(i + 2);
    // Catmull-Rom: flat response through the sample points, and no cutoff that moves with `f`.
    return y1 + 0.5 * f * (y2 - y0 + f * (2 * y0 - 5 * y1 + 4 * y2 - y3 + f * (3 * (y1 - y2) + y3 - y0)));
  }
  reset() { this.buf.fill(0); this.w = 0; }
}


// ---------------------------------------------------------------------------------------------
// STAGE 2 — THE PHYSICAL MODELS.
//
// Both are the same idea and it is the oldest one in the book: hit something, and listen to what it
// does afterwards. An EXCITATION — a short burst of filtered noise — and a RESONATOR that rings. The
// difference is only what rings: a string is a delay line feeding itself, a modal body is a bank of
// tuned filters. Everything the panel does maps the same way in both, which is Plaits' own scheme:
//
//     HARMONICS = structure    what the resonator is: a string's stiffness, a body's inharmonicity
//     TIMBRE    = brightness   how bright the strike is, and how bright the thing rings
//     MORPH     = damping      how fast it dies away
//
// THEY ARE ALREADY ENVELOPED. A struck string decays because it is a struck string, not because
// something turned it down — so these two bypass the low pass gate rather than being shaped twice.
// That is what Plaits' `already_enveloped` flag means, and skipping it is why a plucked note here
// keeps its own tail instead of having a second one imposed on it.

// A PLUCKED STRING: a delay line, a damping filter and a dispersion allpass, all inside one loop.
// The delay is the pitch, the filter is why it dies, and the allpass is why a real string is not
// quite harmonic — the high partials travel faster than the low ones, which is what makes a piano
// sound like a piano and not like an organ.
class StringModel {
  constructor(sr) {
    this.sr = sr;
    this.line = new DelayLine(Math.ceil(sr / 20) + 8);   // long enough for the lowest note
    this.damp = new OnePole();
    this.ap = 0;          // one-pole allpass state, for dispersion
    this.apCoef = 0;
    this.burst = 0;       // samples of excitation left to write
    this.exc = new Svf();
    this.rng = new Prng(0x51f0a3);
  }
  strike(f0, brightness) {
    // A burst one period long: any longer and the excitation is heard as noise in its own right,
    // any shorter and the string is not properly set going.
    this.burst = Math.max(4, Math.round(this.sr / Math.max(20, f0)));
  }
  // `structure` bends the partials, `brightness` opens both the strike and the loop, `damping` is
  // how long it rings.
  render(out, aux, n, f0, structure, brightness, damping) {
    const sr = this.sr;
    // THE FILTERS IN THE LOOP ARE PART OF THE DELAY. A one-pole and an allpass each hold the signal
    // up for a fraction of a sample, and a Karplus-Strong string's pitch IS its loop length — so a
    // line cut to exactly sr/f0 rings flat. It measured 1.7% flat at every pitch, which is a third
    // of a semitone: audible, consistent, and nothing to do with the note being asked for.
    //
    // The one-pole's phase delay at f0, in samples, is what has to come off. For y += a(x - y) that
    // is (1 - a) / a at low frequencies relative to cutoff, which is where a string's fundamental
    // always sits. The allpass contributes its own, which the coefficient gives directly.
    const aCoef = this.damp.a || 1;
    const filterDelay = (1 - aCoef) / aCoef + Math.abs(this.apCoef) * 1.0;
    const delay = clamp(sr / f0 - filterDelay, 4, this.line.buf.length - 4);
    // The loop filter: bright strings keep their highs, dull ones lose them within a few passes.
    const loopHz = clamp(f0 * (1 + brightness * 40), 200, sr * 0.45);
    this.damp.setCutoff(loopHz, sr);
    this.apCoef = clamp((structure - 0.25) * 1.6, -0.6, 0.6);
    // Feedback just under one, taken down by damping. This is the decay time, and it has to be
    // scaled by the delay length or low notes would ring for minutes and high ones not at all.
    // The loop filter removes energy on every pass, on top of the feedback — so a coefficient
    // computed for a clean -60dB fall always undershoots, by more the darker the string. Asking for
    // longer and letting the filter take its share is what makes the knob's ends mean something.
    const decayPasses = 0.1 + Math.pow(1 - damping, 2) * 40;
    const fb = Math.min(0.9995, Math.pow(0.001, delay / (decayPasses * sr)));
    // Dispersion: 0.25 on the structure knob is the neutral point, either side of it stiffens the
    // string in one direction or the other — the same split Plaits makes at 0.24/0.26. Set above,
    // before the delay is worked out, because the delay depends on it.
    this.exc.set(clamp(f0 * (1 + brightness * 30), 100, sr * 0.45), 0.5, sr);
    for (let i = 0; i < n; i++) {
      let x = 0;
      if (this.burst > 0) { x = this.rng.next(); this.burst--; }
      const e = this.exc.process(x)[0];
      aux[i] += e;                                  // the strike itself, on AUX
      let y = this.line.read(delay);
      y = this.damp.lp(y);
      // A one-pole allpass: all frequencies pass, but not all at the same speed.
      const ap = -this.apCoef * y + this.ap;
      this.ap = y + this.apCoef * ap;
      y = ap;
      this.line.write(softLimit(y * fb + e));
      out[i] = y;
    }
  }
}

// A MODAL BODY: a bank of tuned resonators, struck all at once. What a bell, a bar or a drum head is
// — a set of frequencies that ring at different rates. STRUCTURE moves the partials from harmonic
// (a string, a tube) to the stretched ratios of a stiff bar or a bell.
const MODES = 24;
class ModalModel {
  constructor(sr) {
    this.sr = sr;
    this.modes = Array.from({ length: MODES }, () => new Svf());
    this.exc = new Svf();
    this.burst = 0;
    this.rng = new Prng(0x2b7e15);
  }
  strike() { this.burst = 1; }   // a modal body is struck, not bowed: one sample is a hammer
  render(out, aux, n, f0, structure, brightness, damping) {
    const sr = this.sr;
    // The partial ratios. At structure 0 they are 1,2,3,4… — harmonic, and it sounds like a string.
    // Wound up, they stretch towards the ratios of a stiff bar, which is what makes a bell a bell.
    const stretch = structure * 2.2;
    // Q FROM A DECAY TIME, not a number picked to sound right. A resonator's sixty-decibel decay is
    // about 2.2·Q/f cycles' worth of seconds, so asking for a time and solving for Q is the only way
    // the knob means the same thing at every pitch. It measured 5 seconds at both ends of the knob
    // before this — the Q was so high that damping made no audible difference at all.
    const t60 = 0.08 + Math.pow(1 - damping, 2) * 6;
    const top = sr * 0.45;
    const bright = 0.2 + brightness * 0.8;
    const amps = [];
    for (let k = 0; k < MODES; k++) {
      // The stretch starts at the SECOND partial. Applying it from the first pulled the whole set up
      // and the ear followed, which is why this measured a couple of per cent sharp at every note.
      const r = k === 0 ? 1 : (k + 1) * (1 + stretch * 0.02 * k);
      const hz = f0 * r;
      if (hz >= top) { amps.push(0); continue; }
      // Higher partials die sooner, as they do on anything real.
      const qk = Math.max(2, t60 * hz / 2.2 / (1 + k * 0.6));
      this.modes[k].set(hz, qk, sr);
      // High partials fall away with brightness, which is what "dark" means on a struck body. The
      // fundamental leads by a wide margin — without that the ear hears the partial that happens to
      // be loudest as the note, which is why this read a semitone and a half sharp.
      amps.push((k === 0 ? 1.6 : 0.45) * Math.pow(bright, k * 0.7) / (1 + k * 0.6));
    }
    this.exc.set(clamp(f0 * (2 + brightness * 40), 100, top), 1.5, sr);
    for (let i = 0; i < n; i++) {
      let x = 0;
      if (this.burst > 0) { x = 1; this.burst--; }
      const e = this.exc.process(x)[0];
      aux[i] += e;
      let y = 0;
      for (let k = 0; k < MODES; k++) {
        if (!amps[k]) continue;
        y += this.modes[k].process(e)[1] * amps[k];     // the band, not the low or the high
      }
      out[i] = softLimit(y * 2);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// STAGE 3 — THE OSCILLATORS.
//
// Unlike the physical models these do NOT shape themselves: they run continuously and the low pass
// gate does the striking, which is exactly what a gate is for. So they are written as plain
// generators — phase in, sample out — and the socket does the rest.
//
// BAND LIMITED, because the alternative is unlistenable. A naive saw or square has a discontinuity,
// and a discontinuity sampled at 48kHz folds every harmonic above Nyquist back down into the audible
// band as a ringing that moves the wrong way when you change pitch. PolyBLEP fixes the two samples
// either side of each jump — a fraction of the cost of oversampling and inaudible from it here.
const polyBlep = (t, dt) => {
  if (t < dt) { const x = t / dt; return x + x - x * x - 1; }
  if (t > 1 - dt) { const x = (t - 1) / dt; return x * x + x + x + 1; }
  return 0;
};

// VIRTUAL ANALOG — two detuned oscillators and a sub, which is the sound every polysynth is built on.
//   HARMONICS  detune, from unison to a wide beat
//   TIMBRE     pulse width
//   MORPH      saw at one end, square at the other
class VaEngine {
  constructor() { this.p1 = 0; this.p2 = 0.13; this.ps = 0; this.dcX = 0; this.dcY = 0; this.dcXs = 0; this.dcYs = 0; }
  render(out, aux, n, f0, harmonics, timbre, morph, sr) {
    const detune = 1 + harmonics * 0.06;                 // up to a semitone and a bit apart
    const pw = clamp(0.5 + (timbre - 0.5) * 0.9, 0.06, 0.94);
    const d1 = f0 / sr, d2 = f0 * detune / sr, ds = f0 * 0.5 / sr;
    for (let i = 0; i < n; i++) {
      this.p1 += d1; if (this.p1 >= 1) this.p1 -= 1;
      this.p2 += d2; if (this.p2 >= 1) this.p2 -= 1;
      this.ps += ds; if (this.ps >= 1) this.ps -= 1;
      const saw = (t, dt) => 2 * t - 1 - polyBlep(t, dt);
      const sq = (t, dt) => {
        let v = t < pw ? 1 : -1;
        v += polyBlep(t, dt);
        v -= polyBlep((t + 1 - pw) % 1, dt);
        return v;
      };
      const a = saw(this.p1, d1) * (1 - morph) + sq(this.p1, d1) * morph;
      const b = saw(this.p2, d2) * (1 - morph) + sq(this.p2, d2) * morph;
      // AC-COUPLED. R at 0.9995 puts the corner near 4Hz — below anything anyone plays, so the note
      // is untouched and only the offset goes.
      const raw = (a + b) * 0.4;
      this.dcY = raw - this.dcX + 0.9995 * this.dcY; this.dcX = raw;
      out[i] = this.dcY;
      const rawS = sq(this.ps, ds) * 0.5;                // the sub, an octave down
      this.dcYs = rawS - this.dcXs + 0.9995 * this.dcYs; this.dcXs = rawS;
      aux[i] = this.dcYs;
    }
  }
}

// WAVESHAPING — a variable-slope triangle pushed through a folder. Small settings are a filtered
// sawtooth; wound up it is the metallic, formant-ish sound a wavefolder makes and nothing else does.
//   HARMONICS  drive into the folder
//   TIMBRE     how much folding
//   MORPH      the slope, from ramp through triangle to the mirrored ramp
class ShaperEngine {
  constructor() { this.p = 0; }
  render(out, aux, n, f0, harmonics, timbre, morph, sr) {
    const d = f0 / sr;
    const slope = clamp(morph, 0.02, 0.98);
    const drive = 0.3 + harmonics * 6;
    const fold = timbre * 3;
    for (let i = 0; i < n; i++) {
      this.p += d; if (this.p >= 1) this.p -= 1;
      // A triangle whose peak sits wherever `slope` says: at 0.5 it is symmetric, at either end a ramp.
      const t = this.p < slope ? this.p / slope : 1 - (this.p - slope) / (1 - slope);
      let x = t * 2 - 1;
      x = Math.sin(x * (1 + drive));                     // the shaper
      // The folder: reflect anything past the rails back in, which is what makes the harmonics.
      let y = x * (1 + fold);
      for (let k = 0; k < 3; k++) {
        if (y > 1) y = 2 - y; else if (y < -1) y = -2 - y; else break;
      }
      out[i] = y * 0.7;
      aux[i] = x * 0.7;                                  // before the folder, for a tamer voice
    }
  }
}

// TWO-OPERATOR FM — one oscillator modulating another's phase, which is the whole of it.
//   HARMONICS  the ratio between them, stepped to musical intervals
//   TIMBRE     the modulation index — how far the modulator pushes the carrier
//   MORPH      feedback, the carrier modulating itself into noise
const FM_RATIOS = [0.25, 0.5, 0.5, 1, 1, 1, 1.5, 2, 2, 3, 4, 5, 6, 7, 8, 12];
class FmEngine {
  constructor() { this.pc = 0; this.pm = 0; this.fb = 0; }
  render(out, aux, n, f0, harmonics, timbre, morph, sr) {
    // Stepped, not swept: an FM ratio between two whole numbers is an inharmonic clang, which is a
    // legitimate sound but not one you want to pass through on the way to the useful ones.
    const ratio = FM_RATIOS[Math.min(FM_RATIOS.length - 1, Math.floor(harmonics * FM_RATIOS.length))];
    const index = timbre * timbre * 8;
    const fbAmt = morph * morph * 0.8;
    const dc = f0 / sr, dm = f0 * ratio / sr;
    for (let i = 0; i < n; i++) {
      this.pc += dc; if (this.pc >= 1) this.pc -= 1;
      this.pm += dm; if (this.pm >= 1) this.pm -= 1;
      const m = Math.sin(2 * Math.PI * this.pm);
      const y = Math.sin(2 * Math.PI * this.pc + index * m + this.fb * fbAmt);
      this.fb = y;
      out[i] = y * 0.8;
      aux[i] = m * 0.8;                                   // the modulator on its own
    }
  }
}

// NOISE — sampled at a rate you choose, through a resonant filter. At a high clock rate it is hiss;
// slowed down it is the stepped, pitched rattle that makes snares and cymbals and wind.
//   HARMONICS  resonance
//   TIMBRE     the filter's frequency, tracking the note
//   MORPH      how fast the noise is re-sampled
class NoiseEngine {
  constructor() { this.rng = new Prng(0x9e37); this.hold = 0; this.acc = 0; this.f = new Svf(); }
  render(out, aux, n, f0, harmonics, timbre, morph, sr) {
    const rate = clamp(f0 * Math.pow(2, (morph - 0.5) * 8), 20, sr * 0.45);
    const hz = clamp(f0 * Math.pow(2, (timbre - 0.5) * 6), 20, sr * 0.45);
    const q = 0.7 + harmonics * harmonics * 60;
    this.f.set(hz, q, sr);
    const inc = rate / sr;
    for (let i = 0; i < n; i++) {
      this.acc += inc;
      if (this.acc >= 1) { this.acc -= 1; this.hold = this.rng.next(); }
      const [lp, bp] = this.f.process(this.hold);
      out[i] = softLimit(bp * (1 + harmonics * 2));
      aux[i] = this.hold * 0.5;                           // the raw stepped noise
    }
  }
}

// ---------------------------------------------------------------------------------------------
// STAGE 4 — THE DRUMS.
//
// Analogue drum voices, in the sense that the machines of the early eighties were analogue: a kick is
// a sine whose pitch falls, a snare is that plus noise, a hat is a fistful of square waves through a
// high pass. None of it models a drum; all of it models the CIRCUIT that stood in for one, which is
// the sound people actually want.
//
// LIKE THE PHYSICAL MODELS, THEY ENVELOPE THEMSELVES. A kick decays because it is a kick. MORPH is
// the decay in all three, so one knob means one thing across the percussion half of the list.

// A trivial exponential envelope, retriggered by the strike. Held as a value and a rate rather than
// a phase, so a retrigger is a jump to 1 and nothing else has to be reset.
class Env {
  constructor() { this.v = 0; this.k = 0; }
  // t60 IS SIXTY DECIBELS, not a time constant. exp(-1/(t·sr)) decays by 1/e in t seconds and is
  // still audible more than five times later — which is why a kick asked for a third of a second
  // rang for nearly four. The 6.9 is ln(1000): the point where it is a thousandth of its peak.
  set(t60, sr) { this.k = Math.exp(-6.9 / Math.max(1, t60 * sr)); }
  trig() { this.v = 1; }
  next() { this.v *= this.k; return this.v < 1e-5 ? (this.v = 0) : this.v; }
}

// KICK — a sine that starts sharp and falls onto the note, with a click on top.
//   HARMONICS  how far the pitch falls, which is the punch
//   TIMBRE     the click, and how much of it
//   MORPH      the decay
class KickEngine {
  constructor() { this.p = 0; this.amp = new Env(); this.pitch = new Env(); this.click = new Env(); }
  strike() { this.amp.trig(); this.pitch.trig(); this.click.trig(); this.p = 0; }
  render(out, aux, n, f0, harmonics, timbre, morph, sr) {
    this.amp.set(0.05 + morph * morph * 2.5, sr);
    this.pitch.set(0.005 + harmonics * 0.07, sr);      // the drop is fast, and it is the punch
    this.click.set(0.002 + timbre * 0.01, sr);
    const bend = 1 + harmonics * 6;
    for (let i = 0; i < n; i++) {
      const a = this.amp.next(), pe = this.pitch.next(), ce = this.click.next();
      const f = f0 * (1 + bend * pe);
      this.p += f / sr; if (this.p >= 1) this.p -= 1;
      const body = Math.sin(2 * Math.PI * this.p) * a;
      const click = (this.p < 0.5 ? 1 : -1) * ce * timbre * 0.7;
      out[i] = softLimit(body + click);
      aux[i] = body;                                   // the body alone, with no click
    }
  }
}

// SNARE — a tuned shell and a rattle, mixed. The two together are the whole of a snare: a couple of
// modes that give it a pitch, and noise that gives it the snap.
//   HARMONICS  the balance between shell and rattle
//   TIMBRE     how bright the rattle is
//   MORPH      the decay
class SnareEngine {
  constructor() {
    this.p1 = 0; this.p2 = 0; this.amp = new Env(); this.namp = new Env(); this.pitch = new Env();
    this.rng = new Prng(0x5ca1e); this.bp = new Svf();
  }
  strike() { this.amp.trig(); this.namp.trig(); this.pitch.trig(); this.p1 = 0; this.p2 = 0; }
  render(out, aux, n, f0, harmonics, timbre, morph, sr) {
    const t = 0.03 + morph * morph * 1.2;
    this.amp.set(t, sr);
    this.namp.set(t * (0.6 + timbre * 0.8), sr);       // the rattle usually outlasts the shell
    this.pitch.set(0.01, sr);
    this.bp.set(clamp(600 + timbre * 6000, 100, sr * 0.45), 1.2, sr);
    const tone = 1 - harmonics, rattle = harmonics;
    for (let i = 0; i < n; i++) {
      const a = this.amp.next(), na = this.namp.next(), pe = this.pitch.next();
      const f = f0 * (1 + 1.5 * pe);
      this.p1 += f / sr; if (this.p1 >= 1) this.p1 -= 1;
      this.p2 += f * 1.63 / sr; if (this.p2 >= 1) this.p2 -= 1;   // the second mode, deliberately not a whole ratio
      const shell = (Math.sin(2 * Math.PI * this.p1) + Math.sin(2 * Math.PI * this.p2) * 0.7) * a * 0.5;
      const noise = this.bp.process(this.rng.next())[1] * na;
      out[i] = softLimit(shell * tone * 1.4 + noise * rattle * 1.6);
      aux[i] = noise;                                  // the rattle on its own
    }
  }
}

// HAT — six square waves at ratios that are deliberately not musical, high-passed hard. This is the
// 808's trick and there is no more to it: metal is inharmonic, and six squares beating against one
// another sound closer to it than noise does.
//   HARMONICS  how much noise joins the metal
//   TIMBRE     where the high pass sits, which is how bright it is
//   MORPH      the decay — short is a closed hat, long is open
const HAT_RATIOS = [1, 1.4471, 1.6170, 1.9265, 2.5028, 2.6637];
class HatEngine {
  constructor() {
    this.ph = HAT_RATIOS.map(() => 0);
    this.amp = new Env(); this.rng = new Prng(0xbeef1); this.hp = new Svf(); this.bp = new Svf();
  }
  strike() { this.amp.trig(); }
  render(out, aux, n, f0, harmonics, timbre, morph, sr) {
    this.amp.set(0.02 + morph * morph * 1.5, sr);
    const cut = clamp(f0 * (4 + timbre * 40), 400, sr * 0.45);
    this.hp.set(cut, 0.8, sr);
    this.bp.set(clamp(cut * 1.4, 400, sr * 0.45), 1.0, sr);
    const base = f0 * 6;                                // hats sit far above the note they are given
    for (let i = 0; i < n; i++) {
      const a = this.amp.next();
      let metal = 0;
      for (let k = 0; k < HAT_RATIOS.length; k++) {
        const d = base * HAT_RATIOS[k] / sr;
        this.ph[k] += d; if (this.ph[k] >= 1) this.ph[k] -= 1;
        metal += this.ph[k] < 0.5 ? 1 : -1;
      }
      metal /= HAT_RATIOS.length;
      const mix = metal * (1 - harmonics) + this.rng.next() * harmonics;
      const y = this.hp.process(mix)[2];               // the high part: a hat is all top
      out[i] = softLimit(y * a * 1.5);
      aux[i] = this.bp.process(mix)[1] * a;            // a band-passed version, darker
    }
  }
}

// ---------------------------------------------------------------------------------------------
// STAGE 5 — THE LAST TWO.
//
// GRAIN is a formant oscillator: a short burst of sine, windowed, fired once per cycle of the note.
// The note's pitch is how often the burst happens; the burst's own frequency is a resonance sitting
// on top of it, unrelated to the pitch. That is what makes it sound vocal — it is how a voice works,
// a pitch from the vocal folds and formants from the tube above them that do not move with it.
//
//   HARMONICS  the formant, as a ratio to the note
//   TIMBRE     how long the burst lasts, from a click to most of the cycle
//   MORPH      the window's shape, from a hard gate to a smooth bell
class GrainEngine {
  constructor() { this.p = 0; this.g = 0; }
  render(out, aux, n, f0, harmonics, timbre, morph, sr) {
    const d = f0 / sr;
    const formant = 1 + harmonics * 15;                  // up to four octaves above the note
    const width = 0.05 + timbre * 0.9;                   // how much of the cycle the grain fills
    for (let i = 0; i < n; i++) {
      this.p += d;
      if (this.p >= 1) { this.p -= 1; this.g = 0; }      // a new grain, once a cycle
      this.g += d;
      const t = this.g / width;                          // 0..1 through the grain, then past it
      let y = 0, w = 0;
      if (t < 1) {
        // The window: a raised cosine at one end of MORPH, a rectangle at the other. A hard window
        // is a click with a pitch; a soft one is a formant.
        const bell = 0.5 - 0.5 * Math.cos(2 * Math.PI * t);
        w = bell * morph + (1 - morph);
        y = Math.sin(2 * Math.PI * t * formant * width) * w;
      }
      out[i] = y * 0.8;
      aux[i] = w * 2 - 1;                                // the window on its own: a pulse at the note
    }
  }
}

// PARTICLE is the opposite idea: not one grain a cycle, but grains at random, each ringing a filter
// tuned near the note. Sparse, it is a rattle or a rainstick; dense, it is a resonant hiss with a
// pitch you can hear but no fundamental.
//
//   HARMONICS  how far the filters wander from the note
//   TIMBRE     where the band sits
//   MORPH      density — how often a particle arrives
const PARTICLES = 4;
class ParticleEngine {
  constructor() {
    this.rng = new Prng(0x13579b);
    this.f = Array.from({ length: PARTICLES }, () => new Svf());
    this.amp = new Float32Array(PARTICLES);
  }
  render(out, aux, n, f0, harmonics, timbre, morph, sr) {
    const density = 0.00005 + morph * morph * 0.02;      // particles per sample
    const centre = clamp(f0 * Math.pow(2, (timbre - 0.5) * 4), 20, sr * 0.45);
    const spread = harmonics * 2;
    for (let i = 0; i < n; i++) {
      let raw = 0;
      // A new particle: retune one of the filters somewhere around the centre and hit it.
      if ((this.rng.next() * 0.5 + 0.5) < density) {
        const k = Math.floor((this.rng.next() * 0.5 + 0.5) * PARTICLES) % PARTICLES;
        const hz = clamp(centre * Math.pow(2, this.rng.next() * spread), 20, sr * 0.45);
        this.f[k].set(hz, 20 + harmonics * 200, sr);
        this.amp[k] = 1;
        raw = 1;
      }
      let y = 0;
      for (let k = 0; k < PARTICLES; k++) {
        if (this.amp[k] <= 0) continue;
        y += this.f[k].process(this.amp[k] === 1 ? 1 : 0)[1];
        this.amp[k] = 0.5;                               // the impulse is one sample; the ring is the filter
      }
      out[i] = softClip(y * 2);
      aux[i] = raw;                                      // the bare impulses, for triggering something else
    }
  }
}

// The decay time the DECAY knob asks for, in seconds: a short pluck at one end, a long ring at the
// other, exponential between them because that is how the ear reads time.
const decaySeconds = (d) => 0.005 * Math.pow(2000, clamp(d, 0, 1));

class ModelVoice extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    const p = (name, defaultValue, minValue, maxValue) =>
      ({ name, defaultValue, minValue, maxValue, automationRate: 'k-rate' });
    return [
      p('freq', 220, 27.5, 7040),
      p('harmonics', 0.4, 0, 1), p('timbre', 0.5, 0, 1), p('morph', 0.5, 0, 1),
      p('fmDepth', 0, -1, 1), p('harmonicsDepth', 0, -1, 1),
      p('timbreDepth', 0, -1, 1), p('morphDepth', 0, -1, 1),
      p('decay', 0.5, 0, 1), p('colour', 0.5, 0, 1),
    ];
  }

  constructor() {
    super();
    this.model = 'string';
    // WHICH INPUTS HAVE CABLES. An input's own signal cannot answer this — nothing patched and a
    // patched cable sitting at zero are the same samples — and the difference decides whether the
    // internal envelope drives that parameter. So the host says, on connect and disconnect.
    this.port.onmessage = (e) => {
      const m = e.data || {};
      if (m.model !== undefined) this.model = String(m.model);
    };

    this.string = null;     // built on the first block, when the sample rate is known
    this.modal = null;
    this.va = new VaEngine();
    this.shaper = new ShaperEngine();
    this.fm = new FmEngine();
    this.noise = new NoiseEngine();
    this.kick = new KickEngine();
    this.snare = new SnareEngine();
    this.hat = new HatEngine();
    this.grain = new GrainEngine();
    this.particle = new ParticleEngine();
    this.armed = true;      // ready for a rising edge
    this.env = 0;           // the internal decay envelope, 1 at the strike
    this.lpg = 0;           // the gate's own follower, which lags the envelope
    this.phase = 0;         // the one engine that exists so far
  }

  // THE ENVELOPE'S PER-SAMPLE DECAY COEFFICIENT. It used to step once a block, which is a gain
  // staircase 128 samples wide — up to half the amplitude in one jump every 2.7ms. That is a click
  // on every step, loudest on whatever engine has the most high frequency content, and it was the
  // clicking heard on the FM voice. A gain that moves must move per sample.
  _envCoef(decay, sr) {
    return Math.exp(-1 / Math.max(1, decaySeconds(decay) * sr));
  }

  process(inputs, outputs, params) {
    const out = outputs[OUT.out][0];
    const aux = outputs[OUT.aux][0];
    const n = out.length;
    const sr = sampleRate;

    // WHICH INPUTS HAVE CABLES, asked of Web Audio rather than of the host. An unconnected input
    // arrives as an EMPTY ARRAY — that is the platform telling us, per block, for nothing. This used
    // to be reported over the message port by the factory, and the rack never called the method that
    // would have sent it: every CV input was permanently "unpatched", so the four modulation inputs
    // and LEVEL did nothing at all. A fact the runtime already knows should never be mirrored by
    // hand; the copy is what goes stale, and here it was never written in the first place.
    const patched = (k) => { const inp = inputs[k]; return !!(inp && inp.length && inp[0] && inp[0].length); };
    const pFm = patched(IN.fm), pHarm = patched(IN.harmonics), pTimbre = patched(IN.timbre);
    const pMorph = patched(IN.morph), pLevel = patched(IN.level);

    const trig = inputs[IN.trig] && inputs[IN.trig][0];
    const level = inputs[IN.level] && inputs[IN.level][0];
    const pitchCv = inputs[IN.pitch] && inputs[IN.pitch][0];
    const fmCv = inputs[IN.fm] && inputs[IN.fm][0];
    const timbreCv = inputs[IN.timbre] && inputs[IN.timbre][0];
    const morphCv = inputs[IN.morph] && inputs[IN.morph][0];
    const harmCv = inputs[IN.harmonics] && inputs[IN.harmonics][0];

    // ---- the strike. Scanned per sample so a trigger is never missed between blocks.
    if (trig && trig.length) {
      for (let i = 0; i < n; i++) {
        const v = trig[i];
        if (this.armed && v > TRIG_HI) {
          // The ENVELOPE jumps to one; the GATE does not. Setting the follower to full as well was a
          // gain step from silence to full in a single sample at the head of every note — the click
          // that survived making the decay per-sample, once per trigger, at the clock's rate. The
          // follower now rises to it over about a millisecond, which is what a low pass gate does.
          this.armed = false; this.env = 1;
          this.struck = true;   // the engines are told once, after the parameters are known
        }
        else if (!this.armed && v < TRIG_LO) this.armed = true;
      }
    }

    const decay = params.decay[0];
    const colour = params.colour[0];
    const envK = this._envCoef(decay, sr);
    // What the envelope is worth AT THE START of this block, for the k-rate modulation below. The
    // parameters an engine is handed are per block by nature; only the GAIN has to be per sample.
    const envNow = this.env;

    // ---- what the engine is asked for. A patched CV lands on the parameter at the depth its trim
    // says; an UNPATCHED one hands that trim to the internal envelope instead, which is the whole
    // trick that makes one cable into TRIG sound like a played note.
    const mod = (cv, isPatched, depth) =>
      (isPatched && cv && cv.length ? cv[0] * depth : envNow * depth);

    // LEVEL IS AN ACCENT, not just a gate. On the original a harder hit is brighter as well as
    // louder, which is true of every real instrument and is most of what makes a sequence with
    // dynamics sound played rather than typed. It lifts brightness towards its top, so a soft hit is
    // duller than a hard one at the same knob setting.
    const accent = pLevel && level && level.length ? clamp(level[0], 0, 1) : 1;

    let harmonics = clamp(params.harmonics[0] + mod(harmCv, pHarm, params.harmonicsDepth[0]), 0, 1);
    let timbre = clamp(params.timbre[0] + mod(timbreCv, pTimbre, params.timbreDepth[0]), 0, 1);
    const morph = clamp(params.morph[0] + mod(morphCv, pMorph, params.morphDepth[0]), 0, 1);
    if (pLevel) timbre = clamp(timbre + 0.25 * (1 - timbre) * (accent - 1) + 0.25 * (accent - 1), 0, 1);

    // Pitch: the knob in hertz, the v/oct input in volts-as-octaves, and FM at its own depth.
    let f = params.freq[0];
    if (pitchCv && pitchCv.length) f *= Math.pow(2, pitchCv[0]);
    if (pFm && fmCv && fmCv.length) f *= Math.pow(2, fmCv[0] * params.fmDepth[0]);
    else f *= Math.pow(2, envNow * params.fmDepth[0]);
    f = clamp(f, 8, sr * 0.45);

    // ---- THE ENGINE. Each writes `out` and `aux` for the whole block and says whether it has
    // already shaped its own decay; the gate below runs only for the ones that have not.
    if (!this.string) { this.string = new StringModel(sr); this.modal = new ModalModel(sr); }
    out.fill(0); aux.fill(0);
    let enveloped = false;

    if (this.model === 'string' || this.model === 'modal') {
      // DECAY joins damping for these two. A struck string's length of ring is the same idea as the
      // envelope's, and having two controls fight over it is how a module ends up with a knob that
      // seems not to work.
      const damping = clamp(morph * 0.7 + (1 - decay) * 0.3, 0, 1);
      if (this.struck) {
        if (this.model === 'string') this.string.strike(f, timbre); else this.modal.strike();
      }
      if (this.model === 'string') this.string.render(out, aux, n, f, harmonics, timbre, damping);
      else this.modal.render(out, aux, n, f, harmonics, timbre, damping);
      enveloped = true;   // it decays because it is a string, not because we turned it down
    } else if (this.model === 'kick' || this.model === 'snare' || this.model === 'hat') {
      const e = this.model === 'kick' ? this.kick : this.model === 'snare' ? this.snare : this.hat;
      if (this.struck) e.strike();
      // DECAY joins MORPH here for the same reason it does on the physical models: they are the same
      // idea, and two knobs fighting over one is how a control ends up seeming not to work.
      e.render(out, aux, n, f, harmonics, timbre, clamp(morph * 0.7 + decay * 0.3, 0, 1), sr);
      enveloped = true;
    } else if (this.model === 'analog') {
      this.va.render(out, aux, n, f, harmonics, timbre, morph, sr);
    } else if (this.model === 'shaper') {
      this.shaper.render(out, aux, n, f, harmonics, timbre, morph, sr);
    } else if (this.model === 'fm') {
      this.fm.render(out, aux, n, f, harmonics, timbre, morph, sr);
    } else if (this.model === 'noise') {
      this.noise.render(out, aux, n, f, harmonics, timbre, morph, sr);
    } else if (this.model === 'grain') {
      this.grain.render(out, aux, n, f, harmonics, timbre, morph, sr);
    } else if (this.model === 'particle') {
      this.particle.render(out, aux, n, f, harmonics, timbre, morph, sr);
    } else {
      // STAGE 0's PLACEHOLDER, still here for the models that have no engine yet: a saw and a square,
      // which is not one of the sixteen and is not pretending to be.
      const inc = f / sr;
      for (let i = 0; i < n; i++) {
        this.phase += inc;
        if (this.phase >= 1) this.phase -= 1;
        const saw = 2 * this.phase - 1;
        const sq = this.phase < 0.5 + (morph - 0.5) * 0.9 ? 1 : -1;
        out[i] = saw * (1 - harmonics) + sq * harmonics;
        aux[i] = sq;
      }
    }
    this.struck = false;

    // ---- THE LOW PASS GATE. It follows the envelope, and COLOUR decides what it does on the way
    // down: at zero a plain fall in level, at one a fall in level AND in brightness, which is what
    // makes a struck sound read as struck rather than as a tone being turned off. The brightness
    // half is one pole, which is all a vactrol is worth pretending to be.
    if (enveloped) {
      for (let i = 0; i < n; i++) { out[i] = softClip(out[i]); aux[i] = softClip(aux[i]); }
      // Already shaped. LEVEL still applies — it is an accent, and an accent is a thing you do to a
      // note that already has a shape.
      if (pLevel && level && level.length) {
        const g = clamp(level[0], 0, 1);
        for (let i = 0; i < n; i++) { out[i] *= g; aux[i] *= g; }
      }
      return true;
    }

    // NOTHING LEAVES THIS MODULE ABOVE ONE. Each engine is scaled to sit comfortably below it, but
    // "comfortably" is a judgement made per engine and three of them were over with every control at
    // maximum — the noise engine reached 1.25. One bound at the exit is the only version of this that
    // an engine written next month cannot get wrong.
    for (let i = 0; i < n; i++) { out[i] = softClip(out[i]); aux[i] = softClip(aux[i]); }

    const levelPatched = pLevel && level && level.length;
    // The follower's own smoothing, in samples: about a millisecond, which rounds the corner at the
    // strike without softening the attack audibly.
    const follow = 1 - Math.exp(-1 / (0.001 * sr));
    this.lp = this.lp || 0;
    this.lpAux = this.lpAux || 0;
    for (let i = 0; i < n; i++) {
      // Envelope, gate and cutoff all advance HERE, once per sample.
      if (this.env > 0) { this.env *= envK; if (this.env < 1e-5) this.env = 0; }
      const target = levelPatched ? clamp(level[i] !== undefined ? level[i] : level[0], 0, 1) : this.env;
      this.lpg += (target - this.lpg) * follow;
      const g = this.lpg;
      const cut = clamp(Math.pow(g, 1 + colour * 3), 0, 1);
      const a = 1 - Math.exp(-2 * Math.PI * clamp(cut * 8000 + 40, 20, sr * 0.45) / sr);
      this.lp += a * (out[i] - this.lp);
      this.lpAux += a * (aux[i] - this.lpAux);
      out[i] = this.lp * g;
      aux[i] = this.lpAux * g;
    }
    return true;
  }
}

// The primitives, reachable from a test harness. An AudioWorklet has no exports, so a bench can only
// see what the class carries — and primitives that can only be tested THROUGH an engine are
// primitives whose bugs get blamed on the engine.
ModelVoice.dsp = { softLimit, softClip, semitonesToRatio, OnePole, Svf, Prng, DelayLine, clamp };

registerProcessor('model-voice-processor', ModelVoice);
