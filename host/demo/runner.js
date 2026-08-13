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

  let running = false, cancelled = false, rate = 1;
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
  const secs = (s, name) => num(s && s[name], num(defaults[name], DEFAULTS[name]));

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
  const sayFor = (s, action, back = false, ref = null) =>
    (s && s.say !== undefined ? s.say
      : phrases.sayFor(action, (s && s.voice) || verbosity, { back, target: ref, fallback: nameOf(ref) }));

  // Travel to a target, announcing the move, then wait there so the viewer can see WHERE before
  // being told WHAT. Returns the resolved target (or null if there is nothing to point at).
  async function goTo(t, s, action, ref = null) {
    if (!t) return null;
    theatre.badge(phrases.badgeFor(action), { x: t.x, y: t.y });
    // The speech runs alongside the travel rather than before it — "move the pointer to the output
    // terminal" describes what is happening, it is not something to wait for first.
    await Promise.all([theatre.moveTo(t.x, t.y, secs(s, 'perform')), voice.speak(sayFor(s, action, false, ref))]);
    await theatre.sleep(secs(s, 'arrive'));
    return t;
  }
  // Name a gesture, hold it long enough to be read AND said, then let it happen. The speech sets the
  // floor here: a beat shorter than the phrase would clip it, so whichever is longer wins.
  async function announce(action, s, back = false, ref = null) {
    theatre.badge(phrases.badgeFor(action));
    await Promise.all([theatre.sleep(secs(s, 'beat')), voice.speak(sayFor(s, action, back, ref))]);
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
        if (t) { await goTo(t, s, 'moveToTab'); await clickAt(t, s, 'switchPage', true); }
        if (rack._hasPage(s.to)) rack.selectPage(s.to);
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
        // Bind this demo's names to whatever keys the file used: { "osc": "<descriptorId>" }.
        for (const [name, type] of Object.entries(s.as || {})) {
          const rec = [...rack.records.values()].find((r) => r.descriptorId === type);
          if (rec) aliases[name] = rec.key;
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
        await goTo(a, s, fromMove, s.from);
        await announce('pickUpCable', s, true, s.from);
        theatre.click();
        // The rack must know this carry is the SCRIPT's, so a real mouse crossing the window cannot
        // snatch the cord's free end away from the synthetic pointer.
        rack._demoCarry = true;
        rack._startStickyCable(fk, fp, a.x, a.y);
        theatre.setTracker((x, y) => { if (rack._carryTrack) rack._carryTrack(x, y); });
        try {
          const b = resolve(s.to) || b0;                 // re-resolve: highlighting may have moved nothing, but be safe
          await goTo(b, s, toMove, s.to);
          await announce('dropCable', s, true, s.to);
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
        // A numeric target is a knob, anything else a button — which is all that is needed to choose
        // between "turn the scroll wheel over the knob" and "press the button".
        const numeric = typeof s.to === 'number';
        if (t) await goTo(t, s, numeric ? 'moveToKnob' : 'moveToButton', s.target);
        if (numeric) {
          // Every continuous control here is wheel-driven — there is no drag-to-turn anywhere in
          // the app — so a value move is always a scroll-wheel gesture.
          if (t) await announce('turnKnob', s, true, s.target);
          const d = secs(s, 'perform');
          const spin = theatre.wheelTicks(d, Math.max(3, Math.round(d * 5)));
          await ramp(s.target, s.to, d);
          await spin;
        } else {
          if (t) await clickAt(t, s, 'pressButton', true, s.target);
          if (rec) rack.applyParam(rec, id, s.to);
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
        if (t) { await goTo(t, s, 'moveToTerminal'); await announce('rightClick', s, true, s.on); }
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
        // A VALUE LIST. The pointer goes to the lit window, clicks, and the list opens over it — the
        // real one, with the real values in it — then walks to the row it wants and presses that.
        //
        // Which is more theatre than a `set` needs, and deliberately: the list IS the feature. A demo
        // that reached the same value by calling the parameter would show a number changing by itself,
        // which is exactly what a viewer cannot learn anything from.
        const t = resolve(s.target);
        const [k, id] = split(s.target);
        if (t) { await goTo(t, s, 'moveToReadout', s.target); await announce('openList', s, true, s.target); }
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
    if (s.note !== undefined) {
      noteText = s.note;
      const region = noteSpanAvoid(i);
      // The CARD is placed first and the transport window then keeps off both it and the work. The
      // reader's text gets first choice of berth because it is the thing they must read; the author's
      // window is the one that can afford to be shunted.
      showCard(s.note, region, s.berth || null);
      if (opts.onAvoid) opts.onAvoid([region, captions ? card.rect() : null]);
      // The note is read aloud while it is up, and the demo waits for BOTH the hold and the
      // narration — the speech is the floor, so a hold shorter than the sentence cannot cut it off.
      if (s.note) await Promise.all([theatre.sleep(secs(s, 'hold')), voice.speak(s.note)]);
    }
    await perform(s);
    theatre.badge(null);
    await theatre.sleep(secs(s, 'settle'));
  }

  // Captions are OFF by default. The narration is spoken; a card standing over the rack is in the way
  // more often than it is wanted, and the one thing it must never cover is the module being described.
  let captions = false;
  const setCaptions = (on) => { captions = !!on; if (!captions) card.hide(); };
  // A card standing on a module is only a problem when it is standing on the module under discussion.
  // Covering some other part of the rack is fine, and treating the whole rack as out of bounds only
  // drove the card into whatever odd corner happened to be free.
  function showCard(text, region = null, pin = null) {
    if (!captions) { card.hide(); return; }
    card.show(text, { avoid: [region, opts.panelRect ? opts.panelRect() : null], pin });
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
    rate = num(demo && demo.rate, 1) > 0 ? num(demo && demo.rate, 1) : 1;
    theatre.setRate(rate);
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
      const first = [...rack.records.values()].find((r) => !r.pinned);
      if (first && rack.pageOf) { const pg = rack.pageOf(first); if (rack._hasPage(pg)) rack.selectPage(pg); }
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

  async function run(obj) {
    if (running) return;
    if (obj) load(obj);
    if (!demo) return;
    running = true; cancelled = false;
    theatre.setInstant(false);
    try {
      await reset();
      theatre.begin(true, true);   // and from the middle of the window, not wherever the last run ended
      voice.setEnabled(true);
      // A BEAT BEFORE ANYTHING HAPPENS. The tutorial has just vanished and the rack has just been set
      // up; starting to narrate and move in the same instant asks the viewer to work out where they
      // are and follow a pointer at the same time. Let them look first.
      await theatre.sleep(num(demo.openHold, 2.5));
      if (demo.intro) { showCard(demo.intro); await Promise.all([theatre.sleep(num(demo.introHold, 2.5)), voice.speak(demo.intro)]); }
      while (index < steps.length && !cancelled) {
        capture(index);
        await runStep(index);
        index++;
      }
      if (!cancelled && demo.outro) { showCard(demo.outro); await Promise.all([theatre.sleep(num(demo.outroHold, 3.0)), voice.speak(demo.outro)]); }
    } finally {
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
  function silence() { if (rack.engineOn && rack.engineOn()) rack.toggleEngine(); }

  function stop() {
    cancelled = true;
    releaseCable(); theatre.end(); card.hide();
    voice.stop(); voice.setEnabled(false);
    silence();
  }

  function setRate(r) { if (Number(r) > 0) { rate = Number(r); theatre.setRate(rate); } }

  // Where the demo has got to, in enough detail to talk about. Projected to the AI mirror so that
  // "make that shorter" needs no explanation of WHICH step or WHAT it says — the step, its exact
  // note and its pacing are all readable from outside the app.
  function state() {
    const at = (i) => (steps[i] ? { i, ...steps[i] } : null);
    return {
      script: demo ? { id: demo.id, title: demo.title || null, file: demo.__file || null } : null,
      index, count: steps.length, running,
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
      await voice.speak(lines[i]);
    }
    if (mine === speakRun && done) done();
  }
  const stopSpeech = () => { speakRun++; voice.stop(); };

  return {
    run, stop, step, playStep, back, seek, load, reset, setRate, setCaptions, state,
    speakText, stopSpeech,
    get running() { return running; },
    get index() { return index; },
    get count() { return steps.length; },
    get note() { return noteText; },
    stepAt: (i) => steps[i] || null,
  };
}
