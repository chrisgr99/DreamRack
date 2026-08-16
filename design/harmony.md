# Harmony — chord changes, the arpeggiator and the melody

Three modules, one copied library, and no new cable. **Chord Changes** holds a progression and plays it
against the rack's clock. An **Arpeggiator** turns chords into notes with a pattern, a shape and a
feel. A **Melody** invents a line over the same chords, and its bass is a role rather than a fourth
module. Between them runs the note cable that already exists — one module's output fanning out to both.

The point of the set is that the sequencer we have is too blunt to make music with. It steps through
voltages; it has no idea what a chord is, cannot change key, cannot hold a progression, and gives no
way to vary velocity and length per note. This gives the rack harmony, and gives polyphony something
worth playing.

## 1. A chord is not a new domain

**A chord is several notes at one instant, and the note cable already carries that.** Every note-on
carries the sample it begins on, and Voice In's allocator is built to take several at once — that is
what polyphony is. So a chord needs no burst, no packing and no seventh cable colour: it is three or
four note-ons sharing a timestamp.

Three things follow, and all of them are good:

**The Arpeggiator is a note processor** — notes in, notes out. It takes a chord and re-emits it as a
pattern, which is exactly what an arpeggiator is.

**A Chord Changes plugged straight into a Voice In plays block chords**, with no arpeggiator in the patch and
nothing extra to build.

**Anything that makes notes can feed it.** A Sequence Out, an external interface module, a second
Chord Changes: if it speaks the note cable, the Arpeggiator will arpeggiate it.

### What the notes carry, and what they cannot

Almost everything the far end needs is in the pitches themselves.

- **Order, octave range, rate**: sorting and adding volts.
- **Voice leading**: this needs only the pitch sets. An inversion is an octave shift of a member, so
  choosing the voicing nearest the chord before it is arithmetic on notes already in hand.
- **Chord tones** for a melody or a bass line: the set *is* the chord tones.
- **A name for the display**: inferable from the intervals for anything common.

Two things a bare pitch set cannot say:

**Which note is the root.** D–F–A–C is Dm7 or F6 depending on what you meant. Carried by CONVENTION
rather than by a new cable — see below.

**The key or the scale.** Nothing in a set of pitches says whether this is F major or D minor. It only
matters for notes the far end INVENTS — passing tones, added tensions — and Chord Changes avoids the
question by sending every note it wants heard. If that stops being enough, the note transport already
carries tagged messages (`{t:'u', handle, k, v}` for bend, pressure and timbre), and a key or chord
symbol rides the same cable as one more tag. A small extension to a protocol that exists beats a
seventh domain with its own colour, its own rules and its own line in every connection test.

### The conventions on the wire

A chord is:

- **Note-ons sharing one `time`.** Simultaneous, not a burst.
- **Root lowest, close position.** Position carries the root, so the far end can trust it.
- **In a canonical octave** — root between C3 and B3 — so an arpeggiator spreading two octaves upward
  stays in a sane range and a listener has a predictable starting point.
- **Duration is how long the chord lasts.** The block-chord case then ends by itself, with no note-off
  needed from the source and no held chord when a patch stops.
- **Level marks emphasis** — the downbeat louder than the rest, if Chord Changes is asked to.

A module that ignores all of this still works: it receives four notes and plays them.

### The key travels too

An iReal Pro chart names its key, so Chord Changes knows it and the Melody would otherwise have to guess.
It goes down the same cable.

Not as a tagged update, though: every tag today names a note handle — bend, pressure, timbre all belong
to a note that is sounding. A key belongs to the STREAM. So it is a message kind of its own,
`{t:'key', tonic, mode, time}`, sent when a chart loads, when it is transposed, and at a modulation
inside a chart.

That forces a rule the protocol should have had from the start: **a receiver ignores message kinds it
does not know.** Voice In must skip a key message without blinking, and today's queue has to be checked
for that. It is what lets this protocol grow later without breaking the modules already written.

