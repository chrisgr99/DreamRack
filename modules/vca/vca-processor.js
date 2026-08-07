// vca-processor.js — a voltage-controlled amplifier.
//
// gain = knob + (CV x depth), and the RESPONSE curve decides what that number means. Linear is the
// honest multiplier and is what you want for audio: half the number is half the amplitude. Exponential
// is what you want for a level you are LISTENING to, because hearing is roughly logarithmic — a linear
// fade sounds like it rushes away at the end and then takes forever to die. Both are here because
// which one is right depends on whether the VCA is shaping a sound or riding a level.
//
// The exponential curve is x^3: close enough to a 60dB fade to feel right, and it costs two multiplies
// where a real exponential costs a transcendental per sample.
//
// ZERO ALLOCATION: process() allocates nothing.
'use strict';

const LINEAR = 0, EXPONENTIAL = 1;

class Vca extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'level', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'a-rate' }];
  }

  constructor() {
    super();
    this._response = LINEAR;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d && d.type === 'switch' && d.id === 'response') {
        this._response = d.value === 'exp' ? EXPONENTIAL : LINEAR;
      }
    };
  }

  process(inputs, outputs, parameters) {
    const out = outputs[0] && outputs[0][0];
    if (!out) return true;
    const sig = inputs[0] && inputs[0][0];
    const n = out.length;
    if (!sig) { out.fill(0); return true; }

    const p = parameters.level, stride = p.length > 1 ? 1 : 0;
    const exp = this._response === EXPONENTIAL;
    for (let i = 0; i < n; i++) {
      let g = p[i * stride];
      if (g < 0) g = 0; else if (g > 1) g = 1;
      out[i] = sig[i] * (exp ? g * g * g : g);
    }
    return true;
  }
}

registerProcessor('wcoast-vca', Vca);
