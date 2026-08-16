// descriptor.js — Strudel. Live-coded patterns as a module.
//
// See design/strudel-module.md. Strudel runs inside the app, sharing this rack's audio context, with
// the rack as its output instead of superdough — so a pattern event is placed at the sample rather
// than negotiated across a socket. The faceplate is the transport; the editor is a window.
//
// PHASE ONE carries a pattern in a text param and a button to run it. The editor comes next.

'use strict';

const ports = [
  { id: 'noteOut', name: 'Note', section: 'out', domain: 'note', dir: 'out' },
];

const params = [
  // The pattern itself, saved in the patch, so a piece reopens as you left it. Same kind of param as
  // the Formula module's expression.
  { id: 'code', name: 'Pattern', section: 'pattern', curve: 'text',
    default: 'note("<c3 eb3 g3 bb3>").sustain(0.4)' },
  { id: 'run', name: 'Run', section: 'pattern', curve: 'stepped', default: 'stop', modulatable: false,
    steps: [{ value: 'stop' }, { value: 'play' }] },
  // Opens the editor window. Phase two.
  { id: 'edit', name: 'Editor', section: 'pattern', curve: 'stepped', default: 'closed', modulatable: false,
    steps: [{ value: 'closed' }, { value: 'open' }] },
];

export default {
  apiVersion: 1,
  id: 'wcoast.strudel',
  name: 'Strudel',
  abbreviation: 'STR',
  category: 'sequencer',
  scope: 'shared',
  hp: 8,
  worklets: ['modules/strudel/strudel-processor.js'],
  menuSectionOrder: ['pattern', 'out'],
  ports,
  params,
};
