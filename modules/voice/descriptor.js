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
// POLY AND ROLLOVER LIVE HERE, because the page is the voice and this module is its edge. POLY says
// how many copies of the page to run; ROLLOVER says what gives when a note arrives and none is free.
//
// The five rollover choices mean something at every count, which is why they are printed lamps rather
// than a list that changes. OLDEST at POLY 1 is simply retrigger, QUIETEST comes to the same, IGNORE
// is a drum machine that cannot be interrupted, GLIDE keeps one voice and moves its pitch, and LEGATO
// hands each note to the next voice while releasing the one before — the crossfade a wind instrument
// makes, which is why it wants two voices.

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
  worklets: ['modules/voice/voice-processor.js'],
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
  params: [
    // Detented: eight positions you can count by feel as well as read. Eight is a ceiling for CPU
    // rather than principle — the count multiplies every per-note module on the page.
    { id: 'poly', name: 'Poly', section: 'note', curve: 'detent', min: 1, max: 8, default: 1, glideMs: 0 },
    { id: 'rollover', name: 'Rollover', section: 'note', curve: 'stepped', default: 'oldest',
      steps: [{ value: 'oldest' }, { value: 'quietest' }, { value: 'ignore' }, { value: 'glide' },
        { value: 'legato' }] },
    // HOW LONG THE HAND-OVER TAKES, and it means the right thing in both modes because both are the
    // same question. In GLIDE it is the portamento time — how long the pitch takes to travel. In
    // LEGATO it is the overlap: how long the voice being left keeps sounding after the new one has
    // begun, which is the crossfade a wind instrument makes and the whole reason legato needs two
    // voices. Zero in either mode is an instant change, which is what the other three rollovers do.
    // TWO SECONDS AT THE TOP, not the half second a portamento wants. Long crossfades are how you hear
    // what this control does at all, and a range you cannot reach the end of teaches nothing.
    { id: 'time', name: 'Time', section: 'note', curve: 'linear', min: 0, max: 2, default: 0.06,
      unit: 's', glideMs: 0 },
  ],
};
