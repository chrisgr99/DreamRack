# Knobs as gauges

A knob here is not a picture of a knob. It is a gauge you read.

The band between the metal cap and the outer edge fills with colour from the control's minimum round
to where it is set. The rest of the band stays empty. There is no pointer line and no knurl. You read
a filled area rather than finding a thin mark, which is what makes a setting legible at a glance and
under magnification.

The colour says what kind of quantity the knob sets.

## The band

Each knob has three rings, from the middle out: the metal cap, which is what you grab; the gauge
band; and a hairline edge. The gauge band is a proportion of the knob, not a fixed width, so it holds
at every size on the rack.

On a two-tier knob — the complex oscillator's two big ones — the gauge goes on the OUTER tier. Those
are the largest controls on the rack and their reading should be the easiest one on it.

- **Empty** is a dark grey channel, drawn ONLY over the control's own sweep, on a BLACK ring. So an
  untouched knob still shows where its travel is and which way it runs: grey where the value can go,
  black where it cannot. A full circle at near-black, which is what it was, read as two concentric
  black rings on a knob turned right down and said nothing at all — and leaving the dead sector as
  bare knob face was worse, because the body is a mid grey, so the part that can never be reached came
  out lighter than the travel and the whole thing read inside out.
- **Filled** is the signal colour, at full saturation, filling the whole width of the band.
- The fill starts at the knob's own declared minimum angle — usually seven o'clock — and runs
  clockwise to the setting. It does not start at a fixed clock position, because a few controls have
  a different sweep.
- A knob at its minimum still shows a stub two or three degrees wide, so zero reads as *set to zero*
  rather than as unpainted.

**Bipolar controls fill from twelve o'clock**, growing left for negative and right for positive. Any
control whose range crosses zero gets this — attenuverters, pan, fine tune, through-zero FM. Filling
those from the minimum would make centred look half on, which is the opposite of what it means. The
range decides; nothing is declared.

## The colours

The same families as the jacks, and they mean the same things.

| Colour | Hex | What it marks |
| --- | --- | --- |
| Yellow | `#f3c40b` | Audio quantities — levels, and frequencies in the audio band |
| Orange | `#ff7300` | Every other setting: depths, shapes, times, amounts |
| Light blue | `#5aa0e6` | Things measured in pulses — clock rates, divisions, repeat counts |
| Green | `#39a85a` | Reserved for 1V/oct, and used on a knob only where the knob genuinely is that |
| Magenta | `#e0359b` | Picture quantities on the video modules |

Two consequences worth knowing before you look at a rack.

**Most knobs are orange**, because most settings are amounts and times. Yellow, blue and green are
the accents, and that is the point of them: they mark the controls you most often need to find.

**A knAck can show two colours** — an orange jack in the middle with a yellow gauge around it, which
is a control-voltage input driving an audio frequency. The jack's colour is the signal arriving; the
gauge's colour is the quantity being set. They are different questions and they can have different
answers.

## The attenuverter

A patched knAck's attenuverter is an inner ring, drawn in the gap between the jack and the cap. It is
bipolar, so it grows either way from twelve o'clock, over the SAME sweep a value knob has — seven
o'clock, up through twelve, round to five. It is a third narrower than the gap it sits in, so body
grey shows on both sides and it reads as a ring rather than a collar.

It carries **no signal colour** — a light grey against the darker grey of the body. Colour means
signal on this panel; the attenuverter is the control's own machinery, not a signal, and giving it a
hue would say something untrue about it.

On the smallest knAcks the gap between the jack and the cap is under a millimetre, so the ring is
thin there. If it turns out to be unreadable at that size, the answer is that a knAck below a certain
size does not show one rather than that the ring gets thicker.

## What does not change

Stepped controls — selectors, toggles, mode switches — keep their pointer. A fill means nothing on a
three-position switch.

Faceplates draw no pointer at all now, on any knob. The host adds one to a stepped control, because
the host is the side that knows a parameter's curve. Drawing one on every knob and hiding it at
runtime looked right on the rack and wrong in the module library, which shows the raw faceplate.

Rotating face ticks are retired for the same reason the knurl was: they are marks laid over the
gauge. A few layouts still ask for them; the option is accepted and ignored.

## Blue is retired

The blue knob body goes. It has to: light blue is one of the five gauge colours, and a blue gauge on
a blue body would be the one setting you cannot read. The body becomes a neutral dark grey, so all
five colours read equally on it.

The greys have to separate by value: the panel behind, the body, and the attenuverter ring are three
steps, dark to light, with a hairline edge round the body so it stands off the panel.

## The centre is black

A plain knob's cap is black inside a white ring; a knАck's centre is its jack. That is the first thing
you can see about a control, before reading anything: black disc, you turn it — orange jack, you turn
it and you can plug into it.

It used to be metal grey, which stopped working once the gauge track lit up on hover: the cap's edge
and the lit track were within a few percent of each other, so a hovered knob's middle and its ring
merged into one grey mass. Green was tried in between and brought its own problems — it is the 1V/oct
colour, and it shouted.

Black cannot be confused with anything else here and has no brightness to tune. What separates it
from the track is the white ring around it, which is a line rather than a value, so nothing about it
changes when the track lights.

## Where you can scroll

The scroll area reaches past the knob, into the band the hover wedge is drawn in. On a knAck the dial
itself is mostly jack and attenuverter, which left a narrow ring for the value — the control you
reach for most. The band outside the knob is free, and it is full width all the way round even where
the wedge tapers to nothing, so the far side of the knob works as well as the near side.

How far it reaches is worked out per knob: half the clear space to the nearest other knob, or the
whole clear space to the nearest jack less a margin, capped at 3.35mm. A fixed reach would be right
on the complex oscillator and wrong on the mixer, where a full band on each send knob would have them
overlapping — and an overlap means one control quietly taking another's clicks. On the rack as it
stands the median knob gets about 1.7mm and nothing overlaps anything.

