# The knAck control — Design

A **knAck** (knob + jack, Chris's coinage) is a knob a cable plugs straight into:
one control carries a parameter's value *and* its CV input, so modulation is local
to the thing it modulates and a separate CV jack + attenuator disappears. This is
the current-truth spec for the control family — the simple knAck (shipped) and the
**dual knAck** (this design) — plus its first real deployment, the Quad Low Pass
Gate retrofit.

The knAck is reusable infrastructure, not a one-module feature: **any continuous or
detented-numeric, CV-modulatable parameter can be a knAck.** It is built once (loader
+ rack + a little DSP help) and adopted module by module.

## Simple knAck (shipped, in the Quad Function Generator)

A normal knob with the parameter's **CV input jack in its centre** — a black hole
ringed by the signal-family colour (orange for control) with the input direction
dashes, so the centre reads as a jack. Click the centre to pull or drop a cable;
scroll the ring to turn it. The cable feeds the worklet input at unity — no depth
control. Used where a plain CV-in is enough (the gate's attack/decay).

## Dual knAck (this design)

A knob that is **ordinary at rest and splits only when a cable is patched.**

- **At rest** it is indistinguishable from any other knob: a full circular control,
  blue grip, centre jack, value sweeping lower-left to lower-right through the top
  (~270°). Nothing new to learn until you plug in. Drawn about **20% larger** than a
  normal knob — we have the room, and the extra size makes it easier to see and to
  target under magnification.
- **On patch** it splits into two half-knobs:
  - **Top half** — the base value, its sweep compressed into the upper semicircle
    (almost-left to almost-right through straight-up).
  - **Bottom half** — the CV **depth**, working as an **attenuverter**: zero is the
    pointer straight down, one way scales the incoming CV positive, the other
    inverts. Adjustable even with no cable (it stores the setting); it only *shows*
    when patched.
  - The **parting groove runs all the way across, through the blue grip**, so the two
    halves read as two separate plastic mouldings, not a cap scored on top.
- **Scroll feel is identical throughout.** The same scroll amount changes the value
  by the same amount whether split or not; only the *visual* sweep of the value
  pointer compresses (full circle → top half) to make room. On connect the value
  pointer glides to its new position while the bottom half fades in; on disconnect it
  reverses — so the re-scale reads as the control reconfiguring, not glitching.

### Interaction

- **Hover the top half + scroll** → base value. **Hover the bottom half + scroll** →
  CV depth. Radial fine/coarse survives in each half: near the centre turns slowly
  (fine), out at the rim turns fast (coarse). Because the halves split top/bottom,
  the radius stays free for fine/coarse (this is why top/bottom won over concentric
  rings).
- **Click the centre** → pull or drop a cable. Instant, no timing lag (reset is not
  on the click).
- **Right-click** → the control's menu: **Reset** (the value, or the depth, or both),
  **Disconnect** when a cable is patched, and **Quantize** on detented knAcks (below).
  There is **no double-click gesture** anywhere (removed from plain knobs too).

### DSP

Resolved value = `base + depth × cv`, with `depth` bipolar (the attenuverter). The
worklet input for the CV is summed onto the parameter through the depth. With no
cable, depth is stored but inert.

**Detented knAcks** (a parameter that snaps to a grid, e.g. a clock ratio 1..8) carry
a **Quantize** toggle in their right-click menu, on by default. Quantize governs the
*whole control*: on, the base snaps to the grid and the modulated result snaps too
(CV steps cleanly between ratios); off, the control goes fully continuous — smooth
base and smooth CV — for sweeps between ratios. The flag saves per control.

Applicability line: continuous and detented-numeric parameters qualify; **enumerated
switches and toggles do not** (CV into a mode selector or an on/off has no ordered
meaning).

### Rendering & architecture

The split is a **live runtime state keyed to whether the centre jack has a cable** —
which the rack already knows — so the **panel SVG never changes**: it authors a knAck
(a marked element with a centre, a radius, a base param, a depth param, and a CV
port), and the control draws itself and re-draws on connect/disconnect. Keeping the
knAck art code-drawn (like `paintJack`) puts the split logic in one place and keeps
every knAck consistent.

### Save format

One panel element binds three things, saved as: `X.base`, `X.cvIn` (the cable, if
any), `X.cvDepth`, plus `X.quantize` for detented knAcks.

## First implementation — Quad Low Pass Gate retrofit

The gate is the proving ground: real continuous knobs that want CV, retrofitted in a
live module. The dual knAck is built *as* this retrofit rather than on a throwaway
panel.

Every knAck here gains its **own new CV input** for its own parameter — nothing folds
in, and all depths default to zero (patching alone changes nothing until you dial
depth). Knobs that become dual knAcks (all drawn ~20% larger):

- **Level** (per channel) — gains a level CV. Its point is dynamics: with a per-note
  CV into Level you play notes at different loudness — velocity, essentially. (Kept
  precisely because, modulated, it earns its place.)
- **Decay** (per channel) — gains a decay-time CV.
- **Rate** (master clock) — gains a clock-rate CV: voltage-controllable tempo, exactly
  what a master clock wants.
- **Clock ratio** (per channel) — a **detented** knAck (snaps to 1..8). Quantize on by
  default (CV steps the division/multiplication); right-click Quantize off to sweep the
  effective rate smoothly between ratios.

The gate's existing per-channel **CV input stays its own orange jack** — it opens the
gate continuously from an external envelope (shaped gating), which is a different job
from Level and from the blue **Trigger** that strikes it. Both stay as they are.

Left as ordinary controls (enumerated / momentary — not knAcks): the lowpass/VCA mode
pair, the divide/multiply pair, the per-channel clock-on, the master Run, and Strike.

Net: four knobs gain CV they never had (Level for velocity, Decay, Rate, Ratio), the
gate-open CV and Trigger jacks are unchanged, and the knobs grow ~20%.

## Build phasing

1. **Control infrastructure** — panel-loader binds one element as base + depth params
   and a CV port; rack routes scroll by hover half, draws the knAck (normal, then
   split on patch), handles the right-click menu (Reset / Disconnect / Quantize), and
   re-renders on the centre jack's connect/disconnect. Worklet helper for
   `base + depth × cv` and the quantize option.
2. **Gate descriptor + DSP** — add the depth params and the decay/rate/ratio CV
   inputs; the worklet sums the attenuverted CV and quantizes the ratio.
3. **Faceplate** — redraw the gate's Level/Decay/Rate/Ratio as knAcks (~20% larger),
   remove the folded-in CV jacks; regenerate the dark panel.
4. **Verify** — in the browser: knobs read normal until patched, split on patch with
   the attenuverter, scroll routes by half, CV modulates the sound, ratio quantizes
   (and un-quantizes via the menu), save/restore carries base + cable + depth + flag.
