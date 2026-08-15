# Voices — how Sequence Out, Voice In and polyphony work

Written to be read by someone using the rack, not by someone building it. The design and its reasoning
are in `voice-pages.md`; this is what the two modules do and how to patch them.

## The idea in one paragraph

A page can be an instrument. Put a **Voice In** module on a page and that page becomes a voice: it
receives notes and plays them, and its POLY knob says how many copies of the page run at once. Put a
**Sequence Out** module on a page and that page sends notes. One cable carries a whole note between
them — pitch, how hard, how long, where, and how it moves while it sounds — so a page can be built
once and played many times over.

## Sequence Out — making notes

Five inputs are read at the moment a note starts, and two are followed while it sounds.

**GATE** is the note. Its rising edge creates one: at that exact sample everything else is read.
Nothing else on the module makes notes, so with no gate patched the other inputs are read by nobody.

**V/OCT** is the pitch, an ordinary 1V/oct signal, captured at that edge and held. Holding is what
makes a note a note — an unquantised source, or a sequencer's next step arriving early, must not drag
a sounding note around. Unpatched it reads zero, so notes play at whatever the oscillator's own
frequency knob says, which is a perfectly good way to drive drums.

**LEVEL** is velocity: how hard the note was struck.

**DUR** is how long it should last, in seconds — not beats, so a voice never needs to know the tempo.

**PAN** is where it sits in the stereo field, −1 left to +1 right.

Each of those last three has a knob behind it that supplies the value when nothing is patched, so a
bare gate still makes a complete note.

**PRESSURE** and **TIMBRE** are the two that keep moving: how hard the note is being played *now*, and
its brightness or colour. Leave them unpatched and a voice falls back to its own envelope; patch them
and the note is expressive for as long as it lasts.

### The two knobs that are not inputs

**GATE / HOLD** decides what ends a note. In GATE the note ends when your gate falls, and the duration
is a backstop that guarantees it ends even if nothing ever ends it. In HOLD the gate's fall is ignored
and the duration decides alone — which is what lets notes overlap, and therefore what lets a page play
a chord at all.

**BEND** sets how many semitones of pitch movement count as full deflection on the *control voltage*
bend output. It is detented in whole semitones and reads off a printed gauge. It has no effect on the
volts-per-octave bend output, which carries the pitch's real movement.

## Voice In — playing them

Every output is per voice. At POLY 4 with four notes sounding, four copies of the page each see their
own values; the jacks on the panel are the first copy's.

**GATE** is high for as long as the note should sound — a sustain gate, not a trigger pulse. Patch it
to a trigger input, which cares only about the edge, or to an envelope's gate, which cares about the
length.

**V/OCT** is the note's pitch, held for its life.

**BEND** is how far the pitch has moved since the note began, as −1 to 1 against the BEND range. It is
a modulation signal, orange, meant for an input with a depth trim.

**BEND V/OCT** is the same movement in volts per octave, green. Our modulation inputs sum in the
exponent, so patching this into one with its depth at unity reconstructs the source's pitch exactly:
held pitch plus this is where the source has gone. Unlike the control voltage it is not clamped by the
BEND range — the range describes the control signal, not the pitch.

**LEVEL**, **DUR** and **PAN** are the note's velocity, length and position.

**PRESSURE** and **TIMBRE** follow the source while the note sounds.

Voice In has no audio jacks. The page's sound leaves through a **Poly to Stereo**.

## Poly to Stereo — where the sound leaves

It is a gain and a panner, and it is per note, which is the whole reason it exists as its own module:
level and pan belong to a note, so they have to be applied to each copy before anything is summed. A
mixer channel's pan moves every voice at once; this one moves each voice separately.

**LEVEL A and LEVEL B multiply.** The panel prints a multiplication sign between them because that is
not guessable. Two amplitudes matter in a voice and they mean different things — the envelope, which
is the note's shape over time, and the velocity, which is how hard the note was struck and does not
change while it sounds. Patch the ADSR into one and Voice In's LEVEL into the other and you have the
product, which is what a polysynth does. They are A and B rather than named, because either takes
either, and pressure or a second envelope is just as valid in both.

Each knob is an offset, so with nothing patched and the knobs at the top the module passes audio
through untouched. Patch something in and turn that knob down to zero, and the stage follows the
cable.

**PAN sums.** Voice In's PAN puts each note where its source said, the knob offsets the whole page,
and anything else you sum in moves the voices while they sound. That last one is worth knowing: on a
page running eight copies, an LFO on the page is eight LFOs, each with its own phase, so an LFO
through an attenuverter into PAN sends the voices drifting independently rather than together.

