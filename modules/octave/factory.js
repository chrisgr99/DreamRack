// factory.js — Octave audio factory.
//
// An addition, in the audio graph: the input passes through a unity gain and a constant source carries
// the offset onto the same node. One octave is exactly 1.0 on a 1V/oct signal, so the knob's value IS
// the offset and there is nothing to convert.
'use strict';

export function create(ctx, _services) {
  const pass = ctx.createGain();
  pass.gain.value = 1;
  const out = ctx.createGain();
  out.gain.value = 1;
  pass.connect(out);

  const offset = ctx.createConstantSource();
  offset.offset.value = 0;
  offset.connect(out);
  offset.start();

  return {
    node: out,
    getOutput: (id) => (id === 'pitchOut' ? { node: out, index: 0 } : null),
    getInput: (id) => (id === 'pitchIn' ? { node: pass, index: 0 } : null),
    getParam: (id) => (id === 'octave' ? offset.offset : null),
    setParam: (id, value, atTime) => {
      if (id !== 'octave') return;
      const t = (atTime === undefined) ? ctx.currentTime : atTime;
      // No glide: an octave shift is a jump, and sliding through the intervals between would be a
      // portamento nobody asked for.
      offset.offset.setValueAtTime(Math.round(value), t);
    },
    supports: (id) => id === 'octave',
    dispose: () => {
      try { offset.stop(); offset.disconnect(); pass.disconnect(); out.disconnect(); } catch (_e) { /* gone */ }
    },
  };
}
