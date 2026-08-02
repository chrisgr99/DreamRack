// factory.js — the Mixer's Web Audio graph.
//
// Ten channels, each: input gain (level) -> mute gain -> stereo panner, with a tap off the mute
// into each of the two shared send buses. All the panners sum into a master gain, which feeds the
// context destination (your two outputs) and drops the hot internal level toward line level. Every
// channel exposes its panner's pan AudioParam so a control cord can voltage-control it (Web Audio
// sums the CV onto the manual pan value), and the same is true of each send amount.
//
// The realized-instance contract matches every other module so the patchbay
// treats it uniformly:
//   getOutput(portId) -> the send buses  (the only outputs; otherwise the mixer IS the output)
//   getInput(portId)  -> { node, index } (a channel audio input)
//   getParam(paramId) -> AudioParam      (level/pan/master; pan is also a CV target)
//   setParam(id, v)   -> level/pan/master glide; mute toggles a gain
//   supports(id)      -> everything is realized
//   dispose()

'use strict';

// Output makeup gain (linear). Our internal signals run quiet — the Complex Oscillator trims
// itself to about ±0.4 (~-8 dBFS) — and two cascaded faders (channel + master) attenuate further,
// so without makeup the system can't reach a useful loudness. This lifts the post-fader signal
// ~+20 dB into a brick-wall limiter, so a normal patch is loud with headroom and the limiter
// catches peaks instead of clipping. The master fader still sets level below this.
const OUT_MAKEUP = 10;

