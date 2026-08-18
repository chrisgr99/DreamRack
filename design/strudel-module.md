# Strudel — live-coded patterns as a module

A module whose faceplate carries a note output and a button that opens a code editor. You write a
Strudel pattern in the editor; the notes come out of the jack and play whatever you have patched.

Strudel runs **inside DreamRack**, sharing its audio context, with DreamRack as its output instead of
superdough. No socket, no bridge application, no clock to negotiate, and it behaves identically in the
browser and on the desktop.

Everything below was tested against `@strudel/web` 1.3.0 and `@strudel/repl` 1.3.0 in a hidden Electron
window; the findings are recorded where they matter rather than assumed.

## 1. Why this and not the socket

`control-protocol.md` describes a socket for outside senders, and it stands — GXW wants it, and it is the
rack's front door for anything that can open a connection. But Strudel is JavaScript that runs in a
page, and putting a socket between two halves of the same page would buy nothing and cost timing.

**The context is shared.** `initStrudel({ audioContext })` was verified to adopt the context it is
given — `getAudioContext()` returns the identical object. So Strudel's scheduler produces deadlines in
DreamRack's own audio clock, and a pattern event can be placed at the exact sample. The look-ahead
scheduling the socket needs does not exist here as a problem.

## 2. What Strudel hands us

`initStrudel` passes its options through to `repl()`, so **`defaultOutput` is the seam** — a documented
parameter. Verified: `setTriggerFunc` is a different path and fires nothing on this route; do not use
it.

The output is called as `(hap, deadline, duration, cps, t)` and a real chord looks like this:

```
{"value":{"note":"c3","gain":0.8,"pan":0.3,"sustain":0.5},"deadline":0.1,"duration":1,"cps":0.5,"t":0.11,"begin":0}
{"value":{"note":"eb3",…},"deadline":0.1,"t":0.11,"begin":0}
{"value":{"note":"g3", …},"deadline":0.1,"t":0.11,"begin":0}
{"value":{"note":"e4", …},"deadline":0.1,"t":1.11,"begin":0.5}
```

A chord is events sharing `t`, which is already our convention for a chord on the note cable. `t` is
audio-context time; `cps` is cycles per second, which is the clock output.

### The adapter

| Strudel | note bundle |
| --- | --- |
| `note` (name or number) | `pitch`, in VOLTS per octave |
| `gain` | `level` |
| `sustain`, else the hap's own length ÷ `cps` | `duration`, seconds |
| `pan` 0..1 | `pan` −1..1 |
| `t` | `time`, converted to a sample frame |
| anything else | a tagged update, or ignored |

**Pitch is volts, not a note number.** That is the whole reason this is not a MIDI bridge: a pattern
using fractional or unquantised pitch survives the trip.

**A handle per event**, minted here, so a note can be referred to later — the same rule the note
transport already has, and the duration is the failsafe that ends a note whose off never comes.

## 3. The module

**NOTE out** — one cable to a voice tab and the pattern is playing the rack.

**CLOCK out** — a trigger derived from `cps`, so the rack's own clocks, envelopes and arpeggios lock to
the pattern's tempo rather than free-running against it.

**CODE** — a button opening the editor window.

**PLAY / STOP**, and a lamp that goes red when a pattern does not evaluate. An error in a live-coded
pattern is a normal event, not a crash, and the face should say so without the window open.

**A cps readout**, because the tempo is set in the code and you want to see it on the rack.

The window carries the editor and nothing else: the transport is on the faceplate, where the rack's own
controls are.

## 4. The editor

`@strudel/repl` is a 2.2MB self-contained IIFE — a plain script tag, no bundler, no import map — which
registers `<strudel-editor>` and carries CodeMirror with Strudel's syntax highlighting and its
play-position highlighting. Verified: the element upgrades and exposes its `editor` object.

**This is why the heavy bundle is the right choice.** A plain text area calling `evaluate` is a tenth
of the size and gives you a worse instrument: highlighting as it plays is part of how you read a
pattern, not decoration.

**Vendored, not fetched.** Two files copied into the repo — `@strudel/web`'s 827KB ESM module, which
has zero imports, and the REPL script. DreamRack has no build step and works offline; a CDN would cost
both.

**Background throttling stalls the scheduler.** A hidden or throttled window stops the interval clock
that drives the pattern. The module's window may be closed — the pattern must go on playing — so the
scheduler must not depend on the editor being visible, and any embedded frame needs throttling off.
This cost an hour in the spike and it will cost it again if it is not written down.

## 5. Many voices, and many colours

Two separable questions that "orbit" usually tangles together: **where the notes go**, and **what they
sound like**. Most of the time a live coder wants the second without paying for the first.

### Where they go — `orbit`

**Eight note outputs**, and `orbit` picks one. The rack addresses eight audio tabs, so eight jacks match
the ceiling exactly; an untagged note leaves by the first, because a pattern written without thinking
about routing should simply play.

The cost is not the jacks, it is the tabs behind them: a voice tab is duplicated per note, so eight
tabs at eight voices is sixty-four module copies.