**The key is a starting point, not an instruction.** A melody really infers its centre from the changes
— the key tells it where to begin and settles the ambiguous cases. So the Melody module takes it as a
default that its own setting overrides.

### A note output must fan out — and today it does not

One Chord Changes feeds an Arpeggiator AND a Melody from the same jack. Every other cable in the rack fans out
already, because a Web Audio connection does. The note cable is the exception: the sending worklet
holds ONE port (`this._out`), so a second note cable from the same output silently replaces the first
— the Arpeggiator goes quiet the moment you patch the Melody, with nothing on screen to say why.

So the transport learns a list: `attachNoteOut(port, edgeId)` adds, `detachNoteOut(edgeId)` removes,
and a note is posted to each. The cost is one structured clone of a small object per destination —
against the 0.8µs a note message was measured at, nothing.

This is a defect in its own right rather than a feature of this work, and it is the first thing to fix
because everything else here assumes it.

## 2. Chord Changes

**The module is CHORD CHANGES; a chart is what it loads.** The name is what a musician calls the thing
and what an iReal Pro file contains, so the module, the file and the words you would use out loud all
agree. The window shows the chart; the panel shows where you are in the changes.

Holds the progression, follows the clock, and shows where it is.

### The controls

**Jacks.** CLOCK in advances the beat and RESET in returns to bar one — the module never owns a tempo,
because a rack has one clock. RUN in is a gate: high plays, low holds where it is, and unpatched plays,
by the same "unconnected is not zero" rule the Arpeggiator's gate uses.

Out: NOTE, the chord itself. ROOT as 1V/oct, so anything can follow the harmony without understanding
it. CHORD, a trigger on every change. BAR, a trigger on every bar line. Those last three are what let
an ordinary patch respond to the changes — a filter opening on each chord, a fill on the bar.

**LOAD**, a button, opens the file dialog — and it belongs ON THE FACEPLATE, not in the app's File
menu. The rack does not load chord charts; this module does, into its own list, the way a sampler owns
its samples. The typed form of a progression — `Dm7 | G7 | Cmaj7 | %` — is a text param behind the
same list, so a patch with three bars typed into it saves and reloads with no file anywhere.

**TUNE**, a readout that names the loaded chart and opens the module's own list when you scroll it.

**PLAY**, a readout showing what is selected to play — `A ×2`, `bars 9–16`, `whole tune` — and scrolling
it steps through the chart's sections, so the common case never needs the window open. The selection
itself is MADE in the window, by pointing at the chart: see below.

**REPEATS**, a detented knob: how many passes of the selection before it stops, or endless at the top.
The repeats written into the tune are already unfolded by the navigation expansion, so this one is
about how many times you play the thing you chose.

**KEY** and **MODE** — a knob printed with the twelve tonics, spelled as enharmonic pairs the way
GeoSonix spells them (C♯/D♭, not one or the other), and a major/minor lamp pair. The chart
carries its own key when one is loaded, and this is what it is set to.

**TRANSPOSE**, detented in semitones, minus twelve to plus twelve. Separate from the key because
transposing a tune and changing what key it is written in are different acts: the Roman numerals stay
put while the letters move.

**OCTAVE**, detented, where the canonical root sits. Default C3, the octave the note conventions name.

**VOICING** — close, spread, drop-2, shell — as a lamp column. Shell (root, third, seventh) is worth
having because it is what a pianist plays behind a soloist and it leaves room for a melody.

**LENGTH**, a knob from a stab to the full span of the chord, deciding how much of its own time a
chord actually sounds for. At the top, one chord runs into the next; at the bottom you get punctuation.

**ACCENT**, how much louder the downbeat is than the rest — the level lane of the note carries it.

**LOOP**, a lamp: round again at the end, or stop.

**NOTATION**, a lamp pair: the display names chords as letters or as Roman numerals.

