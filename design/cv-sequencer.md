# Sequencer/Programmer Eight — design spec

Status: **built**. All six build phases are complete and verified; the module is
`modules/programmer-8/`. Outstanding work is extracting the shared trigger detector
(Architecture requirements 7).

**Name settled.** *Sequencer/Programmer Eight* — descriptive, and carrying no model
number. Wcoast modules do not get numbers of their own; the 259t and 292 carry Buchla's
real model numbers because those modules exist, so a number on an original module would
be decoration. "Eight" here is the stage count, not a designation. The registered
trademark in this lineage is the Serge name itself, not the descriptive phrase.

An eight-stage sequential voltage programmer, in the Serge tradition: it stores two
rows of voltages and steps through them, and everything else — order, recycling,
interaction — is patched rather than configured. Inspired by the Random\*Source Serge
Sequencer 8 XL, but deliberately not a copy; the differences below are design decisions,
not compromises.

Reference material for the lineage:
- SEQ8 manual / BOM: `https://serge-modular.com/docs/RandomSource_Serge_Sequencer_8_C.pdf`
- SEQ8XL product page: `https://serge-modular.com/serge_eurorack?mod=RS_SEQ8XL_E`
- Panel photo: `https://serge-modular.com/img/euro/Serge_SEQ8_XL_1200.jpg`

## Design stance

Complexity lives in the **patch**, not in the module. Direction is an input, not a mode.
Jumping to a stage is a cable into that stage's select jack. Two of these cross-patched
through each other's stage jacks produce far more than one elaborate sequencer with many
modes.

This replaces the earlier speculative "CV Sequencer" design, which had grown
independent row modes, per-row end actions, probability, chaining and a variant family
— all of which this approach solves by patching or discards.

## Deliberate divergences from the original

Recorded here so they are decisions rather than drift:

1. **Vertical stage layout.** Stages run down the panel, one per row, rather than
   across it. This takes the module from roughly 42 HP to roughly 16, which keeps it
   inside a single magnified viewport.
2. **A directed loop window** — a start stage and an end stage, each its own
   one-of-eight selector, rather than the original's length-only behaviour. Strictly a
   superset, and end before start runs the range backwards. See Behaviour.
3. **Per-stage ratchet count** (0..4) — not in the original at all.
4. **A dedicated Trigger output** — the original has no per-clock event output.
5. **Per-stage pulse outputs** — present in the older paperface lineage, absent on the
   XL; restored here because they are what make non-linear stage orders possible.
6. **Reset/Preset as a panel switch** rather than a build-time solder jumper.
7. **No 16-stage variant.** A longer sequence is a second instance, patched.
8. **House jacks throughout.** The host paints jack fill and direction ring from each
   port's domain and direction (DESIGN.md §3); nothing about jack appearance is
   per-module, so the original's banana jacks are not modelled.
9. **Three lamps per stage, not one button.** On hardware a single pushbutton both plays
   the stage and sets the sequence length. Here those are separate acts, in three labelled
   columns on the row's own centre line: **PLAY** (orange) auditions the stage and shows
   the playhead, **STRT** (green) and **END** (red) are the two ends of the loop window.

## Panel

### Vertical layout
Eight **stage rows** running down the face. The face is 113.6 mm, so each stage row
gets 14.2 mm — comfortable for the house knob at 8.4 mm diameter with margins.

Each stage row carries, left to right:

| Element | Kind | Notes |
|---|---|---|
| Row A knob | continuous | that stage's A voltage |
| Row B knob | continuous | that stage's B voltage |
| Play button + lamp | momentary + readout | ORANGE. Plays the stage: jumps the playhead here and holds All Gate high while pressed. Its lamp is also the **active-stage** indication |
| Start lamp | one-of-eight | GREEN. Click to make this the stage the phrase starts on, and the stage Reset jumps to |
| End lamp | one-of-eight | RED. Click to make this the stage the phrase ends on. Before the start stage = the range runs backwards |
| Ratchet knob | stepped 0..4 | numerals in a short arc above it |
| Stage select in | port, trigger | a pulse jumps to this stage |
| Stage pulse out | port, trigger | fires when this stage becomes active |

### The three lamp columns
PLAY, STRT and END sit in **their own labelled columns**, all on the row's own centre
line so they read along with the knobs and jacks they belong to. Play leads: it is the
performance control, and its lamp is the active-stage indication — the thing you read
while the sequence runs.

They are told apart by **column and colour**: orange for play, green for the loop start,
red for its end. The heading over each column says which is which, so nothing depends on
colour alone.

