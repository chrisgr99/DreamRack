// factory.js — Poly to Stereo's realized instance.
//
// Three separate mono outputs rather than one stereo node: every cable in the rack is one channel,
// and L, R and mono are three jacks a patch can take independently.

'use strict';

const PROCESSOR_NAME = 'wcoast-poly-to-stereo';
const OUT = { outL: 0, outR: 1, outMono: 2 };

export function create(ctx, services) {
  const { descriptor } = services;

  const node = new AudioWorkletNode(ctx, PROCESSOR_NAME, {
    numberOfInputs: 1,
    numberOfOutputs: 3,
    outputChannelCount: [1, 1, 1],
  });

  const meta = new Map(descriptor.params.map((p) => [p.id, p]));

  return {
    node,
    getOutput: (id) => (OUT[id] === undefined ? null : { node, index: OUT[id] }),
    getInput: (id) => (id === 'audioIn' ? { node, index: 0 } : null),
    // The CV inputs are AudioParam targets, so the patchbay reaches them through getParam and there is
    // nothing to return for them here.
    getParam: (id) => node.parameters.get(id) || null,
    setParam: (id, value, atTime) => {
      const m = meta.get(id);
      if (!m) throw new Error(`Poly to Stereo: no param "${id}".`);
      const ap = node.parameters.get(id);
      if (!ap) return;                       // the depth trims live in the patchbay's gain, not here
      const t = (atTime === undefined) ? ctx.currentTime : atTime;
      const g = typeof m.glideMs === 'number' ? m.glideMs : 0;
      if (g > 0) ap.setTargetAtTime(value, t, g / 1000); else ap.setValueAtTime(value, t);
    },
    supports: (id) => ['levelA', 'levelADepth', 'levelB', 'levelBDepth', 'pan', 'panDepth'].includes(id),
    dispose: () => { try { node.disconnect(); } catch (_e) { /* gone */ } },
  };
}