**Fourteen HP.** The display and the twelve-position key knob decide it; everything else fits around
them.

### What you look at

Two surfaces, because a chart is too big for a faceplate and a faceplate is what you have when the
chart is put away.

**On the panel**: the chord playing now, the bar and beat, and the chord coming next. The symbol reads
either as a chord — Dm7 — or as a Roman numeral — ii7 — switched by a lamp pair, and both renderings
already exist in the GeoSonix code. Roman is the one that teaches you what the tune is doing; letters
are the one you play from.

**In a window**: the whole chart, laid out in bars with the current one marked as it plays. It follows
the pattern the scopes, monitors and the video output already use — a floating pane placed by the same
free-space search, opened and closed from the module, with its position and open state saved in the
patch. `harmonyChartLayout.js` in GeoSonix already lays a chart out in rows of bars.

**AND THE WINDOW IS WHERE YOU CHOOSE WHAT TO PLAY.** Knowing that a tune has a section called B does not
tell you what is in it, so picking a section from a list on a faceplate is choosing blind. Point at the
chart instead: click a section header to take its bars, or drag across bars to take a range the chart
never named — the last four of the bridge into the top of the head, which is the thing you actually
want to loop while you work on a sound.

**So the selection is a BAR RANGE with a repeat count, and sections are the fast way to set one.** That
is more general than a section picker and no harder to use, because the chart is in front of you. Most
of the time it will be the head rather than the whole tune from front to back.

### The playhead

**It plays with the chart open, and you watch the playhead step across the chords.** This is most of
why the window is worth building: a progression you can see moving is a progression you can learn from,
and it is how you find the bar you want to loop.

**ONE TIMELINE DRIVES BOTH.** GeoSonix already works this way — `harmonyPlayer.js` builds the chord
spans in beats and the chart cursor runs on the same structure the sound does, so the highlight cannot
drift from what you hear. Lift that whole: the chart becomes a list of spans at load time, the worklet
steps it on clock edges, and the window highlights the span the worklet says it is in. Nothing is
synchronised, because there is only one thing.

**Position is posted on CHANGE, not per frame.** The worklet sends bar, beat and span index when it
moves to a new chord — a handful of messages a bar, against sixty frames a second of asking. The window
moves the highlight and scrolls if the current bar has gone out of view.

**With the engine off the playhead holds where it stopped**, the same as a scope holding its last
trace. Honest, and it costs nothing.

**Clicking a bar while it plays moves the playhead there.** A chart you can steer is worth having: you
hear a turnaround go past, you click it, and it plays from there without stopping.

Closing the window loses nothing: the panel goes on naming the chord under the playhead, and PLAY goes
on saying which bars are running.

### Copied, not shared

The harmony code is COPIED into this project rather than shared with GeoSonix. Sharing would mean one
fix serving both, at the cost of coupling two projects with different release rhythms — worth paying
only while the code is still moving. It is not: those five files took thirteen commits in the last
ninety days and none in the last thirty, and were last touched at the end of June. A settled library
is one to copy.

### Where the chart comes from

Typed in at first — a few chords, entered as symbols — and then **iReal Pro import**, which is where
the GeoSonix work pays off. `src/irealChord.js`, `harmonyModel.js`, `harmonyNavigation.js`,
`harmonyMap.js` and `harmonyMelody.js` in GXW are about 1,600 lines of pure JavaScript with no DOM and
no Node built-ins, which means they import here unchanged: the chord parser, the Roman-numeral model
stored relative to the key, and the navigation expansion that unfolds segno, coda, D.C., D.S. and Fine
into the actual played length.

**The parser runs on the main thread, at load time, and never in the audio thread.** It turns a chart
into a flat list of bars, each with its chords and their beat positions; the worklet holds that array
and steps through it on clock edges. Harmony is decided when a chart is loaded or transposed, not
while it plays — so none of that code has to be real-time safe, and the audio thread does nothing more
than look up an entry and post note-ons.