### What they sound like — the note's own lanes, named in the pattern

**The configuration comes from the pattern, not from a table in the module.** A named-parts table was
the first design and it was wrong: it makes the musician learn a set of names that live in someone
else's patch, and a typo in a live set is indistinguishable from silence.

Instead the note bundle's lanes ARE the vocabulary, set in the pattern by name:

```
note("c3 eb3 g3").timbre("0.2 0.8 0.5").press(0.4)
```

**Verified: an unregistered control name just works.** Strudel turns an unknown method into a control
and carries it through to the output — `.timbre(0.7)` arrives as `{note:'c3', timbre:0.7}` with nothing
registered anywhere. `createParams('timbre','press')` also exists, so they can be declared properly for
the editor's benefit; either way there is nothing to set up and nothing to remember beyond the lane
names, which are printed on Voice In's own panel.

**This is how one tab plays many voices.** The tab is duplicated per note, so each copy's filter,
wavefolder or gate sits where that note asked — patch Voice In's TIMB output at a filter's cutoff and
`timbre("0.2 0.8")` is two different sounds from one voice. On hardware, per-note timbre means per-note
hardware; here it is a lane.

**Friendly aliases for the vocabulary they already have.** `lpf` and `cutoff` map onto the timbre lane,
log-scaled across the audible range so a pattern written for superdough lands sensibly on an
exponential CV input. A pattern's own explicit `timbre` wins over an alias.

**Where it runs out**: two lanes. A pattern wanting cutoff and resonance and shape per note needs more,
and that is the concrete case for adding AUX lanes to the note bundle — deliberately deferred until a
pattern worth playing actually runs out, because each lane costs a jack on a panel that is already
full.

## 6. Strudel's own voices

**Built.** `vendor/superdough-dreamrack.mjs` — superdough 1.3.0, 113kB, no imports: esbuild inlines its
DSP worklets as `data:` URLs, so there is no worklet file to serve. It takes the rack's own
AudioContext, so its voices and the rack's are on one clock and one output.

**THE OUTPUT IS A DISPATCHER**, and it decides per event, in this order:

| the event | where it goes |
| --- | --- |
| names a rack jack — `.rack(2)`, or `orbit` | a note cable, to that voice tab |
| names a SOUND — `s("bd")`, `s("sawtooth")` | superdough |
| a bare note, naming neither | a note cable, V1 |

The last row is why every pattern written before this goes on working: a bare `note("c3")` has always
played a rack voice and still does. Naming a sound is how a pattern asks for Strudel's own.

**Loaded on the first event that needs it**, so a patch playing nothing but rack voices never pays the
113kB. Its synths are registered on load — without `registerSynthSounds()` the first `s("sawtooth")`
reports that the sound was not found, which reads as a broken bundle.

**Samples.** `samples()` and `registerSound` are put where a pattern can reach them, so
`samples('github:…')` works as it does in Strudel. A kit in `vendor/samples/` is loaded from disk
instead when one is there, which is what makes the desktop build play a drum offline; what ships in it
is a licensing decision (see that folder's README).

**What this does not change.** The note cable, the eight jacks and the per-note lanes are untouched.
This adds a second destination for events the rack was never going to play.

## 7. Licence

`@strudel/web` and `@strudel/repl` are **AGPL-3.0-or-later**. Vendoring them makes the combined work
AGPL: the source must be reachable by anyone using a hosted version, which DreamRack does anyway —
the source is published and the app is client-side, so every user already receives it.

The practical consequence is for other people, not for us: nobody can take DreamRack, add to it and run
it as a closed hosted service without publishing their changes.

## 8. Phases

**Phase 1 — it makes a sound.** Vendor the two files. A module with a NOTE out, a hard-coded pattern,
and the adapter. Verified when a pattern plays a voice tab and the notes land where they should.

**Phase 2 — the editor.** The window, `<strudel-editor>`, evaluate on a key press, the error lamp, PLAY
and STOP on the faceplate. Verified when you can write a pattern, hear it, break it, and see the lamp.

**Phase 3 — the rack agrees with it.** CLOCK out from `cps`, the cps readout, and the pattern's text
saved in the patch so a piece reopens as you left it. Verified when an envelope on another tab is
locked to the pattern.

**Phase 4 — expression and routing.** The lanes named in the pattern (§5), `orbit` across eight note
outputs, and Strudel's continuous controls as tagged updates so a pattern can bend, swell and colour a
note while it sounds. This is where a pattern stops sounding like a sequencer and starts sounding
played — and where one tab starts sounding like several.

**Phase 4b — Strudel's own voices (§6). Built**, except for the kit that ships in `vendor/samples/`.

**Phase 5 — what only this can do.** Strudel driving the VIDEO side through the same events, and the
rack's own signals visible in the editor. Nothing else gives a live coder a patchable, visible
instrument with an image attached, and that is the demonstration worth filming.

Phases 1 and 2 are the ones that decide whether this is worth having; neither depends on anything in
`harmony.md` or on the socket.
