// descriptor.js — the output Mixer (207-style), a data-only module schema.
//
// The mixer is our output stage, in the spirit of the Buchla 207: a stereo mixer whose channels
// each have a level fader, an enable lamp, a gain CV input, a pan knAck and two send amounts.
// Every channel rests CENTRED, and every pan is both a knob and a CV input — the knob sets the
// panner's own value and a patched voltage sums onto it. We drop the parts that don't apply to a
// computer — the microphone preamp, preset storage — and add per-channel enables and the sends.
//
// The mixer is a normal rack module, and very nearly a terminal one: its only output jacks are the
// two send buses, because everything else about it ends at the speakers rather than at a cable.
// It's a singleton the host always keeps present (draggable, not deletable), and the patchbay wires
// module outputs into its channel inputs like any other input. A master level + stereo VU also
// mirror into the toolbar for always-on reach.

'use strict';

// TEN channels: eight to mix, and two the faceplate labels as RETURNS for the two send buses. Six
// was a compromise with rack width, and it ran out before a patch ran out of ideas. Nothing in the
// code distinguishes the last two — a return is an ordinary channel, which is the point: the effect
// comes back with its own fader, pan, enable and sends, instead of being a lesser kind of strip.
const CH = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const SENDS = ['1', '2'];   // two shared effect buses
// What each channel is CALLED — the same characters the faceplate prints. The ids stay lettered, but
// anything a person reads (a port's name in a menu, a callout, a page label) has to say what is
// written on the panel, or the two disagree in front of you.
const CH_LABEL = { A: '1', B: '2', C: '3', D: '4', E: '5', F: '6', G: '7', H: '8', I: 'RET 1', J: 'RET 2' };

const ports = [];
const params = [];
for (const L of CH) {
  ports.push({ id: `chan${L}`, name: CH_LABEL[L], section: 'channel', domain: 'audio', dir: 'in' });
  // Gain (amp) CV: a control-voltage input that drives the channel level 0..1, the
  // same range the fader spans bottom-to-top.
  ports.push({ id: `ampCv${L}`, name: `Gain ${CH_LABEL[L]}`, section: 'ampCv', domain: 'control', dir: 'in', target: `level${L}` });
  params.push({ id: `level${L}`, signal: 'audio', name: `Level ${L}`, section: 'channel', curve: 'gainDb', min: 0, max: 1, default: 0.29, glideMs: 20 });   // ~-11 dB → ~70% up the throw
  params.push({ id: `pan${L}`, signal: 'audio', name: `Pan ${L}`, section: 'channel', curve: 'linear', min: -1, max: 1, default: 0, glideMs: 20 });
  // The pan knob is a knAck, so it carries a CV-depth param: the host keys on this to
  // treat the knob as one, and the patchbay uses it as the cord's attenuator. AV is off
  // on the faceplate, which pins it to 1 — full-strength CV — until a knob is given an
  // attenuverter from its right-click menu.
  params.push({ id: `panDepth${L}`, name: `Pan depth ${L}`, section: 'channel', curve: 'linear', min: -1, max: 1, default: 1, glideMs: 0 });
  // Enable lamp: lit = channel enabled (passing audio). Internally still a mute
  // gain, but the sense is flipped — 'on' now means enabled, and it defaults on.
  params.push({ id: `mute${L}`, name: `Enable ${L}`, section: 'channel', curve: 'stepped', steps: [{ value: 'off' }, { value: 'on' }], default: 'on' });
  // TWO SENDS: how much of this channel goes to each shared effect bus. Post-fader and pre-pan, the
  // way a desk does it — the send follows the fader, so pulling a channel down takes its reverb with
  // it, and the effect returns in whatever position you give it rather than inheriting the channel's.
  //
  // Two rather than one because the pair you actually want is a reverb and a delay, and a single bus
  // makes you choose. Zero by default: a send that came up open would put every new patch through
  // whatever happens to be on the bus.
  for (const N of SENDS) {
    params.push({ id: `send${N}${L}`, signal: 'audio', name: `Send ${N} ${L}`, section: 'channel', curve: 'gainDb', min: 0, max: 1, default: 0, glideMs: 20 });
    params.push({ id: `send${N}Depth${L}`, name: `Send ${N} depth ${L}`, section: 'channel', curve: 'linear', min: -1, max: 1, default: 1, glideMs: 0 });
    ports.push({ id: `send${N}Cv${L}`, name: `Send ${N} ${CH_LABEL[L]}`, section: 'channel', domain: 'control', dir: 'in', target: `send${N}${L}`, via: `send${N}Depth${L}` });
  }
}
// Each bus leaves by its own jack. These are the mixer's only outputs — everything else about this
// module is terminal — and they exist because a shared effect is the one thing a modular rack is
// genuinely bad at: without a send bus, putting four voices through one reverb means four cables
// into a mixer you do not have, or four reverbs.
//
// There is deliberately no dedicated return CIRCUIT to match them. The effect comes back into an
// ordinary channel — the two the panel labels RET 1 and RET 2 are ordinary channels — so it reaches
// the main bus by the usual route with a full strip of its own. A special return would be a channel
// with fewer features and one more thing to explain.
for (const N of SENDS) ports.push({ id: `send${N}Out`, name: `Send ${N}`, section: 'master', domain: 'audio', dir: 'out' });
// Pan CV, EVERY channel. It targets the channel's pan param — Web Audio sums the CV onto
// the knob's own value, which is what lets one knAck be both the knob and the input. `via`
// names the depth param, so the patchbay puts the cord through an attenuator gain it owns.
//
// The knAck is what makes this possible: before it, a channel had either a knob or a CV jack,
// because there was only room on the panel for one of them. Every channel now has both.
for (const L of CH) {
  ports.push({ id: `panCv${L}`, name: `Pan ${CH_LABEL[L]}`, section: 'panCv', domain: 'control', dir: 'in', target: `pan${L}`, via: `panDepth${L}` });
}
params.push({ id: 'master', signal: 'audio', name: 'Master', section: 'master', curve: 'gainDb', min: 0, max: 1, default: 0.29, glideMs: 20 });   // ~-11 dB → ~70% up the throw
// Monitor bus: its own fader (level) beside the master. Its enable is INDEPENDENT of the master's
// (see the per-bus enables below) — both, either, or neither bus can play. Enabling a monitor object
// turns the Monitor bus on. All handled by the host (routing lives in the rack), not the DSP.
params.push({ id: 'monitorLevel', signal: 'audio', name: 'Monitor', section: 'master', curve: 'gainDb', min: 0, max: 1, default: 0.29, glideMs: 20 });
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

