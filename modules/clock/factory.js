// factory.js — Clock audio factory.
//
// Three inputs, six outputs, one worklet. The knobs are AudioParams; everything else — run, reset, the
// BPM input's meaning, the pulses per quarter note — goes over the port as a message, because none of
// them is a signal and an AudioParam for a two-state mode would be a number pretending to be a word.
//
// RUN IS A LATCH, AND THE ENGINE OWNS IT. The button toggles it, the run input toggles it, and the
// engine reports back which state it settled in — so the panel's lamp follows the clock rather than
// the click. That matters because the run INPUT can change it without the panel being touched, and a
// lamp driven by the button alone would then be lying.
'use strict';

const PROCESSOR = 'wcoast-clock';
const OUT_PORTS = ['clkOut', 'clk1Out', 'clk2Out', 'clk3Out', 'runOut', 'resetOut'];
const IN_PORTS = ['runIn', 'resetIn', 'bpmIn'];
const KNOBS = new Set(['bpm', 'ratio1', 'ratio2', 'ratio3', 'swing', 'pw',
  'swing1', 'swing2', 'swing3', 'pw1', 'pw2', 'pw3', 'delay1', 'delay2', 'delay3']);
const MESSAGED = new Set(['run', 'reset', 'bpmMode', 'ppqn']);

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

  const lampState = { lamp: 'off', lamp1: 'off', lamp2: 'off', lamp3: 'off' };
  let readoutCb = null, textCb = null;
  let running = false, shownBpm = null;
  node.port.onmessage = (e) => {
    const d = e.data || {};
    if (d.running !== undefined) running = !!d.running;
    // A READOUT IS A MAP OF PARAM TO VALUE — the host paints each named control with what it is given
    // (see rack._applyReadout). So the run lamp is reported as the run PARAM, which is what makes it
    // follow the engine: the run INPUT can toggle the clock with nobody touching the panel, and a lamp
    // driven by the button alone would then be showing the opposite of the truth.
    if (d.lamps) { const L = d.lamps; ['lamp', 'lamp1', 'lamp2', 'lamp3'].forEach((id, k) => { lampState[id] = L[k] ? 'on' : 'off'; }); }
    if (readoutCb) readoutCb({ run: running ? 'on' : 'off', ...lampState });
    // THE NUMBER IS THE ENGINE'S, NOT THE KNOB'S. With a cable in the BPM input the tempo is the
    // cable's, and that is what has to be on the display. Reported as text rather than through the
    // param map because the map paints CONTROLS — and the control called 'bpm' is the tempo knob,
    // which would then be dragged around by the very CV that is overriding it.
    if (d.bpm !== undefined && textCb) {
      const n = Math.round(d.bpm);
      if (n !== shownBpm) { shownBpm = n; textCb('bpm', String(n)); }
    }
  };

  function setParam(paramId, value, atTime) {
    const meta = paramMeta.get(paramId);
    if (!meta) return;
    if (MESSAGED.has(paramId)) {
      if (paramId === 'run') node.port.postMessage({ run: value === 'on' });
      // RESET FIRES ON THE PRESS AND IGNORES THE RELEASE. A momentary button sends 'on' then 'off';
      // acting on both would reset twice, and the second one lands a few milliseconds into the bar
      // you just restarted.
      else if (paramId === 'reset') { if (value === 'on') node.port.postMessage({ reset: true }); }
      else if (paramId === 'bpmMode') node.port.postMessage({ bpmMode: value });
      else if (paramId === 'ppqn') node.port.postMessage({ ppqn: value });
      return;
    }
    const ap = node.parameters.get(paramId);
    if (!ap) return;
    const t = (atTime === undefined) ? ctx.currentTime : atTime;
    // No glide on any of these. A tempo that slid to its new value would be a ritardando nobody asked
    // for, and a ratio is a choice rather than a sweep — the engine stretches the running period
    // instead, which is the musical way to change tempo and is its job, not an envelope's.
    ap.setValueAtTime(value, t);
  }

  return {
    node,
    getOutput: (portId) => { const i = outIndex.get(portId); return i === undefined ? null : { node, index: i }; },
    getInput: (portId) => { const i = inIndex.get(portId); return i === undefined ? null : { node, index: i }; },
    getParam: (paramId) => node.parameters.get(paramId) || null,
    setParam,
    supports: (id) => KNOBS.has(id) || MESSAGED.has(id),
    // The panel's tempo display and run lamp subscribe here; a host that does not is simply unlit.
    onReadout(cb) { readoutCb = typeof cb === 'function' ? cb : null; },
    onReadoutText(cb) {
      textCb = typeof cb === 'function' ? cb : null;
      if (!textCb) return;
      // Only the tempo. The ratios are MENU READOUTS — the panel paints them from the param itself,
      // so nothing here needs to report them.
      if (shownBpm !== null) textCb('bpm', String(shownBpm));
    },
    dispose: () => { try { node.disconnect(); } catch (_e) { /* already gone */ } },
  };
}
