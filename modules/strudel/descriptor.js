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
  // A LATCH: lit red while the pattern is playing, dark when it is not.
  // OFF AND ON, not stop and play: a button's lamp is bound to the value `on`, so any other pair of
  // names gives you a button that works and never lights.
  { id: 'run', name: 'Run', section: 'pattern', curve: 'stepped', default: 'off', modulatable: false,
    steps: [{ value: 'off' }, { value: 'on' }] },
  // MOMENTARY: it lights while you press it and each press is a fresh act — the window is not a state
  // the button holds, it is somewhere you went, and it can also be sent away with Option+Tab or its own
  // close, which would leave a latched button lit over nothing.
  { id: 'edit', name: 'Editor', section: 'pattern', curve: 'stepped', default: 'off', modulatable: false,
    momentary: true, steps: [{ value: 'off' }, { value: 'on' }] },
  // THE TEMPO, WHICH GOES BOTH WAYS. The pattern sets it — `cpm(60)` — and the module reports it here
  // so the panel shows what is actually running; turn it on the panel and the running pattern follows.
  // A NUMBER, not text: a text param under a readout has nothing to scroll and shows NaN when you try.
  { id: 'cps', name: 'Cycles per second', section: 'pattern', curve: 'linear',
    min: 0.05, max: 8, default: 0.5, glideMs: 0 },
  // THE WINDOW IS PART OF THE PATCH. Its size, its place and whether it was open were kept in local
  // storage, which is wrong twice: a patch did not reopen as you left it, and one key served every
  // module and every patch, so two Strudel modules fought over one remembered window and a patch
  // carried to another machine got that machine's last geometry. A text param holds it as JSON, which
  // is the same route the pattern itself takes.
  { id: 'window', name: 'Window', section: 'pattern', curve: 'text', default: '' },

  // Reported by the module, never set: whether the last evaluation took.
  // READ ONLY, because it is a report and not a control: without this you can press the lamp and tell
  // the module it has failed, which is a lie you had to type.
  { id: 'status', name: 'Status', section: 'pattern', curve: 'stepped', default: 'ok', modulatable: false,
    readOnly: true, steps: [{ value: 'ok' }, { value: 'error' }] },
];

export default {
  apiVersion: 1,
  id: 'wcoast.strudel',
  name: 'Strudel',
  abbreviation: 'STR',
  category: 'sequencer',
  scope: 'shared',
  // One engine plays the tab; it is never duplicated per note, so it carries no per-note lamp.
  sharedFixed: true,
  hp: 8,
  worklets: ['modules/strudel/strudel-processor.js'],
  menuSectionOrder: ['pattern', 'out'],
  ports,
  params,
};
