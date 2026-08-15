# Voice pages — specification

A page becomes a voice by containing a **Voice In** module, and a source of notes by containing a
**Sequence Out** module. Everything else follows from that one sentence: what the tab is called, what
crosses its boundary, how many copies of the page run, and where an external sequencer plugs in.

This extends `tabs.md`, which describes pages and the ports they carry, and `control-protocol.md`,
which describes how an outside sender plays the rack. It supersedes two things in `tabs.md`, noted
in §9.

## 1. Two modules, and what they decide

**Voice In** makes its page a voice. **Sequence Out** makes its page a source of notes. The names say
which way the notes run, which is what someone reading an unfamiliar patch needs first. Both are singletons: one per page, and a page may not hold both.

Refusing the combination is deliberate. The point of the scheme is that someone opening a patch they
did not build can read the tab bar and know the shape of the whole thing. That only works if a page
is one thing. A self-contained instrument is therefore two pages — a sequencer feeding a voice —
with the relationship visible in the bar rather than hidden inside a page.

Neither module is a page *type*. There is no setting anywhere that says what a page is; the module
on it is the whole of the answer, and it is visible.

### Naming

The letter remains a page's identity, as in `tabs.md`. Adding a Voice In module sets the page's
nickname to **Voice 1**, the next to Voice 2; a Sequence Out module sets **Sequencer 1**. A nickname
you have already chosen is never overwritten — a page called Bass stays Bass.

Deleting the module leaves the nickname alone and takes the boundary away. Renaming a page out from
under someone because they deleted a module is worse than a stale name.

The names are chosen to teach. Most players will not have met a rack where a page is a voice, and a
tab bar reading Sequencer 1, Voice 1, Voice 2 explains the idea before any documentation does.

## 2. What the modules do, and what they do not

**The two modules bundle and unbundle. That is their entire job.**

Sequence Out takes a gate and separate pitch, level, duration and pan signals from the page and makes
one note out of them. Voice In takes a note in and gives those back as ordinary jacks inside the page.

They do not carry anything else. A filter sweep running from a sequencer page to a voice page is an
ordinary control cable crossing a tab, exactly as `tabs.md` already describes, and neither module is
involved. So the modules have a fixed set of jacks and never change shape.

This also settles a claim that would otherwise be tempting: a page's boundary ports are **not** all
one direction. A voice page sends audio to the mixer, so it has outputs as well as inputs. The
narrower rule is the true one — **a note bundle enters a voice and leaves a sequencer**, and every
other domain crosses tabs as it does now.

## 3. The note domain

A note is its own domain, with its own cable colour, alongside audio, control, trigger, luma and rgb.

**A note bundle is created in exactly one place and opened in exactly one place.** Sequence Out is the
only thing in the rack that produces one; Voice In is the only thing that opens one. Nothing else bundles or unbundles.

That single rule does more work than it looks. It keeps the note domain from leaking into general
patching, and it enforces the encapsulation in §1 without a placement rule anywhere: put a note
source on a voice page and its output has nowhere legal to land, so the cable is simply refused, the
way rgb into a luma input is refused today. No new machinery, no error message to write, and nothing
invisible.

### How it looks

The rack's hues are spent: audio yellow, control orange, trigger light blue, pitch green, luma
off-white, rgb magenta. Everything left over is adjacent to one of those, so **the note cable is not
a hue at all.**

- **It is neutral** — grey on the dark faces, near-black on the light ones — and the same width as
  every other cable. Being the only cable without a hue is a stronger distinction than any remaining
  colour could be, and it works at any zoom and for any kind of colour vision.

  It was drawn heavier at first, which was physically honest and practically wrong: the reshape
  handle is sized as a multiple of a cable's width, so on the widest cable in the rack it swallowed
  the grab that unplugs it and the two could not be separated under the pointer.
- **It is the only cable that changes with the theme**, because its job is to stay legible against
  whatever it crosses rather than to name a domain.
- **The jack has two concentric rings, at the ordinary jack size.** The ring is greyscale, and the
  unpatched jack art is already a neutral mid-grey, so lightness alone would be the weakest signal
  in the rack. A second ring costs no space and settles it. Making the jack larger would cost space
  on a crowded faceplate for nothing the ring does not already do.
