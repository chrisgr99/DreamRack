// host/default-rack.js — the rack a first-run user meets, and the notation demos declare theirs in.
//
// ONE definition, read by two callers: the app places it on a first run and on File > New, and a
// scripted demo uses it as its opening stage. That is what keeps a tutorial honest — the modules a
// demo talks about are the ones already on screen when a new user opens the app, in the same places,
// rather than appearing out of nowhere as the script runs.
//
// A STAGE IS A LIST OF ROWS, left to right, and nothing else. No coordinates, no descriptor ids:
//
//     R1: osc func prog          row 1 of the first audio tab
//     R2: lpg                    row 2 of the same
//     T2R1: shapes               second audio tab
//     MR1: mixer                 the Mixer/Output tab — M, not O, which reads as a zero
//     VR1: videoOut              the video tab
//
// A bare `Rn` means the first audio tab, which is where nearly everything lives, so nearly no line
// ever carries a tab. Modules are named by the ALIASES below, and the alias is also the name a
// script addresses the module by ("osc:timbre"). A second module of the same type in one stage takes
// the alias with a 2 after it, then 3, and so on.
'use strict';

// Short name -> descriptor id. The short name is what you say out loud and what a stage line and a
// script both use; the descriptor id is an internal detail no author should have to know.
export const ALIASES = {
  osc: 'wcoast.complexOsc259t',
  func: 'wcoast.quadFn281t',
  lpg: 'lpg-292',
  prog: 'programmer-8',
  mixer: 'mixer',
  gallery: 'wcoast.gallery',
  sine: 'sine-source',
  vco: 'wcoast.oscillator',
  field: 'coordinate-field',
  formula: 'formula',
  shapes: 'shapes',
  timeMachine: 'time-machine',
  videoMaths: 'video-maths',
  videoOut: 'video-out',
  compositor: 'compositor',
  colorizer: 'colorizer',
  encoder: 'encoder',
  chroma: 'chroma',
  polygon: 'polygon',
  grid: 'grid',
  symmetry: 'symmetry',
};

// The rack a first-run user meets. Row 1 fills left to right; the gate goes on the bottom row of the
// first audio page. It used to sit beside the mixer, which is no longer on this page — following the
// mixer across would have put the one module a first patch needs most on a page you have to find.
// The mixer is absent because it is pinned: it is placed before any of this and survives File > New.
// The video page carries the WHOLE video set, on two rows, in signal order — so that a first patch is
// mostly a matter of joining neighbours, and so that nothing has to be fetched from the library
// before there is something to look at.
//
// ROW ONE MAKES THE PICTURE, all of it monochrome: the field generates coordinates and warps them,
// the polygon draws a shape with corners, shapes cuts an edge out of a gradient, the grid repeats
// what it is given into cells, symmetry folds the frame about its centre, and maths meets two images
// against each other. Reading left to right is reading from "where things are" to "what is drawn" to
// "how it is repeated".
//
// ROW TWO TREATS IT AND ENDS IT: the time machine delays and trails, the three colour modules turn
// one channel or three into colour, the compositor collapses several pictures into one, and the
// output finishes the chain. Colour sits between time and the compositor because that is the order a
// patch uses them in — process in monochrome, colour late, composite last.
//
// The two rows sit under each other so a cable from row one to row two is a short vertical hop, which
// is the commonest cable on the page.
//
// FORMULA IS NOT HERE, though it is in the library. It is four images and a typed expression, which is
// the advanced end of the set: someone who wants it can find it, and someone who does not should not
// have to work out what an unused module with an expression on its face is for. Every other module on
// the page explains itself by its own controls.
export const DEFAULT_RACK = [
  'R1: osc func prog',
  'R2: lpg',
  'VR1: field polygon shapes grid symmetry videoMaths',
  'VR2: timeMachine colorizer encoder chroma compositor videoOut',
];

// "T2R1" / "MR1" / "VR1" / "R2" -> which page, and which row (0-based inside the rack).
// The Mixer/Output tab is M rather than O: it is the mixer's page as much as the output's, and an O
// beside digits reads as a zero.
function parseLabel(label) {
  const m = /^\s*(?:T(\d+)|(M)|(V))?R(\d+)\s*$/i.exec(label);
  if (!m) return null;
  const page = m[2] ? 'output' : m[3] ? 'video' : 'a' + (m[1] || 1);
  return { page, row: Math.max(0, Number(m[4]) - 1) };
}

// A stage's lines, resolved into placements. Unknown aliases and malformed labels are dropped and
// reported rather than silently producing an empty rack.
export function parseStage(lines) {
  const out = [];
  const used = new Map();   // alias -> how many of that type are already placed, for osc / osc2 / osc3
  for (const raw of lines || []) {
    const line = String(raw).trim();
    if (!line || line.startsWith('#')) continue;
    const at = line.indexOf(':');
    const where = at >= 0 ? parseLabel(line.slice(0, at)) : null;
    if (!where) { console.warn(`[demo] stage line not understood: ${line}`); continue; }
    for (const word of line.slice(at + 1).split(/\s+/).filter(Boolean)) {
      const module = ALIASES[word];
      if (!module) { console.warn(`[demo] unknown module "${word}" in stage line: ${line}`); continue; }
      const n = (used.get(word) || 0) + 1;
      used.set(word, n);
      out.push({ as: n === 1 ? word : word + n, module, page: where.page, row: where.row });
    }
  }
  return out;
}

// Place a stage on the rack. `withKeys` forces each module's name as its record key, so a demo can
// address it by that name; the app leaves that off and lets keys be minted as usual.
export async function placeRack(rack, stage = DEFAULT_RACK, { withKeys = false } = {}) {
  const flow = new Map();   // "page/row" -> the x the next module in that row starts at
  for (const m of parseStage(stage)) {
    // Rows fill left to right. A module placed at x = 0 ties with whatever is already there and the
    // tie breaks on insertion order, so it sorts AHEAD of modules that have since been pushed right
    // — which is how the Sequencer once landed in the middle of row 1 instead of at its end.
    const row = Math.min(m.row, rack.rowCount - 1);
    const slot = m.page + '/' + row;
    const opts = { page: m.page };
    if (withKeys) opts.key = m.as;
    const rec = await rack.addModule(m.module, row, flow.get(slot) || 0, opts);
    if (rec) flow.set(slot, rec.x + rec.panelWmm);
  }
}