Two earlier arrangements were tried and are recorded so they are not revisited. The two
buttons were first **stacked vertically** in one column, which kept the row narrow but
put neither of them on the line its row shares and left a single BTN legend covering two
different controls. They were then side by side but the loop window was still **one
marker button per stage** whose meaning depended on press history — see The loop window
for why that went.

**The play lamp doubles as the active-stage indication.** The button that plays a stage
lighting up when the sequencer plays it is the natural pairing, and it means the row
needs no separate active lamp and no row-background highlighting.

**Momentary is fine here.** The connection interface deliberately avoids held buttons
because cabling requires moving the pointer while carrying a cord. A gate button does
not move: you press, hold in place, and release. The two cases are not in conflict.

### Module column
A **single vertical column** beside the stage rows, carrying the module-wide jacks and
the two switches. Each row of the column is one jack with its **label on the same
horizontal line, to its right** — so a magnified viewport catches the jack and its name
together.

Order down the column:

1. **Start/Stop** switch, on its own line.
2. Inputs: **Clock**, **(P)Reset**, **Up/Down**, **Hold**. The Reset/Preset mode switch
   sits directly BENEATH the (P)Reset jack, close to it, with its caption to the right —
   the switch that modifies a jack stays with that jack. It began beside the jack, on its
   line; moving it under freed 9 mm of column width, which is what paid for the wider A-B
   knob spacing and the three lamp columns in each stage row.
3. A **horizontal divider** across the column, in the house line-grey at stroke-width
   0.355 (DESIGN.md §5), delineating inputs from outputs.
4. Outputs: **A**, **B**, **A − B**, **All Gate**, **Trigger**.

Ten lines plus the divider over 113.6 mm gives roughly 10 mm of pitch per line, which
comfortably fits a 6 mm jack and a 2.2 mm condensed legend beside it.

Width: about 6 mm of jack, 1.5 mm of gap, and up to 11 mm of legend, so about 20 mm plus
margins.

The column sits to the **left** of the stage rows, so the module reads global-then-
per-stage, left to right.

Estimated width during design: about 22 mm of module column plus about 58–64 mm of
stage row. **As built: exactly 16 HP (81.28 mm).** (The original is 42.)

### As built — where the panel actually lives
The geometry below was settled by building it; `modules/programmer-8/panel.layout.js`
is the **authoritative source**, and this section is a summary that will drift if the
layout changes. The rendered faceplate is `modules/programmer-8/panel.svg` (and
`panel.dark.svg`), produced by `npm run panels`. There is no separate mock SVG in
`design/` — unlike the 292, this module was generated from the start, so the rendered
panel *is* the picture.

Face 81.28 × 113.5912 mm. Module column jacks at x = 5.5, the vertical rule at x = 17,
the Reset/Preset toggle BELOW the Reset jack at x = 5.5, y = 33.8, with its caption to
the right. Column rows at y = 8 (run), 18.5
(clock), 29 (reset), 39.5 (up/down), 50 (hold), a divider at 57, then 64, 74.5, 85, 95.5
and 106 for A, B, A−B, All Gate and Trigger.

Stage rows begin at y = 10.2 (a legend strip sits above at y = 7.2) and are 12.92 mm
each. Within a row, x = 23.5 stage number, 29.2 Row A knob, 40.7 Row B knob, 47.9 play
button, 48.9 start lamp, 54.5 end lamp, 62.3 the ratchet knob, 70.5 stage select in, 77.0 stage pulse
out — everything on the row's own centre line except the ratchet knob, nudged 1.0 down to
clear its scale. Knobs 4.2 mm radius, ratchet knob 2.8, buttons 1.8, jacks 2.6. The
ratchet scale spans ±50° with tight gaps (0.4 / 0.8 / 1.2) so its numerals stay inside
the row.

**Two elements are much wider than they look, and the row is laid out against those
widths rather than against centres.** The ratchet knob's numerals print on that ±50° arc,
so it occupies ±4.8 mm, not the 2.8 mm of its radius. And a legend's `size` is a nominal
the renderer scales by about 1.4, so PLAY and STRT are each about 5 mm wide — which is
what sets the 2.8 mm between the two buttons, since at 2.0 mm apart the two legends read
as one word. Placing either column against the knob's radius or the nominal font size
collides; both mistakes were made and measured before these numbers settled.

Widening the A–B spacing to 11.5 mm and splitting the button column into two cost about
4 mm the face did not have, so the vertical rule moved left from 26 to 22 and the PRE
toggle went with it. Nothing else in the module column moved. Every gap in a stage row is
now at least 1.0 mm, with 1.78 mm of margin at the right edge.

**Known rough edges from the build.** The ratchet numerals render at about 2.2 mm,
the smallest text on the panel — check them under magnification first.

