# Dual Slope — Design

A two-channel, Serge-inspired dual universal slope generator, built to be the
**system's master clock** as well as a general modulation source. Each channel is
one universal slope: an envelope, an LFO, an audio-rate slope oscillator, a slew
limiter / portamento, a pulse delay, and — the software addition — a swing/timing
reshaper. It is compact, patch-programmable, and playable by ear and by layout,
with no numeric readouts on the faceplate.

The module is the first user of the **triple knAck** — a knob a cable plugs
straight into, with a base-value ring, a CV-depth (attenuverter) ring, and the
input jack all in one concentric control. The detailed interaction design of that
control is its own next task (see *Open questions*); this document specifies the
module and how it uses the control.

Faceplate reference: [dual-slope-panel.svg](dual-slope-panel.svg).

## Stance

The real Serge Dual Universal Slope Generator earns "universal" by doing envelope,
LFO, oscillator, slew, and pulse-delay from **one circuit**, selected by what you
patch rather than by a mode menu. We keep that: behaviours emerge from the jacks,
not from a switch, wherever they can. A short mode selector remains only for the
cases the jacks can't disambiguate (slew vs generate) and for the one behaviour
that isn't a slope function at all (pair timing). The faceplate stays fixed — modes
change what a control *means* internally, never where it sits or what it's labelled.

## The knAck controls

Rise, Fall, Shape, and Bias on each channel are **triple knAcks**. One concentric
control carries three things:

- **Centre hole** — the parameter's CV input jack. Click it to pull or drop a cable;
  it colours orange (control-voltage) with the input direction ring, so it reads as
  a jack. This is authentic Serge: the DUSG's time inputs are voltage-controlled;
  here the cable plugs into the knob it modulates.
- **Inner ring** — the base value. Hover it and scroll.
- **Outer ring** — CV depth, working as an **attenuverter**: centre is zero, one way
  scales the incoming CV positive, the other inverts it. It is always adjustable, so
  you can dial in a negative depth *before* patching. With no cable it stores the
  setting silently; with a cable it sets how strongly (and which polarity) that CV
  moves the parameter.

The resolved value is `base + depth × cv`, with `depth` bipolar. All three aspects
save with the patch. Reset and other per-control operations live on the control's
**right-click menu** (there is no double-click gesture).

The 1V/oct input is a plain jack, **not** a knAck — pitch is calibrated and wants no
depth control.

## Faceplate layout

Two identical channels side by side, a shared global strip beneath. Same control in
the same place on both channels, so the panel is learned spatially. Roughly four
large-knob widths across — narrower than the Complex Oscillator; the tight axis is
vertical.

```
┌──────────────────────────────────────────────┐
│                  DUAL SLOPE                    │
├───────────────────────┬────────────────────────┤
│          A            │           B            │
│   RISE      FALL       │   RISE      FALL       │   ← triple knAcks
│  (knAck)   (knAck)     │  (knAck)   (knAck)     │
│   SHP       BIAS       │   SHP       BIAS       │
│  (knAck)   (knAck)     │  (knAck)   (knAck)     │
│                        │                        │
│  MODE  NORM SLEW PAIR  │  MODE  NORM SLEW PAIR  │
│  CYCLE  OFF ON         │  CYCLE  OFF ON         │
│                        │                        │
│  ○ TRIG   ○ SIG        │  ○ TRIG   ○ SIG        │   ← inputs (hollow)
│  ○ RST    ○ 1V/oct     │  ○ RST    ○ 1V/oct     │
│  ● OUT    ● END        │  ● OUT    ● END        │   ← outputs (filled) + LEDs
├───────────────────────┴────────────────────────┤
│  LINK  OFF A>B B>A PING     ○ RST   ○ RUN       │
│  ● MIX    ● MAX    ● DIFF    ● OR               │
└──────────────────────────────────────────────┘
```

Convention: hollow jack = input, filled = output; colour = signal family (orange
control, blue trigger/gate/pulse, green 1V/oct pitch, yellow signal) — shape and
label carry the meaning, colour is the hint.

## Channel behaviour

