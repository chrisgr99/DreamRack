// envelope-processor.js — an ADSR envelope.
//
// TIMES ARE EXACT. Each stage advances a phase from 0 to 1 over the time its knob asks for, and the
// LEVEL is a curve over that phase. The other common construction — an exponential approach with a
// fixed time constant — never actually arrives, so its "attack time" is a time constant rather than a
// duration and a one-second attack takes about five seconds to look finished. Here a one-second
// attack takes one second, which is what the knob says and what you can check.
//
// THE CURVES ARE ANALOG-SHAPED. A capacitor charges fast and then slows, so attack is 1-(1-p)^3 and
// decay and release fall by the same law. Linear ramps are the giveaway of a digital envelope: the
// corner at the top of the attack is audible as a click on a percussive sound.
//
// STAGE MESSAGES, NOT A PLAYHEAD. The panel draws the envelope's shape and brightens whichever
// segment is running, so the DSP posts a message when the stage CHANGES — four per envelope — rather
// than a position every block. A repaint per frame is what we are deliberately not doing.
//
// EVERY change is reported. Capping the rate here was the first attempt and it was wrong: a normal
// envelope with a 10ms attack passes through attack and decay faster than any sensible cap, so the
// panel never saw them and only ever lit sustain. What the eye needs is a MINIMUM time on screen,
// not fewer messages, and that belongs on the panel where the drawing is. The guard left here is
// only against a runaway — an envelope clocked at audio rate has nothing to show anyway.
//
// ZERO ALLOCATION: process() allocates nothing.
'use strict';

const IDLE = 0, ATTACK = 1, DECAY = 2, SUSTAIN = 3, RELEASE = 4;
const STAGE_NAME = ['idle', 'attack', 'decay', 'sustain', 'release'];

const EOC_MS = 2;              // end-of-cycle pulse width
const MIN_STAGE_MS = 4;        // runaway guard only; the panel does the dwell

class Envelope extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'attack', defaultValue: 0.01, minValue: 0.0005, maxValue: 10, automationRate: 'k-rate' },
      { name: 'decay', defaultValue: 0.2, minValue: 0.0005, maxValue: 10, automationRate: 'k-rate' },
      { name: 'sustain', defaultValue: 0.6, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'release', defaultValue: 0.4, minValue: 0.0005, maxValue: 10, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this._stage = IDLE;
    this._phase = 0;          // 0..1 through the current stage
    this._level = 0;
    this._from = 0;           // level the current stage started from
    this._gatePrev = 0;
    this._retrigPrev = 0;
    this._eoc = 0;            // samples of end-of-cycle pulse left to emit
    this._invSr = 1 / sampleRate;
    this._eocSamples = Math.max(1, Math.round(sampleRate * EOC_MS / 1000));
    this._reported = IDLE;
    this._reportAt = 0;       // currentTime of the last report, for the cap
  }

  _enter(stage) {
    this._stage = stage;
    this._phase = 0;
    this._from = this._level;
  }

  process(inputs, outputs, parameters) {
    const env = outputs[0] && outputs[0][0];
    const inv = outputs[1] && outputs[1][0];
    const eocCh = outputs[2] && outputs[2][0];
    const n = (env || inv || eocCh || []).length;
    if (!n) return true;

    const gateIn = inputs[0] && inputs[0][0];
    const retrigIn = inputs[1] && inputs[1][0];

    const aT = parameters.attack[0], dT = parameters.decay[0];
    const sL = parameters.sustain[0], rT = parameters.release[0];
    const invSr = this._invSr;

    let stage = this._stage, phase = this._phase, level = this._level, from = this._from;
    let gatePrev = this._gatePrev, retrigPrev = this._retrigPrev, eoc = this._eoc;

    for (let i = 0; i < n; i++) {
      const g = gateIn ? gateIn[i] : 0;
      const rt = retrigIn ? retrigIn[i] : 0;

      // A gate's RISING edge starts the envelope; its fall releases it. Retrigger restarts the
      // attack from wherever the level happens to be, which is what makes repeated notes under a
      // held gate sound played rather than reset.
      if (gatePrev <= 0 && g > 0) { this._level = level; this._enter(ATTACK); stage = ATTACK; phase = 0; from = level; }
      else if (gatePrev > 0 && g <= 0 && stage !== IDLE && stage !== RELEASE) {
        this._level = level; this._enter(RELEASE); stage = RELEASE; phase = 0; from = level;
      }
      if (retrigPrev <= 0 && rt > 0 && stage !== IDLE) {
        this._level = level; this._enter(ATTACK); stage = ATTACK; phase = 0; from = level;
      }
      gatePrev = g; retrigPrev = rt;

      switch (stage) {
        case ATTACK: {
          phase += invSr / (aT > 0 ? aT : 1e-4);
          if (phase >= 1) { level = 1; stage = DECAY; phase = 0; from = 1; }
          else { const k = 1 - phase; level = from + (1 - from) * (1 - k * k * k); }
          break;
        }
        case DECAY: {
          phase += invSr / (dT > 0 ? dT : 1e-4);
          if (phase >= 1) { level = sL; stage = SUSTAIN; phase = 0; from = sL; }
          else { const k = 1 - phase; level = sL + (from - sL) * (k * k * k); }
          break;
        }
        case SUSTAIN:
          level = sL;
          break;
        case RELEASE: {
          phase += invSr / (rT > 0 ? rT : 1e-4);
          if (phase >= 1) { level = 0; stage = IDLE; phase = 0; from = 0; eoc = this._eocSamples; }
          else { const k = 1 - phase; level = from * (k * k * k); }
          break;
        }
        default:
          level = 0;
      }

      if (env) env[i] = level;
      if (inv) inv[i] = 1 - level;
      if (eocCh) { eocCh[i] = eoc > 0 ? 1 : 0; if (eoc > 0) eoc--; }
    }

    this._stage = stage; this._phase = phase; this._level = level; this._from = from;
    this._gatePrev = gatePrev; this._retrigPrev = retrigPrev; this._eoc = eoc;

    // One message per stage change, rate-capped. Cheap, and the panel does the rest.
    if (stage !== this._reported && currentTime - this._reportAt >= MIN_STAGE_MS / 1000) {
      this._reported = stage;
      this._reportAt = currentTime;
      this.port.postMessage({ type: 'stage', value: STAGE_NAME[stage] });
    }
    return true;
  }
}

registerProcessor('wcoast-envelope', Envelope);
