// patch-io.js — serialize a live patch to a portable object, and rebuild one.
//
// This is the environment-independent CORE of save/load (design/save-load.md):
// it knows nothing about files, dialogs, or storage — only how to turn the rack,
// its wiring, and every setting into a plain object, and how to reconstruct that.
// The storage adapters (Electron / browser) sit on top and only move the bytes.
//
// The format separates TOPOLOGY (which modules exist, where, and how wired) from
// SETTINGS (every param value), so settings snapshots can be added later without
// touching the topology or wiring (see design/save-load.md "Future").
//
//   serialize(rack, mixer) -> object
//   restore(object, rack, mixer) -> Promise<void>
//
// `mixer` is a small adapter for the output mixer, a pinned rack module that is a
// fixed patch endpoint (never listed among the saved modules):
//   { key, getParams(): {id: value}, setParams({id: value}): void }

'use strict';

export const FORMAT = 'wcoast-patch';   // INTERNAL format id — never rename (identifies the file shape)
export const VERSION = 1;               // format version (bump only when the shape changes)

// User-facing product identity, stamped into every saved patch for traceability.
// APP_VERSION is deliberately pinned; do not increment it without an explicit request.
export const APP_NAME = 'DreamRack';
export const APP_VERSION = '0.1';

const round2 = (n) => Math.round(n * 100) / 100;

// WHERE A MODULE BELONGS when the patch predates pages entirely. A video module goes to the video
// page and everything else to the first audio page, so an old patch opens already sorted the way it
// would have been built today rather than piled onto one page for you to sort by hand. Judged by the
// SIGNALS a module carries rather than by a list of names: a module whose jacks are luma or rgb is a
// video module, and a list would go stale the moment one was added.
//
// ONLY for a patch that predates pages — see `legacy` in restore(). A patch that knows about pages
// has already said where everything goes, INCLUDING by saying nothing (an omitted page means the
// first audio page). Sorting those would silently move a module you had deliberately put somewhere.
function homePage(rack, type) {
  const d = rack.host && rack.host.registry && rack.host.registry.descriptor(type);
  const video = !!d && (d.ports || []).some((pt) => pt.domain === 'luma' || pt.domain === 'rgb');
  return video ? 'video' : 'a1';
}

export function serialize(rack, mixer) {
  // Pinned records (the singleton mixer) aren't listed as modules — they're
  // recreated at boot, not per patch — so a restore won't duplicate them. The
  // mixer's params + wiring still round-trip: params via the `mixer` adapter
  // below, wiring by its stable key.
  const recs = rack.moduleRecords().filter((rec) => !rec.pinned);
  // The pinned mixer isn't listed as a module, but its POSITION still round-trips so it reopens where
  // the user left it (a fresh boot always places it at x=0).
  const mixRec = rack.records.get(mixer.key);

  // `page` is a COORDINATE alongside row and x — which page of the rack the module is drawn on.
  // Omitted when it is the first audio page, so a patch that uses one page reads exactly as it did
  // before pages existed, and an older patch loads with everything on Audio 1.
  const modules = recs.map((rec) => {
    const m = { id: rec.key, type: rec.descriptorId, row: rec.row, x: round2(rec.x) };
    const page = rack.pageOf ? rack.pageOf(rec) : null;
    if (page && page !== 'a1') m.page = page;
    return m;
  });

  const params = {};
  // A param marked `transient` in its descriptor is state, not a setting: it belongs to this
  // session rather than to the patch, so it is left out and comes back at its default. The video
  // output's window is the first — see that descriptor for why it cannot be restored.
  for (const rec of recs) {
    const desc = rack.host.registry.descriptor(rec.descriptorId);
    const skip = new Set((desc && desc.params || []).filter((p) => p.transient).map((p) => p.id));
    const o = Object.fromEntries(rec.values);
    for (const id of skip) delete o[id];
    params[rec.key] = o;
  }
  params[mixer.key] = { ...mixer.getParams() };

  const wiring = rack.patchbay.list().map((e) => {
    const w = {
      from: { module: e.src.key, port: e.src.portId },
      to: { module: e.dst.key, port: e.dst.portId },
    };
    if (e.bow) w.bow = { along: e.bow.along, perp: e.bow.perp };
    // A LINK (mult) records the input it taps, so it round-trips as the short cord you drew.
    if (e.link) w.link = { module: e.link.key, port: e.link.portId };
    return w;
  });

  // Probes (scopes + ear monitors) clipped onto terminals — their kind, endpoint,
  // position and settings — so a bench of monitors/scopes reopens with the patch.
  const probes = rack.serializeProbes ? rack.serializeProbes() : [];

  const out = {
    format: FORMAT,
    version: VERSION,
    app: APP_NAME,
    appVersion: APP_VERSION,
    rack: { rows: rack.rowCount },
    // The pages themselves: their order and their names. The two fixed ones are rebuilt from the
    // code rather than trusted from the file, so a patch can never arrive without them.
    pages: rack.pageList ? rack.pageList().filter((p) => p.kind === 'audio').map((p) => ({ id: p.id, name: p.name })) : undefined,
    mixerPos: mixRec ? { row: mixRec.row, x: round2(mixRec.x) } : null,
    modules,
    wiring,
    settings: { params },
    probes,
  };
  // The exact source revision that produced this file, so a bug report carrying a patch can be
  // traced back to a checkout. Present only in Electron-from-source (see rack.buildInfo); omitted
  // in the browser build, where there is no repository to point at.
  if (rack.buildInfo) out.build = rack.buildInfo;
  // A free-text note about the patch (plain text), and whether it auto-opens on load. Omitted when empty.
  if (rack.patchNotes) out.notes = rack.patchNotes;
  if (rack.patchNotesOpen) out.notesOpen = true;
  return out;
}