The core of each channel is a slope: a voltage that **rises** then **falls**, with a
**shape** curve. Rise and Fall are exponential and independent (sub-audio to audio
rate). Shape bends both the rise and the fall from linear at centre toward
exponential one way and logarithmic the other (one Shape per channel in v1). The
**1V/oct** input scales Rise and Fall *together*, exponentially, so a note CV sets
the channel's overall frequency — the basis of using a cycling channel as a
pitch-tracked oscillator or a musically-tuned master clock.

The mode selector chooses which of the three fundamentally different core behaviours
is active:

**NORM — generate.** A trigger at TRIG fires one rise-then-fall. OUT is the slope
voltage; END fires a pulse when the fall completes. From this one mode you also get:
- **Envelope** — trigger it, take OUT.
- **LFO / clock** — turn on the **Cycle** switch and it repeats continuously; period
  ≈ Rise + Fall; END pulses once per cycle (the clock output). At audio rate with
  short times it's a slope oscillator (triangle-to-ramp by Rise/Fall ratio).
- **Pulse delay** — trigger it and take END; the pulse arrives one slope-length
  later. OUT still gives the ramp if you want it.

A trigger arriving mid-slope **retriggers from the current level** (more flexible
than ignoring it).

**SLEW — follow.** OUT tracks SIG, but upward motion is rate-limited by Rise and
downward by Fall. Portamento, glide, smoothing stepped or random voltages, envelope
following. This is its own mode because "track the input" and "fire on a trigger"
both use the core and the jacks alone can't tell them apart. TRIG is ignored in Slew
in v1; END may fire when OUT reaches the SIG target (optional in v1).

**PAIR — reshape timing.** A steady clock/trigger stream at TRIG is regrouped into
**pairs**, and BIAS shifts the second pulse of each pair earlier or later. Centre =
even; one way = long-short, the other = short-long — straight, swung, and reverse-
swung feels from one control. OUT emits the reshaped pulse stream; END fires once per
pair (a phrase/pair marker). RST sets the next incoming pulse as the first of a pair,
so the pattern's phase is known. Recommended BIAS range ≈ 25–75 % of the pair (centre
50 %, ~66 % common swing, ~33 % reverse); exact value never shown, set by ear.

## Parameters

Each is a triple knAck: inner ring = base, centre = CV in, outer ring = depth
(attenuverter).

- **RISE** — rise time. Clockwise = faster (internal name stays "rise time");
  positive CV depth follows the same perceived direction as turning clockwise.
- **FALL** — fall time, same convention.
- **SHP** — slope curve; centre linear, exponential one way, logarithmic the other;
  affects rise and fall together.
- **BIAS** — pair-timing bias in Pair mode; inactive in Norm, Cycle, and Slew in v1
  (kept on the panel so both channels stay identical and for its Pair use). Modulating
  BIAS in Pair mode gives living, shifting swing.

**CV-modulation domain (decision needed).** Rise/Fall are exponential times; CV must
modulate them in a defined domain so the feel is even. Recommended: modulate in the
exponential (perceptual/rate) domain so a given CV is the same musical amount at any
base setting — pin this before the worklet is written.

## Terminals

Per channel:

- **TRIG** (in, trigger) — fires the slope (Norm), restarts the cycle (Cycle on), or
  is the incoming clock stream (Pair).
- **SIG** (in, signal) — the voltage slewed in Slew mode; unused in other modes in v1.
- **RST** (in, trigger) — hard reset: returns OUT to idle/zero, clears pending pulses,
  resets cycle phase and pair phase. (The separate SYNC input is folded into RST —
  one reset concept, not two.)
- **1V/oct** (in, pitch — green) — exponential frequency control over Rise+Fall.
- **OUT** (out) — slope voltage (Norm/Cycle/Slew) or reshaped pulse stream (Pair).
- **END** (out, trigger) — end-of-transient / end-of-cycle / delayed pulse / per-pair
  marker depending on mode.
- The four knAck centres are also CV inputs: **Rise CV, Fall CV, Shape CV, Bias CV.**

Global (shared):

- **LINK** (selector) — OFF, A→B (A's END triggers B), B→A, PING (alternating ping-
  pong; the active channel lights). Chaining you would otherwise patch END→TRIG;
  PING is the one that's awkward to patch by hand, so it lives here.
- **RST** (in) — resets both channels.
- **RUN** (in, gate) — enables timing; when low, cycles and scheduled pulses **hold**
  (not reset) and resume when high. Unpatched = on. Kept because a master clock wants
  a start/stop.