// THE MASTER IS A BUS YOU MIX; THE MONITOR IS A BUS YOU LISTEN ON. That difference is the whole
// reason their rows differ. The master gets a gain CV and a pan, because a master fade is the most
// ordinary thing you would want an envelope to drive and where the mix sits is part of the mix. The
// monitor gets neither: panning or modulating what you are LISTENING on changes what reaches your
// ears without changing anything that leaves the rack, which can only mislead you about the very mix
// you are trying to judge. Its level is yours to set by hand, and nothing else's to move.
for (const [B, N] of [['Master', 'Master'], ['Monitor', 'Monitor']]) {
  if (B !== 'Master') continue;
  const lvl = 'master';
  ports.push({ id: `ampCv${B}`, name: `Gain ${N}`, section: 'ampCv', domain: 'control', dir: 'in', target: lvl });
  params.push({ id: `pan${B}`, signal: 'audio', name: `Pan ${N}`, section: 'master', curve: 'linear', min: -1, max: 1, default: 0, glideMs: 20 });
  params.push({ id: `panDepth${B}`, name: `Pan depth ${N}`, section: 'master', curve: 'linear', min: -1, max: 1, default: 1, glideMs: 0 });
  ports.push({ id: `panCv${B}`, name: `Pan ${N}`, section: 'panCv', domain: 'control', dir: 'in', target: `pan${B}`, via: `panDepth${B}` });
}

export default {
  id: 'mixer',
  apiVersion: 1,
  name: 'Mixer / Output',
  category: 'utility',   // module library grouping
  abbreviation: 'Mix',
  worklets: [],          // native Web Audio nodes only
  sectioned: true,       // ten independent channel strips — net highlight scopes to the hovered channel
  channels: CH,
  // The identity strip: this module outputs audio — to the speakers, mostly, rather than to a jack
  // — so it wears the audio-yellow band. Declared rather than derived, since its one real output
  // (the send bus) is not what the module is for.
  signalIdentity: ['audio'],
  ports,
  params,
};
