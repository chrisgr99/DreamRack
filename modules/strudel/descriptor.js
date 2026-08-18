// descriptor.js — Strudel. Live-coded patterns as a module.
//
// See design/strudel-module.md. Strudel runs inside the app, sharing this rack's audio context, with
// the rack as its output instead of superdough — so a pattern event is placed at the sample rather
// than negotiated across a socket. The faceplate is the transport; the editor is a window.
//
// PHASE ONE carries a pattern in a text param and a button to run it. The editor comes next.

'use strict';

// EIGHT VOICE OUTS, V1 to V8. A pattern says which one a part leaves by — `.rack(3)` for V3 — and the
// cable from that jack decides which instrument plays it. One jack, one voice tab: the tab's own
// polyphony handles however many notes overlap inside it.
//
// V1 KEEPS THE ID `noteOut`. It was the only jack when there was one, so a patch made before this
// still finds its cable rather than losing it to a renamed port.
//
// The jacks cost sockets and nothing else. A note cable carries messages only when a note starts or
// ends, so an unpatched jack costs nothing at all; what a voice tab costs is paid by the tab.
const ports = [
  { id: 'noteOut', name: 'V1', section: 'out', domain: 'note', dir: 'out' },
  ...[2, 3, 4, 5, 6, 7, 8].map((n) => (
    { id: 'noteOut' + n, name: 'V' + n, section: 'out', domain: 'note', dir: 'out' })),
  // STRUDEL'S OWN VOICES COME OUT HERE, as audio. superdough connects itself to the speakers, which
  // would put its drums outside the rack entirely — past the master fader, past the mutes, past the
  // engine switch, and audible while the rack is silent. Taken from its output stage and offered as a
  // jack instead, they are mixed, muted and switched off like anything else on the rack.
  // A PAIR, because what arrives is stereo: superdough pans its voices, and one jack into one mixer
  // channel would throw that away. Two, as Poly to Stereo has.
  { id: 'audioOutL', name: 'SD L', section: 'out', domain: 'audio', dir: 'out' },
  { id: 'audioOutR', name: 'SD R', section: 'out', domain: 'audio', dir: 'out' },
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
  // TRANSIENT, because a momentary button is a press and not a setting. Saved, its value came back as
  // a press on load — a patch whose SCRIPT button had last been used opened its window on opening,
  // which is a window nobody asked for and, in a demo, the very thing the demo means to show.
  { id: 'edit', name: 'Editor', section: 'pattern', curve: 'stepped', default: 'off', modulatable: false,
    momentary: true, transient: true, steps: [{ value: 'off' }, { value: 'on' }] },
  // THE TEMPO, WHICH GOES BOTH WAYS. The pattern sets it — `cpm(60)` — and the module reports it here
  // so the panel shows what is actually running; turn it on the panel and the running pattern follows.
  // A NUMBER, not text: a text param under a readout has nothing to scroll and shows NaN when you try.
  { id: 'cps', name: 'Cycles per second', section: 'pattern', curve: 'linear',
    min: 0.05, max: 8, default: 0.5, glideMs: 0,
    // A HUNDREDTH PER PRESS, and per notch of the wheel. Tempo is settled in very small moves — the
    // difference between 0.60 and 0.62 is audible against a drum part — and without a step of its own
    // the arrows worked in whole cycles, which is the entire usable range in eight presses.
    step: 0.01 },
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
  hp: 9,
  worklets: ['modules/strudel/strudel-processor.js'],
  menuSectionOrder: ['pattern', 'out'],
  ports,
  params,
};