While you hover, a soft shaded ring grows around the outside of the knob, covering exactly that band.
It is white at low opacity — colour means signal on these panels, so the affordance stays out of that
vocabulary — and it is the only thing drawn. There is no wedge and no marker: the gauge already shows
the sweep and the value.

Whichever ring your scroll would move LIGHTS UP — not the arc, the empty track it travels in. The
arcs have almost no room to say it: audio yellow can only go a quarter brighter before it is cream,
and the attenuverter's arc is already a light grey. The unfilled track is where the reserve is, at
three percent of the knob body's brightness, so lifting it to a mid grey is a seventeen-fold change.
The arc keeps exactly the colour it had — that colour carries meaning — and the ring around it glows.

That is what tells a knАck's two controls apart, since it has two under one pointer.

## How fast a scroll turns something

One rate, and a ladder of held keys off it:

| Held | Rate |
| --- | --- |
| nothing | 1× |
| Shift | 4× |
| Cmd | 0.1× |
| Cmd + Shift | 0.01× |

**Not Ctrl.** Ctrl+wheel is the rack's pinch-zoom and a trackpad pinch arrives as exactly that, so
Cmd carries the slow tiers.

This replaced a law where the rate depended on where the pointer sat on the knob — full at the
centre, a quarter at the rim. Nobody could see it, it could not be aimed for deliberately, and the
same gesture did different things depending on where your hand had landed. A held key is explicit,
repeatable, and the readout shows the rate while you hold it — `220 Hz ↕0.1` — so it is
discoverable the first time you press one by accident. An arrow rather than a times sign: `×0.1`
sits an operator next to a number and reads as a tenth of the value.

Detented controls — the clock ratios, the octave, the repeat counts — ignore the ladder. One notch is
one step, and a whole number is already as precise as it gets.

## The number

The gauge says where a control sits in its travel. It cannot say that the frequency is 246 Hz, and on
a knob whose printed scale is six numbers wide that is what you want. So turning a control puts a
small chip on the pointer with the name of the control and its value.

ONLY WHEN YOU TURN SOMETHING. Not on hover. Every version that appeared on hover — after a second,
after a settling pause, after a longer pause — put numbers over the panel while the pointer was on
its way somewhere else, and a knАck's jack made it worse: crossing one to drop a cable in flashed a
number up and took it away again. That also means the jack needs no special case. Point at it and
nothing happens; scroll on it and you get whatever that scroll moved — the depth on a patched knАck,
the value otherwise.

It emerges over two seconds from the moving end of the arc it is about, follows the pointer while you
stay on that part of the control, and flies back into the arc over one second — when you leave that
part, when you move to the other ring of a knАck (where nothing new appears until you turn that one),
or half a second after you stop turning, whether or not the pointer is still on it. Carrying the pointer
about does not keep it up: the number is about the turning.

What a number means comes from the descriptor, so the readout and the control are derived from one
declaration rather than two that can drift:

| Kind | Reads |
| --- | --- |
| Plain 0..1 | `0.42` |
| Crosses zero | `+0.65`, `-0.65` |
| Frequency | `246 Hz`, `1.24 kHz` — three significant figures |
| Time | `12.3 ms` under a second, `1.42 s` above |
| Semitones | `+1.20 st` |
| Detent | `3`, `-2` |
| Curved in decibels | `-10.8 dB`, `−∞ dB` at the bottom |

That last row is why a mixer fader declared 0 to 1 reads `-10.8 dB` rather than `0.29`. The position
of the control is not a level anyone works in.

## How it is drawn

The gauge depends on the value, so the panel cannot bake it. The panel carries the empty band; the
host fills it, the same way it already dresses a knAck.

The cheap way is a circle stroked as wide as the band with a dashed outline, where changing one
number opens and closes the gap. No path arithmetic on every mouse move, and one attribute per
update.

## The assignment

Colour cannot be derived. Port domains do not know that pulse width is a shaping percentage while
coarse is an audio frequency, so each parameter declares its own, next to its unit and its curve. The
default is orange, which is right more often than not.

Depth parameters are not listed: every one of them becomes the grey attenuverter ring.

**Complex Oscillator** — frequency and fine tune (both oscillators): yellow. Timbre, order, symmetry,
mod index, phase lock gain, and all the CV and FM amounts: orange.

**Oscillator** — coarse, fine: yellow. Linear and exponential FM depth, pulse width, feedback: orange.

**Sine Source** — frequency: yellow.

**Filter** — cutoff: yellow. Resonance, drive: orange.

**VCA** — level: yellow.

**Quad Low Pass Gate** — the four levels: yellow. The four decays: orange. The four clock ratios and
the clock rate: light blue.

**Mixer / Output** — every channel's level, pan and two sends, plus master and monitor: yellow.

**ADSR** — attack, decay, sustain, release: orange. Sustain is a level, but a level of a control
voltage, not of audio.

**Quad Function Generator** — the four attacks and decays, and both quadrature times: orange.

**Sequencer / Programmer Eight** — the A and B rows: orange. The repeat counts: light blue, since a
repeat is a number of clock pulses.

**Octave** — the octave knob: green, if green is allowed on a knob at all. It is the one control on
the rack that genuinely is a 1V/oct amount and nothing else.

**Video modules** — Coordinate Field, Shapes, Compositor, Time Machine: orange throughout, since
their knobs set geometry and amounts. Video Out's brightness: magenta, as a picture quantity.

## Open

Both are built the way they are described above, so they can be looked at rather than argued about.

- Green on the Octave knob, or green stays jacks-only.
- Video Out's brightness in magenta, or orange like every other setting.
