// factory.js — the Sequencer's realized instance.
//
// One worklet, five inputs, and an output that carries nothing. Notes leave as EVENTS on a port the
// rack hands to both ends of the cable; the connection itself is a channel of silence, and it exists
// because a worklet with no path to the destination is not rendered at all.

'use strict';

const PROCESSOR = 'wcoast-sequencer';
const IN_PORTS = ['gateIn', 'pitchIn', 'levelIn', 'durIn', 'panIn'];
const KNOBS = new Set(['level', 'duration', 'pan', 'bendRange']);
const NOTE_CHANNELS = 1;   // one channel of silence: what keeps both ends of the cable rendered

export function create(ctx, services) {
  const { descriptor } = services;
  const parameterData = {};
  for (const p of descriptor.params) if (KNOBS.has(p.id) && typeof p.default === 'number') parameterData[p.id] = p.default;

  const node = new AudioWorkletNode(ctx, PROCESSOR, {
    numberOfInputs: IN_PORTS.length,
    numberOfOutputs: 1,
    outputChannelCount: [NOTE_CHANNELS],
    parameterData,
  });

  const inIndex = new Map(IN_PORTS.map((id, i) => [id, i]));

  // The cable's flash. The worklet posts one note event per note — handle, sample, and what the note
  // holds — and the rack subscribes through onNote and brightens every note cable leaving this
  // module. Today the flash is the only reader; the event is the shape the transport will carry.
  let noteCb = null;
  node.port.onmessage = (e) => {
    const d = e.data || {};
    if (d.note && noteCb) noteCb(d.note);
  };
  // Called by the rack when a note cable is made or pulled. The port is TRANSFERRED into the worklet,
  // so the two processors hold the two ends and nothing passes through the main thread.
  const attachNoteOut = (port) => {
    if (port) node.port.postMessage({ noteOut: port }, [port]);
    else node.port.postMessage({ noteOut: null });
  };

  return {
    node,
    getOutput: (portId) => (portId === 'noteOut' ? { node, index: 0 } : null),
    getInput: (portId) => { const i = inIndex.get(portId); return i === undefined ? null : { node, index: i }; },
    getParam: (paramId) => node.parameters.get(paramId) || null,
    setParam: (paramId, value, atTime) => {
      const ap = node.parameters.get(paramId);
      if (!ap) return;
      ap.setValueAtTime(value, atTime === undefined ? ctx.currentTime : atTime);
    },
    supports: (id) => KNOBS.has(id),
    onNote: (cb) => { noteCb = cb; },
    attachNoteOut,
    dispose: () => { try { node.port.onmessage = null; node.disconnect(); } catch (_e) { /* already gone */ } },
  };
}