*(The old note here — that the marker LEDs all looked alike for want of a tri-state
indicator — is gone: two separate columns each need only one colour, so green start and
red end are simply drawn as such.)*

### The ratchet control is a small stepped knob with an arc scale
A small knob, with its numerals printed in a **short arc above it** rather than
distributed all the way round — so the scale occupies the space a numeric field would
have taken and reads as part of the faceplate rather than as a form field.

This needs **no new machinery**. It is a `stepped` param, so the host already snaps the
indicator to each step's evenly-spaced angle, and the binding contract already allows a
control to override its sweep with `data-wcoast-angle-min` / `data-wcoast-angle-max`
(the mechanism the big Frequency and Pitch knobs use for their printed scales). A sweep
of roughly ±50° puts the five positions in a comfortable arc. Tick marks and numerals
are static faceplate art, untagged, per the binding contract.

It also unifies the interaction: because it is a knob, hover-and-turn works on it
exactly as on every other control, with the same acceleration curve and the same
encoder path — no separate field-editing behaviour to build.

**Row height consequence:** knob at 8.4 mm diameter plus about 2.5 mm of numerals above
is roughly 12 mm in a 14.2 mm stage row. It fits, but with little margin, so this, the
column-legend strip, and the second per-stage lamp all compete for the same few
millimetres.

### Panel is generated, not traced
Because the layout diverges from the original, there is no faceplate to trace. The
panel is **generated** the way the mixer's is — a parameterised `build()` emitting
light and dark. The eight stage rows are a loop, which makes the generator short.

The module name renders **along the top of the module**, per the current faceplate
system.

## Controls

| Control | Count | Notes |
|---|---|---|
| Stage knobs | 16 | 8 stages × 2 rows (A, B). Linear taper. |
| Play buttons | 8 | Momentary. Each with a lamp that is also the active-stage indication. |
| Start selector | 1 | One-of-eight, a green lamp per stage. Persistent, saved with the patch. |
| End selector | 1 | One-of-eight, a red lamp per stage. Persistent, saved with the patch. |
| Ratchet knobs | 8 | Stepped, 0..4, short arc scale. Persistent state. |
| Start/Stop switch | 1 | Runs or halts the sequencer. |
| Reset/Preset mode switch | 1 | Selects which polarity of the (P)Reset input runs the sequencer. |

## Ports — 25 total

### Module inputs (4)
| Port | Domain | Notes |
|---|---|---|
| Clock | trigger | advances the sequencer |
| (P)Reset | trigger | Reset or Preset per the mode switch; jumps to the START stage |
| Up/Down | trigger/control | direction |
| Hold | trigger/control | freezes the sequencer |

### Per-stage (16)
| Port | Domain | Notes |
|---|---|---|
| Stage 1..8 Select | trigger | ×8. A pulse jumps the playhead to that stage. |
| Stage 1..8 Pulse Out | trigger | ×8. Fires when that stage becomes active, by any means. |

### Module outputs (5)
| Port | Domain | Notes |
|---|---|---|
| A | control | Row A voltage of the active stage |
| B | control | Row B voltage of the active stage |
| A − B | control, bipolar | the difference, −5..+5 V range |
| Trigger | trigger | fires at every stage start, plus each ratchet repeat |
| All Gate | trigger | high while any play button is held, or when a stage is addressed by a select pulse |

**Why Trigger exists.** A, B and A − B are voltages, not events, and nothing else on the
module fires once per clock. In the original that is fine, because the clock driving the
sequencer is already a cable in the patch and you take envelope triggers from it
directly. Ratchets break that, because a ratchet is by definition a pulse the main clock
did not produce and so has no way out. Trigger is that way out. All Gate is a different
signal with a different job: it responds to intervention — a play button held, or a
select pulse — not to the clock.

## Behaviour

### The loop window — a directed range
The loop is a **start** stage and an **end** stage, each set from its own column of
lamps: green for start, red for end. Defaults are start 1, end 8. Exactly one lamp is lit
per column, and clicking any lamp moves that end there — nothing depends on what you
pressed before.

**End before start runs the range backwards.** Start 6 with end 2 plays 6, 5, 4, 3, 2 and
repeats. That is not an error state to be guarded against; it is how you get a descending
phrase without patching anything. Measured: start 8 end 1 gives a full lap backwards.

**Start equal to end is a single repeating stage.**

**Up/Down flips whatever the range says.** The range sets the base direction and the input
inverts it, so both controls stay meaningful together: Up/Down high on a 6-to-2 range
plays 2, 3, 4, 5, 6.