- **The cable brightens on each note and decays over a couple of hundred milliseconds.** It is the
  only cable carrying events rather than a continuous signal, and this is what says so — one note is
  a blink, a chord is a stronger one, a dense passage is a cable that stays lit.

  Brightness rather than a pulse travelling along the cable, because the cable is polyphonic. Several
  notes at once would put several pulses on one cable at different offsets, which reads as flicker
  and gets worse exactly when the music gets interesting. Overlapping brightness adds up instead of
  colliding, and needs no position along the cable to mean anything.

### A note cable carries events, not samples

A note edge is a **logical edge**, like a video edge: the rack records it and forwards messages along
it, and no Web Audio connection is made. Sequence Out emits note events; Voice In receives them and
turns each into control voltages inside itself, one set per allocated copy.

**Three reasons, and any one of them would be enough.**

**A note cannot be ended early otherwise.** A gate carried as a signal can stop, but the note it
belonged to cannot be named — so a source can never say "end that one and leave the other two
ringing". With a handle on every note it can, and duration goes back to being the failsafe it was
designed as rather than the only way a note can end. This is why `control-protocol.md` was built on
handles in the first place.

**Channels run out.** Seven lanes per note carried as channels means fifty-six channels for eight
voices, and a browser caps a node at thirty-two. That ceiling arrives at four voices, and trimming
lanes buys one or two more. An event stream has no ceiling at any voice count.

**It collapses two protocols into one.** `control-protocol.md` already specifies note-on with a
handle and a mandatory duration, note-off by handle, and note-modify for per-note expression — for an
external sender. If Sequence Out speaks the same thing, the MIDI or Strudel interface stops being a
translator and becomes a source like any other (§7).

### What a note carries

**Set when the note starts**, and unchanging for its life:

- **pitch** — a 1V/oct value, and see below.
- **level** — the note's velocity: how hard it was played, and see below.
- **duration** — how long, and see §4.
- **pan** — where in the stereo field. Per-note position is genuinely musical: struck notes
  scattered across the field, or a phrase that walks.
- **handle** — what names this note so a later message can refer to it. Minted by Sequence Out, which
  is the note's creator, in the form `control-protocol.md` describes.

**Sent as tagged updates while the note sounds**, each carrying the handle of the note it belongs to:

- **bend** — how far the pitch has moved since the note started, as −1 to 1 against a bend range.
- **pressure** — how hard the note is being played now: breath for a wind voice, bow force for a
  string one. Distinct from level, which is how hard it was struck.
- **timbre** — brightness, vowel, position along the string. MPE's third per-note dimension, sent by
  every expressive controller and expected by every expressive instrument, which is why it is named
  rather than left to a general-purpose lane.

This is the line MPE draws between a note's start and its ongoing expression, drawn here on purpose
rather than arrived at later.

### Updates, and how they become a voltage again

Measured rather than assumed: eight voices with bend and pressure both moving is six thousand updates
a second, which costs about **half a percent of one core** sent as individual messages, and 0.035%
batched into a typed array per block. The form can be chosen for clarity; the traffic is not the
constraint. **Timing is.**

**Sent on change, not on a clock.** A control that is not moving sends nothing at all. Most of them
are still most of the time, so this is the largest saving available and it costs no fidelity.

**Once per audio block when they are moving** — about three milliseconds, finer than breath or a bend
wheel needs.

**Linearly interpolated at the receiver**, each update ramping to its value over one interval and
arriving as the next one does. That removes the steps completely, and unlike a filter it attenuates
nothing and lags nothing beyond the one interval.

**Not smoothed with a low-pass**, which is the tempting answer and the wrong one: a filter cannot tell
a step it should remove from a transient it should keep. Tonguing a note is a five to ten millisecond
dip in pressure, and a filter slow enough to smooth three-millisecond steps is fast enough to blunt
it.

**The edge runs worklet to worklet, never through the main thread.** The rack makes the connection —
it owns the cable — but it does so by handing each end a port of a `MessageChannel`, and the events
themselves never touch the main thread. Main-thread scheduling jitter under load is measured in
milliseconds, and every one of them would land on a note's timing.

