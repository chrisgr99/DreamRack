// patchbay.js — the netlist and its audio wiring.
//
// A patch is a list of EDGES; this is the source of truth (DESIGN.md §3). Each
// edge connects one module output to one module input, and the patchbay both
// records it and realizes it in the Web Audio graph. Every visual surface (the
// rack's on-panel cords today, a grid later) is just a rendering of edges().
//
// Realizing an edge depends on the destination port's kind, which the factory
// contract already encodes for us:
//   - A node input (getInput non-null): a pure signal in (FM, phase lock) or an
//     exponential 1V/oct CV in — the worklet sums these itself, so we simply
//     wire source-output -> node-input. Depth, for the CV ins, is the worklet's
//     job (its own attenuverter param).
//   - A linear CV in (getInput null): drives the target param's AudioParam. If
//     the port declares a `via` attenuator, the cord runs through a GainNode
//     whose gain tracks that panel knob — the input's depth control; otherwise
//     it drives the param at unity.
//
// A cable carries no depth of its own yet (DESIGN: deferred) — depth lives on
// the input. The GainNode seam is exactly where a future per-cable amount would
// multiply in, so adding it later touches only this file.

'use strict';

export const ALLOW = 'allow';
export const WARN = 'warn';
export const DENY = 'deny';

// The video domains. Held apart from audio/control/trigger because an image is not a
// signal you can sum into an AudioParam: a `luma` or `rgb` cable is a LOGICAL edge that the
// video engine reads, not a Web Audio connection.
const VIDEO = new Set(['luma', 'rgb']);
export function isVideoDomain(d) { return VIDEO.has(d); }

// The NOTE domain — a bundle, not a signal (design/voice-pages.md). One cable carries the gate, the
// held pitch, level, duration and pan, plus the bend and pressure lanes, for every note a voice is
// playing at once. It is an ordinary Web Audio connection: the lanes are channels on one node, which
// is why nothing here needs a special case the way the video edges do.
//
// IT CONNECTS TO NOTHING ELSE, IN EITHER DIRECTION. That single rule is what makes a page's kind
// enforce itself: a note source dropped on a voice page has nowhere legal to land, because the only
// input in the rack that accepts a note bundle is the Voice module's, and a voice page has no
// Sequencer module to take one. No placement rule, no error message — the cable simply will not go.
export function isNoteDomain(d) { return d === 'note'; }

// The one place the domain policy lives (see design/video-synthesis.md §2). Among the
// audio-side domains nothing is denied — same-domain and audio->control (FM) are allowed,
// oddities warn but still connect. The VIDEO rules are the first real denials, and each
// earns it:
//
//   luma -> rgb   ALLOW, broadcasting one channel to all three, so a monochrome chain drops
//                 into a colour input without ceremony.
//   rgb -> luma   DENY. Reducing three channels to one is a creative choice — which channel,
//                 or weighted luminance? — so it goes through the decoder module rather than
//                 happening silently.
//   control -> video   ALLOW. CV driving a video parameter is the commonest cable of all.
//   audio/trigger -> video   DENY. Not prudishness: CV is sampled ONCE PER FRAME, so a
//                 200 Hz signal aliases into a slow wobble. An audio-rate signal reaches the
//                 image as a texture, through a module, never as a parameter.
//   video -> audio/control/trigger   DENY. Extracting CV from an image is the image-to-CV
//                 module's job, where the reduction and its one frame of latency are visible.
export function canConnect(srcDomain, dstDomain) {
  // note -> note and nothing else, either way. See isNoteDomain above for why this is the whole of
  // the voice-page rule.
  if (isNoteDomain(srcDomain) || isNoteDomain(dstDomain)) {
    return srcDomain === dstDomain ? ALLOW : DENY;
  }
  const sv = VIDEO.has(srcDomain), dv = VIDEO.has(dstDomain);
  if (sv !== dv) {
    if (!sv && dv) return dstDomain && srcDomain === 'control' ? ALLOW : DENY;
    return DENY;                                                        // video out of the video world
  }
  if (sv && dv) return srcDomain === dstDomain || srcDomain === 'luma' ? ALLOW : DENY;
  if (srcDomain === dstDomain) return ALLOW;
  if (srcDomain === 'audio' && dstDomain === 'control') return ALLOW;   // audio-rate modulation (FM)
  return WARN;                                                          // trigger mismatches / oddities
}

// A cord takes its DESTINATION port's signal family, so its colour matches the
// jack it lands on (DESIGN §3): audio, trigger, 1V/oct pitch (green), else control.
export function familyOfPort(port) {
  if (isNoteDomain(port.domain)) return 'note';      // its own look: neutral, thicker, double-ringed
  if (port.role === 'pitch' || port.name === '1V/Oct') return 'pitch';
  if (port.domain === 'audio') return 'audio';
  if (port.domain === 'trigger') return 'trigger';
  if (VIDEO.has(port.domain)) return port.domain;   // luma and rgb are their own cable colours
  return 'control';
}

