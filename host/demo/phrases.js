// host/demo/phrases.js — reading demos/phrases.md, which is what a demo says.
//
// The markdown file is the SOURCE, not a document about the source: both the app and the render tool
// parse it, so there is no generated copy that can drift from the words you edited.
//
// Each action is a camelCase heading carrying a badge word shown beside the pointer and three lists
// of phrases: LONG for early in the deck, SHORT for later, and AFTER for when the move just before it
// already named the thing — so the click that follows says "click it" rather than naming the button
// all over again. The badge is a single value because it is read at a glance; the phrases are lists
// because hearing the same recording of "click" for the tenth time is most of what makes narration
// sound mechanical.
//
// Headings are more numerous than badge words on purpose. Taking hold of a cable and pressing a
// button are both a left click, but the first time you meet them they want different sentences.
'use strict';

export const PHRASES_URL = 'demos/phrases.md';

// Which KIND of thing each action acts on. Only used when deciding what to render: a turnKnob phrase
// crossed with a button gives "roll the wheel to move the run button", which is a sentence no demo
// can ever ask for and a file nobody will ever hear.
export const ACTION_KIND = {
  moveToOutput: 'terminal', moveToInput: 'terminal', pickUpCable: 'terminal', dropCable: 'terminal',
  moveToKnob: 'knob', turnKnob: 'knob',
  moveToButton: 'button', pressButton: 'button',
  moveToTab: 'tab', switchPage: 'tab',
};

// What a control is CALLED when spoken. A two-column table keyed by "moduleKey:controlId", holding a
// whole noun phrase rather than parts to be assembled: the wording has to disambiguate ("channel A",
// not just "the output") AND scan well, and only a person writing the sentence can judge both.
export function parseControls(md) {
  const out = {};
  for (const raw of String(md || '').split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('|')) continue;
    const c = line.split('|').slice(1, -1).map((x) => x.trim());
    if (c.length !== 2) continue;
    if (/^-+$/.test(c[1]) || /^control$/i.test(c[0])) continue;   // separator and header rows
    if (/^[A-Za-z][\w.]*:[\w]+$/.test(c[0])) out[c[0]] = c[1];
  }
  return out;
}

// The render settings, written as a plain list in the file's Voice section:  - voice: Jamie (Premium)
// They live beside the words because they belong to the same decision — how the app sounds.
export function parseVoiceSettings(md) {
  const out = {};
  for (const raw of String(md || '').split('\n')) {
    const m = /^\s*-\s*(voice|rate)\s*:\s*(.+?)\s*$/.exec(raw);
    if (m) out[m[1]] = m[1] === 'rate' ? Number(m[2]) : m[2];
  }
  return out;
}