**Reset goes to START**, not to the lower-numbered end — with a reversed range those are
different stages, and start is where a phrase begins.

**One range cannot cross the 8-to-1 boundary.** Start 7 with end 2 means "descend from 7
to 2", so there is no way to express 7, 8, 1, 2. The earlier design could not express it
either; this one makes that permanent rather than merely absent.

#### Why this replaced two marker buttons
The window used to be **one marker button per stage**, with the loop defined as the lower
and higher of the two most recent presses — colours falling out of the sort, so pressing
a third stage could turn a red marker green. It worked, and the worked examples were
consistent, but it had three problems that this design removes outright:

- **You could not tell which end you were setting.** The same button did both jobs and
  the answer depended on press history.
- **The colours could not be shown.** Green-start and red-end needed a tri-state
  indicator the panel did not have, so both ends lit identically and the pair only read
  as "the window runs between these two".
- **It did not save.** The press history was engine state rather than a param, so a
  patch came back with its window reset.

Two independent one-of-eight selectors are ordinary **stepped params**. They say plainly
which end you are setting, they carry their own colour, and they save and restore with
the patch for free. The reverse-range behaviour is a bonus the old model had no room for,
because "lower and higher" cannot express a direction.

### The rest
- **Pressing a play button** jumps the playhead to that stage and holds **All Gate**
  high for as long as it is held, so the column of play buttons works as a simple
  keyboard. The stage becomes active by every normal measure: A and B output its
  voltages, its play lamp lights, and its stage pulse output fires. It does not touch
  the loop window — keeping those separate is what stops the window being rewritten
  every time you audition a stage.
- **Clock plus Start** runs the sequencer through the window. A and B output the active
  stage's knob voltages; A − B outputs the difference, computed at the output rather
  than stored.
- **Hold** freezes the sequencer, including any pending ratchet countdown.
- **(P)Reset** jumps the playhead to the START stage. Preset is the level reading of the
  same jack: while it is high the playhead parks on START and the clock is ignored, so
  releasing it starts a phrase from a known stage — and every release plays the same
  phrase. Selected by the panel switch.
- **Up/Down** flips the direction the range implies. The original requires a stage above 1
  to be selected before it will descend — an analog-implementation artifact, **not
  replicated**. Direction reverses freely from any stage.
- **Stage select** jumps the playhead directly, to any stage, including one outside the
  current window.
- **Stage pulse outputs** fire when a stage becomes active, whether it was entered by a
  clock advance or by a select jump.

### Non-linear orders

**Stage select is latched, not immediate.** A pulse into a stage's select input sets
where the sequence goes *next*: it is taken at the following clock in place of the normal
advance. It can address anywhere, including outside the window. This is what hardware
stage-addressing means, and it is the decision that makes the whole mechanism musical.

Immediate jumping was built first — it is what "a pulse jumps the playhead to that stage"
literally says — and it made the module's own premise unusable. Measured, with the
one-block delay Web Audio imposes on a graph cycle: patching stage 5's pulse output into
stage 2's select input recycled the sequence the *instant* stage 5 became active, so
stage 5 held for one render block, about 2.7 ms, and was never a step at all. Latched, it
holds for a full clock like every other stage.

Two costs, accepted deliberately: an external select fires on the next clock rather than
the moment you trigger it, and **with no clock patched at all a select does nothing** —
the module cannot be driven by stage addressing alone. A pending address does resolve
with Run off, though, so a stopped-but-clocked sequencer can still be addressed; what Run
gates is the advance, not the addressing.

Patching stage 5's pulse output into stage 2's select input therefore runs 1–5, then
recycles to 2 and repeats 2–5 — a five-stage first lap and four thereafter, rather than
the plain eight. Measured stage order 1 2 3 4 5, 2 3 4 5, 2 3 4 5, every stage holding a
full clock. This is the point of the per-stage outputs.

**No loop guard is needed.** Latching removes the instantaneous-cycle hazard outright:
nothing can move the playhead between clock edges, so a pulse-out-to-select-in loop
cannot spin within a sample however it is patched. The earlier one-jump-per-sample latch
survives only as a tie-break — the first select edge in a sample wins and later ones in
that same sample are ignored, so simultaneous selects resolve deterministically — and a
later sample overwrites, so the most recent address is the one honoured. Hammering all
eight selects and the clock for 400 blocks completes in 5 ms.

It also makes an instantaneous feedback loop constructible: 5 selects 2, 2 fires its
output, that output leads back to 5. The hardware equivalent is documented — on the
paperface, patching a stage pulse output into the module's own reset locks it up.

