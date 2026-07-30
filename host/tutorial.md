# DreamRack — Interactive tutorial

<!--
This file is BOTH the document you are reading and the exact copy the app shows in its tutorial sections. Editing it here changes the tutorial; there is no build step.

Format (parsed by host/tutorial-md.js):
  ## Heading         starts a section; the heading becomes its title
  paragraph          a paragraph — write it on ONE line, the section wraps it
  - item             consecutive items become one bulleted list
  > **Do this** — …  a "Do this" block; the bold text is its label

Inline: **bold**, *italic*, ==key term== (the accent colour), [text](url), `code`. Text above the first ## is preamble for a human reader and never reaches the app.

House style: the reader has probably used a software modular before, and they all differ in interface and terminology — so the job is to map, not to teach. One section per heading, each a complete covering of it. No sales pitch; they've read the README.

Order earns its place: the reader should reach a sound early, so nothing that can wait goes in front of that. A retired preamble section is kept in design/tutorial-before-you-start.md.
-->

This is the tutorial DreamRack shows in its floating window — one continuous document you scroll, opened on a first run and from Help ▸ Interactive tutorial. It's written for someone who has used a software modular before, so rather than teaching synthesis it maps what you already know onto this one — and points out where DreamRack differs.

## Contents

- [**A few essentials**](#a-few-essentials) — the handful of things that work differently here
- [**First sound**](#first-sound) — the shortest path to hearing something
- [**Building a patch**](#building-a-patch) — adding modules, and how cables behave here
- [**Getting around**](#getting-around) — panning and zooming a rack bigger than the window
- [**Seeing and hearing**](#seeing-and-hearing) — scopes and monitors on any terminal
- [**Saving your work**](#saving-your-work) — saving, loading, and what carries over
- [**Vocabulary**](#vocabulary) — the modular terms this tutorial uses, if you want them

## A few essentials

Even if you've used a software modular before, there are a few things you need to know to succeed in DreamRack.

Also, hover a callout like this {see:mixer} in the tutorial to see any item being referred to.

==Dragging cables:== there is ==no dragging==. ==Click== an output and the cable follows the pointer with ==no button held==; click an input to connect it, or click empty space to let it go. Clicking a terminal that already has cables does one of two things, and the direction you move the mouse decides which: move along an existing cable and that cable lifts off, or move where there is no cable and you start a new one. Escape leaves everything where it was.

==Turning knobs:== ==hover== a knob and ==scroll== (i.e. don't press the mouse button, just turn the scroll wheel). Double-click any knob to reset it.

==Starting the engine:== nothing makes a sound until the engine is on. Press the space bar, or click **Engine** at the top of the **Rack** menu, or the **ENGINE** lamp {see:mixer/engine} on the mixer — all three are the same switch. Press again to stop.

==Moving around:== hold the ==Option key== — Alt on Windows — then ==scroll== to zoom the view in and out, and move the pointer to travel across the rack (again, ==don't drag==). Try it: hold Option and scroll up to zoom in, move the pointer to bring another part of the rack into view, then hold Option and scroll all the way out to see the whole rack at once. You can do all of this while carrying a cable, since none of these actions needs a mouse button held.

Coming next: **First sound**.

## First sound

> **Do this** — Click the **Final** output {see:complexOsc259t/prinFinalOut} on the Complex Oscillator, then click **channel A** {see:mixer/chanA} on the mixer. The cable is yellow — the colour of the audio input it landed on.

> **Do this** — On the **Mixer / Output** module, turn on the **ENGINE** {see:mixer/engine} — the **MSTR** bus lamp {see:mixer/masterEnable} lights with it. Then set a comfortable level on the **Master** fader {see:mixer/master}.

That is your first sound. Now change it. Everything below is on the Complex Oscillator, and every control scrolls.

==Pitch:== the big **Pitch** knob {see:complexOsc259t/prinFreq} sets the note. Hover it and scroll (not drag) to hear the sound change.

==Modulate:== the module has two oscillators — the principal one you are hearing, and a modulation oscillator on the left that drives it. Press **Pitch Mod** {see:complexOsc259t/pitchMod} to set how it drives, then scroll **Mod Index** {see:complexOsc259t/modIndex} off its centre to set how far. Now scroll the modulation oscillator's **Frequency** {see:complexOsc259t/modFreq}: slow rates give vibrato, fast ones a new timbre.

==Shape:== **Timbre** {see:complexOsc259t/timbre}, **Order** {see:complexOsc259t/order} and **Symmetry** {see:complexOsc259t/symmetry} fold the waveform. They add harmonics; they do not change the note. Scroll each in turn.

There is more. **Ampl Mod** {see:complexOsc259t/amplMod} and **Timbre Mod** {see:complexOsc259t/timbreMod} drive the principal in place of Pitch Mod, and any of the three can be on together. The modulation oscillator has its own waveshape {see:complexOsc259t/modWave} — triangle, square or sawtooth — and that is the shape doing the driving. Its **Range** switch {see:complexOsc259t/modRange} moves it between audio rates and LFO rates.

The principal oscillator's own waveform is whichever output you cable: **Sine** {see:complexOsc259t/prinSineOut}, **Square** {see:complexOsc259t/prinSquareOut}, or **Final** {see:complexOsc259t/prinFinalOut} — the folded one, which is what you patched.

Move one at a time and listen.

Coming next: **Building a patch**.

## Building a patch

The default rack currently contains five modules: the Complex Oscillator {see:complexOsc259t}, Quad Function Generator {see:quadFn281t}, Sequencer / Programmer Eight {see:programmer-8}, Quad Low Pass Gate {see:lpg-292} and Mixer / Output {see:mixer}. (If nothing sounds, check the **ENGINE** lamp {see:mixer/engine} on the mixer.)

We'll work with the Quad Low Pass Gate {see:lpg-292} — move or resize the tutorial to see this module if necessary.

**Make a pluck:** a pluck is a short burst of sound — a signal passed through a gate that opens and shuts quickly, which is what a low pass gate does. Feed it the oscillator.

> **Do this** — Cable the Complex Oscillator's **Square** output {see:complexOsc259t/prinSquareOut} to the gate's **channel A** input {see:lpg-292/inA}, then the gate's **channel A** output {see:lpg-292/outA} to the mixer's **channel B** {see:mixer/chanB}. Nothing sounds yet — the gate stays shut until it is struck.

**Play it:** **Strike** {see:lpg-292/strikeA} opens the gate for an instant. **Decay** sets how long the tail rings.

> **Do this** — Press **Strike** on channel A {see:lpg-292/strikeA} for a pluck. Scroll **Decay** {see:lpg-292/decayA} up for a long tail, down for a blip.

**Clock it:** the gate has a clock that strikes a channel repeatedly.

> **Do this** — Turn on channel A's **Clock** button {see:lpg-292/clkOnA}, then **Run** {see:lpg-292/run} at the bottom of the module. The pluck repeats. Scroll **Rate** {see:lpg-292/rate} to change the tempo, and channel A's **clock ratio** {see:lpg-292/divA} to pulse at divisions or multiples of it — always in sync.

**Balance the two voices:** the drone runs into channel A, the plucks into channel B.

> **Do this** — Set the **channel A** {see:mixer/levelA} and **channel B** {see:mixer/levelB} faders against each other. The **Enable** buttons {see:mixer/muteA} below them switch a voice off and on.

> **Do this** — Turn channel A's **Enable** {see:mixer/muteA} off to mute the drone and hear the rhythm alone. Then shape it: on the oscillator work **Pitch**, **Timbre**, **Order**, **Symmetry**, **Mod Index** and the modulation buttons; on the gate, channel A's **Level** {see:lpg-292/levelA} and **Decay** {see:lpg-292/decayA}.

> **Bonus** — Add a second voice. Cable the oscillator's **Sine** output {see:complexOsc259t/prinSineOut} to the gate's **channel B** input {see:lpg-292/inB}, and the gate's **channel B** output {see:lpg-292/outB} to the mixer's **channel C** {see:mixer/chanC}. Turn on channel B's **Clock** {see:lpg-292/clkOnB} and set its **clock ratio** {see:lpg-292/divB} differently from channel A's. The two plucks drift in and out of step.

Coming next: **Getting around**.

## Getting around

You met the **Option** key in the essentials. This is what it buys you once the rack outgrows the window.

> **Do this** — Hold **Option** and scroll to zoom in on a module. Release it and you are back to normal, ready to turn a knob. Hold **Option** again and move the pointer to slide the view elsewhere. Mix zooming and moving until it feels natural.

**Cabling across the rack:** the Option key works while you carry a cable, so a target that is off screen is no obstacle.

> **Do this** — Zoom in until only part of the rack shows. Click an **output** to pick up a cable, then hold **Option** and move and zoom until the module you want appears — the cable trails from the pointer throughout. Release **Option** and click a terminal to drop it.

**A closer look at a scope:** drag a scope's border to make it bigger, or zoom the view over it to magnify it in place.

> **Do this** — Put a scope on an output that is sounding — the Complex Oscillator's **Final** {see:complexOsc259t/prinFinalOut}, say. Hover it, hold **Option** and scroll to zoom in, nudging the pointer to keep it in view. Zoom back out when you are done.

Coming next: **Seeing and hearing**.

## Seeing and hearing

**Listen to any point:** most outputs carry a signal whether or not a cable is plugged in. Right-click a terminal and hover **Monitor** to hear that point alone; move off and it stops. This is separate from your mix — the mixer is the sound you are building, a monitor checks one signal, brought up to a comfortable level. Slow signals work too: a clock ticks.

> **Do this** — Right-click a few outputs on the Complex Oscillator — the modulation **Triangle** {see:complexOsc259t/modTriOut}, the principal **Sine** {see:complexOsc259t/prinSineOut}, the **Final** {see:complexOsc259t/prinFinalOut} — and hover **Monitor** on each. If you built last section's patch, try the gate's **Clk Out** {see:lpg-292/clkOut} to hear the clock.

**Keep a monitor:** click **Monitor** instead of hovering and one drops on the rack where you clicked. It stays live and is saved with your patch, so several can run at once. Scroll it to set its level, click it to mute and unmute — a green ring means on — and close it with the red button at its upper left. Drag its body to move it.

> **Do this** — Right-click a terminal and click **Monitor**. A ring appears around the terminal with a line to the monitor, marking which signal it hears. Drop a couple more, scroll each to set its level, then click to mute and click again to restore.

**The two buses:** the mixer carries **Master** — the mix from the six channels — and **Monitor**, the sum of every monitor you have dropped. They are independent: play either, both or neither. Dropping a monitor switches the Monitor bus on. Both sit beneath the engine, which is why their lamps dim when it is off.

> **Do this** — With a monitor or two running, set the **Monitor** fader {see:mixer/monitorLevel} against the **Master** {see:mixer/master}, then toggle the enable lamps below them — Master off to hear only monitors, Monitor off to keep only the mix.

**See a signal:** the same menu's **Scope** shows its shape. Hover **Scope** and one appears beside the pointer, drawing live; move off and it goes. It scales itself and triggers on rising edges, so the trace holds still — fast or slow. A signal with no clear rising edge, like the **Final** output under modulation, will not lock, and that trace keeps moving.

> **Do this** — Right-click the principal **Square** output {see:complexOsc259t/prinSquareOut} and hover **Scope** for a steady waveform. Try the modulation **Triangle** {see:complexOsc259t/modTriOut} and the gate's **Clk Out** {see:lpg-292/clkOut} — the slow clock locks just as well.

**Keep a scope:** click the **Scope** menu item, or the peeked scope's face, and it drops where you clicked. Like a monitor it draws a callout ring, stays live and is saved with your patch.

> **Do this** — Right-click the principal **Square** output {see:complexOsc259t/prinSquareOut} and click **Scope**. Scroll the **Pitch** knob {see:complexOsc259t/prinFreq} and watch the wavelength squeeze and stretch. Then keep a scope on the gate's **Clk Out** {see:lpg-292/clkOut} and scroll its **Rate** {see:lpg-292/rate} — the pulses crowd together and spread apart.

**Move or remove a scope:** the callout ring has a grab handle. Drag the ring onto another terminal and the scope re-probes there. Drag it out over empty space and release, and the scope goes — the same gesture as pulling a cable off.

> **Do this** — Drag a kept scope's ring onto a different terminal, then drag it out over empty rack and release to remove it.

**Freeze a moving trace:** a heavily modulated signal shifts too much between cycles for the trigger to lock. Hover the scope and press its **freeze** button, lower left, to hold the picture as it was. Press again to run. It works on steady signals too.

> **Do this** — Keep a scope on the **Final** output {see:complexOsc259t/prinFinalOut}, press **Pitch Mod** {see:complexOsc259t/pitchMod} and raise **Mod Index** {see:complexOsc259t/modIndex}. The trace will not settle. Press **freeze** to catch one frame, then press again to run.

The scope has its own trigger controls as well. Dual trace is planned.

Coming next: **Saving your work**.

## Saving your work

**Nothing is lost when you close:** DreamRack remembers your session as you go, in the desktop app and in a browser. Reopen it and you are where you left off — the same modules, cables, settings, scopes and monitors. Saving is for something else: keeping a named version you can return to or hand to someone.

> **Do this** — Turn a knob, quit, and reopen. It comes back as you left it.

**Save a patch:** **File ▸ Save**, or **Save As…** to name a new one. Patches go to your Documents as files you can copy or share. In a browser, saving files to disk needs Chrome or Edge; other browsers still keep your work in their own storage and restore it on reload, but cannot export named versions.

> **Do this** — **File ▸ Save As…**, name the patch, save. That file holds the whole setup.

**Open and revert:** **File ▸ Open** loads a saved patch. **File ▸ Recent** lists them newest first, including the one you have open — choosing it re-reads it from disk, which is how you revert.

> **Do this** — Turn a knob, then pick the patch you just saved from **File ▸ Recent**. It reloads, discarding the change.

**What a patch holds:** every module and its place on the rack, every cable and its bends, every knob and switch, and the scopes and monitors you left on, with their positions and settings. It reopens exactly as you had it.

Coming next: **Vocabulary**.

## Vocabulary

The terms the rest of the tutorial uses. Skip it if you already patch — it sits at the end so it is here when you want it, not in the way when you don't.

- **Synthesizer** — an electronic instrument that makes sound. A *modular* synthesizer, like DR, isn't one fixed instrument but a set of separate parts you connect however you like, so you build the instrument as you go, adding modules and then connecting them.
- **Module** — one piece of the instrument: a single faceplate with its own knobs and jacks, like the oscillator {see:complexOsc259t}, the low-pass gate {see:lpg-292}, or the mixer {see:mixer} here.
- **Rack** — the frame that holds the modules {see:quadFn281t}, arranged in rows like a physical modular case. A rack holds a number of modules that can be wired together with cables so one feeds into the next; that flow of signal from module to module creates an instrument that makes sound.
- **Jack (terminal)** — a socket on a module. An **output** {see:complexOsc259t/prinSineOut} sends a signal out; an **input** {see:lpg-292/inA} takes one in. These look like a small coloured ring with a black hole in the centre.
- **Signal** — what travels along a cable. Three kinds: **audio** (what you hear), **control voltage** or **CV** (a voltage that moves a control for you instead of being heard), and **triggers or gates** (on-off pulses that start or time things). Each kind has its own colour, on the terminals and on the cables: **audio** {see:complexOsc259t/prinFinalOut}, **CV** {see:complexOsc259t/modCvOut}, **trigger** {see:lpg-292/trigA}. DR colours each cable to match the terminal it plugs into.
- **Cable (patch cord)** — the connection you draw from an output to an input.
- **Patch** — the whole arrangement: which modules you have, how they're wired, and every setting. "Patching" is the act of wiring it up; your patch is your current setup, and it's what you save.

That's the tour. From here it's yours — build, listen, and see where it takes you.