**And a receiver defers by one block and places each event by its timestamp.** A gate edge at sample
*i* cannot be known before its block has been processed, so an event transport is late by however far
into the block the edge fell — nothing to 2.7 ms, and *variable*, which smears rhythm rather than
delaying it. Deferring by exactly one block turns that jitter into constant latency, which is
inaudible. It is why every message carries the sample it happened on.

An update **may carry a rate of change** as well as a value, letting the receiver fit a curve rather
than a chord between points. At three milliseconds it buys nothing measurable — linear error is
already below anything audible — so it is an optional field rather than a required one. It earns its
place only if updates are ever thinned to ten or twenty milliseconds, where a chord across a curve
starts to show. Carrying the field in the message costs nothing today and saves a format change then.

### What may ride, and what may not

**The test is whether the value belongs to a note.** Pitch, level, duration, pan, bend and pressure
do: every sounding note has its own. Anything that belongs to the page instead — transport, tempo, a
macro, a pedal — is the same for all eight voices, and putting it here would make the note cable mean
two things and carry the second one eight times over.

**So tempo and transport are not in the bundle.** They cross a tab as an ordinary trigger or control
cable, exactly as a filter sweep from a sequencer page to a voice page already does (§2). A voice
never needs the tempo to play a note correctly, because **duration is in seconds rather than beats** —
it needs a clock only to sync something of its own, and that something wants a clock cable it can
divide.

**Per-note controls beyond these two are open-ended.** An update carries the **name** of what it
moves, not one of a fixed pair, so bend and pressure are two well-known names rather than the whole
vocabulary. `control-protocol.md` already names controls this way for an external sender, so the two
agree, and allowing it costs one field.

What it defers is the receiving end: Voice In's jacks come from its descriptor, so a name nobody
anticipated has nowhere to come out. The answer when someone needs one is a few generic outputs that
take on whatever names arrive, with a readout saying which is which — the shape a MIDI controller
mapper has. Worth designing then; worth allowing for now.

### Pitch is a voltage, not a note number

Pitch is the same 1V/oct value every oscillator in the rack already takes, so the
Voice module's pitch output patches straight into one with nothing converting anything. A note
number would make microtonal music, glissando and any drifting or unquantised source into special
cases, which is the wrong way round: those are ordinary here.

Where a sender speaks in note numbers — MIDI does — the conversion happens once, at the module where
that sender enters the rack (§7). The bundle never knows MIDI exists.

**Pitch is on the wire twice: the value the note started on, and how far it has moved since.** The
held value is captured at note-on and does not move again, because holding is what makes a note a note
— a source whose pitch keeps moving after the gate, an unquantised drift or a sequencer's next step
arriving early, must not drag a sounding note around with it.

The second is **bend**: a deviation, not an absolute pitch. That is what a wheel, a wind
controller and MPE all produce, so it behaves the way anyone who has played one expects. It is also
what suits where it lands — bend is patched into a modulation input, and by the knАck convention
every one of those carries a depth trim, so **how far a bend bends is a knob that already exists on
the module being played**. An absolute value would instead have to be summed with the held pitch, and
an input here takes one cable, so that sum would mean an adder module in every gliding patch.

**Bend leaves on two jacks, and they are not two views of one number.**

The **control voltage** runs −1 to 1 like every other modulation signal here, scaled by Sequence Out's
**bend range** — how many semitones count as full deflection — and clamped there, as a wheel at its
stop is.

The **volts per octave** output carries the pitch's real movement, unscaled and unclamped. Our
modulation inputs sum in the exponent, so patching it into one with the depth at unity reconstructs
the source's pitch exactly rather than approximately: held pitch plus this is where the source has
gone. **The range knob does not touch it** — a range describes a control signal, not a pitch — so a
source that bends further than the range still arrives whole on this jack while the control voltage
has run out at 1.

Two jacks rather than a switch: no mode to remember, and green against orange already says which is a
pitch and which is a modulation signal.

The range is **semitones but not whole ones** — a tenth of a semitone at one end, two octaves at the
other, and everything between. A quarter-tone bend, a scale that is not twelve-tone, and a range set
by ear are all ordinary things to want, and a knob that only stopped on integers would refuse all
three.