**Guard: at most one select-induced jump is honoured per sample.** Latch a flag when a
jump is taken, clear it at the top of the next sample, ignore further select pulses
while set. Everything musically useful survives — a jump on a clock edge, or on an
external trigger — while the pathological patch merely does nothing interesting instead
of freezing the audio thread. A chain of jumps then resolves one hop per sample, which
at 48 kHz is inaudible.

### Ratchets
Each stage stores a ratchet count from **0 to 4** — five positions, suiting the short arc
scale on the knob.

**The count is the number of pulses in the stage, not the number of extras.**

- **0** — the stage's **Trigger output stays silent**. The stage otherwise happens
  completely normally: it becomes active, A and B output its voltages, its active lamp
  lights, and its stage pulse output fires. This gives a stage that changes pitch or
  timbre without sounding a note.
- **1** — an ordinary stage: one trigger at stage start.
- **2..4** — that many evenly spaced triggers across the stage, the first at stage start.
  So 4 produces four pulses at a quarter of the clock interval apart.

An earlier draft of this section said 2..4 were *additional* repeats, "so 4 produces five
pulses". That reading contradicted its own neighbours — 1 giving one pulse, and the
implementation note's "divide the interval by the number of pulses" — and it left no
setting that produced two pulses while making the knob's printed 0–4 mean something other
than what it shows. Count-is-total is also what a ratchet knob conventionally means.
Recorded here because the built module follows the corrected reading.

This is **not** stage skipping. The sequencer never jumps over a stage; true skipping is
available by patching a stage's pulse output into a later stage's select input, which is
the Serge way of doing it and needs no control.

Timing is derived from the **immediately previous clock interval**, not an average.
With a steady clock the two are identical; with a swung or deliberately irregular clock
— very much in this module's spirit, since these get clocked from slews and oscillators
— the previous interval tracks the actual rhythm instead of smearing it.

Implementation is one sample countdown, not a second clock: at stage start, divide the
last measured interval by the number of pulses, convert to samples, and reload the
countdown that many times.

Rules:

- **The next clock edge cancels any pending ratchets.** Nothing ever bleeds into the
  following stage. A bad prediction can only spread the burst too wide and lose its
  tail, or finish early and leave a gap — both harmless, both self-correcting.
- **On the first stage after start** there is no previous interval: emit only the
  stage-start trigger. Ratchets begin working from the second stage.
- **Hold freezes the countdown** along with everything else.
- **A stage entered by a select pulse** uses the last measured clock interval as normal,
  so patched stage-jumping works with ratchets rather than being a special case.
- **Trigger pulse width is a fixed short duration** (1–2 ms), not a proportion of the
  stage. At count 4 on a fast clock a proportional width would merge the repeats into a
  gate.

### Audio rate
The outputs must produce clean stepped waveforms with sharp edges at clock frequencies
of 10 kHz and above — the lineage treats this as a first-class use, for wavetable-like
and bitcrushing sounds. Consequently **smoothing is opt-in per output**, never applied
globally the way the GXW bridge's destination-side glide is (DESIGN.md §9). This is the
one place the module conflicts with a rack-wide convention, and the module wins.

## Editing model

Stage values are set by the modelled knobs — click and turn with an encoder or the
wheel, as with any other control — and by keyboard for precise entry: Left/Right select
the previous/next stage, Up/Down select the row, Plus/Minus adjust the selected value,
Shift+Plus/Minus by a larger step, Space toggles run when the module has focus. Active
only when the module has focus, and must not shadow browser shortcuts.

Three distinct pieces of per-stage visual state, all of which must be legible without
relying on colour alone: the **active** stage (the play lamp, transient), the **window**
(the green start lamp and the red end lamp, persistent), and the **selected** stage
(what the user is editing, shown by a distinct outline).

## Architecture requirements

1. **An `array` binding kind — DEFERRED, not required.** The intent was three arrays of
   eight: Row A (`continuous`), Row B (`continuous`), ratchet counts
   (`stepped`/`oneOf`). The panel build settled the question: `descriptor.js` declares
   the same 40 per-stage values as **flat params** (`a1`..`a8`, `b1`..`b8`, `rpt1`..`rpt8`,
   plus the button pairs) and the panel binds and moves them today with no new machinery.
   An array kind remains worth having as a convenience for the catalogue and for the
   control protocol's indexed targeting, but both are deferred, so nothing here blocks on
   it. Build the narrow thing first; generalise once there is a second consumer to
   generalise against.
2. **A `readout` binding.** The active stage index, the eight active lamps and the two
   window is NOT published — start and end are ordinary stepped params, so the host
   lights their lamps itself.
   `panel-editor.md` already names `readout` as one of the two bindings justifying the
   control-type registry.