## 3. Arpeggiator

Notes in, notes out, and the musicality lives here.

**What it holds.** The chord currently sounding — the set of pitches it last received, replaced
whenever a new chord arrives. Notes with a duration expire on their own; a chord that arrives while
the last is still held replaces it.

**Pattern.** Up, down, up-down, down-up, as-played, converging, random, random-without-repeats — and
two that are not arpeggios at all. **CHORD** plays every note of the chord on each step, which is
comping: the harmony struck on a rhythm, with the accents, velocity variation and humanise below. It is
better than Chord Changes' own block chords for anything but a pad, and it costs a line of code. **STRUM**
is the same notes a few milliseconds apart, up or down, with the spread as a control — and because the
transport places notes by sample, the strum is exact rather than approximated. Nothing makes a static
chord sound played faster.

Octave range on top of all of that: one to four, added above or spread either side.

**Rate.** A clock division rather than a time — the rack has a clock and there should be one tempo in
a patch. Triplet and dotted divisions included, because a straight arpeggio at one division is the
sound everybody is tired of.

**Feel, which is the part that decides whether this sounds played or generated.** Gate length as a
fraction of the step. An accent pattern over the step count, so velocity moves. Velocity range and
randomness on top of the accent. Duration variation. Timing humanise, in milliseconds, applied to the
note's own timestamp — the transport places notes by sample, so a few milliseconds of push and pull is
exact rather than approximate. Pan spread across the arpeggio, which per-note pan turns into an
arpeggio that moves across the stereo field as it climbs.

**A gate input**, so a pattern can be played rather than only free-running. Three rules come with it.
UNPATCHED MEANS RUNNING — the worklet can tell an unconnected input from one sitting at zero, so a
module out of the box plays; a small lamp shows that it thinks it should be. A rising gate RESTARTS the
pattern or CONTINUES it, switchable, because a figure that always begins on its first note and a
pattern that seems to keep turning underneath are both wanted. A falling gate CUTS the sounding note:
tighter, and anything wanting a tail has an envelope.

**HOLD or FOLLOW, rather than a latch button.** Chord notes carry a duration and expire by themselves,
so "the source went quiet" happens routinely — which makes latch the wrong frame. The question is
which rule the module lives by. HOLD: the current chord is whatever last arrived and stays current
until something replaces it, which is what a chart wants, and which IS latch, permanently. FOLLOW:
durations and note-offs end the chord and the arpeggio stops until the next one, which gives silence
between chords as a rhythmic device and is what a keyboard would want. HOLD is the default.

**Voice leading**, as an option: hold common tones, and pick the inversion nearest the chord before.
On pitch sets this is a small calculation, and it is the difference between a progression that lurches
and one that walks.

**Outputs.** The note cable, which plays a polyphonic tab through one cord. And plain 1V/oct, gate,
velocity and duration jacks beside it, for driving an ordinary monophonic patch with no voice tab at
all — an arpeggio is the one polyphonic idea that is usually played by one voice.

## 4. Melody — and the bass is one of its roles

The same chords, a key, and a line out. Separate from the Arpeggiator for a reason that is structural
rather than tidy: **a melody needs the scale and an arpeggio does not.** The Arpeggiator only ever
plays notes it was handed, so pitches are enough. A melody INVENTS notes — passing tones, approaches,
a line walking between chord tones — and that needs the key, which the note cable deliberately does
not carry. The Melody module therefore takes the key from the cable when Chord Changes sends
one, and owns a key and scale setting of its own that overrides it — which is also what you need when
nothing upstream knows the key at all.

The control surfaces barely overlap either. Phrase length, rest density, contour, the balance of steps
against leaps, which chord tone to land on when the harmony changes, motif memory — none of it means
anything to an arpeggiator, and it would swamp the six controls that do.

