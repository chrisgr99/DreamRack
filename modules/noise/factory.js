// factory.js — Noise audio factory.
//
// The simplest factory in the rack: no params, no inputs, five outputs whose graph indices come
// straight from descriptor order. The assert is still here — it costs nothing and it is the only
// thing standing between a reordered descriptor and red coming out of the violet jack.
'use strict';

const PROCESSOR_NAME = 'wcoast-noise';
const EXPECTED_OUTPUTS = ['violetOut', 'blueOut', 'whiteOut', 'pinkOut', 'redOut'];

export function create(ctx, services) {
  const { descriptor, registry } = services;
  const outPorts = registry.outputPorts(descriptor.id);
  const got = outPorts.map((p) => p.id);
  if (got.length !== EXPECTED_OUTPUTS.length || got.some((id, i) => id !== EXPECTED_OUTPUTS[i])) {
    throw new Error(
      `Noise factory: descriptor output order [${got.join(', ')}] does not match the processor's ` +
      `assumed order [${EXPECTED_OUTPUTS.join(', ')}].`,
    );
  }

  const node = new AudioWorkletNode(ctx, PROCESSOR_NAME, {
    numberOfInputs: 0,
    numberOfOutputs: outPorts.length,
    outputChannelCount: outPorts.map(() => 1),
  });
  const outIndex = new Map(outPorts.map((p, i) => [p.id, i]));

  return {
    node,
    getOutput: (portId) => { const i = outIndex.get(portId); return i === undefined ? null : { node, index: i }; },
    getInput: () => null,
    getParam: () => null,
    setParam: () => {},
    supports: () => false,
    dispose: () => { try { node.disconnect(); } catch (_e) { /* already gone */ } },
  };
}
