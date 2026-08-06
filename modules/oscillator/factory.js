// factory.js — Oscillator audio factory.
//
// The descriptor says what the module is; this builds it in Web Audio and hands the host the small
// realized-instance contract it wires against:
//
//   getOutput(portId)  -> { node, index } | null
//   getInput(portId)   -> { node, index } | null
//   getParam(paramId)  -> AudioParam | null
//   setParam(id, v, t) -> apply a knob or switch value
//   supports(id)       -> is this param realized in DSP?
//   dispose()
//
// The processor's input and output indices are DERIVED from descriptor order and then asserted
// against the order the processor assumes. Reorder the ports in the descriptor without touching the
// processor and instantiation fails loudly, rather than quietly sending the saw out of the sine jack.
'use strict';

const PROCESSOR_NAME = 'wcoast-oscillator';

const EXPECTED_OUTPUTS = ['sineOut', 'triOut', 'sawOut', 'pulseOut'];

// Worklet audio inputs, in descriptor order: the pure signal inputs plus the exponential 1V/oct
// pitch input, which has to be summed in the exponent inside the processor. The pulse-width CV is
// linear, so it drives the pulseWidth AudioParam instead and is NOT a worklet input.
const EXPECTED_WORKLET_INPUTS = ['pitchIn', 'linFmIn', 'expFmIn', 'syncIn'];

const REALIZED_PARAMS = new Set(['coarse', 'fine', 'linFm', 'expFm', 'pulseWidth', 'feedback']);
const REALIZED_SWITCHES = new Set(['syncMode']);
// The knAck attenuverter for the pulse-width CV. Realized host-side, as an inline gain on the cord
// when the connection UI patches pwIn into the pulseWidth param — a real control with no effect
// until something is plugged in.
const REALIZED_HOST_ATTEN = new Set(['pwDepth']);

function assertOrder(label, got, expected) {
  const g = got.map((p) => p.id);
  if (g.length !== expected.length || g.some((id, i) => id !== expected[i])) {
    throw new Error(
      `Oscillator factory: descriptor ${label} order [${g.join(', ')}] does not match the ` +
      `processor's assumed order [${expected.join(', ')}]. The descriptor is the source of truth, ` +
      `so fix whichever drifted.`,
    );
  }
}

export function create(ctx, services) {
  const { descriptor, registry } = services;

  const outPorts = registry.outputPorts(descriptor.id);
  assertOrder('output-port', outPorts, EXPECTED_OUTPUTS);

  // Same generic rule the 259t uses: a worklet input is a signal input (no target) or a CV input
  // whose target param is exponential. Linear CV inputs go to AudioParams.
  const curveOfTarget = (port) => {
    if (port.target === undefined) return null;
    const p = registry.paramById(descriptor.id, port.target);
    return p ? p.curve : null;
  };
  const inPorts = registry.ports(descriptor.id).filter(
    (p) => p.dir === 'in' && (p.target === undefined || curveOfTarget(p) === 'exp'),
  );
  assertOrder('worklet-input', inPorts, EXPECTED_WORKLET_INPUTS);

  // Seed the AudioParams from the descriptor defaults, so a fresh instance sounds like its panel.
  const parameterData = {};
  for (const p of descriptor.params) {
    if (REALIZED_PARAMS.has(p.id) && typeof p.default === 'number') parameterData[p.id] = p.default;
  }

  const node = new AudioWorkletNode(ctx, PROCESSOR_NAME, {
    numberOfInputs: inPorts.length,
    numberOfOutputs: outPorts.length,
    outputChannelCount: outPorts.map(() => 1),
    parameterData,
  });

  const outIndex = new Map(outPorts.map((p, i) => [p.id, i]));
  const inIndex = new Map(inPorts.map((p, i) => [p.id, i]));

  // Make the processor's switch state explicit rather than relying on its own defaults matching.
  for (const p of descriptor.params) {
    if (p.curve === 'stepped' && REALIZED_SWITCHES.has(p.id) && p.default !== undefined) {
      node.port.postMessage({ type: 'switch', id: p.id, value: p.default });
    }
  }

  const paramMeta = new Map(descriptor.params.map((p) => [p.id, p]));

  function getOutput(portId) {
    const idx = outIndex.get(portId);
    return idx === undefined ? null : { node, index: idx };
  }
  function getInput(portId) {
    const idx = inIndex.get(portId);
    return idx === undefined ? null : { node, index: idx };
  }
  function getParam(paramId) {
    return node.parameters.get(paramId) || null;
  }
  function supports(paramId) {
    return REALIZED_PARAMS.has(paramId) || REALIZED_SWITCHES.has(paramId) || REALIZED_HOST_ATTEN.has(paramId);
  }

  function setParam(paramId, value, atTime) {
    const meta = paramMeta.get(paramId);
    if (!meta) throw new Error(`Oscillator: no param "${paramId}".`);
    if (meta.curve === 'stepped') {
      if (REALIZED_SWITCHES.has(paramId)) node.port.postMessage({ type: 'switch', id: paramId, value });
      return;
    }
    const ap = node.parameters.get(paramId);
    if (!ap) return;                      // e.g. pwDepth, which is realized on the cord, not here
    const t = (atTime === undefined) ? ctx.currentTime : atTime;
    const glideMs = typeof meta.glideMs === 'number' ? meta.glideMs : 0;
    if (glideMs > 0) ap.setTargetAtTime(value, t, glideMs / 1000);
    else ap.setValueAtTime(value, t);
  }

  function dispose() {
    try { node.disconnect(); } catch (_e) { /* already disconnected */ }
    try { node.port.postMessage({ type: 'dispose' }); } catch (_e) { /* gone */ }
  }

  return { node, getOutput, getInput, getParam, setParam, supports, dispose };
}
