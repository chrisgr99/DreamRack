// factory.js — the Voice In module's realized instance.
//
// It was a ChannelSplitter, which was exactly right while a note was seven channels on one
// connection. A note is now an event, so this is a worklet that turns a stream of them back into the
// voltages the page is patched from — see voice-processor.js for why the cable is still a Web Audio
// connection even though it carries no data.
//
// THE EVENT PORT IS HANDED IN BY THE RACK when the note cable is made: attachNoteIn takes one end of
// a MessageChannel and passes it into the worklet, TRANSFERRED rather than copied, so the two
// worklets talk to each other and the main thread is never in the path of a note.

'use strict';

const PROCESSOR = 'wcoast-voice';
const OUT_PORTS = ['gateOut', 'pitchOut', 'bendOut', 'levelOut', 'durOut', 'panOut'];

export function create(ctx, _services) {
  const node = new AudioWorkletNode(ctx, PROCESSOR, {
    // One input, carrying a channel of silence, whose only job is to keep both ends of the cable in
    // the rendering graph; six mono outputs, the parts of a note.
    numberOfInputs: 1,
    numberOfOutputs: OUT_PORTS.length,
    outputChannelCount: OUT_PORTS.map(() => 1),
  });

  const outIndex = new Map(OUT_PORTS.map((id, i) => [id, i]));

  return {
    node,
    getOutput: (portId) => { const i = outIndex.get(portId); return i === undefined ? null : { node, index: i }; },
    getInput: (portId) => (portId === 'noteIn' ? { node, index: 0 } : null),
    getParam: () => null,
    setParam: () => {},
    supports: () => false,
    // Called by the rack when a note cable is made or pulled: a port to listen on, or null to stop.
    attachNoteIn: (port) => {
      if (port) node.port.postMessage({ noteIn: port }, [port]);
      else node.port.postMessage({ noteIn: null });
    },
    dispose: () => { try { node.port.onmessage = null; node.disconnect(); } catch (_e) { /* already gone */ } },
  };
}