**The source still patches one ordinary 1V/oct signal.** Both are derived in Sequence Out, which is
where the note-on moment is known: bend is the pitch input minus the value held at that moment, so it
is exactly zero on every note, and a source that patches a plain moving voltage never has to know
that handles or updates exist.

### Level and pressure stay separate

Level is the note's velocity, taken at note-on, and pressure is how the note behaves after that.
Nothing derives one from the other. They are two familiar ideas from playing MIDI instruments, and
keeping them apart costs one jack and explains itself.

A source that wants a velocity out of a continuous signal — a breath controller reading its own
early peak, say — does that on its own face, where it is visible and can be changed, rather than
invisibly at the boundary.

**The continuing values are per note, not per page.** With three notes sounding there are three
pressure streams, each tagged with its own handle. Inside the page it is simple again: every
allocated voice is its own copy of the page, and Voice In hands each copy the values belonging to the
note that copy is playing, as ordinary control voltages.

A source with nothing to say about the continuing values simply never sends any, and the voice falls
back to its own envelope. A step sequencer should not have to pretend to be a breath controller.

## 4. Duration is a maximum, not the arbiter

`control-protocol.md` makes duration mandatory, and it stays mandatory: it is what guarantees that a
note ends even if the message that should have ended it never arrives.

**A note-off names its note**, which is the whole reason the transport carries handles: a source can
release one note and leave the others ringing. A pressure update falling to zero ends a note too. So
a note ends at whichever comes first — an explicit note-off, pressure reaching zero, or the duration
running out — and the loss-tolerance guarantee survives, because the duration fires even when the
message that should have ended the note never arrives.

## 5. Polyphony

**The page is the voice; Voice In says how many of it to run.** The count is a control on
that module, and the tab shows the multiplier so the cost is visible from the bar.

Allocation happens at Voice In: notes arriving on the bundle are assigned to free copies,
and the oldest is stolen when there are none. That is the allocator `control-protocol.md` already
specifies, sitting at the boundary rather than inside a sender.

The count has a mono setting at one end, and mono needs a second choice: **retrigger or legato.** A
wind voice wants legato — a new pitch arriving while pressure continues should move to it, not start
a new note. Stating this now avoids discovering it later as a bug report about clicks.

### What Voice In carries

A knob and a row of lamps.

**POLY** — a detented knob, one to eight, so the count can be read at a glance and felt through the
detents. Eight is a ceiling for the sake of CPU rather than principle: the count multiplies every
per-note module on the page, so it is the page's cost, not an oscillator's. The word is the one a
synth player already knows, and saying it on the panel advertises what this rack does.

**ROLLOVER** — what happens when a note arrives and no voice is free. Four radio lamps, printed, so
the setting reads from across the room rather than hiding in a menu:

- **OLDEST** — take the voice that has sounded longest, which is what almost every instrument does.
  At POLY 1 that is simply retrigger, since the one voice is always the oldest.
- **QUIETEST** — take the one furthest into its decay, which is kinder on sustained material. At
  POLY 1 it is the same as oldest, which is honest rather than confusing.
- **IGNORE** — drop the new note. At POLY 1 that is a drum machine: the pattern runs and cannot be
  interrupted.
- **GLIDE** — keep the one voice, hold the gate up, and travel the pitch to the new note. Portamento.
- **LEGATO** — hand over between **two voices and no more**: notes alternate between a pair, the one
  being left fading out while the new one fades in over TIME. Two is all the mode can use, since only
  one note is ever giving way to one other, so POLY above two is ignored here rather than pretended
  into. At POLY 1 there is no pair, so the notes **butt**: the old ends exactly where the new begins.

  **This is what a wind instrument does.** Changing the length of a vibrating column does not move the
  pitch: one resonance dies while the next establishes, which is why a slurred saxophone line sounds
  nothing like a portamento. It is the VL1-m's alternating mono mode, and it is why that mode needs
  two voices — with one there is nothing to hand over to, and LEGATO falls back to GLIDE.

