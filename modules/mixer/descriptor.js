// descriptor.js — the output Mixer (207-style), a data-only module schema.
//
// The mixer is our output stage, modelled on the Buchla 207: a six-input,
// two-output stereo mixer with per-channel level and pan, plus voltage control
// of pan on the two OUTER channels (A and F) — the CV jack takes the pan knob's
// spot there (no manual pan knob). Every channel rests CENTRED; on A and F the
// pan CV sums onto centre (a bipolar CV sweeps full left..right). We drop
// the parts that don't
// apply to a computer — the microphone preamp, headphone/monitor output, preset
// storage — and add a per-channel mute (our own, not on the real panel).
//
// The mixer is a normal rack module — a terminal one: it has no output jacks
// because it IS the output (its master feeds the speakers). It's a singleton the
// host always keeps present (default lower-right, draggable, not deletable), and
// the patchbay wires module outputs into its channel inputs like any other input.
// A master level + stereo VU also mirror into the toolbar for always-on reach.

'use strict';

const CH = ['A', 'B', 'C', 'D', 'E', 'F'];

const ports = [];
const params = [];
for (const L of CH) {
  ports.push({ id: `chan${L}`, name: L, section: 'channel', domain: 'audio', dir: 'in' });
  // Gain (amp) CV: a control-voltage input that drives the channel level 0..1, the
  // same range the fader spans bottom-to-top.
  ports.push({ id: `ampCv${L}`, name: `Gain ${L}`, section: 'ampCv', domain: 'control', dir: 'in', target: `level${L}` });
  params.push({ id: `level${L}`, name: `Level ${L}`, section: 'channel', curve: 'gainDb', min: 0, max: 1, default: 0.29, glideMs: 20 });   // ~-11 dB → ~70% up the throw
  params.push({ id: `pan${L}`, name: `Pan ${L}`, section: 'channel', curve: 'linear', min: -1, max: 1, default: 0, glideMs: 20 });
  // The pan knob is a knAck, so it carries a CV-depth param: the host keys on this to
  // treat the knob as one, and the patchbay uses it as the cord's attenuator. AV is off
  // on the faceplate, which pins it to 1 — full-strength CV — until a knob is given an
  // attenuverter from its right-click menu.
  params.push({ id: `panDepth${L}`, name: `Pan depth ${L}`, section: 'channel', curve: 'linear', min: -1, max: 1, default: 1, glideMs: 0 });
  // Enable lamp: lit = channel enabled (passing audio). Internally still a mute
  // gain, but the sense is flipped — 'on' now means enabled, and it defaults on.
  params.push({ id: `mute${L}`, name: `Enable ${L}`, section: 'channel', curve: 'stepped', steps: [{ value: 'off' }, { value: 'on' }], default: 'on' });
}
// Pan CV, EVERY channel. It targets the channel's pan param — Web Audio sums the CV onto
// the knob's own value, which is what lets one knAck be both the knob and the input. `via`
// names the depth param, so the patchbay puts the cord through an attenuator gain it owns.
//
// Only A and F used to have this, and they had no knob in exchange; B through E had a knob
// and no pan CV port at all. Six knAcks give every channel both.
for (const L of CH) {
  ports.push({ id: `panCv${L}`, name: `Pan ${L}`, section: 'panCv', domain: 'control', dir: 'in', target: `pan${L}`, via: `panDepth${L}` });
}
params.push({ id: 'master', name: 'Master', section: 'master', curve: 'gainDb', min: 0, max: 1, default: 0.29, glideMs: 20 });   // ~-11 dB → ~70% up the throw
// Monitor bus: its own fader (level) beside the master. Its enable is INDEPENDENT of the master's
// (see the per-bus enables below) — both, either, or neither bus can play. Enabling a monitor object
// turns the Monitor bus on. All handled by the host (routing lives in the rack), not the DSP.
params.push({ id: 'monitorLevel', name: 'Monitor', section: 'master', curve: 'gainDb', min: 0, max: 1, default: 0.29, glideMs: 20 });
// The ENGINE — the one switch that decides whether this rack makes sound at all. It sits ABOVE
// the two buses: with it off, neither bus can be heard however its own lamp is set, and both
// lamps dim to say so. Turning it ON also turns the MASTER bus on, always, even if the master
// was off beforehand — otherwise "start the sound" could plausibly produce silence, which is
// precisely the confusion a master switch over two buses invites. Transport state, so it is
// never saved with a patch and always comes up off: the app never boots making noise.
params.push({ id: 'engine', name: 'Engine', section: 'master', curve: 'stepped', steps: [{ value: 'off' }, { value: 'on' }], default: 'off' });
// The two buses, each an independent on/off lamp under its fader (NOT a radio — both, either, or
// neither can play), both downstream of the engine. Master defaults on, monitor off; enabling a
// monitor object turns the monitor bus on. Routing lives in the rack.
params.push({ id: 'masterEnable', name: 'Master enable', section: 'master', curve: 'stepped', steps: [{ value: 'off' }, { value: 'on' }], default: 'on' });
params.push({ id: 'monitorEnable', name: 'Monitor enable', section: 'master', curve: 'stepped', steps: [{ value: 'off' }, { value: 'on' }], default: 'off' });

// The two buses get the same pair of rows the six channels have: a gain CV jack and a pan
// knAck. There is nothing special about a bus in this respect — a master fade is the most
// ordinary thing you would want an envelope to drive, and a bus that cannot be panned is
// the odd one out on a panel where all six channels can.
for (const [B, N] of [['Master', 'Master'], ['Monitor', 'Monitor']]) {
  const lvl = B === 'Master' ? 'master' : 'monitorLevel';
  ports.push({ id: `ampCv${B}`, name: `Gain ${N}`, section: 'ampCv', domain: 'control', dir: 'in', target: lvl });
  params.push({ id: `pan${B}`, name: `Pan ${N}`, section: 'master', curve: 'linear', min: -1, max: 1, default: 0, glideMs: 20 });
  params.push({ id: `panDepth${B}`, name: `Pan depth ${N}`, section: 'master', curve: 'linear', min: -1, max: 1, default: 1, glideMs: 0 });
  ports.push({ id: `panCv${B}`, name: `Pan ${N}`, section: 'panCv', domain: 'control', dir: 'in', target: `pan${B}`, via: `panDepth${B}` });
}

export default {
  id: 'mixer',
  apiVersion: 1,
  name: 'Mixer / Output',
  abbreviation: 'Mix',
  worklets: [],          // native Web Audio nodes only
  sectioned: true,       // six independent channel strips — net highlight scopes to the hovered channel
  channels: CH,
  // No output jacks (it's the terminal output), so the identity strip has no
  // ports to derive from. Declare it explicitly: this module outputs audio — to
  // the speakers rather than to a jack — so it wears the audio-yellow band.
  signalIdentity: ['audio'],
  ports,
  params,
};
