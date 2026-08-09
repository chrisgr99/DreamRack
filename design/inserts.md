# Inserts

Small objects you hang on a terminal that sit in the signal path. Designed, not built.

The rack already has objects that hang on a terminal: the scope and the monitor. Those **tap** — they
look at a signal and change nothing. An insert **intervenes**. That is the distinction the name
carries, and it is the one a person has to hold in their head, so it is worth keeping the two words
apart. (The word is also used in mixers, and we may want inserts there one day. Different thing.)

## Why they exist

A knAck is a knob with a jack in it. It has no attenuverter, and three attempts to give it one all
failed the same way: one control cannot carry two settings and a socket without one of the three
getting in the way. See [knack.md](knack.md).

So where a panel needs a depth control it gets its own small knob, the way a modular synthesiser has
always done it. But that leaves every panel owing a knob for every CV input, which is not affordable
on a dense one — the low pass gate would need thirteen.

Inserts are the fallback. Where a depth control is genuinely needed and the panel does not provide
one, you hang one on the terminal. That takes the pressure off every panel at once, and it means a
panel knob has to earn its place rather than being added on the assumption it is free.

## The family

Three members. Each has one job and one shape, because under magnification the shape is most of what
tells you what a thing does.

**Modifier** — a knob. Two settings: amount and offset. Acts on whatever arrives: `out = in × amount
+ offset`. Amount goes bipolar through zero. These two together are the affine pair that hardware
sells as whole utility modules, and they are almost always used together, which is why they are one
object rather than two.

**Injector** — a knob. Square or sine, with a rate, summing into whatever arrives. Free-running.
Deliberately crude: no waveform beyond those two, no level — hang a modifier if you need one. A good
injector stops being a bench instrument and starts being a way to avoid patching.

**Button** — a button. Pressed by hand, summing into whatever arrives. One setting chooses its
behaviour: **trigger** fires a brief pulse and returns, **gate** is high while held, **latch** is high
until pressed again. A latching button has to show its state, since unlike the other two it is high
when nobody is touching it.

Those three behaviours are the ones the panels already have — the low pass gate's STRIKE, the ADSR's
PUSH, the sequencer's RUN — so a hung button is that same control without a panel to live on.

## The rules

**One insert per terminal, of any kind.** Not one per kind. The moment a modifier and an injector
share a jack there is an order to define — is it the cable scaled and then the injection added, or
both summed and then scaled — and the two give different answers with neither obviously right. One
insert means no order to define, nothing to draw explaining it, and nothing to get wrong in the patch
file. Needing two is a signal that the patch wants a module.

**They hang on the TERMINAL, not the cable.** Simpler to draw and to reason about — one insert per
input, whatever is plugged in — and it survives repatching, which a cable-owned one would not. When
the cable goes the insert stays and takes effect again when something is plugged back in. An
attenuverter that evaporates when you repatch is worse than not having one.

**Injection sums.** Which gives the unpatched case free: an injector on an empty jack is simply a
source, and the same object on a patched jack is a signal added to what is there. No mode, and no
separate "constant" object — a DC constant is the modifier's offset with nothing plugged in.

**Inputs first.** On an output an insert scales everything downstream at once, which is occasionally
what you want and is a different mental model.

**A panel control wins.** If a port already has a declared depth, an insert does not attach there.
Two attenuators in series is not a thing anyone means to build.

## What they must do

**Be visible, and be saved with the patch.** The monitor sets the precedent for both, and it matters
more here because these change the sound. A patch where half the behaviour hangs off terminals is
unreadable otherwise — including to the AI mirror, which reads the rack to describe a patch.

**Share a visual treatment** that says "this is not part of the panel". The monitor already reads that
way. If everything hung looks like one family, a glance tells you the panel is not the whole story,
which is the honest thing for it to say.

**Fit the budget.** No larger than a scope, and preferably monitor-sized, because several may hang on
one patch. A scope's face is 120 by 48 CSS pixels; a monitor is a disc with a tick and is already a
knob — scroll it and it turns with momentum, which is the gesture an insert wants. For the modifier
that suggests one disc for amount with the offset as a thinner ring around it: amount is the one you
play, offset is the one you set once.

## The plumbing already exists

The patchbay puts an attenuator gain in the cord when a port declares `via` — which is what the depth
parameters use today. A hung modifier is that same node with a different owner: the object rather than
the panel. This is a UI and patch-format job, not a DSP one.

## Still open

- Whether the injector's rate can sync to the rack's clock, or stays free-running. Free-running is
  the simpler answer and nothing depends on the other.
- The audit of declared depth parameters. Fourteen modules declare them, mostly on the assumption
  that the knAck would answer for free. The test for keeping one is whether you would reach for it
  while playing: the filter's cutoff depth passes, the VCA's level depth passes, most do not. Some are
  already amounts — the oscillator's linear FM knob IS the depth of that input, so an attenuverter on
  it would be an attenuverter on an attenuverter.
