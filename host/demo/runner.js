// host/demo/runner.js — the scripted demo runner (design/scripted-demo.md).
//
// Plays an authored demo by calling the rack's own imperative methods directly — no faked input
// events, no control-message layer. What the viewer sees is choreography drawn over the top of
// real state changes, which is why a demo can never drift from what the app actually does.
//
// A SCRIPT IS AN ORDERED LIST OF STEPS. A step performs one action and may carry a note. The note
// goes up in the floating card and stays there until the next note replaces it, so one note covers
// however many steps follow it. Every step gets its own pacing, and the demo's `defaults` supply
// the numbers any step leaves out:
//
//   perform  how long the pointer takes to travel, or a value takes to move
//   arrive   the pause after the pointer lands, before it does anything there
//   beat     how long the gesture badge is up before the gesture fires
//   settle   the pause after the action, before the next step
//   hold     how long a new note stays up before the demo acts on it
//
// ANNOUNCE, THEN DO. Each step reads its note, travels, waits at the destination, names the
// gesture, and only then performs it. That ordering — not a slower rate — is what makes a demo
// followable; a fast movement you were told about beats a slow one that surprises you.
//
// Authored steps are SEMANTIC ("patch this to that"), which is the grain an author dictates in.
// The runner expands each into the explicit gestures the app really uses — move pointer, left
// click, move pointer, left click — and the badge names them one at a time.
//
// Control references are "instanceKey:controlId" (e.g. "osc:timbre", "lpg:inA", "mixer:chanA"); an
// `add` step's `as` becomes the instance's rack key, so later steps address it by that name. The
// pinned Mixer is already on the rack under the key "mixer".
'use strict';

import { createDemoTheatre } from './theatre.js';
import { createDemoCard } from './card.js';
import { createVoice } from './voice.js';
import { loadPhraseBook, createPhraseBook } from './phrases.js';
import { DEFAULT_RACK, placeRack } from '../default-rack.js';

// The demo-level defaults, in demo seconds. A demo overrides any of them in its `defaults`, and a
// step overrides any of them for itself.
export const DEFAULTS = { perform: 1.0, arrive: 2.0, beat: 0.7, settle: 0.8, hold: 3.0 };