- **MIX** (out) — A + B, scaled to avoid clipping.
- **MAX** (out) — the higher of A OUT and B OUT (Serge-idiomatic; complex contours).
- **DIFF** (out) — A − B (bipolar shapes).
- **OR** (out, trigger) — a pulse when either A END or B END fires (combined clock).

## LEDs

Per channel an **activity** LED (follows output level in envelope/cycle, flashes on a
pulse, lights while moving in slew) and an **end** LED (flashes on END). Pulse flashes
are stretched to ~50–100 ms to be visible. LEDs are never the only cue — label and
position carry meaning too, and colour is not the sole distinction.

## Save format

`module.type = "DualSlope"`. Per channel `X` in `{A, B}`, each knAck stores three
things (base, the cable into its centre, and depth):

```
X.mode          X.cycle
X.rise.base   X.rise.cvIn   X.rise.cvDepth
X.fall.base   X.fall.cvIn   X.fall.cvDepth
X.shp.base    X.shp.cvIn    X.shp.cvDepth
X.bias.base   X.bias.cvIn   X.bias.cvDepth
X.trigIn  X.sigIn  X.rstIn  X.pitchIn  X.out  X.endOut
```

Global: `link.mode`, `global.rstIn`, `global.runIn`, `mixOut`, `maxOut`, `diffOut`,
`orPulseOut`. In the app descriptor these become flat ids (`riseA`, `riseDepthA`,
port `riseCvA`, `modeA`, `cycleA`, `pitchA`, …); the routing UI and inspector expose
the full names ("Dual Slope A Rise CV In"), while the faceplate shows only RISE.

## Defaults

Both channels NORM, Cycle off, Link off. Rise/Fall at moderate envelope times, Shape
linear, Bias centred, all CV depths zero, nothing patched, global RUN treated as on.
In this state a trigger into A TRIG gives a simple attack-decay at A OUT and an end
pulse at A END.

## First version

Two channels; four triple-knAck parameters each; the slope core with Envelope, Cycle,
Slew, Pulse-delay (via END), and Pair Timing; TRIG/SIG/RST/1V-oct in and OUT/END out
per channel; Link OFF/A→B/B→A/PING; MIX/MAX/DIFF/OR; activity + end LEDs; the three
knAck hover zones with right-click reset; save for base, CV connection, and depth on
every knAck; an inspector that can show exact values off the faceplate.

**Deferred:** separate rise/fall shape; audio-oscillator calibration and any 1V/oct
trimming beyond basic tracking; ASR/burst/divider/probability/Euclidean modes; stored
scenes; AND/XOR and deeper logic outs; per-channel waveform display; on-faceplate
numeric readouts and per-mode faceplate rearranging.

## Open questions

To resolve before / during the build:

1. **The dual-knAck control design — RESOLVED, see [knack.md](knack.md).** The control
   is a normal knob that splits top/bottom only when a cable is patched (top = value,
   bottom = attenuverter depth), keeping radial fine/coarse. Being built first as the
   Quad Low Pass Gate retrofit; Dual Slope uses the same control.
2. **Mode-selector length.** Norm / Slew / Pair is the lean set; confirm vs a fuller
   ENV/SLEW/DLY/PAIR for legibility.
3. **CV-time modulation domain** (see Parameters) — pin the exponential-domain
   convention.
4. **Pair Timing edge cases** — a mid-pair reset, switching into Pair mid-stream, and
   BIAS modulation of an already-scheduled second pulse.
5. **Simultaneous SIG + TRIG** in Norm — the one case the mode selector exists to
   disambiguate; confirm Slew-mode is the intended resolution.

## Build phasing

The slope DSP runs in the AudioWorklet (never in the UI thread), and the module is
large, so build it in verifiable stages:

1. **The triple-knAck control** — proven on a small test panel (loader binds one
   element as two params + a port; rack routes scroll by hover zone; worklet
   attenuverter `base + depth × cv`). Reusable infrastructure, independent of this
   module.
2. **Descriptor + faceplate** — the panel SVG and the descriptor/param wiring.
3. **The slope core** — Envelope and Cycle first (everything builds on the slope),
   then Slew, then Pulse-delay, then Pair Timing.
4. **Linking and combined outputs** — Link modes and MIX/MAX/DIFF/OR.