**ROLE decides register and pull, not a separate module.** MELODY sits above, free to leap and to rest.
BASS sits below, strongly pulled to the root, with a walking option that approaches the next chord's
root by step. COUNTER sits between, moving against whatever else is playing. Same machinery throughout;
`harmonyMelody.js` from GeoSonix is the head start.

They are meant to run together, which is what the rack is for: one Chord Changes, its note output fanning out
to an Arpeggiator on one voice tab and a Melody on another, sharing the harmony, each with its own
sound.

## 5. Variation, so none of it becomes wallpaper

**Randomness is not the cure for repetitiveness — structure is.** Pure randomness is monotonous in its
own way: everything is equally surprising, so nothing is a reference and nothing is a return. What
these modules need is a phrase you recognise, coming back changed.

**Déjà vu, and it is already in the rack.** The Random Sampler's best idea is one knob running from
"reshuffle every time" through "a loop that drifts" to "locked", with a loop length beside it. Both
modules take the same control under the same name: on the Arpeggiator it varies the pattern, on the
Melody the line. Reusing the name is the design-language argument — knowledge carries from one module
to the next — and it is a better answer to "don't be repetitive" than any amount of noise.

**Smooth noise for anything continuous.** Melodic contour above all: a wandering value sampled once per
step and quantised to the notes available gives lines that rise and fall in shapes, where white noise
gives a line that jumps about and reads as broken. Two controls each — how far it wanders, how fast.
The same for velocity drift across a phrase, density across a section, pan movement. Perlin or plain
smoothed value noise; they are the same idea and the second is simpler.

**White noise only for micro-timing.** Humanise wants to be uncorrelated and zero-mean: a player is
late by an unrelated amount each time, not smoothly late for four bars.

**A seed per module, saved in the patch.** Unseeded, a patch you reopen is a different tune, a demo
recorded twice is two performances, and a bug you hear once you can never hear again. Seeded with a
"new seed" button, it is reproducible by default and fresh when you ask.

**CV on the chance controls**, so the Random Sampler, an envelope or Chord Changes' own bar trigger can
drive how much variation there is. A line that grows freer through a section and settles at the
turnaround should be one cable.

The Arpeggiator needs less of this than the Melody — pattern, octave and gate length already give it
shape, so déjà vu, velocity drift and humanise are enough. The contour noise and the phrase memory earn
their place in the Melody.

## 6. What this changes elsewhere

**A second place notes are born.** `voice-pages.md` says bundling happens only in Sequence Out. That
becomes: bundling happens in the modules that own it — Sequence Out, Chord Changes, the Arpeggiator, and
the external interface module when it arrives. The rule that mattered was never "only one module", it
was "not in general patching", and that stands.

**A note INPUT on something that is not Voice In.** Still note-to-note, so the domain rule is
untouched. But the tab logic decides what a tab IS by looking for note sources and sinks, and an
Arpeggiator is neither a voice nor a sequencer — the boundary map must go on ignoring it, or tabs will
start renaming themselves for a module that is only passing through.

**Nothing in the cable's look changes.** A chord is still notes, so it still flashes when one starts,
and a chord flashes harder than a single note, which is correct.

## 7. Build order

0. **Note outputs fan out.** A transport fix, and everything else assumes it.
1. **Chords sounding.** The harmony library copied in, and Chord Changes with a progression typed in,
   playing block chords into a voice tab. Enough to hear harmony in the rack at all.
2. **The Arpeggiator** — patterns, clock division, gate, and the feel controls. This is the one that
   decides whether any of it is worth continuing, and it does not depend on chart loading.
3. **Charts loaded.** iReal Pro import, navigation expansion, key and transpose, the display.
4. **Melody**, with its three roles, and the variation vocabulary in both modules.

## 8. Open

Nothing. The chord SYMBOL stays off the cable: it is displayed on the module that knows it, which sits
in the rack beside everything else, and no downstream module has a reason to name a chord it is
playing.
