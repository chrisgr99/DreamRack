// GXW — the geometric sequencer, as a module on the rack.
//
// GXW (GeosonixV2) is a whole application: objects moving on a canvas, striking beat points, playing
// notes. On the rack it is a module like any other — eight voices out, its own sound out as a stereo
// pair, a switch to run it, and a button that gives it the window when you want to work on it.
//
// MODELLED ON THE STRUDEL MODULE, which solves the same problem: a source of parts that wants to
// reach several rack voices and also make its own sound. Where the two differ, the difference is in
// what fills the window when you open it, not in how it sits on the rack. See design/drack.md §3.
'use strict';

// EIGHT VOICES, on note cables. Each carries a whole voice — up to eight notes at once, each with its
// pitch, level, length and movement while it sounds. One cable to a voice tab and GXW is playing the
// rack. Which of GXW's parts goes to which output is GXW's own business, decided in its window.
//
// The jacks cost sockets and nothing else: a note cable carries messages only when a note starts or
// ends, so an unpatched jack costs nothing at all.
const ports = [
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
    { id: 'noteOut' + n, name: 'V' + n, section: 'out', domain: 'note', dir: 'out' })),
  // GXW'S OWN SOUND COMES OUT HERE. It plays through superdough, which connects itself to the
  // speakers — which would put its voices outside the rack entirely: past the master fader, past the
  // mutes, past the engine switch, and audible while the rack is silent. Taken from superdough's
  // output stage and offered as jacks instead, they are mixed, muted and switched like anything else.
  //
  // A PAIR, because what arrives is stereo and one jack would throw the panning away.
  { id: 'audioOutL', name: 'GX L', section: 'out', domain: 'audio', dir: 'out' },
  { id: 'audioOutR', name: 'GX R', section: 'out', domain: 'audio', dir: 'out' },
];

// NO INPUTS IN THIS VERSION, and no clock output. Both are deliberate and both are additions to a
// face that works rather than changes to it:
//
//   - CV and triggers reaching GXW's parameters and its objects are stage 5. A strip of CV inputs is
//     worth designing once there is a patch asking for particular ones rather than a guess.
//   - A clock output carries PHASE when it comes — a value climbing zero to one across each beat,
//     correct whenever it is read. It is deferred because a note on a composite cable already carries
//     its own timing: the event IS the trigger, so the notes may be trigger enough. The moment
//     something needs to lock to GXW's beat rather than to its notes, it goes on the face.
const params = [
  // RUN FROM THE RACK, without opening it. GXW owns the clock when it is present, and a module that
  // can only be used by taking over the screen is not a module: a patch has to be able to start and
  // stop the sequence with GXW's window never open.
  //
  // ONE STATE, TWO VIEWS. This is not a second transport beside GXW's own — it is the same transport,
  // shown on the faceplate. Starting here and starting inside GXW are the same act.
  { id: 'run', name: 'Run', section: 'transport', curve: 'stepped', default: 'off', modulatable: false,
    steps: [{ value: 'off' }, { value: 'on' }] },

  // OPEN takes the window and gives it to GXW, with GXW's own in-page menu. Closing it returns to the
  // rack. A momentary press rather than a state: the window's openness belongs to the window, not to
  // the patch, so reopening a patch does not reopen the editor over the top of the rack.
  // MOMENTARY AND TRANSIENT, and it needs both.
  //
  // MOMENTARY because every press must mean "open", not "toggle". The window can also be closed from
  // inside — the way out sits in GXW's own toolbar — and the module does not report that back, so a
  // toggling button would still be holding `on` and the next press would send `off`: one press that
  // appeared to do nothing, and only the press after it reopening the window.
  //
  // TRANSIENT because whether a window is open belongs to this session, not to the patch. Reopening a
  // piece should not throw GXW over the rack before you have looked at it.
  { id: 'open', name: 'Open', section: 'transport', curve: 'stepped', default: 'off', modulatable: false,
    momentary: true, transient: true, steps: [{ value: 'off' }, { value: 'on' }] },

  // The score GXW is holding, saved with the patch so a piece reopens as it was left. Text, like the
  // Strudel module's pattern: what it holds is GXW's own bundle, and only GXW reads it.
  { id: 'score', name: 'Score', section: 'transport', curve: 'text', default: '' },

  // What the module says about itself, for the faceplate lamp and the mirror. Transient for the same
  // reason: it is a report about right now, and saving it would restore a claim rather than a fact.
  { id: 'status', name: 'Status', section: 'transport', curve: 'stepped', default: 'idle', modulatable: false,
    transient: true, steps: [{ value: 'idle' }, { value: 'loading' }, { value: 'ok' }, { value: 'error' }] },
];

export default {
  apiVersion: 1,
  id: 'wcoast.gxw',
  name: 'GXW',
  abbreviation: 'GXW',
  category: 'sequencing',
  scope: 'shared',
  // One sequencer plays the tab; it is never duplicated per note, so it carries no per-note lamp.
  sharedFixed: true,
  hp: 9,
  // Shared with the Strudel module; the host loads a worklet path once. See the factory.
  worklets: ['modules/strudel/strudel-processor.js'],
  menuSectionOrder: ['transport', 'out'],
  ports,
  params,
};
