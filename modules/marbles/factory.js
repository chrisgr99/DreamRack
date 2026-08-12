// factory.js — Marbles audio factory.
//
// The generator is real now: marbles-processor.js is Émilie Gillet's C++ ported to a worklet, and this
// is the wiring between it and the panel. Knobs that the DSP reads continuously are AudioParams, so a
// cable into their jack sums with the knob before the engine sees either. Everything that is a WORD —
// the two models, the two ranges, the two déjà-vu latches, the register switch — goes over the port as
// a message, because none of them is a signal and an AudioParam for a three-way choice would be a
// number pretending to be a name.
'use strict';

const PROCESSOR = 'wcoast-marbles';
// The order is the contract: the worklet reads inputs and writes outputs by index, and these two
// lists are what that index means. They match the descriptor's own order.
const IN_PORTS = ['tClockIn', 'xClockIn', 'tRateIn', 'tBiasIn', 'tJitterIn', 'dejaVuIn', 'xSpreadIn', 'xBiasIn', 'xStepsIn'];
const OUT_PORTS = ['t1Out', 't2Out', 't3Out', 'yOut', 'x1Out', 'x2Out', 'x3Out'];
const KNOBS = new Set(['tRate', 'tBias', 'tJitter', 'xSpread', 'xBias', 'xSteps', 'dejaVu', 'dejaVuLength']);
const MESSAGED = new Set(['tMode', 'tRange', 'xMode', 'xRange', 'tDejaVu', 'xDejaVu', 'external']);

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
  const paramMeta = new Map(descriptor.params.map((p) => [p.id, p]));
  // The words the engine starts with, sent once so a fresh module is in the state its panel shows.
  for (const id of MESSAGED) { const m = paramMeta.get(id); if (m) node.port.postMessage({ [id]: m.default }); }

  function setParam(paramId, value, atTime) {
    if (MESSAGED.has(paramId)) { node.port.postMessage({ [paramId]: value }); return; }
    const ap = node.parameters.get(paramId);
    if (!ap) return;
    // No glide on any of them. A spread that slid to its new value would keep drawing from a
    // distribution nobody asked for on the way, and the déjà-vu length is a count, not a sweep.
    ap.setValueAtTime(value, atTime === undefined ? ctx.currentTime : atTime);
  }

  return {
    node,
    getOutput: (portId) => { const i = outIndex.get(portId); return i === undefined ? null : { node, index: i }; },
    getInput: (portId) => { const i = inIndex.get(portId); return i === undefined ? null : { node, index: i }; },
    getParam: (paramId) => node.parameters.get(paramId) || null,
    setParam,
    supports: (id) => KNOBS.has(id) || MESSAGED.has(id),
    dispose: () => { try { node.disconnect(); } catch (_e) { /* already gone */ } },
  };
}
