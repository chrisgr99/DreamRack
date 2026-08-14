// descriptor.js — Voice In. A page's outward face when that page is an instrument.
//
// One note cable in, and the note's parts come back out as ordinary jacks: gate, 1V/oct pitch, bend,
// level, duration and pan. Patch those into whatever the page is built from and the page plays.
//
// UNBUNDLING HAPPENS HERE AND NOWHERE ELSE, exactly as bundling happens only in the Sequence Out module
// (design/voice-pages.md §3). That is the rule that keeps the note domain out of general patching,
// and with the domain rule in the patchbay it is also what makes a page's kind enforce itself: a note
// cable has nowhere to land on a page that has no Voice In module.
//
// PITCH COMES OUT TWICE — the note's own pitch, held, and BEND: how far it has moved since. Holding
// is what makes a note a note, and a deviation is what a wheel, a wind controller and MPE all send,
// so bend behaves the way anyone who has played one expects.
//
// Bend goes into a modulation input, where the knАck convention already puts a depth trim — so how
// far a bend bends is set on the module being played. It runs -1..1 like every other modulation
// signal here rather than in volts; the Sequencer's BEND RANGE knob is what decides how many
// semitones of movement that full deflection stands for.
//
// DURATION COMES OUT AS A JACK because a voice usually wants it. Patch it into an envelope's decay
// and short notes get short envelopes without a second cable from the sequencer page.
//
// NO VOICE COUNT YET. The count belongs on this module — the page is the voice and this says how many
// of it to run — but instantiating a page more than once is stage five, and a knob that does nothing
// is worse than no knob.

'use strict';

export default {
  apiVersion: 1,
  // The id stays as it is — it is in saved patches — while the name says which way the notes run.
  id: 'wcoast.voice',
  name: 'Voice In',
  abbreviation: 'VCI',
  category: 'utility',
  scope: 'shared',            // it is the page's boundary, not one voice's worth of it
  hp: 8,
  ports: [
    { id: 'noteIn', name: 'Note', section: 'note', domain: 'note', dir: 'in' },
    { id: 'gateOut', name: 'Gate', section: 'out', domain: 'trigger', dir: 'out' },
    { id: 'pitchOut', name: '1V/Oct', role: 'pitch', section: 'out', domain: 'control', dir: 'out' },
    // Zero at note-on and moving thereafter, and -1..1 rather than volts — an ordinary modulation
    // signal in the ordinary colour, so the depth trim it lands on behaves as it does for any other
    // CV. Patch it into a pitch modulation input and the note scoops, glides or bends; leave it and
    // notes play at the pitch they started on, which is the ordinary case.
    { id: 'bendOut', name: 'Pitch bend', section: 'out', domain: 'control', dir: 'out', polarity: 'bipolar' },
    { id: 'levelOut', name: 'Level', section: 'out', domain: 'control', dir: 'out' },
    { id: 'durOut', name: 'Duration', section: 'out', domain: 'control', dir: 'out' },
    { id: 'panOut', name: 'Pan', section: 'out', domain: 'control', dir: 'out', polarity: 'bipolar' },
  ],
  params: [],
};