export async function restore(obj, rack, mixer) {
  if (!obj || obj.format !== FORMAT) throw new Error('Not a Wcoast patch file.');
  if (obj.version !== VERSION) throw new Error(`Unsupported patch version ${obj.version}.`);

  rack.clear();
  rack.patchNotes = typeof obj.notes === 'string' ? obj.notes : '';   // the patch's own note (plain text) + whether it greets on load
  rack.patchNotesOpen = !!obj.notesOpen;
  if (obj.rack && typeof obj.rack.rows === 'number') rack.setRowCount(obj.rack.rows);

  // Recreate modules, mapping each saved id to the fresh session key. The mixer
  // is a fixed endpoint whose id maps to itself.
  const idToKey = new Map([[mixer.key, mixer.key]]);
  if (rack.restorePages) rack.restorePages(obj.pages);
  // A patch written since pages existed always carries a `pages` list, even when it uses only one.
  // Its absence is what marks a file as predating them — and only those get sorted onto pages, since
  // only those never had the chance to say where anything belongs.
  const legacy = !Array.isArray(obj.pages);
  for (const m of obj.modules || []) {
    const page = m.page || (legacy ? homePage(rack, m.type) : 'a1');
    const rec = await rack.addModule(m.type, m.row, m.x, { page });
    if (rec) idToKey.set(m.id, rec.key);
  }
  // Put the pinned mixer back where it was saved (it survives rack.clear() at its boot x=0 otherwise).
  if (obj.mixerPos) rack.placeModule(mixer.key, obj.mixerPos.row, obj.mixerPos.x);

  // Apply settings: module param maps, then the mixer.
  const params = (obj.settings && obj.settings.params) || {};
  for (const [id, vals] of Object.entries(params)) {
    if (id === mixer.key) { mixer.setParams(vals); continue; }
    const rec = rack.records.get(idToKey.get(id));
    // Skip ids this module no longer has. applyParam would store them harmlessly, but
    // they would then be written back out on the next save and the patch would carry the
    // stale key for ever; dropping them here lets an old patch heal on first save.
    const desc = rec && rack.moduleTypes.find((t) => t.descriptorId === rec.descriptorId);
    if (rec) {
      for (const [pid, v] of Object.entries(vals)) {
        if (desc && desc.descriptor && !paramIsKnown(desc.descriptor, pid)) continue;
        rack.applyParam(rec, pid, v);
      }
    }
  }

  // Recreate wiring (both endpoints now exist), restoring each cable's bend.
  for (const w of obj.wiring || []) {
    const fromKey = idToKey.get(w.from.module);
    const toKey = idToKey.get(w.to.module);
    if (!fromKey || !toKey) continue;
    const edge = rack.connectPatch(
      { key: fromKey, portId: w.from.port },
      { key: toKey, portId: w.to.port },
    );
    // A cable that silently fails to come back is the worst kind of restore bug: the
    // patch looks restored and isn't. Say so.
    if (!edge) console.warn(`[wcoast] cable not restored: ${w.from.module}.${w.from.port} -> ${w.to.module}.${w.to.port}`);
    if (edge && w.bow) edge.bow = w.bow;
    // Re-tag a link with its (remapped) anchor input; reconciled after all wiring exists.
    if (edge && w.link && idToKey.has(w.link.module)) edge.link = { key: idToKey.get(w.link.module), portId: w.link.port };
  }
  if (rack.reconcileLinks) rack.reconcileLinks();   // fix link styles/sources now that every cord exists
  rack.redrawCables();

  // Probes last: modules and wiring exist now, so an input probe finds its feeding cord.
  // Remap each saved endpoint id to the fresh session key.
  if (Array.isArray(obj.probes) && rack.restoreProbes) {
    rack.restoreProbes(obj.probes
      .map((p) => (p && idToKey.has(p.module) ? { ...p, module: idToKey.get(p.module) } : null))
      .filter(Boolean));
  }
}

