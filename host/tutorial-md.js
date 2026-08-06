// tutorial-md.js — reads tutorial.md and turns it into the tour's step data.
//
// One file serves two masters: tutorial.md is a readable document on its own (on GitHub, in any
// editor) AND the exact copy the app shows in its cards. There is no build step — the app fetches
// the .md and parses it here, which works in Electron (the app:// protocol is registered with
// supportFetchAPI + corsEnabled and serves any file under the app directory) and unchanged over
// http for browser users.
//
// THE FORMAT — a deliberately small subset, so the file stays a document rather than a config:
//
//   # Title            the document's own title. Not a card; ignored here.
//   ## Heading         starts a CARD. The heading text becomes the card's title.
//   paragraph          a paragraph of the current card. Write it on ONE line — the card wraps it.
//   - item             consecutive items become one bulleted list.
//   > **Example** — …  an "Example" block. The bold text is its label, so a card can say something
//                      else ("> **Now play** — …") and the document still reads right.
//   {pause}            a beat of silence when the text is spoken; renders as nothing. Use it where
//                      two sentences would otherwise run into each other.
//   {demo:<id>}        the block ABOVE this line can be demonstrated: names a script in
//                      demos/scripts. On its own line. It puts a play button in that block's own left
//                      gutter, under its listen button, so the two things you can do with a
//                      paragraph — hear it, watch it — sit together. Nowhere to demonstrate means no
//                      button, which says "nothing to show here" better than a dead one would.
//   <!-- … -->         ignored, including across lines.
//
// Inline: **bold**, *italic*, [text](url), `code`, {see:target}. Anything before the first ## is preamble for a
// human reader and is skipped.
//
// The markdown is OURS, not user input, but it's escaped before the inline rules run anyway — so
// a stray angle bracket in the copy shows up as text instead of silently becoming markup.

'use strict';

export const TUTORIAL_URL = new URL('./tutorial.md', import.meta.url);

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The SHOW-ME marker. It carries NO target text of its own — no data attribute, no title, and
// aria-hidden so assistive tech skips it — because a screen reader or text-to-speech picking up a
// paragraph would otherwise read the target out loud along with the prose. The targets travel
// beside the copy instead, in step.sees, and the card pairs them up by order.
//
// It was an EYE, and a page of them stared back at the reader. It is now a QUESTION MARK — which
// says "where is this?", exactly what clicking it answers — in the same black chip with an orange
// border that the listen and play buttons wear. It was a black mark on a filled orange square, and
// that made it the brightest thing on the page: a marker that appears in every other sentence must
// not shout louder than the controls, or than the prose it sits in.
//
// The glyph takes `currentColor` so the `unavailable` and `lit` states can restyle it from CSS alone,
// and is drawn as SVG text rather than a path so it stays crisp at any size, with the font family
// named explicitly rather than inherited — the card's font must not change it.
// The three glyphs the tutorial uses, in one place: the legend at the top draws them as pictures and
// the tour draws them inside the buttons themselves, and a legend that did not match its buttons
// would be worse than no legend.
export const GLYPH = {
  listen: '<svg viewBox="0 0 16 16" aria-hidden="true">'
    + '<path d="M2.5 6.2h2.4L8.2 3.3v9.4L4.9 9.8H2.5z" fill="currentColor"/>'
    + '<path d="M10.4 5.9a3.2 3.2 0 0 1 0 4.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>'
    + '<path d="M12.3 4.1a5.8 5.8 0 0 1 0 7.8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>'
    + '</svg>',
  stop: '<svg viewBox="0 0 16 16" aria-hidden="true">'
    + '<rect x="3.4" y="3.4" width="9.2" height="9.2" rx="1.6" fill="currentColor"/></svg>',
  demo: '<svg viewBox="0 0 16 16" aria-hidden="true">'
    + '<path d="M4.8 3.1 L12.6 8 L4.8 12.9 Z" fill="currentColor"/></svg>',
  find: '<svg viewBox="0 0 16 16" aria-hidden="true">'
    + '<text x="8" y="8.6" text-anchor="middle" dominant-baseline="central" fill="currentColor"'
    + ' font-family="-apple-system, system-ui, Helvetica, Arial, sans-serif"'
    + ' font-size="14" font-weight="700">?</text></svg>',
};

const EYE_BUTTON = '<button type="button" class="tour-eye" aria-hidden="true" tabindex="-1">'
  + GLYPH.find + '</button>';

