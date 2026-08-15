// descriptor.js — Poly to Stereo. Where a page's voices become a signal a mixer can take.
//
// THE NAME IS THE CONVERSION, because that is what you see: a page running eight voices, one module,
// and a stereo pair leaving it for a mixer that knows nothing about polyphony. Per copy it is a
// channel strip — two gain stages and a pan — and eight strips arriving at one destination is a
// mixdown in everything but the fader caps.
//
// This was inside Voice In, and it should not have been. Voice In turns an event into voltages, which
// is one clear idea; scaling and placing the page's audio was a second idea bolted on — eight hidden
// per-copy audio inputs, an internal sum and a pan law buried in the allocator. Out here it stops
// being special: this is an ORDINARY PER-NOTE MODULE, and the summing across copies is the rack
// rule that already exists (per note into shared sums, host/rack.js). Patch it at a mixer channel and
// eight voices arrive summed, exactly as eight of anything else would.
//
// TWO LEVEL INPUTS, MULTIPLIED. A voice has two amplitudes that mean different things: the envelope,
// which is the note's shape over time, and the velocity, which is how hard it was struck — one number
// for the whole note. Their product is what every polysynth computes, and with a single level input
// you would need a separate VCA to compute it, which is the module we just deleted coming back. So
// the multiply lives here and the faceplate prints the sign between them.
//
// Each is a knAck: the CV arrives in the knob, and the knob is the OFFSET. Nothing patched and the
// knob at the top is unity, so a freshly placed module passes audio through untouched; patch an
// envelope, turn the knob down, and the stage follows the envelope. Which of the two takes which is
// not fixed — multiplication is symmetric, so they are A and B and the panel says nothing more.
//
// PAN SUMS RATHER THAN REPLACES, which is the whole reason it is a knAck too. Voice In's PAN into the
// jack puts each note where its source said; the knob then offsets the page as a whole, and anything
// else summed in — an LFO, a slew of the pan lane — moves the voices while they sound. On a per-note
// page that LFO is eight LFOs, each with its own phase, which is the swarm effect for the cost of one
// cable and no worklet at all.

'use strict';

export default {
  apiVersion: 1,
  // THE ID IS NOT THE NAME and does not follow it: an id is what saved patches carry, so changing
  // one costs the user their patch. Same rule as Voice In.
  id: 'wcoast.note-amp',
  name: 'Poly to Stereo',
  abbreviation: 'P2S',
  category: 'processor',
  // PER NOTE, AND NOTHING ELSE — so it carries no per-note lamp (perNoteFixed). It is the last
  // per-note thing on a page: whatever it feeds is shared, and the copies are summed at that input.
  // Made shared it would sum the voices before each one's level and pan had been applied, which is the
  // one thing it exists to prevent, so the choice has only ever had one right answer.
  scope: 'voice',
  perNoteFixed: true,
  hp: 8,
  worklets: ['modules/poly-to-stereo/poly-to-stereo-processor.js'],
  menuSectionOrder: ['io', 'out'],
  ports: [
    { id: 'audioIn', name: 'In', section: 'io', domain: 'audio', dir: 'in' },
    { id: 'levelACv', name: 'Level A', section: 'io', domain: 'control', dir: 'in',
      target: 'levelA', via: 'levelADepth' },
    { id: 'levelBCv', name: 'Level B', section: 'io', domain: 'control', dir: 'in',
      target: 'levelB', via: 'levelBDepth' },
    { id: 'panCv', name: 'Pan', section: 'io', domain: 'control', dir: 'in',
      target: 'pan', via: 'panDepth' },
    // L and R are HALVES, not alternatives: a voice panned right is quiet on L and absent from it, so
    // patching one of the pair gives you half a voice rather than a mono one.
    { id: 'outL', name: 'Left', section: 'out', domain: 'audio', dir: 'out' },
    { id: 'outR', name: 'Right', section: 'out', domain: 'audio', dir: 'out' },
    // THE SUM TAKEN BEFORE THE PANNING — not L and R added back together, which would leave a centred
    // voice three decibels loud and a hard-panned one three decibels quiet, since equal power is not
    // meant to be undone by addition. This is the jack for "one voice, one mixer channel".
    { id: 'outMono', name: 'Mono', section: 'out', domain: 'audio', dir: 'out' },
  ],
  params: [
    // Unity at the top and unity by default: a module you have just placed passes audio.
    { id: 'levelA', signal: 'audio', name: 'Level A', section: 'io', curve: 'linear',
      min: 0, max: 1, default: 1, glideMs: 8 },
    { id: 'levelADepth', name: 'Level A CV depth', section: 'io', curve: 'linear',
      min: -1, max: 1, default: 1, glideMs: 10 },
    { id: 'levelB', signal: 'audio', name: 'Level B', section: 'io', curve: 'linear',
      min: 0, max: 1, default: 1, glideMs: 8 },
    { id: 'levelBDepth', name: 'Level B CV depth', section: 'io', curve: 'linear',
      min: -1, max: 1, default: 1, glideMs: 10 },
    // Bipolar, so the jack takes the dot: hard left to hard right, centre at zero.
    { id: 'pan', name: 'Pan', section: 'io', curve: 'linear', min: -1, max: 1, default: 0, glideMs: 8 },
    { id: 'panDepth', name: 'Pan CV depth', section: 'io', curve: 'linear',
      min: -1, max: 1, default: 1, glideMs: 10 },
  ],
};
