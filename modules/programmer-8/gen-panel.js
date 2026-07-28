// gen-panel.js — render panel.layout.js to the light + dark SVGs via the shared
// renderer, applying panel.overrides.json if present. Run: node modules/programmer-8/gen-panel.js
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderPanel } from '../../panel/render.js';
import { applyOverrides } from '../../panel/overrides.js';
import layout from './panel.layout.js';

const dir = fileURLToPath(new URL('.', import.meta.url));
const ovPath = dir + 'panel.overrides.json';
if (fs.existsSync(ovPath)) applyOverrides(layout, JSON.parse(fs.readFileSync(ovPath, 'utf8')));
fs.writeFileSync(dir + 'panel.svg', renderPanel(layout, false));
fs.writeFileSync(dir + 'panel.dark.svg', renderPanel(layout, true));
console.log('wrote panel.svg + panel.dark.svg');
