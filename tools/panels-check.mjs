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

let drifted = 0, unchecked = 0;
for (const d of dirs) {
  const modDir = path.join(base, d);
  try {
    const layout = structuredClone((await import(pathToFileURL(path.join(modDir, 'panel.layout.js')).href)).default);
    const ov = path.join(modDir, 'panel.overrides.json');
    if (fs.existsSync(ov)) applyOverrides(layout, JSON.parse(fs.readFileSync(ov, 'utf8')));
    const ok = renderPanel(layout, false) === fs.readFileSync(path.join(modDir, 'panel.svg'), 'utf8');
    console.log(`  ${ok ? '✓' : '✗'}  ${d}${ok ? '' : '   — layout does NOT reproduce panel.svg'}`);
    if (!ok) drifted++;
  } catch (e) {
    unchecked++;
    console.log(`  ?  ${d}   — could not check: ${e.message}`);
  }
}
console.log(`\n${dirs.length} panels: ${dirs.length - drifted - unchecked} in sync, ${drifted} drifted, ${unchecked} unchecked`);
process.exit(drifted ? 1 : 0);
