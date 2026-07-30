// factory.js — Video Output's realized instance.
//
// There is almost no audio graph here, and what there is exists for one reason: to give the
// patchbay something to land a CV cable on.
//
// THE PROBLEM. The patchbay's only mechanism for "a cable modulates this parameter" is to
// connect a node to an AudioParam. A video parameter is not one — it is a number written into
// a shader uniform once per frame — so without this the brightness jack refused every cable.
//
// THE SEAM. A ConstantSourceNode whose `offset` IS the parameter. The knob writes offset; the
// patchbay connects the CV through the depth gain it already owns; Web Audio sums them, exactly
// as it does for the mixer's pan knАcks. An AnalyserNode on the node's output then reads that
// sum once per frame — the same tap the oscilloscopes and ear monitors use, at 60 Hz instead of
// audio rate. With no cable patched the analyser reads exactly the knob's own offset, so there
// is no special case and the knob behaves identically either way.
//
// THE RATE RULE, made structural. The engine is handed a SAMPLER, not a connection. A 48 kHz
// control signal is therefore read at 60 Hz and cannot pretend to be video-rate: rack CV
// supplies parameters, and video-rate signal is generated inside the shader and never leaves
// the GPU. Getting this wrong produces a slideshow, so the code is shaped to make it hard.
//
// Contract notes:
//   getOutput -> null    terminal, like the Mixer: it IS the output
//   getInput  -> null    the image input is a LOGICAL video edge the engine reads, not a node
//   getParam  -> the AudioParam for a CV-able video parameter, else null

'use strict';

// The analyser's window. 32 is the smallest Web Audio allows; at 48 kHz that is two thirds of
// a millisecond, so averaging it is effectively an instantaneous read while still shrugging off
// any ripple from an audio-rate source someone insists on patching in.
const WINDOW = 32;

export function create(ctx, services) {
  const { descriptor } = services;
  const meta = new Map(descriptor.params.map((p) => [p.id, p]));
  const values = new Map(descriptor.params.map((p) => [p.id, p.default]));
  let engine = null, unSource = null;

  // Brightness is the one parameter with a CV input, so it is the one that needs a real node.
  const bright = ctx.createConstantSource();
  bright.offset.value = Number(values.get('bright'));
  const tap = ctx.createAnalyser();
  tap.fftSize = WINDOW;
  bright.connect(tap);
  // An AnalyserNode is only guaranteed to be pulled if its chain reaches the destination, so
  // it goes there through a SILENT gain. Nothing is audible; this only keeps the graph alive.
  const mute = ctx.createGain();
  mute.gain.value = 0;
  tap.connect(mute);
  mute.connect(ctx.destination);
  bright.start();
  const buf = new Float32Array(WINDOW);

  function clampTo(id, v) {
    const m = meta.get(id) || {};
    const lo = m.min != null ? m.min : 0, hi = m.max != null ? m.max : 1;
    return Math.max(lo, Math.min(hi, v));
  }

  // Called by the rack once the (lazily created) engine exists. Everything set so far is
  // replayed, so a restored patch's settings survive whichever order the two arrive in.
  function attachEngine(e) {
    engine = e;
    for (const [id, v] of values) push(id, v);
    if (unSource) unSource();
    unSource = engine.addParamSource((params) => {
      tap.getFloatTimeDomainData(buf);
      let s = 0;
      for (let i = 0; i < buf.length; i++) s += buf[i];
      params.bright = clampTo('bright', s / buf.length);
    });
  }

  function push(id, value) {
    if (id === 'bright') { bright.offset.value = Number(value); return; }   // sampled, not pushed
    if (!engine) return;
    if (id === 'limit') engine.params.limit = Number(value);
    else if (id === 'test') engine.params.test = String(value);
    else if (id === 'res' || id === 'frame') {
      engine.params[id] = String(value);
      engine.setSize();                    // reallocates: only on a change, never per frame
    }
  }

  function getOutput() { return null; }
  function getInput() { return null; }
  function getParam(id) { return id === 'bright' ? bright.offset : null; }
  function supports() { return true; }
  function setParam(id, value) { values.set(id, value); push(id, value); }
  function dispose() {
    if (unSource) { unSource(); unSource = null; }
    try { bright.stop(); } catch (_e) { /* already stopped */ }
    try { bright.disconnect(); tap.disconnect(); mute.disconnect(); } catch (_e) { /* gone */ }
    engine = null;
  }

  return { getOutput, getInput, getParam, setParam, supports, dispose, attachEngine };
}
