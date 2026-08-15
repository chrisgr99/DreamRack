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

let drifted = 0, unchecked = 0, encroach = 0;
for (const d of dirs) {
  const modDir = path.join(base, d);
  try {
    const layout = structuredClone((await import(pathToFileURL(path.join(modDir, 'panel.layout.js')).href)).default);
    const ov = path.join(modDir, 'panel.overrides.json');
    if (fs.existsSync(ov)) applyOverrides(layout, JSON.parse(fs.readFileSync(ov, 'utf8')));
    const svg = fs.readFileSync(path.join(modDir, 'panel.svg'), 'utf8');
    const ok = renderPanel(layout, false) === svg;
    const clash = reservedClashes(svg);
    console.log(`  ${ok ? '✓' : '✗'}  ${d}${ok ? '' : '   — layout does NOT reproduce panel.svg'}`
      + (clash.length ? `\n     ! the top-right corner is reserved for the poly lamp: ${clash.join(', ')}` : ''));
    if (!ok) drifted++;
    if (clash.length) encroach++;
  } catch (e) {
    unchecked++;
    console.log(`  ?  ${d}   — could not check: ${e.message}`);
  }
}
console.log(`\n${dirs.length} panels: ${dirs.length - drifted - unchecked} in sync, ${drifted} drifted, ${unchecked} unchecked`
  + (encroach ? `, ${encroach} using the reserved corner` : ''));
process.exit(drifted ? 1 : 0);
