# Scripted demos — design

A subsystem inside DreamRack that plays back an authored sequence of real app actions —
adding modules, drawing cables, turning knobs — while a synthetic pointer moves around the
rack, a badge beside it names each gesture, and a floating card narrates what is happening.

It serves two audiences from one mechanism:

- **Tutorial demos** — launched from the written tutorial, which stays. Where a section says "now you
  try it", a Demo button shows it being done instead.
- **Reels** — standalone pieces for video, typically the building of an interesting patch. Authored
  separately, but made of the same steps and carrying cards of their own.

## The tutorial is the reading surface

Demos do NOT replace the tutorial; they are launched from it. The tutorial explains, the demo shows.

That division earns its keep three ways. The prose already exists and is better at explaining a
concept than a card that has to move on. Reading is self-paced and re-readable, which matters for a
reference you come back to, where a deck sets the pace for you. And it lets a demo's own commentary
stay short, because the concept was explained before the reader pressed Demo.

The tutorial's **contents list is the demo index**. It is already a navigable map of the material, so
a reader who wants a particular demo finds it the same way they find anything else.

**Two more things the tutorial grows.** A **Speak** button beside each block, which reads that block
aloud with no animation — the narration and the demonstration are separate acts, and hearing the
words should not commit you to watching anything. And a **Demo** button on the sections that have one,
naming the script it launches, with the contents list marking which sections those are.

**One at a time.** Pressing Demo closes the tutorial and puts the transport in its place; closing the
transport reopens the tutorial where you left it. They never share the screen — the demo needs the
rack, and the tutorial window sits over it.

Recording is internal (`host/recorder.js` captures the window plus audio tapped off the graph), so
there is no external-recorder assumption anywhere in this design.

## Non-goals

- Not a test framework, and never driven by synthetic DOM input events — it does not fake pointer
  events to trigger handlers.
- No control-message layer. The runner calls the rack's own methods directly.
- Not cross-machine audio identity (see Determinism).

## Principle: theatre separate from behaviour

The synthetic cursor is pure theatre. Each step puts the cursor over the relevant control and plays
a gesture animation; the actual effect — add, patch, set a parameter — comes from calling the rack's
own imperative methods, the same ones the live UI uses. The demo therefore cannot desynchronise from
real app state, and it degrades gracefully: skip the animation and the patch still builds correctly.

## Announce, then do

The pacing rule the whole thing is built around. Each step reads its note, the pointer travels, it
**waits at the destination**, the badge names the gesture, and only then does the gesture happen.

A fast movement you were told about beats a slow one that surprises you. This ordering — not a
slower rate multiplier — is what makes a demo followable.

## The gesture badge

A small black chip with a hairline border, sitting beside the pointer — the same clothes a cable's
hover flag wears, so it reads as native. It names the gesture in the app's own terms, and the
vocabulary is closed at seven:

    move pointer   left click   right click   button down   drag   button up   scroll-wheel

The badge is **generated from the step, never authored**. An author writes "patch this to that"; the
runner expands it into move pointer / left click / move pointer / left click and the badge names them
one at a time. An eighth word needs a discussion, not a new string.

Two of these are worth noting. There is no "turn": every continuous control in the app is
wheel-driven, so moving a value is always **scroll-wheel**, shown as a run of small pulses so the
wheel is seen turning rather than seen to have jumped. And patching is **click, move, click** — not a
held drag — because that is how a cable is really made here. `drag` exists for moving a module by its
title bar.

The badge takes the side of the pointer away from where it is about to travel, so it never covers
what you are being shown next, and flips to stay on screen.

## The card

One text place, floating **over** the rack rather than docked beside it. Docking would take space
from the thing being demonstrated; a separate window would not appear in a recording. So it is a
layer inside the app window, above the rack, taking no layout space and no pointer events.

**It is placed, not dragged.** The script knows every step's target in advance, so the runner works
out the region a note's steps are going to touch and the card takes a berth clear of it. Six berths
in preference order, bottom-centre first. The berth is chosen once per note and does not move while
that note is up — a card that shuffles about while you read it is worse than one that briefly
overlaps something. An author can pin a note to a named berth when the computed one reads badly.

A note stays until the next note replaces it, so one note covers however many steps follow it. A step
with no note is a silent step that still gets its pause.

## The step model

A script is an ordered list of steps. A step performs one action and may carry a note.

