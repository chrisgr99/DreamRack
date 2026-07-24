// SUPERSEDED — DO NOT RUN. The shipped panel.svg/panel.dark.svg were hand-authored
// (attack/decay are knAcks — a cable plugs into the knob — and the CV jack columns were
// folded away, narrowing the faceplate). panel.layout.js still describes the OLD four-column
// layout, so regenerating from it would overwrite the knAck faceplate. Kept for history only.
//
// Generator — renders panel.layout.js to the light + dark SVGs via the shared
// table-driven renderer (panel/render.js), applying any saved position overrides
// (panel.overrides.json) from the visual editor first. See design/panel-editor.md.
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
