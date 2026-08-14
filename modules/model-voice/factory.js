// factory.js — Macro Oscillator 2's realized instance.
//
// The module is one worklet: everything it does is sample-rate work with a shared envelope and gate,
// so splitting it across nodes would mean shuttling the envelope between them for nothing.
//
// WHICH INPUTS HAVE CABLES is worked out inside the worklet, from the shape of what Web Audio hands
// it: an unconnected input arrives as an empty array. There used to be a setPortOccupied method here
// for the rack to call, and nothing ever called it — so every CV input was permanently unpatched and
// the four modulation jacks and LEVEL did nothing. Asking the runtime beats being told.

'use strict';

const PROCESSOR = 'model-voice-processor';
const IN_PORTS = ['trigIn', 'levelIn', 'pitchIn', 'fmCv', 'harmonicsCv', 'timbreCv', 'morphCv', 'modelCv'];
const OUT_PORTS = ['out', 'auxOut'];

const KNOBS = new Set(['freq', 'harmonics', 'timbre', 'morph', 'fmDepth', 'harmonicsDepth',
  'timbreDepth', 'morphDepth', 'decay', 'colour']);

export function create(ctx, services) {
  const { descriptor } = services;
  const parameterData = {};
  for (const p of descriptor.params) if (KNOBS.has(p.id) && typeof p.default === 'number') parameterData[p.id] = p.default;

  const node = new AudioWorkletNode(ctx, PROCESSOR, {
    numberOfInputs: IN_PORTS.length,
    numberOfOutputs: OUT_PORTS.length,
    outputChannelCount: OUT_PORTS.map(() => 1),
    parameterData,
  });

  const outIndex = new Map(OUT_PORTS.map((id, i) => [id, i]));
  const inIndex = new Map(IN_PORTS.map((id, i) => [id, i]));

  // The model is a stepped param and not an AudioParam: it names an engine rather than carrying a
  // value, so it goes over the message port.
  const sendModel = (v) => node.port.postMessage({ model: String(v) });
  sendModel(descriptor.params.find((p) => p.id === 'model').default);

  return {
    node,
    getOutput: (portId) => { const i = outIndex.get(portId); return i === undefined ? null : { node, index: i }; },
    getInput: (portId) => { const i = inIndex.get(portId); return i === undefined ? null : { node, index: i }; },
    getParam: (paramId) => node.parameters.get(paramId) || null,
    setParam: (paramId, value, atTime) => {
      if (paramId === 'model') { sendModel(value); return; }
      const ap = node.parameters.get(paramId);
      if (!ap) return;
      ap.setValueAtTime(value, atTime === undefined ? ctx.currentTime : atTime);
    },
    supports: (id) => KNOBS.has(id) || id === 'model',
    dispose: () => { try { node.disconnect(); } catch (_e) { /* already gone */ } },
  };
}
