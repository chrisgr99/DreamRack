# Voice pages — specification

A page becomes a voice by containing a Voice module, and a source of notes by containing a
Sequencer module. Everything else follows from that one sentence: what the tab is called, what
crosses its boundary, how many copies of the page run, and where an external sequencer plugs in.

This extends `tabs.md`, which describes pages and the ports they carry, and `control-protocol.md`,
which describes how an outside sender plays the rack. It supersedes two things in `tabs.md`, noted
in §9.

## 1. Two modules, and what they decide

**The Voice module** makes its page a voice. **The Sequencer module** makes its page a source of
notes. Both are singletons: one per page, and a page may not hold both.

Refusing the combination is deliberate. The point of the scheme is that someone opening a patch they
did not build can read the tab bar and know the shape of the whole thing. That only works if a page
is one thing. A self-contained instrument is therefore two pages — a sequencer feeding a voice —
with the relationship visible in the bar rather than hidden inside a page.

Neither module is a page *type*. There is no setting anywhere that says what a page is; the module
on it is the whole of the answer, and it is visible.

### Naming

The letter remains a page's identity, as in `tabs.md`. Adding a Voice module sets the page's
nickname to **Voice 1**, the next to Voice 2; a Sequencer module sets **Sequencer 1**. A nickname
you have already chosen is never overwritten — a page called Bass stays Bass.

Deleting the module leaves the nickname alone and takes the boundary away. Renaming a page out from
under someone because they deleted a module is worse than a stale name.

The names are chosen to teach. Most players will not have met a rack where a page is a voice, and a
tab bar reading Sequencer 1, Voice 1, Voice 2 explains the idea before any documentation does.

## 2. What the modules do, and what they do not

**The two modules bundle and unbundle. That is their entire job.**

The Sequencer module takes a gate and separate pitch, level, duration and pan signals from the page
and makes one note out of them. The Voice module takes a note in and gives those back as ordinary
jacks inside the page.

They do not carry anything else. A filter sweep running from a sequencer page to a voice page is an
ordinary control cable crossing a tab, exactly as `tabs.md` already describes, and neither module is
involved. So the modules have a fixed set of jacks and never change shape.

This also settles a claim that would otherwise be tempting: a page's boundary ports are **not** all
one direction. A voice page sends audio to the mixer, so it has outputs as well as inputs. The
narrower rule is the true one — **a note bundle enters a voice and leaves a sequencer**, and every
other domain crosses tabs as it does now.

## 3. The note domain

A note is its own domain, with its own cable colour, alongside audio, control, trigger, luma and rgb.

**A note bundle is created in exactly one place and opened in exactly one place.** The Sequencer
module is the only thing in the rack that produces one; the Voice module is the only thing that
opens one. Nothing else bundles or unbundles.

That single rule does more work than it looks. It keeps the note domain from leaking into general
patching, and it enforces the encapsulation in §1 without a placement rule anywhere: put a note
source on a voice page and its output has nowhere legal to land, so the cable is simply refused, the
way rgb into a luma input is refused today. No new machinery, no error message to write, and nothing
invisible.

### How it looks

The rack's hues are spent: audio yellow, control orange, trigger light blue, pitch green, luma
off-white, rgb magenta. Everything left over is adjacent to one of those, so **the note cable is not
a hue at all.**

- **It is neutral and thicker than every other cable** — near-white on the dark faces, near-black on
  the light ones. Being the only cable without a hue is a stronger distinction than any remaining
  colour could be, and it works at any zoom and for any kind of colour vision. The extra width is
  also physically honest: a bundle is a multicore next to a patch lead.
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

### What rides in the bundle

Two kinds of thing, and the difference matters.

**The gate**, which is the note itself: it opens when the note starts and closes when it ends (§4).

**Values fixed when the note starts:**

- **pitch** — an ordinary 1V/oct control voltage, captured at note-on, and see below.
- **level** — the note's velocity: how hard it was played, and see below.
- **duration** — how long, and see §4.
- **pan** — where in the stereo field. Per-note position is genuinely musical: struck notes
  scattered across the field, or a phrase that walks. It costs one lane.

**Lanes that keep moving while the note sounds:**

- **bend** — pitch movement within the note, in the same 1V/oct units, to be summed with the held
  pitch by any voice that wants to glide.
- **pressure** — a continuous amplitude or effort signal. Breath for a wind voice, bow force for a
  string one.

This is the line MPE draws between a note's start and its ongoing expression, drawn here on purpose
rather than arrived at later.

### Pitch is a voltage, not a note number

The pitch lane carries the same 1V/oct signal every oscillator in the rack already takes, so the
Voice module's pitch output patches straight into one with nothing converting anything. A note
number would make microtonal music, glissando and any drifting or unquantised source into special
cases, which is the wrong way round: those are ordinary here.

Where a sender speaks in note numbers — MIDI does — the conversion happens once, at the module where
that sender enters the rack (§7). The bundle never knows MIDI exists.

**The pitch is captured when the note starts and holds for the note's life.** Holding is what makes
a note a note, and a source whose pitch input keeps moving after the gate — an unquantised drift, a
sequencer's next step arriving early — must not drag a sounding note around with it. Continuous
movement within a note is the bend lane's job, which a gliding voice sums with the held pitch. That
is one cable inside the page, in the case that is genuinely the unusual one.

