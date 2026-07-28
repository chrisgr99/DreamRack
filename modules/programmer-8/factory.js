// factory.js — Sequencer/Programmer Eight audio factory.
//
// Builds the DSP (one AudioWorkletNode running programmer-8-processor.js) and
// returns the realized-instance contract the host wires against — the same shape
// as every other module (see the 259t factory for the contract prose), plus one
// addition described under onReadout below.
//
// The module is complete — every port and param is live.
//
// The processor's fixed input/output index order is derived from the descriptor
// and asserted here, so reordering ports in the descriptor without updating the
// processor fails loudly instead of mis-wiring the sequencer.

'use strict';

const PROCESSOR_NAME = 'programmer-8';
const N = 8;

const range = (n, f) => Array.from({ length: n }, (_, i) => f(i + 1));

// The exact order the processor's process() assumes. The descriptor is the
// source of truth; these assert it still agrees with the DSP.
const EXPECTED_WORKLET_INPUTS = ['clock', 'reset', 'updown', 'hold', ...range(N, (s) => `sel${s}`)];
const EXPECTED_OUTPUTS = ['outA', 'outB', 'outAB', 'allGate', 'trig', ...range(N, (s) => `pulse${s}`)];

function assertOrder(label, got, expected) {
  const g = got.map((p) => p.id);
  if (g.length !== expected.length || g.some((id, i) => id !== expected[i])) {
    throw new Error(
      `programmer-8 factory: descriptor ${label} order [${g.join(', ')}] does not match ` +
      `the processor's assumed order [${expected.join(', ')}]. The descriptor is the ` +
      `source of truth — fix the processor to follow it (or restore the order).`,
    );
  }
}

export function create(ctx, services) {
  const { descriptor, registry } = services;

  const outPorts = registry.outputPorts(descriptor.id);
  assertOrder('output-port', outPorts, EXPECTED_OUTPUTS);
  // Every dir-in port here is a pure worklet signal input (none carries a
  // `target`), so the descriptor's in-ports are exactly the worklet inputs.
  const inPorts = registry.ports(descriptor.id).filter((p) => p.dir === 'in');
  assertOrder('worklet-input', inPorts, EXPECTED_WORKLET_INPUTS);

  const paramMeta = new Map(descriptor.params.map((p) => [p.id, p]));

  // Seed the stage-voltage AudioParams with the descriptor's authored pattern,
  // so the module holds a real sequence the moment it is placed.
  const parameterData = {};
  for (const p of descriptor.params) {
    if (/^[ab][1-8]$/.test(p.id) && typeof p.default === 'number') parameterData[p.id] = p.default;
  }

  const node = new AudioWorkletNode(ctx, PROCESSOR_NAME, {
    numberOfInputs: inPorts.length,
    numberOfOutputs: outPorts.length,
    outputChannelCount: outPorts.map(() => 1),
    parameterData,
  });

  const outIndex = new Map(outPorts.map((p, i) => [p.id, i]));
  const inIndex = new Map(inPorts.map((p, i) => [p.id, i]));

  // ---- readout: engine state that drives panel indication ------------------
  // The play lamp of the active stage is lit by the ENGINE, not by the button,
  // because the playhead moves on its own (design/cv-sequencer.md: "the play
  // lamp doubles as the active-stage indication"). The host stays generic: it is
  // handed a paramId -> display-value map and paints it, knowing nothing about
  // stages. Translating the playhead into that vocabulary is this module's job.
  let readoutCb = null;
  const lamps = {};
  node.port.onmessage = (e) => {
    const m = e.data || {};
    if (m.type !== 'active' || !readoutCb) return;
    // Only the play lamps. The window's own lamps are ordinary stepped params now, so
    // the host lights them from the param values without the engine's help.
    for (let s = 1; s <= N; s++) lamps[`play${s}`] = (s === m.stage + 1) ? 'on' : 'off';
    readoutCb(lamps);
  };

  // A momentary button shares its param id with an engine-owned lamp, and the host
  // paints that param on release — which would blank the lamp the engine had just
  // lit. Re-assert the engine's picture after the host's paint has run: a microtask
  // lands after the synchronous setParam-then-paint, so the engine wins the last word.
  function repaintAfterHostPaint() {
    if (readoutCb) queueMicrotask(() => { if (readoutCb) readoutCb(lamps); });
  }

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
    return paramMeta.has(paramId);
  }

  function setParam(paramId, value, atTime) {
    const meta = paramMeta.get(paramId);
    if (!meta) throw new Error(`programmer-8: no param "${paramId}".`);

    // Transport: run/stop, and which reading the (P)Reset jack gets.
    if (paramId === 'run' || paramId === 'presetMode') {
      node.port.postMessage({ type: 'switch', id: paramId, value });
      return;
    }

    // Loop window. Two one-of-eight selectors, so the value IS the stage number and
    // there is no press history to keep. Their lamps are lit by the host straight from
    // the param, so nothing needs re-asserting here.
    if (paramId === 'start' || paramId === 'end') {
      node.port.postMessage({ type: 'window', id: paramId, stage: Math.round(value) - 1 });
      return;
    }

    // Stage voltages, Rows A and B -> AudioParams. glideMs is 0 on these: a
    // programmer's output must step, not slide (see the audio-rate section of
    // the spec — smoothing here is opt-in per output and off by default).
    if (/^[ab][1-8]$/.test(paramId)) {
      const ap = node.parameters.get(paramId);
      if (!ap) return;
      ap.setValueAtTime(value, atTime === undefined ? ctx.currentTime : atTime);
      return;
    }

    // Play button — momentary, and BOTH edges matter. The press
    // jumps the playhead there; the release drops All Gate. Sending only the press
    // would leave the gate stuck high and the column would not work as a keyboard.
    if (/^play[1-8]$/.test(paramId)) {
      node.port.postMessage({ type: 'play', stage: +paramId.slice(4) - 1, down: value === 'on' });
      repaintAfterHostPaint();
      return;
    }

    // Repeat count per stage — a stepped knob, already detented by the panel to 0..4.
    if (/^rpt[1-8]$/.test(paramId)) {
      node.port.postMessage({ type: 'rpt', stage: +paramId.slice(3) - 1, count: Math.round(value) });
      return;
    }
  }

  function dispose() {
    readoutCb = null;
    try { node.port.onmessage = null; node.disconnect(); } catch (_e) { /* already gone */ }
  }

  return {
    node, getOutput, getInput, getParam, setParam, supports, dispose,
    // Optional contract addition: the host subscribes if present, and modules
    // without engine-driven indication simply don't implement it.
    onReadout(cb) { readoutCb = typeof cb === 'function' ? cb : null; },
    // Also optional: the host calls this when the user resets the module, so state that
    // is NOT a param — here the playhead, a latched address, a ratchet mid-burst — goes
    // back to where a freshly placed module starts.
    resetState() { node.port.postMessage({ type: 'resetState' }); },
  };
}
