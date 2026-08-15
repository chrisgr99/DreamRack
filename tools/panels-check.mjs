// panels-check — does every module's panel.layout.js still reproduce its shipped panel.svg?
//
// Drift between the two is silent and expensive. The panel editor draws the LAYOUT, so a hand-edited
// SVG shows you one panel and edits another, and a save regenerates from the layout — replacing the
// artwork with a drawing nobody chose. That is how the function generator left the canonical system,
// and it stayed out of it for a long time because nothing ever asked this question.
//
// Imports the renderer directly rather than spawning a process per module: the same check, seconds
// instead of minutes, so it is cheap enough to actually run.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderPanel } from '../panel/render.js';
import { applyOverrides } from '../panel/overrides.js';

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const base = path.join(root, 'modules');
const dirs = fs.readdirSync(base)
  .filter((d) => fs.existsSync(path.join(base, d, 'panel.layout.js'))
              && fs.existsSync(path.join(base, d, 'panel.svg')));

// THE TOP-RIGHT CORNER IS RESERVED. The rack draws the poly lamp there at runtime — a control that
// comes and goes with the page cannot be in a generated panel — and the panel editor knows nothing
// about it, so without this check someone would lay a knob under it and find out much later.
// The lamp with its glyph beside it, plus the 1mm margins, measured from the face's top right.
const RESERVED_W = 8.6, RESERVED_H = 6.0;
function reservedClashes(svg) {
  const vb = /viewBox="([\d.\- ]+)"/.exec(svg);
  if (!vb) return [];
  const parts = vb[1].trim().split(/\s+/).map(Number);
  const W = parts[2], top = parts[1] + 4;   // the face begins below the 4mm title strip
  const x0 = parts[0] + W - RESERVED_W, y1 = top + RESERVED_H;
  const hits = [];
  const inside = (x, y) => x > x0 && y > top && y < y1;
  for (const m of svg.matchAll(/<text[^>]*x="([\d.-]+)"[^>]*y="([\d.-]+)"[^>]*>([^<]{1,16})<\/text>/g)) {
    if (inside(+m[1], +m[2])) hits.push(`"${m[3].trim()}"`);
  }
  for (const m of svg.matchAll(/<circle[^>]*cx="([\d.-]+)"[^>]*cy="([\d.-]+)"[^>]*r="([\d.]+)"/g)) {
    if (inside(+m[1], +m[2])) hits.push(`a circle at ${(+m[1]).toFixed(1)},${(+m[2]).toFixed(1)}`);
  }
  for (const m of svg.matchAll(/<rect[^>]*x="([\d.-]+)"[^>]*y="([\d.-]+)"[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/g)) {
    const x = +m[1], y = +m[2], w = +m[3], h = +m[4];
    if (w > W * 0.9) continue;                       // the face itself
    if (x + w > x0 && y < y1 && y + h > top) hits.push(`a rect at ${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return hits;
}

// ANYTHING DRAWN OUTSIDE THE MODULE'S BORDER IS DRAWN NOWHERE. A panel whose content does not fit
// does not complain: the elements are emitted past the faceplate, where the module ends and the rack
// is empty — so a jack still binds, still takes a cable, and the cable runs off the module into open
// rack. Voice In did exactly that when it grew a band too many, and nothing said so.
//
// MEASURED AGAINST THE BORDER, NOT THE OUTER EDGE. Every face is a rectangle with a frame drawn half
// a millimetre inside it, and that frame is what a person sees as the module. A jack whose ink laps
// over it is outside the module however you count the numbers.
//
// AND BY EXTENT, NOT BY POSITION: a jack's radius, a label's descenders. Checking centres alone
// passed a panel whose jacks sat on the face while the words beneath them did not.
function border(svg) {
  // The first rect is the face; the second is the frame drawn inside it. Fall back to the face.
  const rects = [...svg.matchAll(/<rect[^>]*x="([\d.-]+)"[^>]*y="([\d.-]+)"[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/g)];
  const r = rects[1] || rects[0];
  if (!r) return null;
  const x = Number(r[1]), y = Number(r[2]), w = Number(r[3]), h = Number(r[4]);
  return { left: x, top: y, right: x + w, bottom: y + h };
}
function overflows(svg) {
  const b = border(svg);
  if (!b) return [];
  const out = [];
  const say = (what, edge, v) => out.push(`${what} ${edge} the border by ${v.toFixed(1)}mm`);
  for (const m of svg.matchAll(/<g[^>]*data-wcoast-(?:port|param)="([^"]+)"[^>]*>/g)) {
    const tail = svg.slice(m.index, m.index + 900);
    let lo = -Infinity, hi = Infinity, rt = -Infinity, lf = Infinity;
    for (const c of tail.matchAll(/<circle[^>]*cx="([\d.-]+)"[^>]*cy="([\d.-]+)"[^>]*r="([\d.]+)"/g)) {
      const cx = Number(c[1]), cy = Number(c[2]), rr = Number(c[3]);
      lo = Math.max(lo, cy + rr); hi = Math.min(hi, cy - rr);
      rt = Math.max(rt, cx + rr); lf = Math.min(lf, cx - rr);
    }
    if (lo > b.bottom) say(m[1], 'runs below', lo - b.bottom);
    if (hi < b.top) say(m[1], 'runs above', b.top - hi);
    if (rt > b.right) say(m[1], 'runs past the right of', rt - b.right);
    if (lf < b.left) say(m[1], 'runs past the left of', b.left - lf);
  }
  for (const m of svg.matchAll(/<text[^>]*x="([\d.-]+)"[^>]*y="([\d.-]+)"[^>]*font-size="([\d.]+)"[^>]*>([^<]{1,20})<\/text>/g)) {
    const size = Number(m[3]), foot = Number(m[2]) + size * 0.25;
    const text = m[4].trim(), w = text.length * size * 0.55, x = Number(m[1]);
    // WHERE A LABEL SITS DEPENDS ON ITS ANCHOR. Band headers are anchored at their START and control
    // labels at their MIDDLE; treating them all as centred put every OUT header a millimetre outside
    // its own panel — the check was wrong, not the panels.
    const anchor = (/text-anchor="([a-z]+)"/.exec(svg.slice(m.index, m.index + 240)) || [, 'middle'])[1];
    const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
    const right = left + w;
    if (foot > b.bottom) say(`the label "${text}"`, 'runs below', foot - b.bottom);
    if (right > b.right) say(`the label "${text}"`, 'runs past the right of', right - b.right);
    if (left < b.left) say(`the label "${text}"`, 'runs past the left of', b.left - left);
  }
  return out;
}

let drifted = 0, unchecked = 0, encroach = 0, spilled = 0;
for (const d of dirs) {
  const modDir = path.join(base, d);
  try {
    const layout = structuredClone((await import(pathToFileURL(path.join(modDir, 'panel.layout.js')).href)).default);
    const ov = path.join(modDir, 'panel.overrides.json');
    if (fs.existsSync(ov)) applyOverrides(layout, JSON.parse(fs.readFileSync(ov, 'utf8')));
    const svg = fs.readFileSync(path.join(modDir, 'panel.svg'), 'utf8');
    const ok = renderPanel(layout, false) === svg;
    const clash = reservedClashes(svg);
    const over = overflows(svg);
    console.log(`  ${ok ? '✓' : '✗'}  ${d}${ok ? '' : '   — layout does NOT reproduce panel.svg'}`
      + (clash.length ? `\n     ! the top-right corner is reserved for the poly lamp: ${clash.join(', ')}` : '')
      + (over.length ? `\n     ✗ OUTSIDE THE MODULE'S BORDER, where the rack is empty: ${over.join(', ')}` : ''));
    if (!ok) drifted++;
    if (clash.length) encroach++;
    if (over.length) spilled++;
  } catch (e) {
    unchecked++;
    console.log(`  ?  ${d}   — could not check: ${e.message}`);
  }
}
console.log(`\n${dirs.length} panels: ${dirs.length - drifted - unchecked} in sync, ${drifted} drifted, ${unchecked} unchecked`
  + (encroach ? `, ${encroach} using the reserved corner` : '')
  + (spilled ? `, ${spilled} SPILLING OFF THE FACE` : ''));
process.exit(drifted || spilled ? 1 : 0);
