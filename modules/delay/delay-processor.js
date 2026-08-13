// delay-processor.js — the delay line.
//
// Ported in structure from VCV Fundamental's Delay (GPL-3.0): the same four controls, the same
// exponential time, the same one-knob tone splitting a lowpass and a highpass about the middle, the
// same clock capture. What is written differently is said where it happens.
//
// THE LINE ITSELF is a ring buffer with a fractional read head, read with a cubic interpolation
// (Catmull-Rom). Linear interpolation on a delay line is a lowpass whose corner falls with the
// fractional part of the read position, so a moving delay whistles and a still one is dull at the
// wrong times; cubic costs three multiplies more and neither happens.
//
// THE TIME GLIDES rather than jumping. Assigning a new read position is a discontinuity in the
// signal — a click, and a loud one at the long end where the buffer holds something quite different.
// A one-pole on the delay LENGTH turns every time change into a sweep, which is also the thing a
// delay is worth having for: the pitch-bend as the head moves. Fundamental resamples instead, which
// holds pitch and is the other legitimate answer; this one is the tape answer.

const MAX_SECONDS = 10.5;              // the knob's ten, plus room for the glide to overshoot into
const GLIDE_TAU = 0.08;                // how fast the read head chases a new time, in seconds
const CLOCK_TIMEOUT = 4.0;             // no edge for this long and the clock is considered gone

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

class DelayProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'time', defaultValue: 0.5, minValue: 0.001, maxValue: 10, automationRate: 'k-rate' },
      { name: 'timeDepth', defaultValue: 1, minValue: -1, maxValue: 1, automationRate: 'k-rate' },
      { name: 'feedback', defaultValue: 0.5, minValue: 0, maxValue: 0.98, automationRate: 'k-rate' },
      { name: 'feedbackDepth', defaultValue: 1, minValue: -1, maxValue: 1, automationRate: 'k-rate' },
      { name: 'tone', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'toneDepth', defaultValue: 1, minValue: -1, maxValue: 1, automationRate: 'k-rate' },
      { name: 'mix', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'mixDepth', defaultValue: 1, minValue: -1, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.size = Math.ceil(MAX_SECONDS * sampleRate) + 4;
    this.buf = new Float32Array(this.size);
    this.write = 0;
    this.delaySamples = -1;                 // the glided length, in samples; -1 until the first block
                                            // sets it from the knob — see the snap in process()
    this.lp = 0; this.hp = 0;               // the two one-poles in the feedback path
    this.prevClock = 0;
    this.clockCount = 0;                    // samples since the last rising edge
    this.clockPeriod = 0;                   // seconds between the last two, 0 when there is no clock
    this.clockAge = 0;                      // seconds since the last edge
    this.shown = null;                      // what the window is currently saying
    this.glideCoef = 1 - Math.exp(-1 / (GLIDE_TAU * sampleRate));
  }

  // Catmull-Rom through the four samples around a fractional position.
  read(pos) {
    const i = Math.floor(pos);
    const f = pos - i;
    const n = this.size;
    const y0 = this.buf[((i - 1) % n + n) % n];
    const y1 = this.buf[(i % n + n) % n];
    const y2 = this.buf[((i + 1) % n + n) % n];
    const y3 = this.buf[((i + 2) % n + n) % n];
    const a = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3;
    const b = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
    const c = -0.5 * y0 + 0.5 * y2;
    return ((a * f + b) * f + c) * f + y1;
  }

  process(inputs, outputs, params) {
    const wetOut = outputs[0] && outputs[0][0];
    const mixOut = outputs[1] && outputs[1][0];
    const n = (wetOut && wetOut.length) || (mixOut && mixOut.length) || 128;
    const sr = sampleRate;

    const chan = (k) => (inputs[k] && inputs[k][0] && inputs[k][0].length ? inputs[k][0] : null);
    const audio = chan(0), clock = chan(1);
    const timeCv = chan(2), fbCv = chan(3), toneCv = chan(4), mixCv = chan(5);
    const pv = (name) => params[name][0];
    const cvAt = (buf, i) => (buf ? buf[Math.min(i, buf.length - 1)] : 0);

    const fbBase = pv('feedback'), fbDepth = pv('feedbackDepth');
    const toneBase = pv('tone'), toneDepth = pv('toneDepth');
    const mixBase = pv('mix'), mixDepth = pv('mixDepth');
    const timeBase = pv('time'), timeDepth = pv('timeDepth');

    for (let i = 0; i < n; i++) {
      // --- the clock, if there is one -------------------------------------------------------
      // Measured between rising edges, and forgotten if they stop: a delay that stayed locked to a
      // tempo whose cable has been pulled would leave the knob dead with nothing to say why.
      if (clock) {
        const v = clock[i] > 0.5 ? 1 : 0;
        this.clockCount++;
        if (v && !this.prevClock) {
          const p = this.clockCount / sr;
          if (p > 0.002 && p < CLOCK_TIMEOUT) this.clockPeriod = p;
          this.clockCount = 0;
          this.clockAge = 0;
        }
        this.prevClock = v;
      }
      this.clockAge += 1 / sr;
      if (this.clockAge > CLOCK_TIMEOUT) this.clockPeriod = 0;

      // --- how long the line is -------------------------------------------------------------
      // CLOCKED, the time is a division of the measured beat and the knob is not consulted at all.
      // Free, it is the knob plus its CV, exponential the whole way — a volt doubling it, which is
      // what makes a delay time playable from a pitch source.
      // THE KNOB IS A RATIO WHEN THERE IS A CLOCK, exactly as the original's is: it computes a delay
      // FREQUENCY of clockFreq/2 times two-to-the-knob, and takes clockFreq as 2Hz when nothing is
      // patched. Which comes to the same thing said the other way round — the knob's seconds, scaled
      // by how far the incoming beat is from the half second that reference implies. So the knob at
      // 0.5s is one beat at any tempo, at 0.25s half a beat, at 1s two beats, and the whole four
      // decades of its travel are decades of RATIO rather than of duration.
      const cv = cvAt(timeCv, i) * timeDepth;
      let seconds = timeBase * Math.pow(2, cv);
      if (this.clockPeriod > 0) seconds *= this.clockPeriod / 0.5;
      seconds = clamp(seconds, 0.001, 10);
      const target = seconds * sr;
      // THE FIRST BLOCK SNAPS. The glide is what makes a time CHANGE a sweep rather than a click, and
      // there is no change to sweep from when the module has only just appeared: starting the head at
      // some fixed length and letting it slide to the knob's meant the first echo of a fresh delay
      // arrived at the wrong time and bent on the way.
      if (this.delaySamples < 0) this.delaySamples = target;
      else this.delaySamples += (target - this.delaySamples) * this.glideCoef;

      // --- the line -------------------------------------------------------------------------
      const x = audio ? audio[i] : 0;
      let wet = this.read(this.write - this.delaySamples + this.size);

      // TONE, from the middle, on what goes BACK IN rather than on what comes out. A tone control on
      // the output colours every repeat identically; in the loop it colours each one again, so the
      // tail walks away from the source instead of merely repeating it quieter.
      const tone = clamp(toneBase + cvAt(toneCv, i) * toneDepth, 0, 1);
      if (tone < 0.5) {
        const f = 20000 * Math.pow(0.0015, 1 - tone * 2);   // 20k at noon down to 30Hz at the floor
        const a = 1 - Math.exp(-2 * Math.PI * Math.min(f, sr * 0.45) / sr);
        this.lp += a * (wet - this.lp);
        wet = this.lp;
      } else if (tone > 0.5) {
        const f = 20 * Math.pow(500, (tone - 0.5) * 2);     // 20Hz at noon up to 10k at the ceiling
        const a = 1 - Math.exp(-2 * Math.PI * Math.min(f, sr * 0.45) / sr);
        this.hp += a * (wet - this.hp);
        wet = wet - this.hp;
      }

      const fb = clamp(fbBase + cvAt(fbCv, i) * fbDepth, 0, 0.98);
      this.buf[this.write] = x + wet * fb;
      this.write = (this.write + 1) % this.size;

      const mix = clamp(mixBase + cvAt(mixCv, i) * mixDepth, 0, 1);
      if (wetOut) wetOut[i] = wet;
      // EQUAL POWER, not a straight crossfade. A linear mix dips three decibels in the middle, which
      // is exactly where a delay is usually set.
      if (mixOut) mixOut[i] = x * Math.cos(mix * Math.PI / 2) + wet * Math.sin(mix * Math.PI / 2);
    }

    return true;
  }
}

registerProcessor('wcoast-delay', DelayProcessor);
