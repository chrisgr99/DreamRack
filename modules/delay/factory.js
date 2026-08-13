// factory.js — Delay audio factory.
//
// Six inputs, two outputs, one worklet. Every control is an AudioParam, so a cord into a knob's CV
// jack sums with the knob before the engine sees either — which is what the attenuverter on the
// knAck's lower half is attenuating.
//
// NOTHING IS REPORTED BACK. The knob is the whole story: a duration when nothing is clocking it and a
// ratio to the beat when something is, which is what the original does and why it needs no display.
'use strict';

const PROCESSOR = 'wcoast-delay';
const IN_PORTS = ['audioIn', 'clockIn', 'timeCv', 'feedbackCv', 'toneCv', 'mixCv'];
const OUT_PORTS = ['wetOut', 'mixOut'];
const KNOBS = new Set(['time', 'timeDepth', 'feedback', 'feedbackDepth', 'tone', 'toneDepth', 'mix', 'mixDepth']);

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

  return {
    node,
    getOutput: (portId) => { const i = outIndex.get(portId); return i === undefined ? null : { node, index: i }; },
    getInput: (portId) => { const i = inIndex.get(portId); return i === undefined ? null : { node, index: i }; },
    getParam: (paramId) => node.parameters.get(paramId) || null,
    setParam: (paramId, value, atTime) => {
      const ap = node.parameters.get(paramId);
      if (!ap) return;
      // No glide from here: the TIME glide lives in the worklet, where it is a property of the read
      // head rather than of the parameter, and applies to a clock change as much as to a knob.
      ap.setValueAtTime(value, atTime === undefined ? ctx.currentTime : atTime);
    },
    supports: (id) => KNOBS.has(id),
    dispose: () => { try { node.disconnect(); } catch (_e) { /* already gone */ } },
  };
}