3. **Indexed addressing.** `instanceId.paramId` gains an index, so the catalogue can
   enumerate stage values and the control protocol's `control-set` can target one.
4. **Save/load widening.** The `.wcoast` format needs no change — an array is
   JSON-native and `version: 1` survives. Only the restore path's `_setParam` and the
   live `rec.values` map need to accept an indexed or whole-array write.
5. **A state channel between worklet and UI.** Twenty-four values inward (16 floats, 8
   counts) plus the window, one integer outward. Small
   enough that **postMessage is sufficient**; SharedArrayBuffer is optional here rather
   than load-bearing. Still define the channel as one core with two transports (as
   `save-load.md` did for storage), since later modules will want the SAB path.
6. **Realized-instance contract additions.** `getState`/`setState` for the array
   bindings and a status read or subscription for the readouts, so the host still
   touches nothing but contract methods.
7. **A shared trigger edge-detector.** Clock, (P)Reset, Up/Down, Hold and eight stage
   selects all need per-sample edge detection with threshold, hysteresis and debounce.
   The LPG and function generator will want identical semantics, so this is a shared DSP
   helper, not a private copy.
8. **`scope` is `shared`, not `voice`** — otherwise every polyphonic voice runs its own
   playhead.

Not needed: no module family in the registry, no heterogeneous arrays, no per-row
modulation plumbing, no selected-row editor, no grid display modes.

## Patch saving

Sixteen stage voltages, eight ratchet counts, the start/stop state, the reset-versus-
preset mode, and the loop window. All of it is params, so all of it saves — including
the window, which the earlier marker-history design could not.

### Playhead outside the window
When a change to the window leaves the playhead outside the new range, it **keeps running and is
not moved**. It continues advancing in its current direction, and once it arrives inside
the window it simply repeats there from then on. Reshaping the loop while playing never
causes an audible jump.
## Build sequence

Called **phases**, not stages: "stage" already means one of the eight steps in the
sequence, and the two readings collide in almost every sentence.

Seven phases. Phase 0 is built; phases 1 to 5 carry code; phase 6 is verification only.

### Phase 0 — Panel — BUILT, awaiting review
Generator-authored layout: the eight-row loop with its button pair, the module
column, the two switches, all binding tags, light and dark. Output is a rendered panel at
true millimetres, opened at working magnification and adjusted until the stage row reads
comfortably. No DSP, no descriptor behaviour.

Built as module id **`programmer-8`**: `descriptor.js` (42 params, 25 ports),
`panel.layout.js`, `gen-panel.js`, and a silent `factory.js` stub that hands the patchbay
a zero-volt source for every output and a muted sink for every input, so cables draw and
nothing sounds. Registered in `debug/rack-app.js` and listed in `MODULE_TYPES`.

**Run `npm run panels` before adding it** — the SVGs are generated artifacts and are not
in the repo until that runs.

**Checkpoint (unverified):** the panel renders in the rack as a dead faceplate at 16 HP
and every control, lamp and jack is where it should be.

### Phase 1 — Spine and first sound — BUILT, awaiting review
The trigger edge-detector, the readout channel outward, the playhead, Run, Clock in,
Row A out, and the play lamps as active-stage indication.

Built as `programmer-8-processor.js` (playhead, Schmitt edge detection, Row A held
between clocks, throttled readout) plus a real `factory.js` replacing the silent stub.
The host gained one optional contract method, `onReadout(cb)`: a module pushes a
`paramId -> display-value` map and `rack._applyReadout` paints it. That write is purely
visual — it does not touch `rec.values`, does not call `setParam`, and does not dirty the
patch, so a running playhead never reaches the save file. The host learns nothing about
stages; translating the playhead into lamp values is the module's job.

Deliberately *not* here: the `array` binding kind, indexed addressing, and the state
channel's second transport. The descriptor's flat params already carry the stage values
(architecture requirement 1), and building general bindings before a second consumer
exists is how the shape gets guessed wrong. `postMessage` alone is sufficient for the
traffic involved (requirement 5).

The edge-detector is likewise **local to this processor for now**, not the shared helper
of requirement 7 — same reasoning, since the LPG and function generator still carry their
own inline copies and a single consumer cannot settle a shared interface.

**Checkpoint:** patch a clock in, A into the 259t pitch input, and hear a sequence.

### Trigger thresholds are relative, not absolute
Settled during phase 2, and it governs every trigger input on the module — Clock,
(P)Reset, Up/Down, Hold, and the eight stage selects when they arrive.