// Actions out of the markdown: a camelCase `##` heading opens one, a **Badge** line sets its chip
// text, **Long** / **Short** switch which list the bullets below them join. Everything else is prose
// and is ignored, so the file can explain itself around the data.
export function parseActions(md) {
  const actions = {};
  let cur = null, list = null;
  for (const raw of String(md || '').split('\n')) {
    const line = raw.trim();

    // camelCase only — a lower-case first letter and no spaces. That is what keeps prose headings
    // like "Voice" or "How this file works" from being mistaken for actions.
    const head = /^##\s+([a-z][A-Za-z0-9]*)\s*$/.exec(line);
    if (head) { cur = actions[head[1]] = { badge: '', long: [], after: [], short: [] }; list = null; continue; }

    if (!cur) continue;
    const badge = /^\*\*Badge\*\*\s*(.+?)\s*$/i.exec(line);
    if (badge) { cur.badge = badge[1]; list = null; continue; }
    const which = /^\*\*(Long|After|Short)\*\*\s*$/i.exec(line);
    if (which) { list = which[1].toLowerCase(); continue; }
    if (/^#/.test(line)) { cur = null; list = null; continue; }   // a new section ends the action

    const item = /^-\s+(.*\S)\s*$/.exec(line);
    if (item && list) cur[list].push(item[1]);
  }
  return actions;
}

// Deterministic variety. A demo should not narrate differently on a second take — that would break
// the promise that replays match — but it should not say the same recording of "click" every time
// either. So the choice is a hash of the action and its occurrence number: different each time it
// comes round, identical on every replay.
function pick(list, occurrence) {
  if (!list || !list.length) return null;
  if (list.length === 1) return list[0];
  let h = 0x811c9dc5 ^ (occurrence | 0);
  h = Math.imul(h ^ 0x9e3779b9, 0x01000193) >>> 0;
  return list[h % list.length];
}

export function createPhraseBook(actions = {}, controls = {}) {
  const seen = new Map();   // how many times each action has come round this demo

  // The chip text for an action. Unknown action: no badge rather than a guessed one.
  const badgeFor = (key) => (actions[key] ? actions[key].badge || null : null);

  // What to SAY for an action. `verbosity` is 'long', 'short' or 'off'. An empty list at that
  // verbosity means say nothing — which is a real authoring choice, not a gap.
  //
  // `back` says the thing was named a moment ago, by the move that led here — so the After list is
  // used and the sentence says "click it" instead of naming the button all over again. Only at Long
  // verbosity: that is the only one where the move named anything to refer back TO.
  // What to call a control when speaking about it. `fallback` is the descriptor's own name, used when
  // the table has no entry — terse and sometimes an abbreviation, which is why anything a demo points
  // at is worth writing down properly.
  const describe = (ref, fallback) => controls[ref] || (fallback ? `the ${fallback}` : 'it');

  const sayFor = (key, verbosity = 'long', { back = false, target = null, fallback = null } = {}) => {
    if (verbosity === 'off') return null;
    const a = actions[key];
    if (!a) return null;
    const n = (seen.get(key) || 0);
    seen.set(key, n + 1);
    const text = verbosity === 'short' ? pick(a.short, n)
      : (back && a.after && a.after.length) ? pick(a.after, n)
        : pick(a.long, n);
    return text ? text.replace('{target}', describe(target, fallback)) : text;
  };

  // Occurrence counts are per demo: a replay must start from the same place or the variety would
  // drift with every run.
  const reset = () => seen.clear();

  const keys = () => Object.keys(actions);
  // Every string the file can produce — what the renderer walks to decide which fragments to make.
  // Every string the file can produce. A phrase with a {target} in it becomes one string per control
  // in the table — which is exactly what the renderer has to make, because every sentence has to be a
  // single continuous recording. Stitching a name onto a phrase at play time would put a seam right
  // where the ear is listening.
  // `kinds` maps a control reference to 'terminal' | 'knob' | 'button' — what the scripts actually do
  // with it. Given that, a templated phrase is only crossed with the controls its action can act on.
  // Without it every phrase is crossed with every control, which is correct but wasteful.
  const all = (kinds = null) => {
    const out = new Set();
    const refs = Object.keys(controls);
    for (const [key, a] of Object.entries(actions)) {
      const want = ACTION_KIND[key];
      const usable = (kinds && want) ? refs.filter((r) => kinds[r] === want) : refs;
      for (const t of [...a.long, ...(a.after || []), ...a.short]) {
        if (!t) continue;
        if (t.includes('{target}')) { for (const r of usable) out.add(t.replace('{target}', controls[r])); }
        else out.add(t);
      }
    }
    return [...out];
  };
  return { badgeFor, sayFor, describe, reset, keys, all, actions, controls };
}

// Browser side: fetch and parse. A missing or unreadable file is a normal state — the demo still
// runs, it simply says nothing about its gestures.
export async function loadPhraseBook(url = PHRASES_URL) {
  try {
    const res = await fetch(url);
    if (!res.ok) return createPhraseBook({});
    const md = await res.text();
    return createPhraseBook(parseActions(md), parseControls(md));
  } catch (_e) { return createPhraseBook({}); }
}