// Validate a patch object against the registered descriptors. Returns
// { ok: true, warnings: [] } or { ok: false, error }.
//
// STRUCTURE is fatal; SETTINGS are not. A patch's value is its modules and its
// cables — an unknown or unusable param value is a detail, and losing an entire
// patch over one is a bad trade. So an unknown param id, a step that no longer
// exists, or a value out of range is dropped with a warning and everything else
// restores; the param simply takes its default.
//
// This matters because the module descriptors are still moving. Every time a param
// is renamed or removed — the knAck rework, the sequencer's marker buttons becoming
// start/end selectors — every saved session written before that change contained the
// old id. Under the previous all-or-nothing rule that silently discarded the whole
// session, cables included, and the app came up empty with only a console line to
// say why.
//
// Fatal, still: a bad format or version, a module with no id, a duplicate id, an
// unknown module type, and any malformed or impossible wiring. Those cannot be
// applied at all, and a patch that half-exists is worse than one that is refused.
export function validate(obj, registry) {
  const warnings = [];
  const bad = (m) => ({ ok: false, error: m });
  if (!obj || obj.format !== FORMAT) return bad('not a wcoast-patch file');
  if (obj.version !== VERSION) return bad(`unsupported version ${obj.version}`);

  // module id -> descriptor (the mixer is a fixed endpoint, always present).
  const descOf = new Map([['mixer', registry.descriptor('mixer')]]);
  for (const m of (obj.modules || [])) {
    if (!m || typeof m.id !== 'string') return bad('a module has no id');
    if (descOf.has(m.id)) return bad(`duplicate module id "${m.id}"`);
    if (!registry.has(m.type)) return bad(`unknown module type "${m.type}"`);
    descOf.set(m.id, registry.descriptor(m.type));
  }

  const params = (obj.settings && obj.settings.params) || {};
  for (const [mid, vals] of Object.entries(params)) {
    const d = descOf.get(mid);
    if (!d) { warnings.push(`settings for unknown module "${mid}" ignored`); continue; }
    const byId = new Map((d.params || []).map((p) => [p.id, p]));
    for (const [pid, v] of Object.entries(vals)) {
      const p = byId.get(pid);
      if (!p) {
        // knAck UI state: "av.<paramId>" carries the knob's attenuverter on/off choice
        // (designer default overridden by the user — see rack's _setupDualKnack).
        if (pid.startsWith('av.') && byId.has(pid.slice(3)) && (v === 'on' || v === 'off')) continue;
        warnings.push(`unknown param "${pid}" on "${mid}" ignored`);
        continue;
      }
      if (p.curve === 'text') {
        // A TEXT param: the Formula module's expression. Length-capped because it is compiled
        // into a shader, and an unbounded string in a patch file is an unbounded string handed
        // to a driver. The grammar is checked by the module, not here — this only has to be
        // sure the file is carrying a string of a sane size.
        if (typeof v !== 'string' || v.length > 512) warnings.push(`param "${pid}" on "${mid}" is not a short string — ignored`);
      } else if (p.curve === 'stepped') {
        const steps = (p.steps || []).map((s) => s.value);
        if (!steps.includes(v)) warnings.push(`param "${pid}" on "${mid}" is not one of ${steps.join(', ')} — ignored`);
      } else if (typeof v !== 'number' || !Number.isFinite(v)) {
        warnings.push(`param "${pid}" on "${mid}" is not a number — ignored`);
      } else if (v < p.min || v > p.max) {
        warnings.push(`param "${pid}" on "${mid}" is outside ${p.min}..${p.max} — ignored`);
      }
    }
  }

  const portOf = (mid, portId, dir) => {
    const d = descOf.get(mid);
    const port = d && (d.ports || []).find((pp) => pp.id === portId);
    return (port && port.dir === dir) ? port : null;
  };
  const usedInputs = new Set();
  for (const w of (obj.wiring || [])) {
    if (!w || !w.from || !w.to) return bad('a wiring entry is missing from/to');
    if (!descOf.has(w.from.module)) return bad(`wiring from unknown module "${w.from.module}"`);
    if (!descOf.has(w.to.module)) return bad(`wiring to unknown module "${w.to.module}"`);
    if (!portOf(w.from.module, w.from.port, 'out')) return bad(`no output "${w.from.port}" on "${w.from.module}"`);
    if (!portOf(w.to.module, w.to.port, 'in')) return bad(`no input "${w.to.port}" on "${w.to.module}"`);
    const key = `${w.to.module}|${w.to.port}`;
    if (usedInputs.has(key)) return bad(`input "${w.to.port}" on "${w.to.module}" has more than one cable`);
    usedInputs.add(key);
  }
  return { ok: true, warnings };
}

// The param ids a descriptor will actually accept, used by restore() to skip the ones
// validate() warned about. Without this a stale id is stored in the record's values and
// written straight back out on the next autosave, so the patch never heals itself.
function paramIsKnown(descriptor, pid) {
  const ids = (descriptor && descriptor.params) || [];
  if (ids.some((p) => p.id === pid)) return true;
  return pid.startsWith('av.') && ids.some((p) => p.id === pid.slice(3));
}