export function createDemoRunner(rack, opts = {}) {
  const ctx = () => (rack.host && rack.host.ctx) || null;   // resolved lazily; the AudioContext may not exist at construction
  const snapshot = opts.snapshot || (() => null);           // capture the whole app state (patch, page, view)
  const restoreSnapshot = opts.restoreSnapshot || (async () => {});

  let running = false, cancelled = false, rate = 1.5;   // matches the transport's default — see panel.js
  let demo = null, steps = [], defaults = { ...DEFAULTS };
  let index = 0;                 // the step about to be performed
  let history = [];              // history[i] = the app state as it stood BEFORE step i
  let noteText = null;

  const theatre = createDemoTheatre();   // wall-clock only — see span() on why it no longer takes the audio clock
  const card = createDemoCard();
  const voice = createVoice(ctx, { register: opts.registerAudio || null });
  let verbosity = 'long';        // which list the spoken gesture phrases come from: 'long', 'short' or 'off'
  // The wording lives in demos/phrases.md, which is the source both this and the render tool read.
  // Empty until it loads, which only means the first moments of the first demo say nothing.
  let phrases = createPhraseBook({});
  loadPhraseBook().then((p) => { phrases = p; });


  // A demo that LOADS a patch inherits whatever keys the file happened to use, which are no use to a
  // script. An `example` step binds readable names to them by module type — "osc" is the first
  // Complex Oscillator in the patch — and everything below resolves through that.
  let aliases = {};
  const realKey = (k) => (aliases[k] || k);

  const split = (ref) => { const i = String(ref).indexOf(':'); return [realKey(ref.slice(0, i)), ref.slice(i + 1)]; };
  const recOf = (key) => rack.records.get(realKey(key));
  const num = (v, fb) => (Number.isFinite(Number(v)) ? Number(v) : fb);
  // Every timing question goes through here: the step's own number, else the demo's, else ours.
  const secs = (s, name) => {
    const v = num(s && s[name], num(defaults[name], DEFAULTS[name]));
    if (!captionMode) return v;
    // EVERY PAUSE IN A NARRATED DEMO IS SIZED FOR A SENTENCE. The beats between gestures, the settle
    // after one, and above all an authored sweep — "set chr hue 0.5 over 8" — are long because words
    // are being said over them. With no words there is nothing to fill, and a captioned run that
    // keeps those pauses is a slow demo with the talking removed rather than a fast one. Authored
    // sweeps take the deeper cut: they are the longest waits and the ones a reader least needs.
    const authored = Number.isFinite(Number(s && s[name]));
    if (name !== 'perform' || !authored) return v * CAPTION_PACE;
    // AND A CEILING ON A KNOB TURN. Watching a control travel is worth a couple of seconds the first
    // time and nothing at all the fifth; the value it lands on is the point, and the turn only has to
    // be seen to happen. One second, wall clock — multiplied up by the rate the clock is about to
    // divide it by — so an eight-second authored sweep still reads as a sweep and costs a second.
    return Math.min(v * SWEEP_SCALE, CAPTION_TURN_MAX * rate * CAPTION_RATE);
  };

  // ---- resolving a control to a place on screen -----------------------------
  // A module on ANOTHER PAGE has no on-screen position worth pointing at — its panel is present but
  // hidden, so its bounding box is a lie. The one exception is the mixer, whose inputs are mirrored
  // onto every other page as the buttons under the tab bar; those ARE the on-page way to reach a
  // mixer input, so a demo naming "mixer:chanA" from an audio page is pointed at the button.
  function resolve(ref) {
    const [key, id] = split(ref);
    const rec = recOf(key);
    if (!rec) return null;
    if (rack.pageOf && rack.pageOf(rec) !== rack.page) {
      const btn = (rack._mixerButtonGeom ? rack._mixerButtonGeom() : []).find((b) => b.rec.key === key && b.portId === id);
      if (!btn) return null;                              // off-page and not mirrored: nothing to point at
      const el = document.querySelector(`.mixer-btn[data-chan="${btn.L}"]`);
      return { el, x: btn.x, y: btn.y, w: btn.hitR * 2, h: btn.hitR * 2 };
    }
    let el = (rack._jackElement && rack._jackElement(key, id)) || null;                     // a jack
    if (!el && rec.panel) { const cb = rec.panel.controls.get(id); el = cb && cb.group; }   // a knob / switch
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { el, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  }
  // A PHRASE IN THE SCRIPT WINDOW. Pointing at a module says which faceplate; pointing at a line of
  // code says which words, and a pattern is mostly words. The text is found in the editor's own DOM
  // and measured with a Range, so the mark lands on the phrase wherever it has been scrolled to.
  async function resolveText(needle) {
    const root = () => document.querySelector('.strudel-root .cm-content');
    if (!root() || !needle) return null;

    // FIND IT WHERE IT IS NOW. CodeMirror renders the lines around the viewport and replaces those
    // nodes when it scrolls, so a range measured before a scroll points at nodes that no longer exist
    // — which is how the pointer came to rest above the window. The search is redone after every
    // scroll rather than the rectangle being re-read.
    const rectOf = () => {
      const el = root();
      if (!el) return null;
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let all = '';
      for (let n = walk.nextNode(); n; n = walk.nextNode()) { nodes.push([all.length, n]); all += n.textContent; }
      const at = all.indexOf(needle);
      if (at < 0) return null;
      const end = at + needle.length;
      const find = (pos) => { let hit = nodes[0]; for (const e of nodes) if (e[0] <= pos) hit = e; return [hit[1], pos - hit[0]]; };
      const [sn, so] = find(at), [en, eo] = find(end - 1);
      const range = document.createRange();
      try { range.setStart(sn, Math.min(so, sn.textContent.length)); range.setEnd(en, Math.min(eo + 1, en.textContent.length)); }
      catch (_e) { return null; }
      const r = range.getBoundingClientRect();
      return (r && (r.width || r.height)) ? r : null;
    };

    const scroller = () => document.querySelector('.strudel-root .cm-scroller');
    for (let pass = 0; pass < 4; pass++) {
      const r = rectOf();
      const sc = scroller();
      if (!r || !sc) return null;
      const sr = sc.getBoundingClientRect();
      const margin = 28;
      const above = r.top < sr.top + margin, below = r.bottom > sr.bottom - margin;
      if (!above && !below) {
        return { el: root(), x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
      }
      sc.scrollTop += (r.top + r.height / 2) - (sr.top + sr.height / 2);
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    }
    // Still not on screen after scrolling to it: point at nothing rather than at the wrong thing.
    console.warn(`[demo] could not bring "${needle}" into view`);
    return null;
  }

  // The page tab itself is a target: switching page is something the viewer must see happen.
  function resolveTab(pageId) {
    const el = document.querySelector(`.rack-tab[data-page="${pageId}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { el, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  }

  // Which targets a step points at — used both to drive the pointer and to work out the region a
  // note's card must keep clear of.
  function targetsOf(s) {
    switch (s.do) {
      case 'patch': return [s.from, s.to];
      case 'set': case 'choose': return [s.target];
      case 'unpatch': return [s.at];
      case 'repatch': return [s.at, s.to];
      default: return [];
    }
  }
  // A step may name the modules it is TALKING about — `"about": "lpg"`, or a list. A `say` step
  // touches no control, so without this there is nothing to tell the card which module it must not
  // stand on; covering some OTHER module is not a problem.
  const aboutOf = (s) => (s.about == null ? [] : (Array.isArray(s.about) ? s.about : [s.about]));

  // ---- the note card --------------------------------------------------------
  // A note covers the steps from where it appears until the next note. The card is berthed clear of
  // everything those steps touch, once, and then left alone while it is being read.
  function noteSpanAvoid(from) {
    const rects = [];
    // The region is the whole MODULE a target sits on, not the target's own few pixels. A card berthed
    // clear of a jack can still be sitting squarely over the module the note is describing, which is
    // the one place it must not be.
    const moduleRect = (ref) => {
      const rec = recOf(split(ref)[0]);   // also takes a bare "key:" from an `about`
      if (!rec || !rec.el || (rack.pageOf && rack.pageOf(rec) !== rack.page)) return resolve(ref);
      const r = rec.el.getBoundingClientRect();
      if (!r.width || !r.height) return resolve(ref);
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    };
    for (let i = from; i < steps.length; i++) {
      if (i > from && steps[i].note) break;
      for (const key of aboutOf(steps[i])) { const t = moduleRect(key + ':'); if (t) rects.push(t); }
      if (steps[i].do === 'page') { const t = resolveTab(steps[i].to); if (t) rects.push(t); continue; }
      for (const ref of targetsOf(steps[i])) { const t = moduleRect(ref); if (t) rects.push(t); }
    }
    if (!rects.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of rects) {
      x0 = Math.min(x0, r.x - r.w / 2); x1 = Math.max(x1, r.x + r.w / 2);
      y0 = Math.min(y0, r.y - r.h / 2); y1 = Math.max(y1, r.y + r.h / 2);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  // ---- gestures -------------------------------------------------------------
  // Everything the app shows or says about a gesture comes from an ACTION KEY looked up in
  // demos/phrases.md — the badge word from its Badge line, the sentence from its Long or Short list.
  // The keys are more numerous than the badge words on purpose: pickUpCable and pressButton are both
  // a left click, but the first time you meet them they want different sentences. A step may carry
  // its own `say` when a stock phrase reads badly.
  // `back` marks a gesture whose target the pointer has just moved to and named — so it can be
  // referred to as "it" rather than named twice in two breaths.
  // The descriptor's own name for a control, used when demos/phrases.md has no wording for it.
  function nameOf(ref) {
    const [key, id] = split(ref || '');
    const rec = recOf(key);
    const d = rec && rack.host.registry.descriptor(rec.descriptorId);
    if (!d) return null;
    const p = (d.ports || []).find((x) => x.id === id) || (d.params || []).find((x) => x.id === id);
    return p ? p.name : null;
  }
  // WHAT TO SAY FOR A GESTURE THIS TIME ROUND. Three rules, in order:
  //
  //   1. If the note has already named the control, say nothing. A note that reads "the scale knob
  //      zooms that space" has done the naming, and a gesture line after it is the same words twice.
  //   2. First time this kind of action appears, say it in full; second time, briefly; after that,
  //      not at all. The gesture is learned once. The badge beside the pointer still shows on every
  //      one of them, so what is happening stays legible without being narrated.
  //   3. A step may always override with its own `say`, or force a level with `voice`.
  //
  // Rule 1 works on the CORE of the spoken name — "the scale knob on the coordinate field" is matched
  // by a note saying "the scale knob", which is how a note would naturally put it.
  function noteNames(s, ref) {
    if (!ref || !s || !s.note) return false;
    const full = phrases.describe(ref, nameOf(ref));
    if (!full) return false;
    const core = String(full).replace(/^the\s+/i, '').split(/\s+(?:on|of|in)\s+/)[0].trim().toLowerCase();
    return core.length > 2 && String(s.note).toLowerCase().includes(core);
  }

  function gestureLevel(s, action, ref) {
    if (s && s.voice) return s.voice;
    // THE DEMO'S OWN SETTING IS A CEILING, and 'off' means off. When the gesture narration moved to
    // one-sentence-per-gesture this rule was left behind in the old path, so a silent reel — no notes,
    // voice off — still announced every cable and every knob. A demo that says it wants no words gets
    // no words, whatever the per-action tier below would have chosen.
    if (verbosity === 'off') return 'off';
    if (noteNames(s, ref)) return 'off';
    const n = phrases.timesSaid ? phrases.timesSaid(action) : 0;
    const tier = n === 0 ? 'long' : n === 1 ? 'short' : 'off';
    return (verbosity === 'short' && tier === 'long') ? 'short' : tier;
  }

  const sayFor = (s, action, back = false, ref = null) =>
    (s && s.say !== undefined ? s.say
      : phrases.sayFor(action, (s && s.voice) || verbosity, { back, target: ref, fallback: nameOf(ref) }));

  // WHERE A STEP IS ABOUT TO ACT, so the pointer can be sent there before its note is read. A note
  // describes what you are looking at — "radius gives us distance from the centre" — and reading it
  // while the pointer is still resting on the last module asks the viewer to take it on trust and
  // find out what it meant three seconds later. It used to be an instruction ("now turn the timbre
  // knob"), which is the one kind of sentence that belongs BEFORE the move; nothing is written that
  // way any more.
  function approachOf(s) {
    if (!s) return null;
    switch (s.do) {
      case 'set': case 'choose': return resolve(s.target);
      case 'patch': return resolve(s.from);
      case 'repatch': case 'unpatch': {
        const [k, id] = split(s.at);
        const key = aliases[k] || k;
        const edge = rack.edgeAt && rack.edgeAt(key, id);
        if (!edge) return null;
        const which = (edge.dst.key === key && edge.dst.portId === id) ? 'dst' : 'src';
        return rack.cordGrabPoint(edge, which);
      }
      case 'menu': return s.on ? resolve(s.on) : null;
      case 'page': return resolveTab(s.to);
      default: return null;
    }
  }

  // TRAVEL AND ACT AS ONE. The pointer sets off and a single sentence describes the whole gesture
  // while it goes — "click the X coordinate button" — instead of one sentence for the journey and
  // another for the press. The action that follows this must NOT announce itself again; that pairing
  // is what made every knob take three sentences to turn.
  async function gestureTo(t, s, action, ref = null) {
    if (!t) return null;
    theatre.badge(phrases.badgeFor(action), { x: t.x, y: t.y });
    const level = gestureLevel(s, action, ref);
    const line = (s && s.say !== undefined) ? s.say
      : phrases.sayFor(action, level, { target: ref, fallback: nameOf(ref), combined: true });
    // Already standing there, because the approach took us before the note was read: say the line,
    // do not walk the same six inches again. A second travel of zero distance still spends its whole
    // duration, which reads as the demo hesitating for no reason.
    const there = theatre.pos && Math.hypot(theatre.pos.x - t.x, theatre.pos.y - t.y) < 4;
    await Promise.all([there ? Promise.resolve() : theatre.moveTo(t.x, t.y, secs(s, 'perform')), narrate(line)]);
    if (!there) await theatre.sleep(secs(s, 'arrive') * 0.35);
    return t;
  }

  // Travel to a target, announcing the move, then wait there so the viewer can see WHERE before
  // being told WHAT. Returns the resolved target (or null if there is nothing to point at).
  async function goTo(t, s, action, ref = null) {
    if (!t) return null;
    theatre.badge(phrases.badgeFor(action), { x: t.x, y: t.y });
    // The speech runs alongside the travel rather than before it — "move the pointer to the output
    // terminal" describes what is happening, it is not something to wait for first.
    await Promise.all([theatre.moveTo(t.x, t.y, secs(s, 'perform')), narrate(sayFor(s, action, false, ref))]);
    await theatre.sleep(secs(s, 'arrive'));
    return t;
  }
  // Name a gesture, hold it long enough to be read AND said, then let it happen. The speech sets the
  // floor here: a beat shorter than the phrase would clip it, so whichever is longer wins.
  async function announce(action, s, back = false, ref = null) {
    theatre.badge(phrases.badgeFor(action));
    await Promise.all([theatre.sleep(secs(s, 'beat')), narrate(sayFor(s, action, back, ref))]);
  }
  async function clickAt(t, s, action, back = false, ref = null) {
    await announce(action, s, back, ref);
    theatre.click();
    theatre.highlight(t && t.el);
  }

  // Which way a port faces, so the narration can say "the output terminal" rather than leaving the
  // listener to work out which end of the cable is being picked up.
  function portDir(ref) {
    const [key, id] = split(ref);
    const rec = recOf(key);
    const d = rec && rack.host.registry.descriptor(rec.descriptorId);
    const p = d && (d.ports || []).find((x) => x.id === id);
    return (p && p.dir) || 'in';
  }

  // Move a numeric parameter from where it is to `to` over `perform` seconds, applying it every
  // frame so the knob turns and the sound sweeps with it.
  function ramp(target, to, demoSecs) {
    const [key, id] = split(target);
    const rec = recOf(key);
    if (!rec) return Promise.resolve();
    const from = Number(rec.values.get(id));
    const start = Number.isFinite(from) ? from : to;
    return theatre.span(demoSecs, (u) => rack.applyParam(rec, id, start + (to - start) * u));
  }

  // ---- the actions ----------------------------------------------------------
  async function perform(s) {
    switch (s.do) {
      case 'page': {
        const t = resolveTab(s.to);
        // ONE UTTERANCE, like every other gesture. This was still announcing the journey and then the
        // press — and a step carrying its own `say` had that ONE line spoken by both halves, so the
        // demo said "let's go to the video page" twice in a row on the way to a single click.
        if (rack.page === s.to) return;   // already there: pressing the tab again would take us BACK
        if (t) { await gestureTo(t, s, 'switchPage'); theatre.click(); theatre.highlight(t.el); }
        if (rack._hasPage(s.to)) rack.selectPage(s.to);
        else console.warn(`[demo] there is no page called ${s.to}`);
        if (rack.page !== s.to) console.warn(`[demo] page step asked for ${s.to} but we are showing ${rack.page}`);
        return;
      }
      case 'add':
        // No pointer choreography: the module is not on the rack yet, so there is nothing to point
        // at. The note carries this step; the module simply appears.
        await rack.addModule(s.module, s.row || 0, s.x || 0, { key: s.as, page: s.page });
        return;
      case 'example': {
        // Load one of the shipped example patches. `via: "menu"` walks the real File ▸ Examples menu,
        // which is the point when the demo is TEACHING where examples come from: a patch that simply
        // materialises teaches nothing about how to open the next one.
        //
        // The menu OPENS WITHOUT BEING TRAVELLED TO. Walking the pointer up to the corner of the
        // window and back costs several silent seconds, and a menu bar is the one part of this app a
        // reader already knows how to work. It appears open; the pointer joins it at the item that
        // matters and presses that.
        if (s.via === 'menu' && rack.openAppMenu) {
          const opened = rack.openAppMenu(s.from || 'File');
          if (opened) {
            await theatre.sleep(secs(s, 'beat'));
            for (const label of ['Examples', s.name]) {
              const el = rack.menuItemEl(label);
              if (!el) { console.warn(`[demo] no menu item "${label}"`); break; }
              const r = el.getBoundingClientRect();
              await goTo({ el, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }, s, 'moveToMenuItem');
              theatre.hoverItem(el);
              await announce('chooseItem', s, true);
              theatre.click();
              rack.activateMenuItem(el);
              theatre.hoverItem(null);
              await theatre.sleep(secs(s, 'settle'));
            }
            // The menu's own action loads the file and does not report back, so wait for the patch to
            // actually arrive before anything names a module in it.
            const want = Object.values(s.as || {});
            for (let i = 0; want.length && i < 60; i++) {
              if (want.every((t) => [...rack.records.values()].some((r) => r.descriptorId === t))) break;
              await theatre.sleep(0.1);
            }
          } else if (opts.loadExample) { await opts.loadExample(s.name); }
        } else if (opts.loadExample) { await opts.loadExample(s.name); }
        keepViewerLevel();
        ensureSound();
        applyStage();   // a loaded patch closes the output window; put the picture back where it was
        // Bind this demo's names to whatever keys the file used: { "osc": "<descriptorId>" }.
        //
        // A PATCH MAY HOLD SEVERAL OF ONE MODULE — two voice tabs are two of everything — so a name may
        // ask for the nth of them: "wcoast.oscillator#1". Ordered by page and then by position, which
        // is the order they are read on screen, so #0 and #1 mean first and second as you would say it.
        const ordered = [...rack.records.values()].sort((a, b) =>
          String(rack.pageOf ? rack.pageOf(a) : '').localeCompare(String(rack.pageOf ? rack.pageOf(b) : ''))
          || (a.row - b.row) || (a.x - b.x));
        for (const [name, spec] of Object.entries(s.as || {})) {
          const [type, nth] = String(spec).split('#');
          const all = ordered.filter((r) => r.descriptorId === type);
          const rec = all[nth ? Number(nth) : 0];
          if (rec) aliases[name] = rec.key;
          else console.warn(`[demo] nothing named ${spec}`);
        }
        return;
      }
      case 'patch': {
        // Click the source jack, travel, click the destination — which is how a cable is actually
        // made here: two clicks with the cord following the pointer between them, not a held drag.
        const [fk, fp] = split(s.from), [tk, tp] = split(s.to);
        const a = resolve(s.from);
        const b0 = resolve(s.to);
        const fromMove = portDir(s.from) === 'out' ? 'moveToOutput' : 'moveToInput';
        const toMove = portDir(s.to) === 'out' ? 'moveToOutput' : 'moveToInput';
        if (!a || !b0) { rack.connectPatch({ key: fk, portId: fp }, { key: tk, portId: tp }); return; }

        // The cord is CARRIED FOR REAL between the two clicks — the rack's own click-to-pick-up
        // machinery, not a mime of it. So the cable trails the pointer, the destination arms and
        // highlights as it arrives, and the drop connects through the same path your own hand takes.
        // Announcing that we are pulling a cable while nothing is in hand was the visible lie here.
        await gestureTo(a, s, 'pickUpCable', s.from);
        theatre.click();
        // WHICH PAGE THE FAR END IS ON. A cord in hand crosses pages by pressing a tab — the rack
        // keeps it in hand and the free end travels with you — so a patch between two pages is one
        // continuous gesture, not two halves joined behind the scenes. Worth showing rather than
        // hiding: a reader who has put two modules on different pages needs to know this is possible.
        const destRec = recOf(tk);
        const destPage = destRec && rack.pageOf ? rack.pageOf(destRec) : null;
        const crossing = destPage && destPage !== rack.page;
        // The rack must know this carry is the SCRIPT's, so a real mouse crossing the window cannot
        // snatch the cord's free end away from the synthetic pointer.
        rack._demoCarry = true;
        rack._startStickyCable(fk, fp, a.x, a.y);
        theatre.setTracker((x, y) => { if (rack._carryTrack) rack._carryTrack(x, y); });
        try {
          if (crossing) {
            const tab = resolveTab(destPage);
            if (tab) {
              await gestureTo(tab, s, 'switchPage');
              theatre.click();
            }
            if (rack._hasPage(destPage) && rack.page !== destPage) rack.selectPage(destPage);
            await theatre.sleep(secs(s, 'settle'));
          }
          const b = resolve(s.to) || b0;                 // re-resolve: the page change moved everything
          await gestureTo(b, s, 'dropCable', s.to);
          theatre.click();
          if (rack._carryDrop) rack._carryDrop(b.x, b.y);
          else rack.connectPatch({ key: fk, portId: fp }, { key: tk, portId: tp });
          theatre.highlight(b.el);
        } finally { theatre.setTracker(null); rack._demoCarry = false; }
        return;
      }
      case 'set': {
        const t = resolve(s.target);
        const [k, id] = split(s.target);
        const rec = recOf(k);
        if (!rec) console.warn(`[demo] no module for ${s.target}`);
        // A numeric target is a knob, anything else a button — which is all that is needed to choose
        // between "turn the scroll wheel over the knob" and "press the button".
        const numeric = typeof s.to === 'number';
        if (t) await gestureTo(t, s, numeric ? 'turnKnob' : 'pressButton', s.target);
        if (numeric) {
          // Every continuous control here is wheel-driven — there is no drag-to-turn anywhere in
          // the app — so a value move is always a scroll-wheel gesture. The sentence for it was
          // already spoken on the way in; here the wheel simply turns.
          const d = secs(s, 'perform');
          const spin = theatre.wheelTicks(d, Math.max(3, Math.round(d * 5)));
          await ramp(s.target, s.to, d);
          await spin;
        } else {
          // THE RINGS SAY WHERE, THE FLASH SAYS WHAT. A ripple on its own reads as "something
          // happened near here"; lighting the control itself says which one was pressed, the way the
          // value moving does for a knob.
          if (t) { theatre.click(); theatre.highlight(t.el); await theatre.sleep(secs(s, 'beat')); }
          if (rec) rack.applyParam(rec, id, s.to);
          else console.warn(`[demo] no module for ${s.target} — the value was not set`);
        }
        return;
      }
      case 'say':
        // A step that only speaks. Its note is shown and read like any other, then nothing happens —
        // which is how a demo explains what a low pass gate IS before telling you to patch into one.
        // The card stays up through the steps that follow, so the explanation is still on screen
        // while the thing it explained is being done.
        return;
      case 'menu': {
        // A menu, driven BY NAME. The pointer travels to the thing, right-clicks it, then walks down
        // the menu that appears and presses an item — and the press runs the very function a real
        // click runs, rather than a second copy of it. Submenus are just more names in `choose`.
        const t = s.on ? resolve(s.on) : null;
        if (t) await gestureTo(t, s, 'rightClick', s.on);
        theatre.click();
        if (s.on) { const [k, id] = split(s.on); rack.openTerminalMenu(k, id, t ? t.x : theatre.pos.x, t ? t.y : theatre.pos.y); }
        for (const label of (Array.isArray(s.choose) ? s.choose : [s.choose]).filter(Boolean)) {
          const el = rack.menuItemEl(label);
          if (!el) { console.warn(`[demo] no menu item "${label}"`); break; }
          const r = el.getBoundingClientRect();
          await goTo({ el, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }, s, 'moveToMenuItem');
          theatre.hoverItem(el);
          await announce('chooseItem', s, true);
          theatre.click();
          rack.activateMenuItem(el);
          theatre.hoverItem(null);
          await theatre.sleep(secs(s, 'settle'));
        }
        return;
      }
      case 'choose': {
        // WHATEVER THE PANEL ACTUALLY IS. A stepped parameter is drawn either as a row of lamps or as
        // a readout with a list behind it, and the demo must do what a hand would do to the control in
        // front of it: press the lamp for the value, or open the list and pick the row. Opening a menu
        // over a radio group would be showing a gesture the panel does not have.
        const [k, id] = split(s.target);
        const rec0 = recOf(k);
        const b0 = rec0 && rec0.panel && rec0.panel.controls.get(id);
        const lamp = b0 && b0.stepIndicators && b0.stepIndicators.get(s.to);
        if (lamp) {
          const lr = lamp.getBoundingClientRect();
          const at = { el: lamp, x: lr.left + lr.width / 2, y: lr.top + lr.height / 2, w: lr.width, h: lr.height };
          await gestureTo(at, s, 'pressButton', s.target);
          theatre.click();
          theatre.highlight(lamp);
          rack.applyParam(rec0, id, s.to);
          await theatre.sleep(secs(s, 'settle'));
          return;
        }
        // A VALUE LIST. The pointer goes to the lit window, clicks, and the list opens over it — the
        // real one, with the real values in it — then walks to the row it wants and presses that.
        //
        // Which is more theatre than a `set` needs, and deliberately: the list IS the feature. A demo
        // that reached the same value by calling the parameter would show a number changing by itself,
        // which is exactly what a viewer cannot learn anything from.
        const t = resolve(s.target);
        if (t) await gestureTo(t, s, 'openList', s.target);
        theatre.click();
        if (!rack.openValueList(k, id)) { console.warn(`[demo] no value list for "${s.target}"`); return; }
        await theatre.sleep(secs(s, 'settle'));
        const row = rack.valueListRowEl(s.to);
        if (!row) { console.warn(`[demo] no row for ${JSON.stringify(s.to)} in "${s.target}"`); rack.closeValueList(); return; }
        const rr = row.getBoundingClientRect();
        await goTo({ el: row, x: rr.left + rr.width / 2, y: rr.top + rr.height / 2, w: rr.width, h: rr.height }, s, 'moveToListItem');
        if (row._light) row._light();   // the rule follows a real pointer; the synthetic one has to say so
        await announce('chooseValue', s, true);
        theatre.click();
        rack.chooseValueListRow(row);
        await theatre.sleep(secs(s, 'settle'));
        return;
      }
      case 'key': {
        // A KEY PRESS. No pointer travel and no click ring: the pointer has nothing to do with it,
        // and moving it would suggest otherwise. The badge names the key instead of a gesture, and
        // the press goes to the window as a real keydown, so the app's own handler runs — there is
        // no second copy of what the space bar does.
        const key = s.key || ' ';
        theatre.badge(s.label || (key === ' ' ? 'space bar' : key));
        await theatre.sleep(secs(s, 'beat'));
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key, code: key === ' ' ? 'Space' : undefined, bubbles: true, cancelable: true,
        }));
        theatre.badge(null);
        await theatre.sleep(secs(s, 'settle'));
        return;
      }
      case 'zoom': {
        // FRAME ONE MODULE, or step back to the whole rack with `"to": "out"`. A faceplate at working
        // size is unreadable in a recording, and a demo that explains a control nobody can see is a
        // voice-over. Nothing is clicked and nothing changes; it is the camera, not the hand.
        if (s.to === 'out' || s.at == null) {
          if (rack.resetZoom) rack.resetZoom();
        } else if (rack.frameModule) {
          rack.frameModule(aliases[s.at] || s.at, typeof s.to === 'number' ? s.to : 2.2, s.align || 'centre');
        }
        await theatre.sleep(secs(s, 'settle'));
        return;
      }
      case 'point': {
        // POINT AT SOMETHING while it is described. Not a gesture — nothing is clicked and nothing
        // changes — so it carries no badge and says nothing of its own: the note is the whole content,
        // and the pointer is there to say WHICH thing the note is about. runStep moves it before the
        // note is read, so the sentence lands with the pointer already resting on its subject.
        //
        // THREE KINDS OF TARGET. A module by name; one of its JACKS or knobs, written "module:port",
        // which is what lets a demo indicate one socket out of eight; and `text`, a phrase in the
        // script window, for saying which words in a pattern are being talked about.
        // On its page, for the same reason framing is — a pointer resting on a hidden module points
        // at whatever happens to be drawn in that spot on the page you are actually looking at.
        if (!s.text) {
          const key = aliases[String(s.at || '').split(':')[0]] || String(s.at || '').split(':')[0];
          const rec = rack.records.get(key);
          if (rec && rack.pageOf && rack.pageOf(rec) !== rack.page && rack._hasPage(rack.pageOf(rec))) {
            rack.selectPage(rack.pageOf(rec));
            await theatre.sleep(0.35);
          }
        }
        const t = s.text ? await resolveText(s.text)
          : (String(s.at || '').includes(':') ? resolve(s.at)
            : (rack.moduleBox ? rack.moduleBox(aliases[s.at] || s.at) : null));
        if (!t) { console.warn(`[demo] nothing to point at: ${s.text ? 'text ' + s.text : s.at}`); return; }
        await theatre.moveTo(t.x, t.y, secs(s, 'perform'));
        if (s.mark !== false) theatre.highlight(t.el);
        return;
      }
      case 'repatch': {
        // MOVE ONE END OF A CABLE. Inserting a module into a working chain is not "unplug, then plug
        // in twice" — the cord already runs to the output, so the end at the far side is carried over
        // to the new module and the output end never moves. That is what a hand does, it is one
        // gesture instead of three, and nothing is ever seen to be destroyed: the picture changes
        // over rather than going away and coming back.
        const [k, id] = split(s.at);
        const key = aliases[k] || k;
        const edge = rack.edgeAt && rack.edgeAt(key, id);
        if (!edge) { console.warn(`[demo] no cable at ${s.at} to move`); return; }
        const which = (edge.dst.key === key && edge.dst.portId === id) ? 'dst' : 'src';
        const grab = rack.cordGrabPoint(edge, which);
        const dest = resolve(s.to);
        if (!grab || !dest) {
          // Say WHICH half is missing. "cannot move A to B" is true and useless: the cord's grab point
          // and the destination jack fail for entirely different reasons, and one message for both
          // sent the last investigation down the wrong path.
          const [dk, dp] = split(s.to);
          const drec = recOf(dk);
          console.warn(`[demo] cannot move ${s.at} to ${s.to} — `
            + `grab=${grab ? 'ok' : 'NULL (cord geometry unmeasurable)'} `
            + `dest=${dest ? 'ok' : 'NULL'} `
            + `[module ${drec ? 'found' : 'MISSING'}, `
            + `its page ${drec && rack.pageOf ? rack.pageOf(drec) : '?'} vs showing ${rack.page}, `
            + `jack ${rack._jackElement && rack._jackElement(dk, dp) ? 'found' : 'MISSING'}]`);
          return;
        }
        await gestureTo(grab, s, 'pullCable', s.at);
        theatre.click();
        rack._demoCarry = true;
        if (!rack.startRegrab(edge, which, grab.x, grab.y)) { rack._demoCarry = false; return; }
        theatre.setTracker((x, y) => { if (rack._carryTrack) rack._carryTrack(x, y); });
        try {
          const b2 = resolve(s.to) || dest;
          await gestureTo(b2, s, 'dropCable', s.to);
          theatre.click();
          if (rack._carryDrop) rack._carryDrop(b2.x, b2.y);
          theatre.highlight(b2.el);
        } finally { theatre.setTracker(null); rack._demoCarry = false; }
        return;
      }
      case 'carry': {
        // PICK A MODULE UP AND PUT IT SOMEWHERE ELSE, including on another page, with its cables
        // still attached. The rack has always allowed this by hand — hold the title strip, press a
        // tab, drop — and the cords follow the panel while it is in the air. A demo could only ever
        // CREATE a module before this.
        const key = aliases[s.module] || s.module;
        const box = rack.moduleBox && rack.moduleBox(key);
        if (!box) {
          const rec = rack.records.get(key);
          console.warn(`[demo] cannot carry ${s.module} — `
            + (!rec ? 'no module with that name is on the rack'
                    : `it is on page ${rack.pageOf ? rack.pageOf(rec) : '?'} and we are showing ${rack.page}`));
          return;
        }
        await goTo(box, s, 'moveToTitle');
        theatre.click();
        rack._demoCarry = true;
        try {
          if (!rack.carryModule(key, { atX: box.x, atY: box.y })) { console.warn(`[demo] could not pick up ${s.module}`); return; }
          theatre.setTracker((x, y) => { if (rack._moduleCarryTrack) rack._moduleCarryTrack(x, y); });
          if (s.page && s.page !== rack.page) {
            const tab = resolveTab(s.page);
            if (tab) { await goTo(tab, s, 'moveToTab'); theatre.click(); }
            if (rack._hasPage(s.page) && rack.page !== s.page) rack.selectPage(s.page);
            await theatre.sleep(secs(s, 'settle'));
          }
          const spot = rack.rowPoint(s.row || 0, s.x || 0);
          if (spot) await goTo(spot, s, 'moveToEmpty');
          theatre.click();
          if (rack._moduleCarryDrop && spot) rack._moduleCarryDrop(spot.x, spot.y);
          // DID IT LAND? A carry that quietly fails leaves the module where it was, which on another
          // page looks exactly like a module that was never moved — and the step itself would have
          // said nothing. Checked against what was asked for, not assumed from the absence of an error.
          const rec = rack.records.get(key);
          const page = rec && rack.pageOf ? rack.pageOf(rec) : null;
          if (!rec) console.warn(`[demo] ${s.module} vanished during the carry`);
          else if (s.page && page !== s.page) console.warn(`[demo] ${s.module} did not move — it is still on ${page}`);
          else if (s.row !== undefined && rec.row !== s.row) console.warn(`[demo] ${s.module} landed in row ${rec.row}, not ${s.row}`);
        } finally { theatre.setTracker(null); rack._demoCarry = false; }
        return;
      }
      case 'unpatch': {
        // TAKE A CABLE OUT, by the gesture a hand uses: take hold of the cord just outside the jack,
        // the end comes away with the pointer, and dropping it on empty space removes it. The same
        // carry the patch step uses, run backwards — not a call to disconnect with the pointer waved
        // over it, which would be the visible lie that patching-by-mime once was.
        const [k, id] = split(s.at);
        const key = aliases[k] || k;
        const edge = rack.edgeAt && rack.edgeAt(key, id);
        if (!edge) { console.warn(`[demo] nothing plugged into ${s.at}`); return; }
        const which = (edge.dst.key === key && edge.dst.portId === id) ? 'dst' : 'src';
        const grab = rack.cordGrabPoint(edge, which);
        if (!grab) { rack.patchbay.disconnect(edge); rack.redrawCables(); return; }
        await gestureTo(grab, s, 'pullCable', s.at);
        theatre.click();
        rack._demoCarry = true;
        if (!rack.startRegrab(edge, which, grab.x, grab.y)) { rack._demoCarry = false; return; }
        theatre.setTracker((x, y) => { if (rack._carryTrack) rack._carryTrack(x, y); });
        try {
          const away = rack.emptyPointNear(grab.x, grab.y + 140) || grab;
          await gestureTo(away, s, 'dropAway');
          theatre.click();
          if (rack._carryDrop) rack._carryDrop(away.x, away.y);
        } finally { theatre.setTracker(null); rack._demoCarry = false; }
        return;
      }
      // WHERE THE PICTURE STANDS. Nothing is pointed at and nothing is clicked: the pane is not a
      // control on a faceplate, and walking a synthetic pointer to a title bar to drag it would be
      // several silent seconds spent on the one object in the window that is not part of the patch.
      case 'stage':
        stageNow = s.to;
        applyStage();
        return;
      case 'pause':
        await theatre.sleep(num(s.for, 1));
        return;
      default:
        return;
    }
  }

  // One whole step: its note, then its action, then its settle.
  async function runStep(i) {
    const s = steps[i];
    if (!s) return;
    // TELL THE OUTSIDE WHERE WE ARE, at the top of every step. The mirror publishes this, so a
    // conversation about "the step we are on" needs no preamble: the script, the step's own
    // directive and line in the file, its caption and its note are all readable while it plays.
    if (opts.onProgress) { try { opts.onProgress(); } catch (_e) { /* a watcher must not stop a demo */ } }
    let approach = null;   // caption mode: the pointer's journey, running under the card
    // POINTING COMES FIRST. Every other action answers a note that has already been read — "now do
    // this" — but a point exists to say what the note is ABOUT, so it has to arrive before the words
    // rather than three seconds after them.
    // POINTING COMES FIRST, and so does moving the picture: a note on a `stage` step is about what
    // that move reveals — "eight modules, and no connections yet" — and reading it before the pane
    // has shrunk describes a screen the viewer cannot see yet.
    if (s.do === 'point' || s.do === 'stage') await perform(s);
    // Everything else with somewhere to go gets there first, silently. The gesture's own sentence is
    // still said by the action, on arrival.
    //
    // EXCEPT IN CAPTION MODE, where the travel is started but not waited for: the card goes up now
    // and the pointer crosses the rack while it is being read. Waiting for the pointer first put a
    // second of nothing in front of every card, which over fifty steps is most of a minute spent
    // watching an arrow move with nothing to read.
    else {
      const at = approachOf(s);
      if (at) { const trip = theatre.moveTo(at.x, at.y, secs(s, 'perform')); if (!captionMode) await trip; else approach = trip; }
    }
    // A TITLE STEP CARRIES ITS WORDS AS A CAPTION and has no narration, so without naming it here the
    // whole block was skipped in a narrated run and the opening frame never appeared at all.
    if (s.note !== undefined || ((capShow || captions) && s.caption) || s.title) {
      noteText = cardTextFor(s);
      const region = noteSpanAvoid(i);
      // The CARD is placed first and the transport window then keeps off both it and the work. The
      // reader's text gets first choice of berth because it is the thing they must read; the author's
      // window is the one that can afford to be shunted.
      showCard(noteText, region, s.berth || null, s);
      if (opts.onAvoid) opts.onAvoid([region, captions ? card.rect() : null]);
      // The note is read aloud while it is up, and the demo waits for BOTH the hold and the
      // narration — the speech is the floor, so a hold shorter than the sentence cannot cut it off.
      // `wait: false` — SPEAK IT AND CARRY ON. A note normally holds the demo until it has been read,
      // which is right for a sentence about the thing that is happening next. It is wrong for a long
      // opening statement: a minute of narration over a motionless rack cannot be told apart from a
      // demo that has hung, and the honest response to that is to stop it, which is what happened.
      // Unwaited, the words play over the first moves instead of in front of them.
      //
      // IN CAPTION MODE THE CARD IS READ BEFORE THE GESTURE, always. The line says what is about to
      // happen — "connect the field to the Colorizer" — so it has to be up and readable first;
      // arriving with the movement it describes makes a reader choose between watching and reading,
      // and they will miss one. `wait: false` is ignored here for the same reason: it exists so a
      // long spoken passage can play over the moves, and there is no long passage without a voice.
      // The card is up for as long as it takes to read, and the pointer's journey runs underneath —
      // whichever is longer decides when the gesture happens. `readingSecs` is wall clock, so it is
      // multiplied back up by the rate that theatre.sleep is about to divide it by.
      // THE POINTER ARRIVES, AND ONLY THEN DOES THE CLOCK START. Reading while the pointer is still
      // crossing the rack is reading and tracking at once, and the caption can be gone before the
      // pointer has settled on the thing it names. So the journey is waited out — the card is
      // already up, so it can be read on the way — and the hold is spent STANDING on the target.
      if (s.title && !captionMode) {
        // ...and it is READ as well as shown. This held the card for its reading time and never said
        // it, so a narrated run put the opening frame on screen in silence.
        const line = s.note || s.caption;
        const spoken = await voice.secondsFor(line);
        await Promise.all([theatre.sleep(Math.max(readingSecs(noteText), spoken + 0.2) * rate), narrate(line)]);
      } else if (captionMode) {
        if (approach) { await approach; approach = null; }
        // With the captions spoken, the line is both read and heard, so the hold is whichever takes
        // longer — the speech is a floor exactly as it is in a narrated run.
        const hold = theatre.sleep(readingSecs(noteText) * rate * CAPTION_RATE);
        await (captionVoice ? Promise.all([hold, narrate(noteText)]) : hold);
      }
      else if (s.note && s.wait === false) { narrate(s.note); await theatre.sleep(secs(s, 'beat')); }
      else if (s.note) {
        // THE HOLD IS THE SENTENCE, not a fixed three seconds. The default was a guess for a line with
        // no audio, and it turned a list of eight module names into eight one-second names with two
        // seconds of silence after each. Where the line HAS been rendered, its own length is the hold
        // — with a beat after it, so consecutive lines run on rather than butting together — and a
        // line with no audio keeps the old default, which is the only case that guess was ever for.
        const spoken = await voice.secondsFor(s.note);
        const hold = spoken > 0 ? Math.max(spoken + 0.08, secs(s, 'beat')) : secs(s, 'hold');
        await Promise.all([theatre.sleep(hold * rate), narrate(s.note)]);
      }
    }
    if (approach) { await approach; approach = null; }   // a step with no card still waits for its travel
    if (s.do !== 'point') await perform(s);
    theatre.badge(null);
    // AND A NOTE THAT BELONGS AFTERWARDS. "Now we have a chain three modules long" is true once the
    // cable has landed and not a moment before, and saying it on the way in describes a rack that
    // does not exist yet. `after` is for the result; `note` stays for what you are about to watch.
    if (s.after) {
      showCard(s.after, noteSpanAvoid(i), s.berth || null, s);
      noteText = s.after;
      if (captionMode) await theatre.sleep(readingSecs(s.after));
      else await Promise.all([theatre.sleep(secs(s, 'beat')), narrate(s.after)]);
    }
    await theatre.sleep(secs(s, 'settle'));
  }

  // Captions are OFF by default. The narration is spoken; a card standing over the rack is in the way
  // more often than it is wanted, and the one thing it must never cover is the module being described.
  let captions = false;
  const setCaptions = (on) => { captions = !!on; if (!captions) card.hide(); };

  // ---- caption mode: the same demo, run silent ------------------------------
  //
  // `**Mode** captions` in the script. The voice is off entirely — notes and gesture phrases both —
  // each step shows its own one-line caption, and the hold is how long that line takes to READ
  // rather than how long a sentence takes to say. A captioned run of the colour demo is about a
  // third the length of the narrated one, and it plays in a feed, where video autoplays muted.
  //
  // A step with no caption falls back to its narration, timed the same way. That is deliberately not
  // an error: it lets a script be captioned a few steps at a time.
  // THE SAME SCRIPT PLAYS BOTH WAYS. The header declares which a demo is normally run as; an
  // override — from the transport, or from a recording harness making both cuts of one demo — wins
  // over it. Null means "whatever the script says", which is the ordinary case.
  // SPEAKING THE CAPTIONS. A third way to run the same script: the short line read aloud rather
  // than the long sentence, with the cards and the pacing of caption mode. It suits a viewer who
  // wants both and a script whose captions were written to be said as well as read.
  // TWO SWITCHES, INDEPENDENT. They were one mode with a rider on it, so "speak them" did nothing
  // unless "captions" was also on — which is not what two checkboxes mean.
  //
  //   captions off, speak off   the demo's own narration, spoken, no cards      (how a reel ships)
  //   captions on,  speak off   the short lines on screen, silent
  //   captions on,  speak on    the short lines on screen AND read aloud
  //   captions off, speak on    the short lines read aloud, nothing on screen
  //
  // `captionMode` survives as the internal question "are we working from the short lines?", which is
  // what decides the wording and the pacing; either switch turns it on.
  let capShow = false, capSpeak = false;
  let captionMode = false, captionOverride = null, captionVoice = false;
  const syncCaption = () => {
    captionMode = captionOverride == null ? (capShow || capSpeak) : captionOverride;
    captionVoice = capSpeak;
    if (capShow) captions = true;
  };
  const setCaptionShow = (on) => { capShow = !!on; if (!capShow) card.hide(); syncCaption(); };
  // WHERE THE PICTURE STANDS, and it has to be re-applied after every patch load: restoring a patch
  // closes the output window (a file must not open one), so a demo that loads its second example
  // would lose the picture and every `stage` after it would have no pane to move.
  let stageNow = null;
  function applyStage() {
    if (!stageNow || !rack.videoStage) return;
    // The black goes up in the same tick the run starts; the pane catches up when it can.
    if (rack.videoBackdrop) rack.videoBackdrop(stageNow === 'full');
    // AND IT KEEPS TRYING. Restoring a patch closes the output window — a file must never open one —
    // and that close is asynchronous, so a single reopen on a timer sometimes ran BEFORE it and was
    // undone. The picture then vanished for the rest of the demo. So: ask, check, ask again, for a
    // second or so, and stop the moment the pane is actually standing where it was asked to stand.
    if (stageNow === 'off' || stageNow === 'none') { try { rack.videoStage(stageNow); } catch (_e) { /* nothing open */ } return; }
    let tries = 0;
    const put = () => {
      const out = [...rack.records.values()].find((r) => r.descriptorId === 'video-out');
      if (out && out.values && out.values.get('window') !== 'on') rack.applyParam(out, 'window', 'on');
      let placed = false;
      try { placed = !!rack.videoStage(stageNow); } catch (_e) { placed = false; }
      if (!placed && ++tries < 8) setTimeout(put, 150);
    };
    setTimeout(put, 60);
  }
  const setCaptionVoice = (on) => { capSpeak = !!on; syncCaption(); };
  const setCaptionMode = (on) => {
    captionOverride = on == null ? null : !!on;
    if (captionOverride != null) { capShow = !!on; capSpeak = capSpeak && !!on; }
    syncCaption();
  };
  // Reading a five-word label is quick — a fluent reader takes a short line in at about fifteen
  // characters a second — and the first pass at these numbers was sized for sentences, which made
  // the cards the longest thing in the demo. `readingSecs` is WALL CLOCK: it is not divided by the
  // rate, because the rate makes the pointer quicker and cannot make a reader quicker.
  const READ_BASE = 0.25, READ_PER_CHAR = 0.035, READ_MIN = 0.7, READ_MAX = 2.2;
  // AND HALF AS LONG AGAIN. The figures above are a fluent reader taking a short line at a glance,
  // which is the floor rather than the target: the viewer is also watching the rack, may be reading
  // at speed or under magnification, and a caption that goes before it has been finished is worse
  // than a demo that runs a little longer. The margin is deliberately a single number, so it can be
  // raised for everyone rather than argued about line by line.
  const READ_MARGIN = 1.5;
  const CAPTION_RATE = 1.6;      // and the gestures themselves run faster with no sentence to fill
  const CAPTION_TURN_MAX = 1.0;  // seconds, wall clock, for any one knob sweep
  const SWEEP_SCALE = 0.45;   // an authored `over N` is long because a sentence is read over it
  const CAPTION_PACE = 0.6;   // and so is every other pause the runner takes between gestures
  const readingSecs = (text) =>
    READ_MARGIN * Math.max(READ_MIN, Math.min(READ_MAX, READ_BASE + String(text || '').length * READ_PER_CHAR));
  const cardTextFor = (s, which = 'note') =>
    (s.title && which === 'note' ? (s.caption || s.note)
      : (captionMode && which === 'note' ? (s.caption || s.note) : s[which]));
  // A card standing on a module is only a problem when it is standing on the module under discussion.
  // Covering some other part of the rack is fine, and treating the whole rack as out of bounds only
  // drove the card into whatever odd corner happened to be free.
  function showCard(text, region = null, pin = null, step = null) {
    // A TITLE IS NOT A CAPTION. The captions switch decides whether the running commentary is drawn
    // over the rack; an opening frame is the demo introducing itself and belongs on screen either
    // way — without this it was invisible in a narrated run, which is how it ships.
    if (!(captions || capShow) && !(step && step.title)) { card.hide(); return; }
    // IN CAPTION MODE THE CARD GOES TO THE WORK. The step already names what it is about to touch, so
    // the chip parks beside that and points at it. A step naming a CONTROL — a jack, a knob, a lamp —
    // gets the ring; one naming a whole module gets the chip beside it and no ring, because an arrow
    // into the middle of a panel points at nothing in particular.
    let near = null, arrow = false;
    // The opening title has nothing to point at and belongs over the picture, not under it.
    if (step && step.title) pin = 'title';
    else if (captionMode && step && step.do === 'stage' && step.to === 'full') pin = 'middle';
    if (captionMode && step) {
      const ref = targetsOf(step)[0] || null;
      if (ref) {
        near = resolve(ref);
        arrow = String(ref).includes(':') && !!split(ref)[1];
      }
    }
    // The caption HANGS OFF THE POINTER in caption mode: read where the eye already is, and carried
    // to the next control by the thing that is about to act on it. The opening title is the one
    // exception — it belongs over the picture, and the pointer is nowhere near it.
    const follow = (capShow || captions) && captionMode && pin !== 'middle' ? () => theatre.pos : null;
    card.show(text, { avoid: [region, opts.panelRect ? opts.panelRect() : null], pin, caption: captionMode, near, arrow, follow });
  }

  // ---- state, so a step can be gone back to --------------------------------
  // Every step is preceded by a snapshot, which is what makes stepping BACKWARDS as cheap as
  // stepping forwards: going back to step i is restoring the state that stood before it ran.
  function capture(i) { history[i] = { app: snapshot(), note: noteText }; }

  async function rewindTo(i) {
    const h = history[i];
    if (!h) return false;
    await restoreSnapshot(h.app);
    noteText = h.note;
    if (noteText) showCard(noteText, noteSpanAvoid(i)); else card.hide();
    index = i;
    return true;
  }

  // ---- the public surface ---------------------------------------------------
  function load(obj) {
    demo = obj || null;
    steps = (demo && demo.steps) || [];
    defaults = { ...DEFAULTS, ...((demo && demo.defaults) || {}) };
    verbosity = (demo && demo.voice) || 'long';
    // A captioned script turns its own cards on: they are the only channel it has, so leaving them
    // to the transport's toggle would make the demo silent AND wordless.
    if (String((demo && demo.mode) || '').toLowerCase().includes('voice')) captionVoice = true;
    if (captionOverride == null && !capShow && !capSpeak) {
      const declared = String((demo && demo.mode) || '').toLowerCase();
      capShow = declared.startsWith('captions');
      capSpeak = declared.includes('voice');
    }
    syncCaption();
    rate = num(demo && demo.rate, 1) > 0 ? num(demo && demo.rate, 1) : 1;
    theatre.setRate(rate * (captionMode ? CAPTION_RATE : 1));
    index = 0; history = []; noteText = null;
  }

  // Put the rack in the demo's starting condition: the user's own modules gone (the pinned mixer
  // stays), the demo's STAGE placed, sound on. The stage is the rack the demo opens on, built in one
  // go before the pointer appears — modules materialising one at a time while a script runs is a
  // conjuring trick a new reader has to make sense of before they can follow anything else.
  //
  //   "stage": "default"   the rack a first-run user meets (host/default-rack.js) — what a TUTORIAL
  //                        demo wants, so the modules it talks about are already there, where they
  //                        already are
  //   "stage": [ ... ]     an explicit list, same shape, for a reel that needs a different set
  //   omitted              an empty rack, for a demo whose subject IS adding modules
  //
  // Either way the modules take the names the stage gives them, so later steps address them as
  // "osc:timbre" without the demo having had to add them itself.
  async function reset() {
    releaseCable();   // a cord left in hand by an interrupted run must not survive into the next one
    rack.clear();
    const stage = demo && demo.stage;
    if (stage) {
      await placeRack(rack, stage === 'default' ? DEFAULT_RACK : stage, { withKeys: true });
      // Stand on the page the stage put its modules on, silently. A demo used to open by clicking a
      // tab, which is a step the viewer has to make sense of before anything else happens and which
      // demonstrates nothing — the demo has not started yet. A `page` step is now only for a demo that
      // means to SHOW a page change.
      // WHERE THE DEMO OPENS. Declared, when the demo says: a reel that begins by crossing to the
      // video page has to begin ON the audio page, and "wherever the first module happens to be"
      // depends on the order the stage lines were written in — which is a thing an author changes
      // for other reasons and should not silently move the opening shot.
      const want = demo.page || null;
      const first = [...rack.records.values()].find((r) => !r.pinned);
      const pg = want || (first && rack.pageOf ? rack.pageOf(first) : null);
      if (pg && rack._hasPage(pg)) rack.selectPage(pg);
    }
    // The transport is now the ENGINE over two buses, and turning the engine on brings the master
    // bus with it — so this one switch is the whole of "make sound".
    if (rack.engineOn && !rack.engineOn()) rack.toggleEngine();
    index = 0; history = []; noteText = null; aliases = {};
    card.hide();
    // Back to the first alternative of every phrase, so a replay narrates exactly as the first run
    // did rather than carrying on from wherever the last one left off.
    phrases.reset();
  }

  // What the rack's master fader was set to when this run began; see run().
  let viewerMaster = null;

  // ---- NARRATION OVER THE PATCH ------------------------------------------------------------------
  // The patch goes on playing while a line is read, a few decibels down so the words are clear, and
  // comes back up in the gaps left for listening. Done on the master AudioParam rather than the
  // mixer's param, so the patch's own setting is untouched and nothing has to be put back if a run is
  // interrupted — and rammped rather than stepped, or the drop is audible as a click.
  const DUCK = 0.25;          // about 12dB under: still audible, but well clear of the words
  const DUCK_RAMP = 0.12;     // seconds
  let duckBase = null, ducked = false;
  function duck(on) {
    const rec = rack.records.get('mixer');
    const p = rec && rec.instance.getParam ? rec.instance.getParam('master') : null;
    const ctx = rack.host && rack.host.ctx;
    if (!p || !ctx) return;
    // THE LEVEL TO COME BACK TO IS READ ONCE. Reading it at each duck looked equivalent and was not:
    // the ramp is asymptotic, so a line beginning while the previous release was still travelling
    // captured a value part of the way down and made THAT the new full level. Over a dozen lines the
    // music ratcheted quietly away, which is precisely what a demo full of narration does.
    if (duckBase == null) duckBase = p.value;
    const to = on ? duckBase * DUCK : duckBase;
    ducked = !!on;
    try { p.cancelScheduledValues(ctx.currentTime); } catch (_e) { /* not schedulable */ }
    p.setTargetAtTime(to, ctx.currentTime, DUCK_RAMP);
  }

  // Every line goes through here, so there is one place that knows the patch should be down while
  // anything is being said.
  async function narrate(text) {
    // Caption mode is silent by definition: no notes, no gesture phrases, nothing for the ducking to
    // duck. The badge still names each gesture, which is picture rather than sound.
    if (captionMode && !capSpeak) return;
    if (!text) return;
    duck(true);
    try { await voice.speak(text); } finally { duck(false); }
  }

  // MAKE SURE IT CAN BE HEARD, for a script that starts with a patch already playing.
  //
  // Loading ANY patch turns the engine and both buses off — deliberately, so a file cannot start
  // making noise before anyone has looked at it (see silenceAfterLoad). A demo that opens a patch and
  // narrates it therefore has to turn the sound back on, and doing it in the script means every such
  // script carries the same three steps and one of them will eventually be forgotten. So the runner
  // does it: before the first step, and again after any patch the script loads.
  //
  // OPT IN, with `"sound": true` in the script. The demos that TEACH the engine — where the whole
  // point is pressing it and hearing the rack come alive — must not find it already on.
  function ensureSound() {
    if (!demo || !demo.sound) return;
    const rec = rack.records.get('mixer');
    if (!rec) return;
    const on = (id) => rec.values.get(id) === 'on';
    // The viewer's own choice of bus is kept when they had one; otherwise the main output.
    if (!on('masterEnable') && !on('monitorEnable')) rack.applyParam(rec, 'masterEnable', 'on');
    if (!on('engine')) rack.applyParam(rec, 'engine', 'on');
  }

  // Put it back after anything that loads a patch over the top of it.
  function keepViewerLevel() {
    if (viewerMaster == null) return;
    const rec = rack.records.get('mixer');
    if (rec && rec.values.get('master') !== viewerMaster) rack.applyParam(rec, 'master', viewerMaster);
  }

  async function run(obj, { from = 0 } = {}) {
    // A RUN THAT IS REFUSED SAYS SO. Silently returning is how two demos came to look like one bug:
    // the second press did nothing, the first was still going, and what was heard was the two of them.
    if (running) { console.warn('[demo] a run is already going; this one was refused'); return; }
    if (obj) load(obj);
    if (!demo) return;
    // BLACK FIRST, BEFORE THE PATCH IS EVEN LOADED. A reel that opens on a full screen is opening on
    // its FINISHED patch, and reset() builds that patch on a rack the viewer can see. Half a second
    // of it is enough to give away the whole demo, so the black goes up here — the first thing the
    // run does — and comes down when the picture takes over.
    if (demo.screen === 'full' && rack.videoBackdrop) rack.videoBackdrop(true);
    running = true; cancelled = false;
    theatre.setInstant(false);
    try {
      await reset();
      // THE VIEWER'S LEVEL IS THE VIEWER'S. A demo opens a patch, and a patch carries the master fader
      // the person who saved it was using — which is how a script came to play several times louder
      // than the same patch does when you open it yourself. Whatever the rack is set to when a demo
      // starts is put back after every patch the script loads, so the only thing that changes the
      // volume is the viewer's own hand. A script that genuinely wants a level can still set it, in
      // a `set` step, where it is written down and visible.
      const mixRec = rack.records.get('mixer');
      viewerMaster = mixRec ? mixRec.values.get('master') : null;
      duckBase = null; ducked = false;   // this run's full level, read at its first line
      ensureSound();   // before the first step, so a script that opens playing is audible at once
      theatre.begin(true, true);   // and from the middle of the window, not wherever the last run ended
      // NOTHING FROM BEFORE IS STILL TALKING. A line cut off by a stop, a note being read aloud from
      // the panel, a run that ended while its last sentence was still playing — any of them would be
      // heard under the first line of this one. The speech is stopped before the voice is enabled.
      // THE PICTURE IS UP BEFORE THE FIRST STEP. `**Stage**` says where it starts, and both the
      // opening and the window it needs are done here rather than as steps: a viewer who pressed Run
      // on a video reel should be looking at the picture, not at a pointer pressing a button to make
      // it appear. Nothing is pointed at and nothing is announced.
      stageNow = demo.screen || null;
      if (stageNow === 'full' && rack.videoBackdrop) rack.videoBackdrop(true);
      applyStage();
      // The page the script opens on, before the pointer appears — see `**Page**` in demo-md.
      if (demo.startPage && rack._hasPage && rack._hasPage(demo.startPage) && rack.page !== demo.startPage) {
        rack.selectPage(demo.startPage);
      }
      // THE CONTEXT IS RESUMED HERE, at the top of the run. It was resumed by the first line spoken,
      // which is too late and too narrow: a demo whose first words come after a patch load found the
      // context suspended, played its fragment into a stopped clock and made no sound at all — the
      // files were fine and nothing was heard. Pressing Run is the gesture that permits this.
      const actx = ctx();
      if (actx && actx.state === 'suspended') { try { await actx.resume(); } catch (_e) { /* stays silent */ } }
      stopSpeech();
      voice.setEnabled(true);
      if (voice.prime) voice.prime();   // its output node must exist before a recorder looks for it
      if (voice.reload) voice.reload();   // pick up anything rendered since the app started
      // A BEAT BEFORE ANYTHING HAPPENS. The tutorial has just vanished and the rack has just been set
      // up; starting to narrate and move in the same instant asks the viewer to work out where they
      // are and follow a pointer at the same time. Let them look first.
      console.warn(`[demo] RUN START — ${demo.id || '?'}, ${steps.length} steps, rate ${rate}${from ? ', from step ' + from : ''}`);
      // RUN FROM A STEP. The steps before it are replayed with every wait collapsed and the voice off,
      // because the rack has to arrive in the state that step begins from — a demo is a sequence of
      // acts on a patch, not a set of independent moments. Then the run proper carries on from there.
      if (from > 0) {
        theatre.setInstant(true);
        voice.setEnabled(false);
        try { while (index < Math.min(from, steps.length) && !cancelled) { capture(index); await runStep(index); index++; } }
        finally { theatre.setInstant(false); voice.setEnabled(true); }
      }
      await theatre.sleep(num(demo.openHold, 2.5));
      if (demo.intro) { showCard(demo.intro); await Promise.all([theatre.sleep(num(demo.introHold, 2.5)), narrate(demo.intro)]); }
      while (index < steps.length && !cancelled) {
        capture(index);
        // A STEP THAT THROWS LOSES ITS STEP, NOT THE REEL. This used to fall straight out of the loop
        // into the cleanup, so a script that hit a bad reference simply stopped partway through with
        // no message and nothing to distinguish it from a script that had ended — which is exactly
        // how it looked from the outside, and cost a round of guessing to find. Now it says which
        // step and why, and carries on to the next one.
        if (window.__demoTrace) {
          const st = steps[index] || {};
          const what = st.target || st.at || st.from || st.to || st.module || '';
          console.warn(`[demo] step ${index}: ${st.do} ${what}`);
        }
        try { await runStep(index); }
        catch (e) {
          const st = steps[index] || {};
          console.warn(`[demo] step ${index} (${st.do}) failed — ${(e && e.message) || e}`);
          releaseCable();
        }
        index++;
      }
      if (!cancelled && demo.outro) { showCard(demo.outro); await Promise.all([theatre.sleep(num(demo.outroHold, 3.0)), narrate(demo.outro)]); }
    } finally {
      console.warn(`[demo] RUN END — reached step ${index} of ${steps.length}, cancelled=${cancelled}`);
      releaseCable();
      theatre.end();
      card.hide();
      voice.stop();
      silence();
      running = false;
    }
  }

  // Perform the next step with every wait collapsed — the author's Step control, and the way a
  // script is checked without watching it in real time.
  async function step() {
    if (!demo || running || index >= steps.length) return false;
    // Silent, like the collapsed waits: an author walking a script a step at a time is reading it,
    // not listening to it, and a sentence per press would make stepping unusable.
    theatre.setInstant(true);
    voice.setEnabled(false);
    theatre.begin(false);
    try { capture(index); await runStep(index); index++; }
    finally { theatre.setInstant(false); voice.setEnabled(true); }
    return true;
  }

  // The same step, but PERFORMED — full pacing, cursor, badge and narration, then stop. This is how
  // you judge a step rather than merely check it: whether the words sit right, whether the pause
  // before the gesture is long enough, whether the sentence outstays its welcome.
  async function playStep() {
    if (!demo || running || index >= steps.length) return false;
    running = true; cancelled = false;
    theatre.setInstant(false);
    voice.setEnabled(true);
    theatre.begin(false);
    try { capture(index); await runStep(index); index++; }
    finally { theatre.badge(null); releaseCable(); running = false; }
    return true;
  }

  // Back one step: restore the state that stood before the previous step ran.
  async function back() {
    if (!demo || running || index <= 0) return false;
    return rewindTo(index - 1);
  }

  // Jump to a step. Backwards is a snapshot restore; forwards replays the steps in between with
  // their waits collapsed, since no snapshot exists ahead of where we have been.
  async function seek(i) {
    const want = Math.max(0, Math.min(steps.length, i | 0));
    if (want < index) return rewindTo(want);
    while (index < want) { if (!(await step())) return false; }
    return true;
  }

  // Stopping mid-patch would otherwise leave a cord hanging off the pointer for the user to deal
  // with. Dropping it nowhere cancels it through the rack's own path.
  function releaseCable() { theatre.setTracker(null); if (rack._carryDrop) rack._carryDrop(-1, -1); rack._demoCarry = false; }

  // Stopping SILENCES the voice as well as cutting it off. `voice.stop()` alone only kills the
  // fragment that is sounding; the run is still unwinding, and a step already past its cancelled
  // check would start the next sentence a moment later — so pressing Stop was followed by one more
  // line being spoken. Disabling makes every later speak a no-op until the next run enables it again.
  // A DEMO THAT ENDS MUST NOT LEAVE THE ROOM MAKING A NOISE. Whatever it built is still patched and
  // the engine is still on, so the drone it started carries on into whatever the reader does next —
  // and a reader who has just watched a demo may have no idea which of those controls is holding the
  // sound up. Stepping back through the demo turns it on again; this is only about walking away.
  // SILENCE MEANS NOTHING IS STILL GOING, not merely that the engine is off. A module with a
  // transport of its own — Strudel is the one so far — goes on running when the engine is switched
  // off: inaudible, and playing again the instant anything turns the engine back on. So a run that
  // ends or is stopped puts those transports back to off as well.
  function silence() {
    for (const rec of rack.records.values()) {
      try {
        if (rec.values && rec.values.get('run') === 'on' && rec.instance && rec.instance.supports
            && rec.instance.supports('run')) rack.applyParam(rec, 'run', 'off');
      } catch (_e) { /* a record mid-teardown; nothing to stop */ }
    }
    if (rack.engineOn && rack.engineOn()) rack.toggleEngine();
  }

  // WHO STOPPED IT. A run that ends early is indistinguishable from one that finished unless the
  // stop says where it came from — and there are six ways to stop a demo, one of which is a stray
  // Escape key that nobody remembers pressing.
  function stop(reason) {
    if (running) console.warn(`[demo] STOP — ${reason || 'no reason given'}`);
    cancelled = true;
    // A run stopped WHILE PAUSED would otherwise leave the clock frozen and the next run would never
    // move. Unfreeze first, then cancel: the order matters, since the waits in flight are waiting on
    // that clock to notice they have been cancelled.
    if (theatre.isPaused()) { theatre.setPaused(false); voice.setPaused(false); }
    // The monitors a demo opened are the demo's, not yours: they were put there to show a stage of a
    // chain being built, and once the run is over they are a screenful of pictures with nothing to
    // explain them. Cleared with the rest of the theatre.
    if (rack.closeVideoMonitors) rack.closeVideoMonitors();
    releaseCable(); theatre.end(); card.hide();
    if (rack.videoBackdrop) rack.videoBackdrop(false);
    voice.stop(); voice.setEnabled(false);
    silence();
  }

  function setRate(r) { if (Number(r) > 0) { rate = Number(r); theatre.setRate(rate); } }

  // ---- pause ----------------------------------------------------------------
  //
  // STOPPING AND PAUSING ARE DIFFERENT ACTS. Stopping ends the run and leaves the rack exactly as the
  // demo had built it, standing on the step it reached — which is what you want when you have seen
  // enough. Pausing freezes the performance where it is and gives nothing up: the clock stops, so the
  // step in flight simply takes longer; the sentence stops and remembers where it was; the real
  // pointer comes back so the viewer can hover a jack or read a value; and the caption stays up,
  // because it is the line explaining the thing they have stopped to look at.
  //
  // Nothing is snapshotted or restored, so anything the viewer does while paused is theirs to keep —
  // the demo carries on from the rack as it finds it, which is the honest behaviour and also the only
  // one that does not silently undo their poking about.
  function setPaused(on) {
    const want = !!on;
    if (want === theatre.isPaused()) return want;
    theatre.setPaused(want);
    voice.setPaused(want);
    if (want) console.warn('[demo] PAUSED at step ' + index);
    if (opts.onProgress) { try { opts.onProgress(); } catch (_e) { /* as above */ } }
    return want;
  }
  const togglePause = () => setPaused(!theatre.isPaused());
  const isPaused = () => theatre.isPaused();

  // Where the demo has got to, in enough detail to talk about. Projected to the AI mirror so that
  // "make that shorter" needs no explanation of WHICH step or WHAT it says — the step, its exact
  // note and its pacing are all readable from outside the app.
  function state() {
    const at = (i) => (steps[i] ? { i, ...steps[i] } : null);
    return {
      script: demo ? { id: demo.id, title: demo.title || null, file: demo.__file || null } : null,
      index, count: steps.length, running,
      // Paused is part of the state a reader needs: "step 9 of 33, paused" is a different situation
      // from "step 9 of 33, playing", and it is the moment an author is most likely to ask for a
      // change to the step they are looking at.
      paused: theatre.isPaused ? theatre.isPaused() : false,
      captionMode, captionVoice,
      defaults, voice: verbosity,
      note: noteText,
      previous: at(index - 1),
      current: at(index),
      next: at(index + 1),
    };
  }

  // Reading a block of the TUTORIAL aloud. Same pre-rendered fragments, same pipeline — the tutorial's
  // prose is rendered alongside the demos' notes — but no animation: hearing the words should not
  // commit you to watching anything.
  // `text` may be several lines — a list is spoken item by item — and they play in order. A press of
  // the same button stops the run, so the sequence checks before each piece.
  // A BEAT BETWEEN THE PIECES. A block spoken as several fragments — a list, or a line carrying a
  // {pause} — runs its sentences into each other without one, because each recording starts the
  // instant the last sample of the previous one ends. Silence is what tells the ear a sentence has
  // finished.
  const BETWEEN = 0.45;
  let speakRun = 0;
  async function speakText(text, done) {
    const mine = ++speakRun;
    voice.setEnabled(true);
    voice.stop();
    const lines = (Array.isArray(text) ? text : [text]).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      if (mine !== speakRun) return;
      if (i) await new Promise((r) => setTimeout(r, BETWEEN * 1000));
      if (mine !== speakRun) return;
      await narrate(lines[i]);
    }
    if (mine === speakRun && done) done();
  }
  const stopSpeech = () => { speakRun++; voice.stop(); };

  return {
    run, stop, step, playStep, back, seek, load, reset, setRate, setCaptions, setCaptionMode, setCaptionVoice, setCaptionShow,
    setPaused, togglePause, isPaused, state,
    speakText, stopSpeech,
    // BEFORE A RECORDER LOOKS FOR IT. The recorder gathers what it will capture at the moment it
    // starts, and the narration's output node is built by the first line spoken — so a take begun
    // before then carries the patch and none of the words. Anything about to record calls this first.
    primeVoice: () => { if (voice.prime) voice.prime(); },
    get running() { return running; },
    get index() { return index; },
    get count() { return steps.length; },
    get note() { return noteText; },
    stepAt: (i) => steps[i] || null,
  };
}
