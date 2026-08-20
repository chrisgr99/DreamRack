# DRACK — DreamRack and GXW in one runtime

Status: design. Nothing here is built.

Two finished applications become one instrument. **DreamRack** is a modular synthesiser: a rack of
plug-in modules patched with cables, in the browser and on the Mac. **GXW** (GeosonixV2) is a
geometric sequencer: objects moving on a canvas, striking beat points, playing notes. They already
share a language — events in time, values that modulate — and they already share a runtime, since
both are Electron apps built on Web Audio.

The goal is not a bridge between two programs. It is **one audio graph, one clock, one window**, in
which GXW is a module on the rack like any other.

## 1. The shape

- **DreamRack is the host frame.** It owns the window, the rack, the mixer and the patch.
- **GXW is a full-TAB module.** Its faceplate sits in the rack with the others; opening it gives the
  whole window and GXW's own in-page menu, with the Electron menu suppressed in that view.
- **One AudioContext**, created by the host and handed to both. This is the whole reason for merging
  rather than running two apps side by side: CV, audio and triggers can only be patched between them
  if they are nodes in one graph. An iframe or a second process cannot do it at any price.
- **A new repository, `DRACK`**, holding a thin Electron shell with both projects checked out beside
  it as a workspace — not submodules, because this will mean editing both sides daily for weeks and
  a pointer commit per change is a tax on every one of them. Both originals keep building standalone.

## 2. Decisions

**GXW keeps superdough, and keeps making its own sound.** The alternative — an engine-less GXW
feeding a new polyphonic superdough module in DreamRack — moves a working sound path into a module
archetype that does not exist yet. Instead GXW's superdough runs on the shared context and its output
leaves the module as a **stereo pair**, exactly as the Strudel module already does: superdough's
output controller is pointed at the module's own gain, split, and appears as two jacks. GXW sounds
the same as it does today, and the rack can put it through a filter, a delay, or the mixer.

**Only one of Strudel or GXW exists at a time.** Superdough is a module-level singleton with one
output controller; two owners in one context would fight over it. Rather than share it, the rack
refuses to have both: a **group singleton**, where adding either takes both out of the Add menu. A
patch naming both is refused at load with a message — one of them dropped silently would look like
data loss.

**GXW owns the clock when it is present.** Standalone DreamRack keeps its own clock; with a GXW
module in the rack, GXW is the master and the rack's clocks follow. The rule is "GXW if it is there,
otherwise the rack".

**The clock is carried as PHASE, not as edges.** A phase that climbs from zero to one across each
beat is correct whenever it is read, so a reader that samples it late still lands in the right place;
an edge detected in one thread and acted on in another arrives with whatever jitter lies between
them. This is the rule the video design already settled on for the same reason.

**The GXW module can run the clock without being opened.** Its faceplate carries a **RUN** button and
a **CLOCK** output, so a patch can start and stop the sequence, and lock the rack's clocks to it,
with GXW's own window never open. A module that can only be used by taking over the screen is not a
module.

## 3. The GXW module's face

- **RUN** — starts and stops GXW's transport. The one control that matters from outside.
- **CLOCK out** — a trigger on each beat, with the beat's phase available to anything that wants to
  sample rather than to trigger.
- **AUDIO L and R** — superdough's output, and anything else GXW makes.
- **NOTE out** — a composite note cable, so GXW can play a voice tab instead of, or as well as,
  making its own sound.
- **CV outs** — a small fixed set, driven by whatever GXW chooses to expose: an object's position, a
  parameter, a stream of values from the canvas.
- **OPEN** — takes the window, with GXW's in-page menu. Closing it returns to the rack.

Inputs come later, at stage 5: CV and triggers from the rack driving GXW's parameters and the motion
of its display objects.

## 4. Staging

**0 — the repo.** `DRACK`: Electron shell, both projects as a workspace, one AudioContext, DreamRack
booting as the host. Both originals still build standalone.

**1 — prove the seam.** A throwaway tone made on the GXW side arrives in the DreamRack mixer, and one
DreamRack CV output moves a single dot on a bare canvas. Three things proven at once: the shared
context, audio into the rack, and CV read at frame rate for visuals.

**2 — embeddable DreamRack.** Extract `createDreamRack({ ctx, element })` from `boot()`, with today's
page as its first caller. Useful in the Wcoast repo whether or not the merge proceeds — it is also
what would let a test or a demo build a rack without a page.

**3 — embeddable GXW.** GXW accepts an AudioContext and an output node instead of creating its own
and connecting to the destination, and mounts into an element. Standalone GXW passes its own context
and its own destination, so nothing changes for it. Superdough is started on the shared context
through a shared helper — moved out of the Strudel module's factory, so there is one place that knows
how superdough is started and where its output goes.

**4 — GXW as a full-tab module.** The faceplate of section 3, minus the inputs. Opening it takes the
window; the rack makes the sound audible. This is the "GXW as a module, like Strudel" milestone.

**5 — the other direction.** DreamRack CV and triggers reach GXW's parameters and its display
objects. The clock rule of section 2 applies throughout, and `design/control-protocol.md` is the
receiving end for notes coming back into the rack.

**6 — consolidation.** Combined patch save, the menu handoff between GXW's in-page menu and
DreamRack's, sample and asset paths, and the build.

## 5. What to watch

**One thread, two apps.** GXW's canvas and DreamRack's video engine both want frames, and the audio
thread is shared. The Load module already reads that thread as a percentage of one core, so this can
be measured rather than guessed.

**The group singleton is a new rule in the library**, and the first one that spans module types. It
needs to hold in three places: the Add menu, a patch load, and the module library window.

**Licence.** DreamRack is AGPL-3.0-only and GXW is AGPL v3, so the combined work is AGPL-3.0. No
change to either project's terms and nothing to decide.

## 6. Open questions

- **Which CV outs**, and how many, does GXW expose at stage 4? A fixed strip is simpler than a
  configurable one and can grow later.
- **Does the RUN button also arm GXW's own transport UI**, or are they two views of one state? They
  should be one state; the question is which side owns it.
- **What happens to a combined patch** opened in standalone DreamRack, where the GXW module does not
  exist. The honest answer is probably the same as any missing module: refuse, and say which.
