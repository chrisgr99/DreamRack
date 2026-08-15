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
// EIGHT GROUPS OF SIX. Group zero is what the panel's jacks show; the rest are what the copies of a
// duplicated page will be wired to, so the allocator lives in one worklet rather than being spread
// across eight of them. Unused groups cost a block of silence each.
const MAX_VOICES = 8;
const ROLLOVER = ['oldest', 'quietest', 'ignore', 'glide', 'legato'];
// Input 0 is the note cable — a channel of silence that keeps both ends rendered. Then one audio
// input per copy of the page, and after the note groups, the summed stereo pair.
const AUDIO_IN = 1;
const AUDIO_OUT = { audioL: MAX_VOICES * OUT_PORTS.length, audioR: MAX_VOICES * OUT_PORTS.length + 1 };

export function create(ctx, _services) {
  const node = new AudioWorkletNode(ctx, PROCESSOR, {
    // One input, carrying a channel of silence, whose only job is to keep both ends of the cable in
    // the rendering graph; six mono outputs per voice, the parts of a note.
    numberOfInputs: 1 + MAX_VOICES,
    numberOfOutputs: OUT_PORTS.length * MAX_VOICES + 2,
    outputChannelCount: new Array(OUT_PORTS.length * MAX_VOICES + 2).fill(1),
  });

  const outIndex = new Map(OUT_PORTS.map((id, i) => [id, i]));

  return {
    node,
    getOutput: (portId) => {
      if (AUDIO_OUT[portId] !== undefined) return { node, index: AUDIO_OUT[portId] };
      const i = outIndex.get(portId);
      return i === undefined ? null : { node, index: i };
    },
    getInput: (portId) => {
      if (portId === 'noteIn') return { node, index: 0 };
      if (portId === 'audioIn') return { node, index: AUDIO_IN };   // copy zero, which is the template
      return null;
    },
    // Copy k's audio arrives on its own input, so it can be scaled and placed before the sum.
    getVoiceInput: (portId, voice) => (portId === 'audioIn' && voice >= 0 && voice < MAX_VOICES
      ? { node, index: AUDIO_IN + voice } : null),
    // The engine asks for a copy's outputs by voice number; the panel's jacks are voice zero.
    getVoiceOutput: (portId, voice) => {
      const i = outIndex.get(portId);
      if (i === undefined || !(voice >= 0 && voice < MAX_VOICES)) return null;
      return { node, index: voice * OUT_PORTS.length + i };
    },
    getParam: (paramId) => node.parameters.get(paramId) || null,
    setParam: (paramId, value, atTime) => {
      const ap = node.parameters.get(paramId);
      if (!ap) return;
      // ROLLOVER is a word on the panel and a number in the worklet: a stepped param arrives here as
      // its step value, and an AudioParam only carries numbers.
      const v = paramId === 'rollover' ? Math.max(0, ROLLOVER.indexOf(String(value))) : value;
      ap.setValueAtTime(v, atTime === undefined ? ctx.currentTime : atTime);
    },
    supports: (id) => id === 'poly' || id === 'rollover' || id === 'time',
    // Called by the rack when a note cable is made or pulled: a port to listen on, or null to stop.
    attachNoteIn: (port) => {
      if (port) node.port.postMessage({ noteIn: port }, [port]);
      else node.port.postMessage({ noteIn: null });
    },
    dispose: () => { try { node.port.onmessage = null; node.disconnect(); } catch (_e) { /* already gone */ } },
  };
}