**TIME** is one knob for both, because both are the same question: how long the pitch takes to travel
in GLIDE, and how long the crossfade lasts in LEGATO. Zero is an instant change.

The LEGATO overlap is a **level crossfade** — the voice being left fades to nothing while the new one
rises from nothing over the same span. Holding the old note at full and releasing it at the end of the
overlap was the first attempt and sounded like what it was: two notes at once, then a drop.

Five options that mean something at every count, so nothing on the panel has to change with the knob
beside it and no lamp is ever greyed. The name is not quite literal for legato, and it is the word
that carries the idea: all four answer what gives when the polyphony is exceeded.

Both controls are printed rather than listed. A value window hides its options until it is opened, and
how many voices there are and what happens when they run out are settings you want to read at a
glance.

### Per note or shared, and who decides

**Not the module's author.** `scope` in a descriptor is fixed per module TYPE, and whether a delay is
per-note or shared is not a property of delays — the same delay is a voice's character in one patch
and a shared send in another. (The field is also not to be trusted as it stands: thirteen modules
leave it unset and the clock declares itself per-voice, which would give eight free-running clocks
drifting apart.)

**So it is a per-instance setting, stored in the patch**, with the descriptor's `scope` supplying only
the default: sources, filters, envelopes and VCAs per note; clocks, sequencers and anything a page has
one of, shared.

**Set from a button the host draws** at the left of the module's title strip — three dots for per
note, one for shared — which appears only while that module is on a voice page. It cannot be in the
faceplate: panels are generated ahead of time and identical for every instance, so a control that
comes and goes has to be painted at runtime, as the bipolar dot and the note ring already are. Voice
In and Sequence Out have no such button; there is one of each by definition.

**And one rule has to be said out loud: a shared module is where per-note ends.** Eight voices
reaching a shared reverb are summed at its input, and everything past it is a mix — a per-note module
downstream of a shared one cannot un-mix what it is given. The setting is really "where does this
page stop being eight things", and the panel should say so rather than leave it to be discovered.

### The audio inside a page is never polyphonic

The page is a template and the engine runs N copies of it, each an ordinary mono graph of ordinary
modules. **No module in the rack has to know that polyphony exists**, which is what makes the scheme
affordable across twenty-seven of them and counting, and a polyphonic signal is never a cable you can
see. The note edge is the only thing that carries several notes at once, and it stops at Voice In.

### Poly to Stereo — where a page's voices become one signal

Level and pan belong to a note, so they are **only right if they are applied per copy, before
anything is summed**: panning at a mixer channel moves all eight voices at once. But that does not
mean Voice In has to do it. It means the module that does it has to be **per note**, which is a
property any module on the page can have.

So the gain and the pan are their own module, **Poly to Stereo**, and the summing across copies is the rack
rule that already exists — per note into shared sums, so eight copies patched to one mixer channel
arrive summed at its input like eight of anything else.

Voice In is left with one idea: turn an event into voltages. It has no audio jacks at all.

**Two level inputs, multiplied**, each a knAck with the CV in the knob. A voice has two amplitudes
that mean different things — the envelope, which is the note's shape over time, and the velocity,
which is how hard it was struck, one number for the whole note — and their product is what a
polysynth computes. With one input you would need a separate VCA to compute it, which is the module
this replaced. They are **A and B**, not "env" and "vel": multiplication is symmetric, and naming one
of them would say something false about the other, since pressure or a second envelope belongs in
either. **The faceplate prints a multiplication sign between them**, because two jacks with the same
name and no sign would leave the user to guess, and the guess would be that they sum.

Each knob is the offset, so nothing patched with the knobs at the top is unity — a freshly placed
module passes audio through untouched, and that is the one state the panel has to be readable for.

**Pan sums rather than replaces.** Voice In's PAN into the jack puts each note where its source said;
the knob offsets the page; anything else summed in moves the voices while they sound. On a per-note
page an LFO is eight LFOs, one per copy, each free-running with its own phase — which is the swarm
effect for the cost of one cable and no change to any worklet. Everything is computed **per sample**,
including the pan gain, so a moving pan slides rather than stepping once per block.