Authored steps are **semantic**, which is the grain an author dictates in — "patch the oscillator's
principal output into the gate's A input" — and the runner expands each into explicit gestures.

    page    switch to a page (the tab itself is clicked, so the switch is seen to happen)
    add     add a module under a stable key
    patch   connect two terminals
    set     move a parameter — a click for a switch, a wheel for a value
    say     nothing happens; the note is the whole step
    pause   let the patch play
    menu    right-click a terminal and choose from the menu that appears
    example open one of the shipped example patches

`example` normally loads the file outright. With `"via": "menu"` it goes the long way instead —
File ▸ Examples ▸ the name — because a demo whose subject IS opening an example has to show where
examples come from; a patch that simply materialises teaches nothing about opening the next one.

The menu OPENS WITHOUT BEING TRAVELLED TO. Walking the synthetic pointer to the corner of the window
and back costs several silent seconds, and a menu bar is the one part of this app a reader already
knows how to work. It appears open, and the pointer joins it at the item that matters.

A demo driving the real menu meets the guards the real menu has, and both must stand down for it: the
unsaved-changes prompt (the user's patch is already snapshotted and restored around the run, and a
modal is a dead end — the synthetic pointer cannot press it) and a patch's own notes window, which
would otherwise unfurl over the modules the demo is talking about.

`say` is how a demo explains a thing before doing anything with it — what a low pass gate IS, before
being told to patch into one — or names what has just been built. Like any note, its card stays up
until another note replaces it, so an explanation can carry through however many silent steps follow
it.

Every step carries its own pacing, and the demo's `defaults` supply whatever a step leaves out:

    perform   how long the pointer takes to travel, or a value takes to move
    arrive    the pause after the pointer lands, before it does anything there
    beat      how long the gesture badge is up before the gesture fires
    settle    the pause after the action, before the next step
    hold      how long a new note stays up before the demo acts on it

A single global multiplier scales all of it, for re-timing a finished demo — a slower pass for the
tutorial, a tighter one for video. It is the last resort, not the thing you author with: the numbers
above are what a person can actually judge while watching.

Control references are `instanceKey:controlId` — `osc:timbre`, `lpg:inA`, `mixer:chanA`. An `add`
step's `as` becomes the key. The pinned mixer is already on the rack as `mixer`.

Values may be authored positionally where that is how you would say it — a knob at two o'clock, fully
open, centred — and resolved against the control's own range.

### Example

```json
{
  "id": "intro",
  "title": "Intro — Oscillator into Gate into Mixer",
  "stage": "default",
  "intro": "DreamRack — a quick patch",
  "defaults": { "perform": 1.0, "arrive": 2.0, "beat": 0.7, "settle": 0.8, "hold": 3.0 },
  "steps": [
    { "do": "page", "to": "a1",
      "note": "This is the rack you start with." },
    { "do": "patch", "from": "osc:prinFinalOut", "to": "lpg:inA",
      "note": "Patch the oscillator's principal output into the gate's A input." },
    { "do": "set", "target": "osc:timbre", "to": 0.85, "perform": 6.0,
      "note": "Now open the timbre. That is the wave folder." }
  ]
}
```

## Voice

The words a demo says, and the tutorial prose around it, follow `design/voice.md` — plain language,
conversational, second person, no personification and no enthusiasm. That file is the authority; this
one only says how the words get said aloud.

## Narration

Speech is **pre-rendered and shipped with the app** — the demos' notes and gesture phrases, and the
tutorial's own prose, through one pipeline. `npm run speech` walks every script and the
gesture phrase table, renders each distinct line once with the Mac's `say` in **Jamie Premium**,
compresses it to AAC and writes `demos/speech/index.json`. Fragments are keyed by a hash of the text,
so re-wording one note re-renders one file; lines that no longer appear anywhere are swept.

`demos/speech/` is **gitignored**. `say` is not byte-stable — the same words rendered twice give
different files — so committing it while the copy is churning would put a fresh blob in history for
every reworded line, and the whole set again for every voice experiment. It is committed deliberately
once the wording settles, which the web build needs since it has no other way to speak. The tutorial's
audio is larger (about fifteen minutes) but changes far less, and takes the same route.

Pre-rendering is not just a speed optimisation. It removes a macOS-only dependency from playback, so
everyone hears the same voice and the browser build gets narration at all. Measured cost is about
5 kB per second of speech — the whole intro reel plus the full phrase table is well under a megabyte.

