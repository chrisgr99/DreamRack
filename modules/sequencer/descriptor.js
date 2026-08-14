// descriptor.js — Sequencer. A page's outward face when that page makes notes.
//
// It bundles, and that is the whole of its job (design/voice-pages.md §2). Separate gate, pitch,
// level, duration and pan signals go in; one note cable comes out, and crosses to a voice page. What
// produces those signals — a hand-built sequencer, a MIDI listener, an arpeggiator — is whatever else
// is on the page, and this module has no opinion about it.
//
// IT IS ALSO WHAT MAKES THE PAGE A SEQUENCER PAGE. A page holds one of these or one Voice module,
// never both, so a page can be trusted to be one thing. That enforcement lands in stage three; here
// the module is an ordinary one you can place anywhere, and the note cable's domain rule already
// stops it being wired anywhere it should not go.
//
// PITCH IS HELD, LEVEL AND PAN ARE NOT SAMPLED FROM ANYTHING ELSE. On the gate's rising edge the
// pitch, level, duration and pan are captured and held for the life of the note. Holding is what
// makes a note a note: a sequencer's next step arriving early, or an unquantised source drifting,
// must not drag a sounding note around with it. Movement within a note is the bend lane's job, which
// arrives in stage six.
//
// DURATION IS A MAXIMUM. The note ends when the gate falls or when the duration runs out, whichever
// comes first — the rule from control-protocol.md, which exists so a note always ends even when the
// message that should have ended it never arrives.

'use strict';

export default {
  apiVersion: 1,
  id: 'wcoast.sequencer',
  name: 'Sequencer',
  abbreviation: 'SEQ',
  category: 'sequencing',
  scope: 'shared',            // it is the page's boundary, not one voice's worth of it
  hp: 8,
  worklets: ['modules/sequencer/sequencer-processor.js'],
  ports: [
    // The gate is the note. Everything else is captured when it rises.
    { id: 'gateIn', name: 'Gate', section: 'note', domain: 'trigger', dir: 'in' },
    { id: 'pitchIn', name: '1V/Oct', role: 'pitch', section: 'note', domain: 'control', dir: 'in' },
    // Each of these three overrides its knob while a cable is in it, and the knob is what the note
    // carries otherwise — so a bare gate still makes a complete note.
    { id: 'levelIn', name: 'Level', section: 'note', domain: 'control', dir: 'in' },
    { id: 'durIn', name: 'Duration', section: 'note', domain: 'control', dir: 'in' },
    { id: 'panIn', name: 'Pan', section: 'note', domain: 'control', dir: 'in', polarity: 'bipolar' },
    { id: 'noteOut', name: 'Note', section: 'out', domain: 'note', dir: 'out' },
  ],
  params: [
    { id: 'level', name: 'Level', section: 'note', curve: 'linear', min: 0, max: 1, default: 0.8, glideMs: 10 },
    // Seconds, exponential: the useful range runs from a click to a held drone, and a linear knob
    // would spend most of its travel above a second.
    { id: 'duration', name: 'Duration', section: 'note', curve: 'exp', min: 0.01, max: 8, default: 0.25, unit: 's', glideMs: 0 },
    { id: 'pan', name: 'Pan', section: 'note', curve: 'linear', min: -1, max: 1, default: 0, glideMs: 10 },
    // How many semitones of movement away from the note's own pitch count as full bend. It is what
    // turns volts into the -1..1 the bend lane carries, and it is the one setting a player expects to
    // find: two semitones is what a MIDI instrument ships with, and a whole tone is what a wheel does
    // on most of them.
    //
    // SEMITONES, BUT NOT WHOLE ONES. A tenth of a semitone at one end and two octaves at the other,
    // and everything between: a quarter-tone bend, a scale that is not twelve-tone, or a range set by
    // ear rather than by arithmetic are all ordinary things to want. The curve is exponential because
    // the span is 240 to 1, and on a linear knob almost the whole travel would be spent above the
    // handful of semitones most playing uses.
    { id: 'bendRange', name: 'Bend range', section: 'note', curve: 'exp', min: 0.1, max: 24, default: 2, unit: 'st', glideMs: 0 },
  ],
};
