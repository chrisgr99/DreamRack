// factory.js — Filter audio factory.
'use strict';

const PROCESSOR_NAME = 'wcoast-filter';
const EXPECTED_OUTPUTS = ['lowOut', 'bandOut', 'highOut'];

const REALIZED = new Set(['cutoff', 'resonance', 'drive']);
const SWITCHES = new Set(['poles']);
const ATTEN = new Set(['cutoffDepth', 'resDepth', 'driveDepth']);

export function create(ctx, services) {
  const { descriptor, registry } = services;
  const outPorts = registry.outputPorts(descriptor.id);
  const got = outPorts.map((p) => p.id);
  if (got.join(',') !== EXPECTED_OUTPUTS.join(',')) {
    throw new Error(`Filter factory: output order [${got.join(', ')}] is not [${EXPECTED_OUTPUTS.join(', ')}].`);
  }

  const node = new AudioWorkletNode(ctx, PROCESSOR_NAME, {
    numberOfInputs: 2, numberOfOutputs: 3, outputChannelCount: [1, 1, 1],
    parameterData: { cutoff: 1000, resonance: 0, drive: 0 },
  });
  node.port.postMessage({ type: 'switch', id: 'poles', value: '4' });

  const outIndex = new Map(outPorts.map((p, i) => [p.id, i]));
  const meta = new Map(descriptor.params.map((p) => [p.id, p]));

  return {
    node,
    getOutput: (id) => { const i = outIndex.get(id); return i === undefined ? null : { node, index: i }; },
    getInput: (id) => (id === 'audioIn' ? { node, index: 0 } : id === 'cutoffCv' ? { node, index: 1 } : null),
    getParam: (id) => node.parameters.get(id) || null,
    setParam: (id, value, atTime) => {
      const m = meta.get(id);
      if (!m) throw new Error(`Filter: no param "${id}".`);
      if (m.curve === 'stepped') { if (SWITCHES.has(id)) node.port.postMessage({ type: 'switch', id, value }); return; }
      const ap = node.parameters.get(id);
      if (!ap) return;
      const t = (atTime === undefined) ? ctx.currentTime : atTime;
      const g = typeof m.glideMs === 'number' ? m.glideMs : 0;
      if (g > 0) ap.setTargetAtTime(value, t, g / 1000); else ap.setValueAtTime(value, t);
    },
    supports: (id) => REALIZED.has(id) || SWITCHES.has(id) || ATTEN.has(id),
    dispose: () => { try { node.disconnect(); } catch (_e) { /* gone */ } },
  };
}
