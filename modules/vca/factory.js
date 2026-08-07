// factory.js — VCA audio factory.
'use strict';

const PROCESSOR_NAME = 'wcoast-vca';

export function create(ctx, services) {
  const { descriptor, registry } = services;
  const outPorts = registry.outputPorts(descriptor.id);
  const inPorts = registry.ports(descriptor.id).filter((p) => p.dir === 'in' && p.target === undefined);
  const got = outPorts.map((p) => p.id).join(',') + '|' + inPorts.map((p) => p.id).join(',');
  if (got !== 'out|audioIn') {
    throw new Error(`VCA factory: descriptor port order [${got}] is not what the processor assumes [out|audioIn].`);
  }

  const node = new AudioWorkletNode(ctx, PROCESSOR_NAME, {
    numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
    parameterData: { level: 0 },
  });
  node.port.postMessage({ type: 'switch', id: 'response', value: 'lin' });

  const meta = new Map(descriptor.params.map((p) => [p.id, p]));

  return {
    node,
    getOutput: (id) => (id === 'out' ? { node, index: 0 } : null),
    getInput: (id) => (id === 'audioIn' ? { node, index: 0 } : null),
    getParam: (id) => node.parameters.get(id) || null,
    setParam: (id, value, atTime) => {
      const m = meta.get(id);
      if (!m) throw new Error(`VCA: no param "${id}".`);
      if (m.curve === 'stepped') { node.port.postMessage({ type: 'switch', id, value }); return; }
      const ap = node.parameters.get(id);
      if (!ap) return;
      const t = (atTime === undefined) ? ctx.currentTime : atTime;
      const g = typeof m.glideMs === 'number' ? m.glideMs : 0;
      if (g > 0) ap.setTargetAtTime(value, t, g / 1000); else ap.setValueAtTime(value, t);
    },
    supports: (id) => ['level', 'levelDepth', 'response'].includes(id),
    dispose: () => { try { node.disconnect(); } catch (_e) { /* gone */ } },
  };
}
