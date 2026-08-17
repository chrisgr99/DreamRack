// host.js — the audio host.
//
// The host owns the one AudioContext, loads the worklet DSP a module declares,
// and turns a registered module into a live, wired instance. It is the piece
// that consumes the descriptor at run time: it reads descriptor.worklets to
// know what to addModule(), and it hands the factory a `services` bundle so
// the factory can build its nodes without knowing anything about the host.
//
// The host stays generic — it has no knowledge of oscillators or wavefolders.
// Everything module-specific lives behind the descriptor (data) and the
// factory (code). Adding a new module is: register it, then instantiate it.
// That is the pluggability promise of DESIGN §4, made real.
//
// This milestone builds a SINGLE instance (no polyphony, no rack yet) — enough
// to hear the module. Voice allocation, stealing, and multi-instance patching
// come later (DESIGN §7); the seam is here (instantiate takes an optional
// instanceId) so growing to N voices doesn't reshape this file.

'use strict';

import { ModuleRegistry } from './registry.js';

// Loaded into the worklet scope ahead of every processor; see worklets/lifetime.js.
const LIFETIME = 'worklets/lifetime.js';

export class SynthHost {
  // ctx: an AudioContext the caller created on a user gesture (browsers, and
  // Electron's renderer, require a gesture before audio starts). The host does
  // not create the context itself so the gesture stays in the UI layer.
  constructor(ctx, registry) {
    this.ctx = ctx;
    this.registry = registry || new ModuleRegistry();
    // Worklet module paths already addModule()'d, so we never load one twice
    // (addModule is idempotent but this avoids the extra round-trips).
    this._loadedWorklets = new Set();
    // instanceId -> realized instance, so the host can dispose/enumerate them.
    this._instances = new Map();
    this._instanceSeq = 0;
  }

  register(entry) { return this.registry.register(entry); }

  // Which descriptor an instance came from, so dispose knows which ports to ask it for.
  _noteDescriptor(instanceId, descriptorId) {
    if (!this._descriptorOf) this._descriptorOf = new Map();
    this._descriptorOf.set(instanceId, descriptorId);
  }

  // END ITS WORKLETS. A factory's dispose disconnects its nodes, which is not what stops them — a
  // processor runs until it returns false, and the message this posts is what makes it do that.
  //
  // The NODES ARE FOUND THROUGH THE DESCRIPTOR'S PORTS rather than by reaching into the instance: a
  // factory keeps its nodes in a closure and exposes them exactly one way, through getOutput and
  // getInput. So the ports are the map, and a module with several worklets is covered by all of them.
  _endWorklets(instanceId, inst) {
    const descriptorId = this._descriptorOf && this._descriptorOf.get(instanceId);
    const d = descriptorId && this.registry.descriptor(descriptorId);
    const ports = (d && d.ports) || [];
    const seen = new Set();
    for (const p of ports) {
      let slot = null;
      try {
        slot = p.dir === 'out' ? (inst.getOutput && inst.getOutput(p.id))
          : (inst.getInput && inst.getInput(p.id));
      } catch (_e) { slot = null; }
      const node = slot && slot.node;
      if (!node || !node.port || seen.has(node)) continue;
      seen.add(node);
      try { node.port.postMessage({ type: 'dispose' }); } catch (_e) { /* already gone */ }
    }
    if (this._descriptorOf) this._descriptorOf.delete(instanceId);
  }

  // Load every worklet a module declares, once each. Paths are RELATIVE to the
  // document, so they resolve correctly whether the page is served at the origin
  // root (Electron's app:// scheme) or under a sub-path (e.g. GitHub Pages).
  async loadWorklets(descriptorId) {
    const descriptor = this.registry.descriptor(descriptorId);
    const paths = Array.isArray(descriptor.worklets) ? descriptor.worklets : [];
    // FIRST, ALWAYS. It wraps registerProcessor so every processor loaded after it can be ended when
    // its module goes (worklets/lifetime.js says why); loaded after one, that processor would be the
    // one orphan that never stops.
    if (paths.length && !this._loadedWorklets.has(LIFETIME)) {
      await this.ctx.audioWorklet.addModule(LIFETIME);
      this._loadedWorklets.add(LIFETIME);
    }
    for (const p of paths) {
      if (this._loadedWorklets.has(p)) continue;
      await this.ctx.audioWorklet.addModule(p);
      this._loadedWorklets.add(p);
    }
  }

  // Build one live instance of a registered module. Returns { instanceId,
  // instance }. The factory is called with (ctx, services); services carries
  // the descriptor, the registry (for its port-order enumeration), and the
  // real sample rate. The optional explicit instanceId lets a future voice
  // allocator name instances deterministically ("voice0.complexOsc").
  async instantiate(descriptorId, instanceId) {
    const entry = this.registry.entry(descriptorId);
    if (!entry.create) {
      throw new Error(`Module "${descriptorId}" has no factory; cannot instantiate.`);
    }
    await this.loadWorklets(descriptorId);

    const id = instanceId || `${descriptorId}#${this._instanceSeq++}`;
    if (this._instances.has(id)) {
      throw new Error(`Instance id "${id}" already exists.`);
    }
    const services = {
      descriptor: entry.descriptor,
      registry: this.registry,
      sampleRate: this.ctx.sampleRate,
    };
    const instance = entry.create(this.ctx, services);
    this._instances.set(id, instance);
    this._noteDescriptor(id, descriptorId);
    return { instanceId: id, instance };
  }

  instance(instanceId) { return this._instances.get(instanceId) || null; }

  dispose(instanceId) {
    const inst = this._instances.get(instanceId);
    if (!inst) return;
    // The worklets are ended BEFORE the factory tears its nodes down: getOutput has to still answer.
    try { this._endWorklets(instanceId, inst); } catch (_e) { /* best effort */ }
    try { inst.dispose(); } catch (_e) { /* best effort */ }
    this._instances.delete(instanceId);
  }

  disposeAll() {
    for (const id of [...this._instances.keys()]) this.dispose(id);
  }
}