Fixed thresholds only served the house 0..1 pulse. Anything attenuated, or any audio
source whose peak fell below the trigger point, produced **nothing at all** — measured:
501 clock edges at 0..0.5 gave zero advances. Silence is the worst failure mode here,
because a patch that looks correct and does nothing reads as broken rather than as
under-threshold.

The detector now tracks the swing actually arriving — expanding the instant the signal
exceeds it, contracting over a ~2 s time constant — and fires at 60% of that swing,
re-arming below 40%. A ±1 square, a quiet sine and a 0..0.5 pulse all clock it alike.
Two guards keep it honest: below a 5% peak-to-peak floor it falls back to the old
absolute thresholds, so a disconnected input at exactly zero cannot self-trigger on its
own noise; and each detector starts **armed high**, so a freshly patched line must be
seen low before it can fire. Without that second rule the first sample of a rising
signal satisfies its own freshly-expanded threshold and emits one spurious trigger at
patch time.

One behaviour change falls out of it: a line that is *already* high when the sequencer
starts no longer produces an edge. A steady DC level is not a clock.

### Phase 2 — Transport and the loop window — BUILT, awaiting review
(P)Reset with its mode switch, Hold, Up/Down, and the loop window. *(The window was
built here as two marker buttons with a last-two-presses rule; it was later replaced by
the two directed selectors described under The loop window.)*

Reset and Preset are the two readings of one jack. **Reset** is edge-triggered: a pulse
jumps to the START stage and the sequence carries on — the playhead never stops moving.
**Preset** is a level: while the input is high the playhead is parked on START
and the clock is ignored, so releasing it starts a phrase from a known stage. Hold and
Up/Down are levels too, read from the same detectors' hysteresis rather than needing a
second kind of reader.

**Every Preset release plays the same phrase.** Parking re-arms the first-clock rule, so
the clock after a release always sounds the parked stage and then moves on. Found while
building a demonstration of the switch: without it, the first release sounded the parked
stage and every release after skipped straight past it, so what you heard depended on how
many times you had already used the switch — which defeats the whole point of starting
from a known stage. Measured over three park-and-release cycles, each release now plays
1, 2, 3 identically.

The readout was widened to carry the window as well, which needed no new machinery — the
module simply put more entries in the `paramId -> display-value` map. *(That widening was
later undone: the window became params, so the host lights those lamps itself and the
readout is back to the active stage alone.)*

**Checkpoint:** press 3 then 5 and hear a three-to-five loop; press 7 and hear it become
five-to-seven with 5 turning green; press 7 again and hear it collapse to one stage.

### Phase 3 — Per-stage jacks — BUILT, awaiting review
The eight select inputs and the eight pulse outputs, with the one-jump-per-sample guard.

**Early on purpose.** These are the module's premise — order and recycling are patched,
not configured — and the jump guard is the only piece that could expose an architectural
problem. Better to learn that here than after everything else is built on top of it. It
needs nothing but the playhead, which phase 1 provides.

Selects are **latched**, not immediate — the reasoning and what it cost is under
Non-linear orders, and it was settled by building the immediate version first and
measuring what it did to the module's own worked patch. A stage's pulse fires when it
*becomes* active, by a clock advance, a latched address or Reset landing on it; a stage
re-addressed while already active is not a transition and stays silent. Hold defers a
pending address rather than discarding it, and parking (Preset held) leaves it intact so
releasing Preset honours it on the next clock.

**Checkpoint, as measured:** stage 5's pulse out into stage 2's select in runs 1–5 then
recycles to 2, every stage holding a full clock; and no patch of these jacks can hang the
audio thread, because nothing moves the playhead between clock edges.

### Phase 4 — Row B, A − B, All Gate, Trigger — BUILT, awaiting review
The second voltage row, the difference computed at the output, the play buttons' gate,
and the Trigger output at fixed short pulse width.

**The play buttons jump immediately**, unlike a select, which latches for the next clock.
That asymmetry is deliberate and it is what "the column works as a simple keyboard"
requires: a key that sounded on the next clock would not be a keyboard. All Gate is high
while *any* play button is held, so two keys keep it up until both release, and a plain
clock advance never raises it — it answers intervention only. A latched address landing
also counts as intervention and gets a pulse there.

Two things the Trigger output exposed that no earlier phase could:

1. **Placing the module fired a Trigger.** The arrival test seeded its "already
   announced" stage to none, so stage 1 read as freshly arrived and struck an envelope
   the moment the module appeared in the rack. Seeded to the starting stage instead.
2. **The first stage never sounded.** The playhead sat on stage 1 and the first clock
   advanced past it, so the first note you heard was stage 2. The first clock after Run
   now announces the stage the playhead is already on rather than advancing, which is
   what every sequencer does and what makes a one-stage window audible at all.

