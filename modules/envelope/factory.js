// factory.js — Envelope (ADSR) audio factory.
//
// Three outputs, two trigger inputs, four linear CV inputs that drive AudioParams rather than worklet
// inputs. The manual gate button is a switch: pressing it sends a gate the same way a cable would, so
// there is one gate path in the DSP and not two.
//
// `onStage` is the optional contract addition the panel's graph subscribes to — see rack._attachGraph.
// The host subscribes if it is present; a module without one simply has no live indication.
'use strict';

const PROCESSOR_NAME = 'wcoast-envelope';
const EXPECTED_OUTPUTS = ['envOut', 'invOut', 'eocOut'];
const EXPECTED_WORKLET_INPUTS = ['gateIn', 'retrigIn'];

const REALIZED_PARAMS = new Set(['attack', 'decay', 'sustain', 'release']);
const REALIZED_SWITCHES = new Set(['gateBtn']);

function assertOrder(label, got, expected) {
  const g = got.map((p) => p.id);
  if (g.length !== expected.length || g.some((id, i) => id !== expected[i])) {
    throw new Error(
      `Envelope factory: descriptor ${label} order [${g.join(', ')}] does not match the processor's ` +
      `assumed order [${expected.join(', ')}].`,
    );
  }
}

export function create(ctx, services) {
  const { descriptor, registry } = services;

  const outPorts = registry.outputPorts(descriptor.id);
  assertOrder('output-port', outPorts, EXPECTED_OUTPUTS);

  const curveOfTarget = (port) => {
    if (port.target === undefined) return null;
    const p = registry.paramById(descriptor.id, port.target);
    return p ? p.curve : null;
  };
  const inPorts = registry.ports(descriptor.id).filter(
    (p) => p.dir === 'in' && (p.target === undefined || curveOfTarget(p) === 'exp'),
  ).filter((p) => EXPECTED_WORKLET_INPUTS.includes(p.id));
  assertOrder('worklet-input', inPorts, EXPECTED_WORKLET_INPUTS);

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

  // The manual gate. A constant source into the gate input is the same signal a cable would carry,
  // so the DSP has one gate path and the button cannot behave differently from a patched gate.
  const manual = ctx.createConstantSource();
  manual.offset.value = 0;
  manual.connect(node, 0, inIndex.get('gateIn'));
  manual.start();

  let stageCb = null;
  node.port.onmessage = (e) => {
    const d = e.data;
    if (d && d.type === 'stage' && stageCb) stageCb(d.value);
  };

  const paramMeta = new Map(descriptor.params.map((p) => [p.id, p]));

  function setParam(paramId, value, atTime) {
    const meta = paramMeta.get(paramId);
    if (!meta) throw new Error(`Envelope: no param "${paramId}".`);
    if (meta.curve === 'stepped') {
      if (paramId === 'gateBtn') {
        const t = (atTime === undefined) ? ctx.currentTime : atTime;
        manual.offset.setValueAtTime(value === 'on' ? 1 : 0, t);
      }
      return;
    }
    const ap = node.parameters.get(paramId);
    if (!ap) return;
    const t = (atTime === undefined) ? ctx.currentTime : atTime;
    const glideMs = typeof meta.glideMs === 'number' ? meta.glideMs : 0;
    if (glideMs > 0) ap.setTargetAtTime(value, t, glideMs / 1000);
    else ap.setValueAtTime(value, t);
  }

  return {
    node,
    getOutput: (portId) => { const i = outIndex.get(portId); return i === undefined ? null : { node, index: i }; },
    getInput: (portId) => { const i = inIndex.get(portId); return i === undefined ? null : { node, index: i }; },
    getParam: (paramId) => node.parameters.get(paramId) || null,
    setParam,
    supports: (id) => REALIZED_PARAMS.has(id) || REALIZED_SWITCHES.has(id),
    // Optional: the host subscribes to light the running stage on the drawn envelope.
    onStage(cb) { stageCb = typeof cb === 'function' ? cb : null; },
    dispose: () => {
      try { manual.stop(); manual.disconnect(); } catch (_e) { /* already gone */ }
      try { node.disconnect(); } catch (_e) { /* already disconnected */ }
    },
  };
}
