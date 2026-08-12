// factory.js — Marbles audio factory.
//
// PHASE ONE: THE PANEL IS REAL, THE GENERATOR IS NOT YET. Every jack takes a cable, every knob turns
// and its value is stored and saved with the patch — nothing is generated. The outputs sit at zero, so
// a cord from one is silent rather than broken.
//
// The same order the clock was built in, and for the same reason: the faceplate is the part with
// opinions in it and is far cheaper to change before any DSP is married to it. Émilie Gillet's random
// generator is MIT-licensed and self-contained — a t-generator, an x-y generator and the déjà vu loop
// buffer — which is the next piece.
'use strict';

const OUTS = ["t1Out","t2Out","t3Out","yOut","x1Out","x2Out","x3Out"];
const INS = ["tClockIn","xClockIn","tRateIn","tBiasIn","tJitterIn","dejaVuIn","xSpreadIn","xBiasIn","xStepsIn"];

export function create(ctx, _services) {
  const outs = new Map();
  for (const id of OUTS) {
    const src = ctx.createConstantSource();
    src.offset.value = 0;
    src.start();
    outs.set(id, src);
  }
  // Inputs terminate in gains that go nowhere yet: the patchbay needs a node to land a cable on, and a
  // jack you cannot plug into is worse than one that does nothing.
  const ins = new Map();
  for (const id of INS) { const g = ctx.createGain(); g.gain.value = 1; ins.set(id, g); }

  return {
    node: outs.get('t1Out'),
    getOutput: (id) => (outs.has(id) ? { node: outs.get(id), index: 0 } : null),
    getInput: (id) => (ins.has(id) ? { node: ins.get(id), index: 0 } : null),
    getParam: () => null,
    setParam: () => { /* stored by the host; nothing reads it until the generator lands */ },
    supports: () => false,
    dispose: () => {
      for (const s of outs.values()) { try { s.stop(); s.disconnect(); } catch (_e) { /* gone */ } }
      for (const g of ins.values()) { try { g.disconnect(); } catch (_e) { /* gone */ } }
    },
  };
}