**A stereo pair out**, because per-note pan has nowhere to go in one signal — and a **mono** sum
beside it, taken before the panning. L and R are halves: patching one of them gives half a voice, not
a mono one. The pan law is **equal power**, so a voice panned hard is no louder than one in the
middle — a linear law dips three decibels in the centre, which on a phrase that walks across the
field is an audible pumping.

Nothing else belongs in it. No filter, no saturation, no mute: each of those is a module already, and
each would be worse for being tied to the voice's exit. And nothing per-note can follow a shared
module, so Poly to Stereo is the natural end of the per-note world — its outputs fanning out, mono into a
shared reverb and L and R dry to the mixer, is how you keep both.

Using it is optional. A page can patch its own VCA from the level lane and reach the mixer that way;
what it cannot do is pan per note, because a mixer channel's pan moves every voice at once.

## 6. Ports appear when they are used

Nothing on a boundary is reserved. **You drop a cable on a tab and a port appears, typed by the
domain of the cable you dropped.** Space is not spent on pins that may never be patched, and no
list of lanes has to be guessed in advance.

**The note port is the one exception, and it connects itself.** Dropping a Voice or Sequencer module
on a page creates the note port on that page's tab and the cable running to it. There is nothing to
choose: a page holds one boundary module and its tab holds one note port, so asking for the gesture
would be ceremony. Pulling that cable is still allowed — a boundary module with nothing leaving the
page is a legible state, not a broken one.

This does not extend to the interface module (§7). Its patch into Sequence Out is a real
choice, because a page can hold several things that make notes, so that cable stays manual.

Every other port is created on drop and removed deliberately, not automatically when the last cable
comes off.
That is what keeps `tabs.md`'s rule that a port is identified by its position: a port that vanished
when unpatched would give a tab a different number of ports depending on what happened to be
connected, and following a signal through a portal by position would stop working.

## 7. External sources are ordinary modules

Web MIDI, OSC, Strudel and GeoSonix each arrive as a module that anyone can place.

**The wire protocol is a superset; the note cable is not.** What comes down the link is one stream
carrying note-ons, note-offs and tagged updates *and* control-set messages belonging to no note, plus
transport and clock. What comes out of the module is several jacks: a **note output** that feeds
Sequence Out, a **clock output** as an ordinary trigger, and a **bank of named modulation outputs** as
ordinary control voltages.

So the superset lives on the module's face rather than in the cable. Anything that is not a note
leaves as the domain it actually is, crosses tabs like any other cable, and can go to a page with no
voice on it at all — which is what you want when the sender is driving a filter sweep or a video
parameter rather than playing notes.

The modulation lanes are **named**, because a sender addressing `cutoff` has to find a lane and the
catalogue is how it discovers them. That is already specified on the sending end in
`control-protocol.md`; it holds on the receiving end too.

**The interface module is not a boundary module.** It is an ordinary module that happens to sit on a
source page, because its note output has to reach Sequence Out. Its other outputs have no such
constraint.

Such a module sits on a sequencer page and patches into Sequence Out like anything else on
that page. It is not a special case and it does not make a page anything — only the boundary modules
do that.

Its bundle output goes into Sequence Out rather than straight across the tab, and that
patch is doing real work: a page may hold several things that produce notes, and the cable is which
one leaves. The clock and controller outputs cross the tab as their own ports, per §6.

The cost of the scheme, stated plainly: the simplest case — MIDI plays one voice — needs two pages.
That is the price of having one way to connect things instead of two, and the tab bar reading
MIDI 1, Voice 1 is arguably clearer than one page doing both.

## 8. The wind case

A wind voice is the reason the bundle splits in two, and it is worth writing down as a worked
example because it exercises every part of §3 to §5.

The player's amplitude is a continuous signal, not an envelope. Pressure drives the voice's
amplitude directly; when the breath stops, the note stops. **Tonguing needs no special support** —
if amplitude is continuous, a tongued articulation is a fast dip in it, and a re-attack without a
new note is what that dip sounds like. Getting that for free is the sign the model is right.

The voice's amplitude therefore comes from outside rather than from an envelope inside it, and that
machinery exists already: Macro Oscillator 2's level input does exactly this when patched, and its
percussive models already bypass their internal gate.

