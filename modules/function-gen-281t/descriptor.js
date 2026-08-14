// descriptor.js — Quad Function Generator (281t), a data-only module schema.
//
// A Buchla-281-style quad function generator: four identical rise/fall function
// generators (A–D). Each produces a transient (attack then decay) that can be
// fired three ways — the panel TRIG button, an external TRIG input, or by
// self-cycling — and self-cycling turns the transient into a repeating LFO.
// Per channel: a TRIG input + a manual TRIG button; a CYCLE gate input + a CYCLE
// switch (self-cycle on/off); ATTACK and DECAY time knobs (0.001–10 s) each with
// its own CV input; a FUNCTION output (the envelope, usable as audio-rate CV)
// and a PULSE output that fires a trigger when the decay completes (end of cycle).
// On the shipped faceplate the ATTACK/DECAY CV inputs are folded INTO their knobs as
// knAcks (a cable plugs straight into the knob), so the ports below are unchanged but
// the panel has no separate CV jacks for them — see panel.svg.
//
// Quadrature ties the A–B and C–D pairs so the two functions run 90° out of
// phase (A rises, holds while B rises, then A falls, …). NOTE: the exact role of
// the two large QUADRATURE knobs and their two outputs is a BEST-GUESS PLACEHOLDER
// pending a readable manual — modelled here as a coordinated-time knob and a
// paired quadrature output per pair, plus a per-pair enable. Revise once the
// manual is available.
//
// The art and coordinate convention follow the 259t / 292 house style.

'use strict';

const CH = ['A', 'B', 'C', 'D'];
const PAIRS = [['A', 'B'], ['C', 'D']];

const ports = [];
const params = [];

// Ports. The dir="in" order fixes the worklet's input indices and the dir="out"
// order fixes its output indices (the factory asserts both). Grouped by type so
// inputs come out as [trig A-D, cycle A-D, attackCv A-D, decayCv A-D] and outputs
// as [fn A-D, pulse A-D, quad AB, quad CD].
// Port names mirror the faceplate labels (the user-facing text on the panel), plus the channel letter.
for (const L of CH) ports.push({ id: `trig${L}`, name: `Trig ${L}`, section: 'channel', domain: 'trigger', dir: 'in' });
for (const L of CH) ports.push({ id: `cycleIn${L}`, name: `Cycle ${L}`, section: 'channel', domain: 'trigger', dir: 'in' });
  // The trim that scales what arrives here. Named on the PORT, not merely present among the params,
  // so the rack can see the pairing: it is what tells the panel this jack sits at a knob's centre
  // and what earns the jack its bipolar dot, since an attenuverter can invert whatever is patched.
for (const L of CH) ports.push({ id: `attackCv${L}`, name: `Attack CV ${L}`, section: 'channel', domain: 'control', dir: 'in', via: `attackDepth${L}` });
for (const L of CH) ports.push({ id: `decayCv${L}`, name: `Decay CV ${L}`, section: 'channel', domain: 'control', dir: 'in', via: `decayDepth${L}` });
for (const L of CH) ports.push({ id: `fn${L}`, name: `CV out ${L}`, section: 'channel', domain: 'control', dir: 'out' });
for (const L of CH) ports.push({ id: `pulse${L}`, name: `Pulse out ${L}`, section: 'channel', domain: 'trigger', dir: 'out' });
ports.push({ id: 'quadOutAB', name: 'A-B out', section: 'quad', domain: 'control', dir: 'out' });
ports.push({ id: 'quadOutCD', name: 'C-D out', section: 'quad', domain: 'control', dir: 'out' });

// Params. ATTACK/DECAY are exponential time knobs (0.001–10 s, no glide — a time
// control shouldn't smear). TRIG is a momentary button (each press fires once).
// MODE is a 3-position switch: transient (one-shot attack/decay), sustained
// (attack, hold while gated, decay) or cyclic (repeats as an LFO). The separate
// cycleIn gate forces cycling in any mode while it's held.
const onoff = () => ({ curve: 'stepped', steps: [{ value: 'off' }, { value: 'on' }] });
for (const L of CH) {
  params.push({ id: `attack${L}`, name: `Attack ${L}`, section: 'channel', curve: 'exp', min: 0.001, max: 10, default: 0.05, unit: 's', glideMs: 0 });
  params.push({ id: `decay${L}`, name: `Decay ${L}`, section: 'channel', curve: 'exp', min: 0.001, max: 10, default: 0.2, unit: 's', glideMs: 0 });
  params.push({ id: `trigBtn${L}`, name: `Trig ${L}`, section: 'channel', ...onoff(), default: 'off', momentary: true });
  params.push({ id: `mode${L}`, name: `Mode ${L}`, section: 'channel', curve: 'stepped', steps: [{ value: 'transient' }, { value: 'sustained' }, { value: 'cyclic' }], default: 'transient' });
  // knAck AV depth per time knob: time = knob x 2^(depth x CV x octaves). Default 1 =
  // the plain knАck (AV off): CV acts at full strength. subControl = driven by the knob's
  // AV ring, not its own SVG element, so the panel-coverage check skips it.
  // Each has its own TRIM on the faceplate now, at four o'clock from its knАck, so it is no longer a
  // subControl — the panel-coverage check should hold it to the same standard as any other knob.
  params.push({ id: `attackDepth${L}`, name: `Attack CV depth ${L}`, section: 'channel', curve: 'linear', min: -1, max: 1, default: 1, glideMs: 10 });
  params.push({ id: `decayDepth${L}`, name: `Decay CV depth ${L}`, section: 'channel', curve: 'linear', min: -1, max: 1, default: 1, glideMs: 10 });
}
// Quadrature (placeholder behaviour — see header): a coordinated-time knob per
// pair plus an enable toggle per pair.
params.push({ id: 'quadTimeAB', name: 'Quad Time A-B', section: 'quad', curve: 'linear', min: 0, max: 1, default: 0.5, glideMs: 10 });
params.push({ id: 'quadTimeCD', name: 'Quad Time C-D', section: 'quad', curve: 'linear', min: 0, max: 1, default: 0.5, glideMs: 10 });
params.push({ id: 'quadEnAB', name: 'Quadrature A-B', section: 'quad', ...onoff(), default: 'off' });
params.push({ id: 'quadEnCD', name: 'Quadrature C-D', section: 'quad', ...onoff(), default: 'off' });

export default {
  id: 'wcoast.quadFn281t',
  apiVersion: 1,
  name: 'Quad Function Generator',
  category: 'modulation',   // module library grouping
  abbreviation: 'QFG',
  sectioned: true,   // four independent channels — net highlight scopes to one
  worklets: ['modules/function-gen-281t/function-gen-281t-processor.js'],
  channels: CH,
  pairs: PAIRS,
  ports,
  params,
};
