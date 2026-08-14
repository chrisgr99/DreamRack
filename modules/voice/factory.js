// factory.js — the Voice module's realized instance.
//
// NO WORKLET. Unbundling a seven-channel connection into seven mono ones is precisely what a
// ChannelSplitterNode does, and it does it in the audio thread's own C++ rather than in a processor
// callback. Reaching for a worklet here would cost a scheduling slot to copy numbers.
//
// A splitter's channelCountMode is explicit and its interpretation discrete by specification, which
// is the behaviour this needs: channel four is pan because it is channel four, not because a
// downmixer thought it looked like a surround layout.
//
// THE CHANNEL ORDER IS THE FORMAT, shared with sequencer-processor.js. A worklet cannot import, so
// the list lives in both files and both must change together.

'use strict';

const CH = { gateOut: 0, pitchOut: 1, levelOut: 2, durOut: 3, panOut: 4, bendOut: 5, pressureOut: 6 };
const NOTE_CHANNELS = 7;

export function create(ctx, _services) {
  const splitter = ctx.createChannelSplitter(NOTE_CHANNELS);

  return {
    node: splitter,
    getOutput: (portId) => { const i = CH[portId]; return i === undefined ? null : { node: splitter, index: i }; },
    getInput: (portId) => (portId === 'noteIn' ? { node: splitter, index: 0 } : null),
    getParam: () => null,
    setParam: () => {},
    supports: () => false,
    dispose: () => { try { splitter.disconnect(); } catch (_e) { /* already gone */ } },
  };
}