export function create(ctx, services) {
  const { descriptor } = services;
  const CH = descriptor.channels;

  const master = ctx.createGain();
  master.gain.value = paramDefault('master');
  // Master-enable gate: passes the mix (1) or silences it (0), without disturbing the master
  // level. Driven by the mixer's masterEnable bus, and momentarily by the Sound menu's audition
  // (host `setMasterAudible`). Audible by default — masterEnable defaults on; the host reconciles
  // the exact state on boot and whenever the bus toggles.
  const masterGate = ctx.createGain();
  masterGate.gain.value = 1;
  // Master pan, between the fader and the enable gate: the whole mix's stereo balance,
  // and a knAck like every channel's, so it can be swept by CV.
  const masterPan = ctx.createStereoPanner();
  masterPan.pan.value = paramDefault('panMaster');
  master.connect(masterPan); masterPan.connect(masterGate);
  // Output makeup + brick-wall limiter (see OUT_MAKEUP): lift the quiet post-fader signal up so the
  // system is actually loud, and catch peaks safely instead of clipping. Everything upstream (the
  // gate and master fader) still shapes the signal before it reaches here.
  const makeup = ctx.createGain();
  makeup.gain.value = OUT_MAKEUP;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -1; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.003; limiter.release.value = 0.12;
  masterGate.connect(makeup); makeup.connect(limiter); limiter.connect(ctx.destination);
  // Set the master audible (1) or silent (0). The host computes this from masterEnable, or from a
  // momentary Sound-menu audition — the param itself is never touched, so an audition restores free.
  function setMasterAudible(on) { masterGate.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.008); }

  // Stereo VU tap: read the FINAL (post-makeup, post-limiter) output so the meters reflect what you
  // actually hear. (A pure read — it doesn't alter the signal reaching the destination.)
  const splitter = ctx.createChannelSplitter(2);
  limiter.connect(splitter);
  const meterL = ctx.createAnalyser(); meterL.fftSize = 256;
  const meterR = ctx.createAnalyser(); meterR.fftSize = 256;
  splitter.connect(meterL, 0);
  splitter.connect(meterR, 1);

  // The Monitor bus's fader and pan. The REST of that bus — its enable gate, makeup,
  // limiter and the taps that feed it — is built by the rack, because the routing is the
  // rack's job. These two nodes are not: they are the mixer's own Monitor fader and pan
  // knob, drawn on this faceplate, and owning them here is what lets a CV cord resolve
  // them through getParam at any moment — including before any monitor object has been
  // placed, which is when the rack would not yet have built the bus at all. The rack
  // splices this chain into the bus when it builds it (see monitorChain).
  const monLevel = ctx.createGain();
  monLevel.gain.value = paramDefault('monitorLevel');
  const monPan = ctx.createStereoPanner();
  monPan.pan.value = paramDefault('panMonitor');
  monLevel.connect(monPan);

  // The shared effect buses. Every channel taps into each after its fader and before its pan, and
  // each leaves by its own output jack — the only outputs this module has.
  const SENDS = ['1', '2'];
  const sendBus = new Map(SENDS.map((N) => { const g = ctx.createGain(); g.gain.value = 1; return [N, g]; }));

  const channels = CH.map((L) => {
    const level = ctx.createGain();
    const mute = ctx.createGain();
    const pan = ctx.createStereoPanner();
    level.gain.value = paramDefault(`level${L}`);
    mute.gain.value = paramDefault(`mute${L}`) === 'on' ? 1 : 0;
    level.connect(mute); mute.connect(pan); pan.connect(master);
    // POST-FADER, PRE-PAN. Post-fader so the send follows the fader — pull a channel down and its
    // reverb goes with it. Pre-pan so the effect returns wherever you place it, instead of arriving
    // already panned to wherever the dry channel happens to sit.
    const sends = new Map(SENDS.map((N) => {
      const g = ctx.createGain();
      g.gain.value = paramDefault(`send${N}${L}`);
      mute.connect(g); g.connect(sendBus.get(N));
      return [N, g];
    }));
    // Pan is a knAck on every channel: the knob sets pan.pan's own value and a patched CV
    // SUMS onto it, which is exactly Web Audio's rule for an AudioParam with a connected
    // input. No scaling node is needed here — the port declares `via: panDepth`, so the
    // patchbay owns the attenuator gain and updates it when the depth changes.
    //
    // This replaced an either/or: two channels had a CV input and no knob (their pan param
    // deliberately reported no AudioParam), and four had a knob and no CV.
    pan.pan.value = paramDefault(`pan${L}`);
    // A per-channel analysis tap, post level+mute (so a zeroed fader or a mute
    // reads as silence): a read-only fan-out for the VU meters and audio-trace.
    const meter = ctx.createAnalyser(); meter.fftSize = 1024;
    mute.connect(meter);
    return { L, level, mute, pan, sends, meter };
  });

  const byLetter = new Map(channels.map((c) => [c.L, c]));
  const inIndex = new Map(CH.map((L, i) => [`chan${L}`, i]));

  function paramDefault(id) {
    const p = descriptor.params.find((x) => x.id === id);
    return p ? p.default : 0;
  }

  // The send buses are the module's only outputs; everything else about it is terminal.
  function getOutput(portId) {
    const m = /^send([12])Out$/.exec(portId || '');
    return m ? { node: sendBus.get(m[1]), index: 0 } : null;
  }
  function getInput(portId) {
    const i = inIndex.get(portId);
    if (i !== undefined) return { node: channels[i].level, index: 0 };
    // Pan CV on the outer channels routes through the ×2/−1 pan scaler so a 0..1
    // CV sweeps the panner fully left..right.
    // panCv is NOT a node input: it carries `target`, so the patchbay wires it to the pan
    // AudioParam through the depth attenuator. Returning null here is what selects that path.
    return null;
  }
  function getParam(paramId) {
    if (paramId === 'master') return master.gain;
    if (paramId === 'monitorLevel') return monLevel.gain;
    if (paramId === 'panMaster') return masterPan.pan;
    if (paramId === 'panMonitor') return monPan.pan;
    if (paramId.startsWith('level')) { const c = byLetter.get(paramId.slice(5)); return c ? c.level.gain : null; }
    { const m = /^send([12])([A-J])$/.exec(paramId); if (m) { const c = byLetter.get(m[2]); return c ? c.sends.get(m[1]).gain : null; } }
    if (/^pan[A-J]$/.test(paramId)) { const c = byLetter.get(paramId.slice(3)); return c ? c.pan.pan : null; }
    return null;
  }
  function supports() { return true; }
  function setParam(paramId, value, atTime) {
    if (paramId.startsWith('mute')) {
      const c = byLetter.get(paramId.slice(4));
      if (c) c.mute.gain.value = value === 'on' ? 1 : 0;
      return;
    }
    const ap = getParam(paramId);
    if (!ap) return;
    const t = atTime === undefined ? ctx.currentTime : atTime;
    ap.setTargetAtTime(value, t, 0.02);
  }
  function dispose() {
    try { master.disconnect(); masterPan.disconnect(); masterGate.disconnect(); makeup.disconnect(); limiter.disconnect(); } catch (_e) { /* gone */ }
    try { monLevel.disconnect(); monPan.disconnect(); } catch (_e) { /* gone */ }
    for (const g of sendBus.values()) { try { g.disconnect(); } catch (_e) { /* gone */ } }
    for (const c of channels) {
      try { c.level.disconnect(); c.mute.disconnect(); c.pan.disconnect(); } catch (_e) { /* gone */ }
      for (const g of c.sends.values()) { try { g.disconnect(); } catch (_e) { /* gone */ } }
    }
  }

  // RMS level (0..~1) of each output channel, for the VU meters.
  const buf = new Float32Array(meterL.fftSize);
  function rms(an) {
    an.getFloatTimeDomainData(buf);
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / buf.length);
  }
  function meters() { return { l: rms(meterL), r: rms(meterR) }; }

  // Per-channel + master RMS levels (0..~1) for the VU meters. One reused buffer
  // sized to the largest analyser avoids per-frame allocation.
  const vbuf = new Float32Array(1024);
  function levelOf(an) {
    an.getFloatTimeDomainData(vbuf);
    let s = 0; const n = an.fftSize;
    for (let i = 0; i < n; i++) s += vbuf[i] * vbuf[i];
    return Math.sqrt(s / n);
  }
  function levels() {
    const ch = {};
    for (const c of channels) ch[c.L] = levelOf(c.meter);
    // The master is reported per SIDE as well as summed. Panning is the whole reason: with one bar
    // you can see that the mix is loud and not where it is going.
    const l = levelOf(meterL), rr = levelOf(meterR);
    return { channels: ch, master: Math.max(l, rr), masterL: l, masterR: rr };
  }

  // Read-only analyser taps for the audio-trace mirror: the master (stereo) plus
  // one per channel (post level+mute). Pure fan-outs; not part of the audio path.
  const analysers = {
    master: { l: meterL, r: meterR },
    channels: new Map(channels.map((c) => [c.L, c.meter])),
  };

  // The last node before the speakers. The screen recorder connects here in parallel
  // with ctx.destination, so a take carries exactly what the master bus is producing.
  // Optional contract method: a module without an output of its own doesn't implement it.
  function outputTap() { return limiter; }

  // Where the rack splices the Monitor bus through this mixer's Monitor fader and pan:
  // it connects its summed taps into `input` and takes `output` on to its own enable gate.
  const monitorChain = { input: monLevel, output: monPan };

  return { getOutput, getInput, getParam, setParam, supports, dispose, setMasterAudible, master, monitorChain, meters, levels, analysers, outputTap };
}