**L and R are halves, not alternatives.** A voice panned right is quiet on L and absent from it, so
patching one of the pair gives you half a voice rather than a mono one. **MONO** is the sum taken
before the panning, which is what "one voice, one mixer channel, never mind where the notes sit"
actually needs. It is not L and R added back together: equal power is not meant to be undone by
addition, and doing so would leave a centred voice three decibels loud and a hard-panned one three
decibels quiet. The pan law is equal power, so a voice panned hard is no louder than one in the
middle.

Outputs fan out, so mono into a shared reverb and L and R dry to the mixer is a normal thing to do.
What you cannot do is put anything per note after a shared module: the eight copies are summed at
that module's input and cannot be told apart again. That is where the per-note world ends.

## Polyphony

**POLY** says how many copies of the page to run. The screen still shows one page — the template —
and every module on it marked *per note* is built that many times, wired exactly as you wired the
template. Turn a knob and every copy follows.

**Per note or shared** is a setting on each module, shown as a green lamp at the top right of its face:
lit with a tied pair of notes means one of these per voice, dark with a single note means one for the
whole page. Oscillators, filters, envelopes and VCAs are per note. A clock, a sequencer, or a reverb
you want the whole page to share is not.

**A shared module is where per-note ends.** Eight voices reaching one reverb are summed at its input,
and nothing after it can be separated again. That setting is really the question "where does this page
stop being eight things".

### ROLLOVER — what gives when no voice is free

**OLDEST** takes the voice that has been sounding longest, which is what almost every instrument does.

**QUIETEST** takes the one furthest into its decay, which is kinder on sustained material.

**IGNORE** drops the new note. At POLY 1 that is a drum machine: the pattern runs and cannot be
interrupted.

**GLIDE** uses one voice however high POLY is: the gate stays up and the pitch travels to each new note
over TIME. Portamento. Because it never restarts the note, a struck sound decays away under it — glide
wants a voice that sustains.

**LEGATO** alternates between two voices and no more. Each note takes the other one, and the voice
being left fades out while the new one fades in over TIME. That crossfade is what a wind instrument
does: changing the length of a vibrating column does not move the pitch, one resonance dies while the
next establishes, which is why a slurred line sounds nothing like a portamento. At POLY 1 there is no
pair to hand over to, so the notes simply butt: one ends exactly as the next begins.

**TIME** is the pitch's travel in GLIDE and the crossfade in LEGATO. It is greyed out under the other
three, and POLY is greyed under GLIDE, because in those positions they do nothing.

## Three ways a note's length reaches the sound

They are different, and they combine.

**The gate's length.** An envelope sustains for exactly as long as the gate is up, so this is the one
that behaves like a keyboard. GATE mode makes it your gate's length, HOLD mode the duration.

**The duration as a control voltage.** Voice In's DUR into an envelope's decay or release makes the
*shape* scale with the note: short notes get short envelopes rather than the same envelope cut off.
Nothing else in the rack can do this, because nothing else knows how long the note was meant to be.

**The voice's own envelope**, like the Macro Oscillator's DECAY, which ignores note length entirely —
it strikes on the edge and rings for as long as it rings.

## A worked patch: an ADSR voice

On a voice page, with Voice In on it:

- Voice In **GATE** → the ADSR's gate
- the ADSR's envelope out → a **VCA**'s level
- an oscillator → that VCA's audio in
- Voice In **V/OCT** → the oscillator's 1V/oct
- Voice In **BEND V/OCT** → the oscillator's FM input, depth at unity, if you want the source's
  expression to reach the pitch exactly
- the VCA's out → a **Poly to Stereo**'s audio in — or skip the VCA and patch the ADSR into one of
  its level inputs, which is the same thing with one module fewer
- Voice In **LEVEL** → its other level input, so velocity is in the sound
- Voice In **PAN** → its **PAN**
- its **L** and **R** → two mixer channels, or **MONO** → one

Then check the poly lamps: the oscillator, the ADSR and the Poly to Stereo must all be per note, or four voices
share one envelope and the chord has a single amplitude.

## Pages, and what they are called

A page holding **Voice In** alone is named Voice 1, 2, 3; one holding **Sequence Out** alone is SEQ 1,
2, 3. The name is derived from what the page holds, not from what you last did to it, so deleting a
module renames the page back. A name you type yourself is never overwritten.

A page may hold **one of each** — a sequencer feeding the voice beside it — which is the smallest
complete instrument there is and useful for testing. Such a page has no note port on its tab: nothing
crosses the boundary of a page that makes its own notes and plays them, so the cable simply runs from
one module to the other. Two of the same kind are refused, because a page with two voices cannot say
which of them a note is for.