function finiteOr(v, fallback) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export class Patchbay {
  constructor(ctx, registry) {
    this.ctx = ctx;
    this.registry = registry;
    this.edges = new Map();     // edgeId -> edge
    this._seq = 0;
  }

  list() { return [...this.edges.values()]; }

  // src/dst: { key, instance, descriptorId, portId }. src must be an output and
  // dst an input; the caller resolves orientation before calling. initialDepth
  // seeds the via-attenuator gain (the destination knob's current value).
  connect(src, dst, initialDepth) {
    const srcPort = this.registry.portById(src.descriptorId, src.portId);
    const dstPort = this.registry.portById(dst.descriptorId, dst.portId);
    if (!srcPort || srcPort.dir !== 'out') return { ok: false, reason: 'source is not an output' };
    if (!dstPort || dstPort.dir !== 'in') return { ok: false, reason: 'destination is not an input' };

    const verdict = canConnect(srcPort.domain, dstPort.domain);
    if (verdict === DENY) return { ok: false, reason: 'not allowed', verdict };

    // An input takes at most one cable — reject a second (outputs still fan out).
    if (this.inputOccupied(dst.key, dst.portId)) return { ok: false, reason: 'input already connected' };

    // A VIDEO edge carries no audio node at either end. It is a LOGICAL connection — module X's
    // output texture becomes module Y's input sampler — and the whole of it lives inside the
    // video engine's frame loop. So it is recorded and nothing is wired: no getOutput, no
    // getInput, no gain. The rack reads these edges back out to build the render graph.
    if (VIDEO.has(srcPort.domain) && VIDEO.has(dstPort.domain)) {
      const vEdge = {
        id: 'e' + (this._seq++),
        src: { ...src }, dst: { ...dst },
        srcDomain: srcPort.domain, dstDomain: dstPort.domain,
        style: familyOfPort(dstPort),
        viaParamId: null,
        out: null, nodeIn: null, gainNode: null, target: null,
        video: true,
        verdict,
      };
      this.edges.set(vEdge.id, vEdge);
      return { ok: true, edge: vEdge, verdict };
    }

    const out = src.instance.getOutput(src.portId);
    if (!out) return { ok: false, reason: `output "${src.portId}" not realized` };

    const edge = {
      id: 'e' + (this._seq++),
      src: { ...src }, dst: { ...dst },
      srcDomain: srcPort.domain, dstDomain: dstPort.domain,
      style: familyOfPort(dstPort),
      viaParamId: dstPort.via || null,
      out, nodeIn: null, gainNode: null, target: null,
      verdict,
    };

    const nodeIn = dst.instance.getInput(dst.portId);
    if (nodeIn) {
      // Pure signal / exponential CV input: wire straight into the worklet.
      out.node.connect(nodeIn.node, out.index, nodeIn.index);
      edge.nodeIn = nodeIn;
    } else if (dstPort.target) {
      // Linear CV input: source -> [via gain] -> target AudioParam.
      const param = dst.instance.getParam(dstPort.target);
      if (!param) return { ok: false, reason: `target param "${dstPort.target}" not realized` };
      edge.target = param;
      if (dstPort.via) {
        const g = this.ctx.createGain();
        g.gain.value = finiteOr(initialDepth, 1);
        out.node.connect(g, out.index, 0);
        g.connect(param);
        edge.gainNode = g;
      } else {
        out.node.connect(param, out.index);
      }
    } else {
      return { ok: false, reason: `input "${dst.portId}" has neither node input nor target` };
    }

    this.edges.set(edge.id, edge);
    return { ok: true, edge, verdict };
  }

  // Update every live cord whose depth this destination knob controls.
  setDepth(dstKey, viaParamId, value, atTime) {
    if (!viaParamId) return;
    const t = atTime === undefined ? this.ctx.currentTime : atTime;
    for (const e of this.edges.values()) {
      if (e.gainNode && e.dst.key === dstKey && e.viaParamId === viaParamId) {
        e.gainNode.gain.setTargetAtTime(finiteOr(value, 1), t, 0.01);
      }
    }
  }

  disconnect(edge) {
    // A video edge has nothing to unwire — removing it from the list IS the disconnection, and
    // the rack rebuilds the render graph from what is left.
    if (edge && edge.video) { this.edges.delete(edge.id); return; }
    if (!edge || !this.edges.has(edge.id)) return;
    try {
      if (edge.nodeIn) edge.out.node.disconnect(edge.nodeIn.node, edge.out.index, edge.nodeIn.index);
      else if (edge.gainNode) { edge.out.node.disconnect(edge.gainNode, edge.out.index, 0); edge.gainNode.disconnect(); }
      else if (edge.target) edge.out.node.disconnect(edge.target, edge.out.index);
    } catch (_e) { /* already gone */ }
    this.edges.delete(edge.id);
  }

  // Remove every edge touching a module (used when it is deleted).
  disconnectModule(key) {
    for (const e of this.list()) if (e.src.key === key || e.dst.key === key) this.disconnect(e);
  }

  // Edges with an endpoint on this jack (for the disconnect menu).
  edgesAtJack(key, portId) {
    return this.list().filter((e) => (e.src.key === key && e.src.portId === portId)
      || (e.dst.key === key && e.dst.portId === portId));
  }

  // Does this input jack already carry a cable? (exceptEdge is ignored — for a
  // move, the cable's own edge shouldn't count against it.)
  inputOccupied(dstKey, dstPortId, exceptEdge) {
    return this.list().some((e) => e !== exceptEdge && e.dst.key === dstKey && e.dst.portId === dstPortId);
  }
}