// Inline markdown → the small HTML the card renders. Order matters: links before emphasis, so a
// URL containing an underscore or asterisk isn't mangled.
//
// {see:TARGET} becomes the eye. TARGET is "<module>" (whole module), "<module>#title" (its title
// bar), "<module>#<section>" (a quad's channel band), "<module>/<element>" (one terminal or
// control), or "ui:<css selector>" (application chrome). Each target found is pushed onto `sees`.
const inline = (s, sees) => escapeHtml(s)
  .replace(/\{see:([^}\s]+)\}/g, (_m, t) => { if (sees) sees.push(t); return EYE_BUTTON; })
  // A bare glyph, for the legend that introduces the three things you can click. It is a picture of a
  // control, not a control — no button, nothing to press.
  .replace(/\{icon:(listen|find|demo)\}/g, (_m, k) => `<span class="tour-icon tour-icon-${k}" aria-hidden="true">${GLYPH[k]}</span>`)
  .replace(/\{pause\}/g, '<span class="tour-pause" aria-hidden="true"></span>')
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  // ==key term== — the tutorial's accent colour rather than weight. Bold is already doing a lot
  // of work in this document (module names, menu names, control names), so a topic label or the
  // one surprising word in a sentence needs a channel of its own to stand out from it.
  .replace(/==([^=]+)==/g, '<span class="tour-key">$1</span>')
  .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
  .replace(/`([^`]+)`/g, '<code>$1</code>');

// `> **Example** — text` → { try: text, label: 'Example' }. The dash after the label is optional
// and may be an em dash or a hyphen; without a label the block still works and takes the default.
const LABELLED = /^\*\*(.+?)\*\*\s*(?:—|–|--|-)?\s*([\s\S]*)$/;

export function parseTutorial(md) {
  const steps = [];
  let step = null;          // the card being filled
  let para = [];            // lines of the paragraph being gathered
  let list = [];            // consecutive `- ` items
  let quote = [];           // consecutive `> ` lines

  const flushPara = () => {
    if (!para.length) return;
    if (step) step.body.push(inline(para.join(' '), step.sees));
    para = [];
  };
  const flushList = () => {
    if (!list.length) return;
    if (step) step.body.push('<ul>' + list.map((i) => '<li>' + inline(i, step.sees) + '</li>').join('') + '</ul>');
    list = [];
  };
  const flushQuote = () => {
    if (!quote.length) return;
    const text = quote.join(' ').trim();
    const m = LABELLED.exec(text);
    if (step) step.body.push(m ? { try: inline(m[2], step.sees), label: m[1] } : { try: inline(text, step.sees) });
    quote = [];
  };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };

  // Strip comments first so a `##` or `>` inside one can't be read as content.
  const lines = md.replace(/<!--[\s\S]*?-->/g, '').split('\n');

  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') { flushAll(); continue; }
    if (line.startsWith('## ')) {
      flushAll();
      step = { title: line.slice(3).trim(), body: [], sees: [] };
      steps.push(step);
      continue;
    }
    if (line.startsWith('# ')) { flushAll(); continue; }         // document title
    const dm = /^\{demo:([A-Za-z0-9_-]+)\}$/.exec(line);
    if (dm) {
      flushAll();
      // Attach to the block just written, not as a block of its own: the button belongs in that
      // paragraph's gutter.
      if (step && step.body.length) {
        const last = step.body[step.body.length - 1];
        step.body[step.body.length - 1] = typeof last === 'string' ? { html: last, demo: dm[1] } : { ...last, demo: dm[1] };
      }
      continue;
    }
    if (line.startsWith('>')) { flushPara(); flushList(); quote.push(line.replace(/^>\s?/, '')); continue; }
    if (/^[-*+]\s/.test(line)) { flushPara(); flushQuote(); list.push(line.replace(/^[-*+]\s+/, '')); continue; }
    flushList(); flushQuote();
    para.push(line);
  }
  flushAll();
  return steps.filter((s) => s.body.length);
}

// What a rendered part SOUNDS like: its words with the markup taken off. Both the tour (deciding
// what to ask the voice for) and the render tool (deciding what to record) run this over the same
// parsed document, so neither can drift from the other. The show-me markers carry no text of their
// own, so nothing extra is read out.
// A {pause} splits the line in two, and the voice leaves a gap between the pieces. Marked before the
// tags come off, because after that there is nothing left to split on.
const PAUSE_MARK = '\u0000';
const strip = (html) => html
  .replace(/<span class="tour-pause"[^>]*><\/span>/g, PAUSE_MARK)
  // Every glyph first, whole. They are SVG carrying letters — the show-me marker's question mark, the
  // legend's icons — and stripping tags alone would leave a trail of spoken question marks.
  .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
  .replace(/<button\b[\s\S]*?<\/button>/gi, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ')
  .trim();

// A LIST is spoken item by item, not as one recording. The Vocabulary section is a single list of a
// dozen terms; as one fragment it is a minute and a half you cannot get out of, and it can never be
// re-rendered without redoing all of it. So a list part returns an array and the voice plays them in
// order — same button, same block, but small pieces.
const split = (t) => (t.includes(PAUSE_MARK) ? t.split(PAUSE_MARK).map((x) => x.trim()).filter(Boolean) : t);

export function spokenText(part) {
  if (part && typeof part.html === 'string') return spokenText(part.html);
  if (typeof part === 'string') {
    const items = [...part.matchAll(/<li>([\s\S]*?)<\/li>/gi)].map((m) => strip(m[1])).filter(Boolean);
    if (items.length) {
      const lead = strip(part.replace(/<ul>[\s\S]*?<\/ul>/gi, ' '));
      return (lead ? [lead, ...items] : items).flatMap((x) => split(x));
    }
    return split(strip(part));
  }
  return split(strip(`${part.label || 'Example'}: ${part.try || ''}`));
}

// A section that is a table of contents is navigation, not prose: nothing to read aloud and no
// speaker beside it. Recognised by its title, the same way the tour numbers the rest.
export const isContentsTitle = (t) => String(t || '').trim().toLowerCase() === 'contents';

// Every line the tutorial can speak, in document order.
export function tutorialLines(steps) {
  const out = [];
  for (const s of steps) {
    if (isContentsTitle(s.title)) continue;
    for (const part of (s.body || [])) {
      const t = spokenText(part);
      for (const line of (Array.isArray(t) ? t : [t])) if (line) out.push(line);
    }
  }
  return out;
}

export async function loadTutorial(url = TUTORIAL_URL) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('tutorial.md ' + res.status);
  return parseTutorial(await res.text());
}
