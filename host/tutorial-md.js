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
// It was an EYE, and a page of them stared back at the reader. It is now a small orange rounded
// square carrying a black QUESTION MARK — the same orange the callout ring and leader line are
// drawn in, so the marker and the thing it produces read as one mechanism, and a question mark says
// "where is this?" which is exactly what clicking it answers.
//
// The square is filled with `currentColor` so the `unavailable` and `lit` states can restyle it
// from CSS alone. The glyph is drawn as SVG text rather than a path so it stays crisp at any size,
// with the family named explicitly rather than inherited — the card's font must not change it.
const EYE_BUTTON = '<button type="button" class="tour-eye" aria-hidden="true" tabindex="-1">'
  + '<svg viewBox="0 0 16 16" aria-hidden="true">'
  + '<rect x="0.6" y="0.6" width="14.8" height="14.8" rx="3.4" fill="currentColor"/>'
  + '<text x="8" y="8.1" text-anchor="middle" dominant-baseline="central" fill="#000000"'
  + ' font-family="-apple-system, system-ui, Helvetica, Arial, sans-serif"'
  + ' font-size="12.5" font-weight="700">?</text></svg></button>';

// Inline markdown → the small HTML the card renders. Order matters: links before emphasis, so a
// URL containing an underscore or asterisk isn't mangled.
//
// {see:TARGET} becomes the eye. TARGET is "<module>" (whole module), "<module>#title" (its title
// bar), "<module>#<section>" (a quad's channel band), "<module>/<element>" (one terminal or
// control), or "ui:<css selector>" (application chrome). Each target found is pushed onto `sees`.
const inline = (s, sees) => escapeHtml(s)
  .replace(/\{see:([^}\s]+)\}/g, (_m, t) => { if (sees) sees.push(t); return EYE_BUTTON; })
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
    if (line.startsWith('>')) { flushPara(); flushList(); quote.push(line.replace(/^>\s?/, '')); continue; }
    if (/^[-*+]\s/.test(line)) { flushPara(); flushQuote(); list.push(line.replace(/^[-*+]\s+/, '')); continue; }
    flushList(); flushQuote();
    para.push(line);
  }
  flushAll();
  return steps.filter((s) => s.body.length);
}

export async function loadTutorial(url = TUTORIAL_URL) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('tutorial.md ' + res.status);
  return parseTutorial(await res.text());
}