**Nothing is ever time-stretched.** Fragments play at their natural speed and the timeline waits for
them: the speech sets the floor and the rate multiplier squeezes only the silences around it. That is
why narration is cut into small pieces — one per note, plus the gesture phrases — each placed on cue
rather than one long track everything must stay in sync with. A note's hold therefore stretches to
however long its own sentence takes.

The voice plays through the audio graph, not straight to the speakers, so it registers as one of the
rack's recording taps and a recorded reel contains it.

### What a gesture sounds like

The badge word and the spoken phrase are different things. The badge stays the terse fixed seven —
read at a glance, and shortening it later would only make it inconsistent. The spoken form is as full
as clarity needs early on ("turn the scroll wheel over the knob", "left click the button") and shrinks
to the badge word later, once the reader knows the vocabulary.

So a phrase is looked up on three keys: the gesture, the **kind** of control it lands on (jack, knob,
switch, tab), and a verbosity the demo or a section of it sets. The runner knows the first two from
the step, so none of it is authored — though a step may carry its own `say` where a stock phrase reads
badly, and `voice: "off"` silences the gesture phrases while leaving the badges.

**The wording lives in `demos/phrases.md`**, a plain markdown table edited directly. Both the app and
the render tool parse that file, so there is no generated copy to drift from the words you typed. The
voice and its speed are declared in the same file, beside the words they will speak. Most of the
full-verbosity forms are still placeholders, to be written properly against the real tutorial copy.

A connection point is a **terminal**, which is what the app calls one everywhere else. The narration
has to use the tutorial's vocabulary or the reader is learning two.

**Referring back.** Where the move just before a gesture already named the thing, the gesture says
"it" — the pointer moves to the enable button, and the click that follows is "click it" rather than
naming the button all over again. That is a third list per action, used only at Long verbosity, since
that is the only one where the move named anything to refer back to.

Stepping through a script is silent. An author walking it a step at a time is reading, not listening,
and a sentence per press would make stepping unusable.

### The opening rack

A script declares the rack it opens on, built in one go before the pointer appears — modules
materialising one at a time while a script runs is a conjuring trick a new reader has to make sense of
before they can follow anything else.

    "stage": "default"    the rack a first-run user meets
    "stage": [ ... ]      rows, for a demo needing a different set
    omitted               an empty rack, for a demo whose subject IS adding modules

A stage is a list of rows and nothing else — no coordinates, no descriptor ids:

    R1: osc func prog     row 1 of the first audio tab
    R2: lpg               row 2 of the same
    T2R1: shapes          second audio tab
    MR1: mixer            the Mixer/Output tab (M, not O — an O beside digits reads as a zero)
    VR1: videoOut         the video tab

A bare `Rn` means the first audio tab, which is where nearly everything lives. Modules are named by
short aliases, and the alias is also the name a script addresses the module by (`osc:timbre`); a
second module of the same type takes the alias with a 2 after it.

`"default"` and the app's own first-run arrangement are **the same list**, in `host/default-rack.js`,
read by both. Authoring a stage that merely resembles the default would drift from it; sharing one
definition cannot.

## Control resolution

Steps address controls logically and resolve to screen space at the last moment, so the script is
geometry-independent and survives magnification and any window size. A jack resolves through
`rack._jackElement`; a knob or switch through `rec.panel.controls`.

Two cases the resolver has to get right:

- **A module on another page** has no on-screen position worth pointing at. Its panel is present but
  hidden, so its bounding box is a lie. Off-page targets resolve to nothing rather than to a false
  position.
- **The mixer is the exception.** Its inputs are mirrored onto every other page as the buttons under
  the tab bar, and those genuinely *are* the on-page way to reach a mixer input — so `mixer:chanA`
  named from an audio page points at the button.

## Stepping, and going back

Every step is preceded by a snapshot of the whole app state — patch, probes, page and view. That is
what makes stepping **backwards** as cheap as stepping forwards, which matters twice: the author
checking a script walks it a step at a time in both directions, and a reader who missed something
steps back to see it again.

Snapshots restore with `keepKeys`, so a module keeps the name the script calls it by. Without that, a
step-back would rename every module and break every step after it.

Stepping runs with every wait collapsed. The author stepping one step at a time is not watching the
choreography — and neither is a test, which is why the same path is how a script is verified without
watching it in real time.