### Level and pressure stay separate

Level is the note's velocity, taken at note-on, and pressure is how the note behaves after that.
Nothing derives one from the other. They are two familiar ideas from playing MIDI instruments, and
keeping them apart costs one jack and explains itself.

A source that wants a velocity out of a continuous signal — a breath controller reading its own
early peak, say — does that on its own face, where it is visible and can be changed, rather than
invisibly at the boundary.

**The continuing lanes are per note, not per page.** With three notes sounding there are three
pressure streams, one per allocated voice — the bundled cable carries a small number of parallel
streams, as VCV's polyphonic cables do. Inside the page it is simple again, because each allocated
voice is its own copy of the page and sees only its own lane, as an ordinary control signal.

A source that has nothing to put in the continuing lanes leaves them unpatched, and the voice falls
back to its own envelope. A step sequencer should not have to pretend to be a breath controller.

## 4. Duration is a maximum, not the arbiter

`control-protocol.md` makes duration mandatory, and it stays mandatory: it is what guarantees that a
note ends even if the message that should have ended it never arrives.

A pressure lane falling to zero must also be able to end a note early. So the note ends at whichever
comes first — pressure reaching zero, an explicit note-off, or the duration running out. The
loss-tolerance guarantee survives and live playing works.

## 5. Polyphony

**The page is the voice; the Voice module says how many of it to run.** The count is a control on
that module, and the tab shows the multiplier so the cost is visible from the bar.

Allocation happens at the Voice module: notes arriving on the bundle are assigned to free copies,
and the oldest is stolen when there are none. That is the allocator `control-protocol.md` already
specifies, sitting at the boundary rather than inside a sender.

The count has a mono setting at one end, and mono needs a second choice: **retrigger or legato.** A
wind voice wants legato — a new pitch arriving while pressure continues should move to it, not start
a new note. Stating this now avoids discovering it later as a bug report about clicks.

## 6. Ports appear when they are used

Nothing on a boundary is reserved. **You drop a cable on a tab and a port appears, typed by the
domain of the cable you dropped.** Space is not spent on pins that may never be patched, and no
list of lanes has to be guessed in advance.

**The note port is the one exception, and it connects itself.** Dropping a Voice or Sequencer module
on a page creates the note port on that page's tab and the cable running to it. There is nothing to
choose: a page holds one boundary module and its tab holds one note port, so asking for the gesture
would be ceremony. Pulling that cable is still allowed — a boundary module with nothing leaving the
page is a legible state, not a broken one.

This does not extend to the interface module (§7). Its patch into the Sequencer module is a real
choice, because a page can hold several things that make notes, so that cable stays manual.

Every other port is created on drop and removed deliberately, not automatically when the last cable
comes off.
That is what keeps `tabs.md`'s rule that a port is identified by its position: a port that vanished
when unpatched would give a tab a different number of ports depending on what happened to be
connected, and following a signal through a portal by position would stop working.

## 7. External sources are ordinary modules

Web MIDI, OSC and Strudel each arrive as a module that anyone can place. Each has a note bundle
output, plus clock, gate and controller outputs of the ordinary domains.

Such a module sits on a sequencer page and patches into the Sequencer module like anything else on
that page. It is not a special case and it does not make a page anything — only the boundary modules
do that.

Its bundle output goes into the Sequencer module rather than straight across the tab, and that
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
   restriction that a note cable may only land on a Voice module's input. Nothing to play yet, but
   every later stage depends on it.
2. **The two modules, monophonic.** Sequencer bundles pitch, level, duration and pan; Voice unbundles
   them; count fixed at one. At this point a hand-built sequencer on one page plays a voice on
   another, which is the whole idea demonstrated end to end.
3. **The page kind and its naming.** Singleton enforcement, the default nicknames, and the refusal to
   hold both modules.
4. **Ports on demand.** §6, which is independent of everything above and improves ordinary tab
   patching whether or not you ever build a voice.
5. **Polyphony.** The count, allocation, stealing, and the mono retrigger-or-legato choice. This is
   the stage that costs real engine work, because a page must be instantiated more than once.
6. **The continuing lanes.** Bend and pressure per allocated voice, and duration becoming a maximum.
7. **The external interface module.** The receiver from `control-protocol.md`, with a note bundle
   output, arriving as an ordinary module on a sequencer page.

## 11. Open questions

- **What duplicating a page costs when the count is more than one.** A reverb on a voice page becomes
  eight reverbs. Either that is accepted and documented, or an effect is marked as shared, or effects
  belong on a plain page after the mixer. The last is probably right and the first is probably what
  people will do anyway.
- **Whether a voice page's audio output is summed across copies before the tab port**, which it must
  be for the mixer channel to mean anything, and what happens to per-note pan at that point.
- **Whether the Sequencer module needs a count at all.** A sequencer producing several simultaneous
  notes is a chord; whether that is one bundled cable carrying parallel streams or several cables is
  the same question as §3's parallel streams, seen from the other end.
- **Where allocation actually runs** — inside the Voice module's own code, or in the engine with the
  module as its face. The answer probably follows from how a page is instantiated more than once.