Arrival is also now tracked across blocks rather than per sample, because a play button
press arrives as a message *between* blocks and a per-sample comparison missed it.

**Checkpoint:** two oscillators tracking A and B with A − B driving a third; the
play-button column usable as a keyboard; Trigger into the LPG plucking a note per stage
with no clock patched to the LPG.

### Phase 5 — Ratchets — BUILT, awaiting review
The per-stage knob, the previous-interval measurement, the sample countdown, and the
cancel-on-next-clock rule.

Measured at a 1024-sample clock: count 0 gives no Trigger at all while the stage's own
pulse output still fires; 1 gives one; 2 gives two 512 samples apart; 3 gives three at
341; 4 gives four at 256. Every burst is identical stage to stage, none bleeds past the
next clock, and the first stage after Run emits only its stage-start trigger because
there is no previous interval to divide.

Two corrections came out of building it. The count is the **number of pulses**, not the
number of extras — see Ratchets above for why the original phrasing could not stand. And
the first repeat landed one sample early, because the countdown runs in the same sample
iteration that sets it up; the reload now compensates, and the spacing is exact.

**Checkpoint:** a stage set to 4 produces four even triggers; a stage set to 0 goes
silent but still changes pitch; changing tempo mid-sequence recovers within one stage.

### Reset — controls AND engine state
"Reset this module" restores every param to its `default`, which is also where a
double-click on a control puts it — one source, so the two can never disagree.

Two things had to change for that to mean what it says.

**Every stage control now has ONE standard default**: 0.5 on both voltage rows, 1 on the
ratchets. They were an authored pattern — an arch in A, a falling contour in B, scattered
ratchets — so a freshly placed module played a tune immediately. The cost was that reset
left eight knobs pointing eight different ways, with no way to see at a glance which
settings were deliberate. A flat default reads as a straight line of pointers; the module
now holds a steady voltage until you turn something.

**Reset also clears state that is not a param.** The playhead is not a param, so restoring
every control still left it wherever it had got to — a reset that visibly did not reset.
The host now calls an optional `resetState()` on the realized instance, alongside the
optional `onReadout()`; a module with no internal state simply does not implement it.
Here it returns the playhead to START, drops any latched address, cancels a ratchet
mid-burst, clears the pulse and gate outputs and re-arms the detectors — without firing a
Trigger on the way. It is deliberately not undoable, because engine state was never in
the undo snapshot to begin with.

### Phase 6 — Verification — DONE
No new code.

**Audio rate.** Clocked at 1 kHz, 5 kHz and 12 kHz, the output produced exactly one step
per clock edge at every rate, and across 25 600 samples the output took **only the eight
stored stage voltages** — not one intermediate value, and not one transition spread over
more than a single sample. So the stepped waveform has genuinely sharp edges and nothing
in the path smooths it. Confirmed at the source too: the factory writes stage voltages
with `setValueAtTime` rather than `setTargetAtTime`, and no stage param declares a glide.

**Two instances cross-patched.** To make the coupling unambiguous rather than hidden
inside two identical 1–8 runs, each module was given a window the other's addressing had
to break it out of: X confined to 1–3 and fed by Y's stage-7 pulse into X's select 7, Y
confined to 5–8 and fed by X's stage-3 pulse into Y's select 2.

    X alone      1 2 3   1 2 3   1 2 3 …
    X coupled    1 2 3   7 8 1 2 3   1 2 3 …
    Y coupled    5 6 7   2 3 4   5 6   2 3 4   2 3 4 …

Both escaped their windows to stages only the other could reach, and both carried on.
The pair then settled into a **stable coupled cycle**: X running its own three-stage
loop, and X's stage-3 pulse pulling Y back to stage 2 every third clock, so Y never
climbs back to 5. That lock is emergent, not a fault — it is the design's premise
working, and it is an order neither module produces alone. On separate, unrelated clocks
(one every 8 blocks, one every 13) the pair produced a long non-repeating order instead.

Neither configuration hangs. Clocked every single block with the cross-patch live, 400
blocks completed in 7 ms.

**The build sequence is complete.** What remains is listed under Known rough edges and
Architecture requirements, not here: extracting the shared trigger detector.

## Reason for this design

A sequencer as a **voltage programmer** rather than a note list. It stores sixteen
voltages and steps through them; order, recycling and interaction are all patched. The
per-stage outputs and select inputs are what let a stage announce itself and let another
stage be addressed, which is where non-linear and cross-coupled patterns come from. The
loop window and the ratchet count are the two pieces of internal cleverness, and the
ratchet is kept honest by deriving its timing from the incoming clock rather than from a
tempo setting.