Monophonic legato allocation (§5) completes it. Pitch changes during a held breath move the voice;
they do not restrike it.

## 9. What this changes in `tabs.md`

**Section 7, "Tabs are not polyphony", no longer holds.** It argued that polyphony belongs on a
subgraph rather than on tabs, and it was right — a voice page *is* that subgraph, given a boundary
module and a count. What it correctly ruled out was hand-editing eight identical pages, and nothing
here asks for that.

**Section 3's rule that ports are never created by dragging a cable near a tab is relaxed**, in the
form given in §6: created on drop, removed deliberately. Its second objection — that a port
appearing and vanishing with occupancy destroys identity by position — is preserved exactly, because
removal stays a deliberate act.

## 10. Build order

Each stage is usable on its own and worth having even if the next one is never built.

1. **The note domain.** The cable and jack appearance above, the patchbay rules, and the one
   restriction that a note cable may only land on a Voice In module's input. Nothing to play yet, but
   every later stage depends on it.
2. **The two modules, monophonic.** Sequence Out makes notes; Voice In turns them back into a gate,
   a held pitch, bend, level, duration and pan; count fixed at one. At this point a hand-built
   sequencer on one page plays a voice on another, which is the whole idea demonstrated end to end.

   *Built and working, over a seven-channel Web Audio connection rather than an event stream. That
   transport is monophonic by construction (§3) and is replaced in stage 5. Everything else about
   these two modules survives it: the jacks, the held pitch, the bend range and its knob, the panels,
   the cable and its flash.*
3. **The page kind and its naming.** Singleton enforcement, the default nicknames, and the refusal to
   hold both modules.
4. **The tab's note port.** *Done, as part of stage 3.* Note that this is NOT the general
   "any port appears when a cable is dropped on a tab" of §6 — `host/rack.js` says plainly that no
   page owns a terminal, and that this was a retreat from a design where tabs carried real ports and
   every hard bug lived in that machinery. The two drop targets that earn their keep — the mixer's
   channels and the note port — each stand for a real jack on a real module. §6 is kept as the
   description of the idea; the rack's answer to it is a button that stands for a jack.
5. **The event transport, then polyphony.** The note edge becomes logical, carrying note-on with a
   handle, note-off by handle, and tagged updates; Voice In generates the per-copy voltages. Then the
   count, allocation, stealing, and the mono retrigger-or-legato choice. The transport has to change
   first, because the channel format cannot reach five voices.

   Poly to Stereo — the per-copy gain and pan — belongs here for the same reason: it is only needed once a
   page runs more than one copy, and building it earlier would mean building it twice.
6. **The continuing values.** Bend and pressure per allocated voice, and duration becoming a maximum.
7. **The external interface module.** The receiver from `control-protocol.md`, arriving as an
   ordinary module on a sequencer page. After stage 5 it speaks the transport the rack already
   speaks, so it is a listener rather than a translator.

## 11. Open questions

- **What duplicating a page costs when the count is more than one.** A reverb on a voice page becomes
  eight reverbs. Either that is accepted and documented, or an effect is marked as shared, or effects
  belong on a plain page after the mixer. The last is probably right and the first is probably what
  people will do anyway.
- **Whether Sequence Out needs a count at all.** A sequencer producing several simultaneous notes is
  a chord. With an event transport it costs nothing — several note-ons at the same timestamp — so the
  question is only whether its own panel needs to say anything about it.
- **Where allocation actually runs** — inside Voice In's own code, or in the engine with the
  module as its face. The answer probably follows from how a page is instantiated more than once.
- **A TIMBRAL crossfade across the legato overlap.** Amplitude alone is what the hand-over gives
  today. Fading the timbre of the outgoing voice into the incoming one over the same TIME is closer
  still to what an instrument does, and it is worth experimenting with once there is something to
  play — the control is already there and the two voices already overlap.
- **A source for pressure and timbre.** The lanes and their jacks exist; nothing in the rack produces
  them yet, which waits on the external interface module (§7) or on a controller module of our own.
- **What a page copy costs to build and tear down.** Allocation is only free if a copy already
  exists; if the engine builds one on demand, a note would wait for a graph to be assembled. Measured
  once there is something to measure.