## Session guard

A demo rebuilds the rack, so the user's whole working state is snapshotted before it and put back
after: patch, probes, page, view, **and** the three transport switches. The transport is not part of a
saved patch, so it is caught and restored by hand — a demo turns the engine on, and leaving it on
afterwards would break the rule that sound only ever starts because you asked for it. Autosave is
frozen for the duration so the demo's rack never overwrites the saved session. The first-run tutorial
card is closed before a demo starts.

## Determinism

Timing is read off `AudioContext.currentTime`, so ramps and waits land the same on replays. Every
loop is driven by a **timer as well as** by animation frames: a hidden or occluded window stops
delivering frames, and a demo that silently parks itself mid-step is worse than one that finishes
without its in-between positions drawn. Frames are used when they arrive; the timer carries the
timeline when they don't.

Starting conditions are fixed: the rack cleared of user modules (the pinned mixer aside), descriptor
defaults, a fixed order of operations. The current modules carry no randomness. When a stochastic
module lands it must expose a seedable PRNG whose seed the demo pins at start.

## Authoring

One tool, which is the player itself with author mode switched on — the text and the steps cannot be
maintained in two places.

Scripts are written **by Claude from spoken objectives**, at whatever grain suits: an objective for a
whole section, or a step at a time ("move to the oscillator's principal output, click, move to the
gate's A input, click"). Claude runs the draft and reads app state to confirm it built what it
claims, and says so when a step does not make sense.

The author then steps through and corrects. Author mode adds, below the player controls:

- **A step strip** — one block per step, the current one lit, notes marked differently from silent
  steps. Click any block to jump there.
- **Previous step**, pairing with Step.
- **Edit** — the text becomes an editable field in place, focused for dictation. Same field for a
  card's text and for a step's note.
- **No card here** — strips the note off a step, leaving a silent pause.
- **Two number fields** for the current step: how long to perform it over, how long to hold its note.
  Blank means inherit.
- **Card starts here** — marks a section boundary, which is the same thing as a card boundary.
- **Delete step** and **move step**. Adding a step stays a conversation.
- **Defaults**, **Validate**, **Save**, **Revert**.

A saved script reopens for further editing, because the words will need several passes.

## The transport, and its two faces

One window, wide and short, dragged by its own background and remembered where you put it. It steps
aside when a demo is about to work underneath it, and the caption card is placed first so the reader's
text gets the better berth.

**A reader sees**: Run, Stop, Restart, Back, Step, Captions, Rate, and Close — which reads "Back to
the tutorial" when that is where they came from. No reel picker: arriving from a tutorial section
means the demo is already chosen, so the demo's title stands in its place.

**An author additionally sees**: the reel picker, **Play** (perform this one step properly, to judge
its words and its pacing) and **Reload** (re-read the script from disk and return to the same step).

Nothing pauses in flight. **Stop is two-stage**: stopping a running demo leaves you standing on the
step it reached, with the rack as the demo built it, so you can go back a step or look at what it did;
pressing Stop again puts your own patch back. That is what stopping is FOR while authoring, and it
costs a reader nothing.

## Build order

Each phase stands alone and is verifiable before the next.

0. **Rebase and repair** — the branch onto current code: the transport is now the engine over two
   buses, `addModule` takes a page, the first-run card must be closed, the snapshot must cover view
   and probes, and the mixer lives on its own page. *Done.*
1. **The step model and the runner** — steps with their own pacing, notes in the floating card,
   gesture badges, snapshots and step-back. *Done.*
2. **The validator** — static checks that every module, control and port a script names exists and
   that the sequence is legal, plus the run-and-inspect pass that confirms a draft did what it says.
   Early, because it is what stops bad scripts reaching the author.
3. **Tutorial integration** — a Speak button per block, a Demo button on the sections that have one,
   the contents list marking which those are, and the hand-off both ways: Demo closes the tutorial and
   opens the transport, Close reopens the tutorial where you left it. Plus the transport's reader face.
4. **The editor** — author mode as described above.
5. **The content** — bring the tutorial's copy up to date (the *Getting around* section still
   describes panning one big rack, from before tabs), and write the demos each section launches.
6. **Reels and recording** — standalone pieces, and the runner driving the recorder so a take is one
   action.

Capturing steps by performing them is deliberately absent: describing a step and having Claude write
it is easier, so it stays out until a case appears where it isn't.
