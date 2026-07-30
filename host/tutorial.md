# DreamRack — Interactive tutorial

<!--
This file is BOTH the document you are reading and the exact copy the app shows in its tutorial sections. Editing it here changes the tutorial; there is no build step.

Format (parsed by host/tutorial-md.js):
  ## Heading         starts a section; the heading becomes its title
  paragraph          a paragraph — write it on ONE line, the section wraps it
  - item             consecutive items become one bulleted list
  > **Example** — …  an "Example" block; the bold text is its label

Inline: **bold**, *italic*, ==key term== (the accent colour), [text](url), `code`. Text above the first ## is preamble for a human reader and never reaches the app.

House style: the reader has probably used a software modular before, and they all differ in interface and terminology — so the job is to map, not to teach. One section per heading, each a complete covering of it. No sales pitch; they've read the README.

Order earns its place: the reader should reach a sound early, so nothing that can wait goes in front of that. A retired preamble section is kept in design/tutorial-before-you-start.md.
-->

This is the tutorial DreamRack shows in its floating window — one continuous document you scroll, opened on a first run and from Help ▸ Interactive tutorial. It's written for someone who has used a software modular before, so rather than teaching synthesis it maps what you already know onto this one — and points out where DreamRack differs.

## Contents

- [**A few essentials**](#a-few-essentials) — the handful of things that work differently here
- [**First sound**](#first-sound) — the shortest path to hearing something
- [**Building a patch**](#building-a-patch) — adding modules, and how cables behave here
- [**Seeing and hearing**](#seeing-and-hearing) — scopes and monitors on any terminal
- [**Getting around**](#getting-around) — panning and zooming a rack bigger than the window
- [**Saving your work**](#saving-your-work) — saving, loading, and what carries over
- [**Vocabulary**](#vocabulary) — the modular terms this tutorial uses, if you want them

## A few essentials

Even if you've used a software modular before, there are a few things you need to know to succeed in DreamRack.

Also, hover a callout like this {see:mixer} in the tutorial to see any item being referred to.

==Dragging cables:== there is ==no dragging==. ==Click== an output and the cable follows the pointer with ==no button held==; click an input to connect it, or click empty space to let it go. Clicking a terminal that already has cables does one of two things, and the direction you move the mouse decides which: move along an existing cable and that cable lifts off, or move where there is no cable and you start a new one. Escape leaves everything where it was.

==Turning knobs:== ==hover== a knob and ==scroll== (i.e. don't press the mouse button, just turn the scroll wheel). Double-click any knob to reset it.

==Starting the engine:== nothing makes a sound until the engine is on. Press the space bar, or click **Engine** at the top of the **Rack** menu, or the **ENGINE** lamp {see:mixer/engine} on the mixer — all three are the same switch. Press again to stop.

==Menus:== the menu bar sits at the top of the window. ==Right-click a faceplate== for the same menu where you are working. Right-click a module's title bar for that module's own menu, and a knob or jack for that control's.

==Moving around:== hold the ==Option key== — Alt on Windows — then ==scroll== to zoom the view in and out, and move the pointer to travel across the rack (again, ==don't drag==). Try it: hold Option and scroll up to zoom in, move the pointer to bring another part of the rack into view, then hold Option and scroll all the way out to see the whole rack at once. You can do all of this while carrying a cable, since none of these actions needs a mouse button held.

## First sound

> **Example** — Click the **Final** output {see:complexOsc259t/prinFinalOut} on the Complex Oscillator, then click **channel A** {see:mixer/chanA} on the mixer. The cable is yellow — the colour of the audio input it landed on.

> **Example** — On the **Mixer / Output** module, turn on the **ENGINE** {see:mixer/engine} — the **MSTR** bus lamp {see:mixer/masterEnable} lights with it. Then set a comfortable level on the **Master** fader {see:mixer/master}.

That is your first sound. Now change it. Everything below is on the Complex Oscillator, and every control scrolls.

==Pitch:== the big **Pitch** knob {see:complexOsc259t/prinFreq} sets the note. Hover it and scroll (not drag) to hear the sound change.

==Modulate:== the module has two oscillators — the principal one you are hearing, and a modulation oscillator on the left that drives it. Press **Pitch Mod** {see:complexOsc259t/pitchMod} to set how it drives, then scroll **Mod Index** {see:complexOsc259t/modIndex} off its centre to set how far. Now scroll the modulation oscillator's **Frequency** {see:complexOsc259t/modFreq}: slow rates give vibrato, fast ones a new timbre.

==Shape:== **Timbre** {see:complexOsc259t/timbre}, **Order** {see:complexOsc259t/order} and **Symmetry** {see:complexOsc259t/symmetry} fold the waveform. They add harmonics; they do not change the note. Scroll each in turn.

There is more. **Ampl Mod** {see:complexOsc259t/amplMod} and **Timbre Mod** {see:complexOsc259t/timbreMod} drive the principal in place of Pitch Mod, and any of the three can be on together. The modulation oscillator has its own waveshape {see:complexOsc259t/modWave} — triangle, square or sawtooth — and that is the shape doing the driving. Its **Range** switch {see:complexOsc259t/modRange} moves it between audio rates and LFO rates.

The principal oscillator's own waveform is whichever output you cable: **Sine** {see:complexOsc259t/prinSineOut}, **Square** {see:complexOsc259t/prinSquareOut}, or **Final** {see:complexOsc259t/prinFinalOut} — the folded one, which is what you patched.

Move one at a time and listen.

## Building a patch

The default rack contains five modules: the Complex Oscillator {see:complexOsc259t}, Quad Function Generator {see:quadFn281t}, Sequencer / Programmer Eight {see:programmer-8}, Quad Low Pass Gate {see:lpg-292} and Mixer / Output {see:mixer}.

This section uses the Quad Low Pass Gate {see:lpg-292}. Move or resize the tutorial if it covers the module.

A low pass gate opens and shuts quickly, turning a continuous signal into a short burst — a pluck.

> **Example** — Cable the Complex Oscillator's **Square** output {see:complexOsc259t/prinSquareOut} to the gate's **channel A** input {see:lpg-292/inA}, and the gate's **channel A** output {see:lpg-292/outA} to the mixer's **channel B** {see:mixer/chanB}. Check that the engine is started and the master bus enabled (see above). Nothing sounds: the gate is shut.

**Strike** {see:lpg-292/strikeA} opens the gate once. **Decay** {see:lpg-292/decayA} sets the length of the tail.

> **Example** — Press **Strike** on channel A. Scroll **Decay** and press **Strike** again.

The gate also has a clock, which strikes a channel repeatedly.

> **Example** — Turn on channel A's **Clock** {see:lpg-292/clkOnA}, then **Run** {see:lpg-292/run} at the bottom of the module. Scroll **Rate** {see:lpg-292/rate} to set the tempo. Channel A's **clock ratio** {see:lpg-292/divA} divides or multiplies that rate.

The oscillator now reaches mixer channel A directly and channel B through the gate.

> **Example** — Set the **channel A** {see:mixer/levelA} and **channel B** {see:mixer/levelB} faders against each other. The **Enable** buttons {see:mixer/muteA} below them switch each voice off.

> **Example** — Switch channel A off and shape the plucks with the oscillator controls from the last section, and with channel A's **Level** {see:lpg-292/levelA} and **Decay** {see:lpg-292/decayA} on the gate.

> **Bonus** — Cable the oscillator's **Sine** output {see:complexOsc259t/prinSineOut} to the gate's **channel B** input {see:lpg-292/inB}, and channel B's output {see:lpg-292/outB} to mixer **channel C** {see:mixer/chanC}. Turn on channel B's **Clock** {see:lpg-292/clkOnB} and set its **clock ratio** {see:lpg-292/divB} differently from channel A's. The two plucks drift in and out of phase.

## Seeing and hearing

Most outputs carry a signal whether or not a cable is plugged into them. Right-click a terminal for its menu: hover **Monitor** to hear that point, hover **Scope** to see it. Move off and the peek ends.

> **Example** — Right-click the modulation **Triangle** {see:complexOsc259t/modTriOut}, the principal **Sine** {see:complexOsc259t/prinSineOut} and the **Final** {see:complexOsc259t/prinFinalOut} in turn, hovering **Monitor** on each. Then hover **Scope** on the principal **Square** {see:complexOsc259t/prinSquareOut}.

Clicking instead of hovering keeps the probe. It drops where you clicked, stays live and is saved with the patch, and a ring around the terminal, joined by a line, marks what it reads. Drag its body to move it. Dropping a monitor switches the Monitor bus on.

> **Example** — Right-click a terminal and click **Monitor**. Drop two more. Scroll each to set its level, click to mute and click again to restore, and close one with the red button at its upper left.

A scope scales itself and triggers on rising edges, so the trace holds still. A signal with no clear rising edge — the **Final** output under modulation — will not lock.

> **Example** — Keep a scope on the principal **Square** {see:complexOsc259t/prinSquareOut} and scroll **Pitch** {see:complexOsc259t/prinFreq}: the wavelength changes. Keep another on the gate's **Clk Out** {see:lpg-292/clkOut} and scroll **Rate** {see:lpg-292/rate}.

Freeze holds the picture as it was. Hover a scope and press the freeze button at its lower left; press again to run.

> **Example** — Keep a scope on the **Final** output {see:complexOsc259t/prinFinalOut}, press **Pitch Mod** {see:complexOsc259t/pitchMod} and raise **Mod Index** {see:complexOsc259t/modIndex}. The trace will not settle. Press **freeze**.

The callout ring has a grab handle. Drag it to another terminal to re-probe there, or out over empty rack to remove the probe.

> **Example** — Drag a kept scope's ring onto a different terminal, then out over empty rack to remove it.

The mixer's **Monitor** bus sums every monitor you have dropped; **Master** is the mix from the six channels. Both sit beneath the engine.

> **Example** — Set the **Monitor** fader {see:mixer/monitorLevel} against the **Master** {see:mixer/master}, then toggle the enable lamps below them.

## Getting around

The Option key, from the essentials, is how you reach a rack larger than the window.

> **Example** — Hold **Option** and scroll to zoom in, then move the pointer to bring another part of the rack into view. Release **Option** to work a control.

Option also works while you carry a cable, so a target off screen is still reachable.

> **Example** — Zoom in until only part of the rack shows. Click an **output** to pick up a cable, hold **Option**, and move and zoom until the module you want appears. Release **Option** and click a terminal to drop the cable.

Zooming magnifies a scope in place. Dragging its border resizes it instead.

> **Example** — Put a scope on an output that is sounding — the Complex Oscillator's **Final** {see:complexOsc259t/prinFinalOut}, say. Hover it, hold **Option** and scroll.

## Saving your work

**Nothing is lost when you close:** DreamRack remembers your session as you go, in the desktop app and in a browser. Reopen it and you are where you left off — the same modules, cables, settings, scopes and monitors. Saving is for something else: keeping a named version you can return to or hand to someone.

> **Example** — Turn a knob, quit, and reopen. It comes back as you left it.

**Save a patch:** **File ▸ Save**, or **Save As…** to name a new one. Patches go to your Documents as files you can copy or share. In a browser, saving files to disk needs Chrome or Edge; other browsers still keep your work in their own storage and restore it on reload, but cannot export named versions.

> **Example** — **File ▸ Save As…**, name the patch, save. That file holds the whole setup.

**Open and revert:** **File ▸ Open** loads a saved patch. **File ▸ Recent** lists them newest first, including the one you have open — choosing it re-reads it from disk, which is how you revert.

> **Example** — Turn a knob, then pick the patch you just saved from **File ▸ Recent**. It reloads, discarding the change.

**What a patch holds:** every module and its place on the rack, every cable and its bends, every knob and switch, and the scopes and monitors you left on, with their positions and settings. It reopens exactly as you had it.

## Vocabulary

Skip it if you already patch — it sits at the end so it is here when you want it, not in the way when you don't.

- **Synthesizer** — an electronic instrument that makes sound. A *modular* synthesizer, like DR, isn't one fixed instrument but a set of separate parts you connect however you like, so you build the instrument as you go, adding modules and then connecting them.
- **Module** — one piece of the instrument: a single faceplate with its own knobs and jacks, like the oscillator {see:complexOsc259t}, the low-pass gate {see:lpg-292}, or the mixer {see:mixer} here.
- **Rack** — the frame that holds the modules {see:quadFn281t}, arranged in rows like a physical modular case. A rack holds a number of modules that can be wired together with cables so one feeds into the next; that flow of signal from module to module creates an instrument that makes sound.
- **Jack (terminal)** — a socket on a module. An **output** {see:complexOsc259t/prinSineOut} sends a signal out; an **input** {see:lpg-292/inA} takes one in. These look like a small coloured ring with a black hole in the centre.
- **Signal** — what travels along a cable. Three kinds: **audio** (what you hear), **control voltage** or **CV** (a voltage that moves a control for you instead of being heard), and **triggers or gates** (on-off pulses that start or time things). Each kind has its own colour, on the terminals and on the cables: **audio** {see:complexOsc259t/prinFinalOut}, **CV** {see:complexOsc259t/modCvOut}, **trigger** {see:lpg-292/trigA}. DR colours each cable to match the terminal it plugs into.
- **Cable (patch cord)** — the connection you draw from an output to an input.
- **Patch** — the whole arrangement: which modules you have, how they're wired, and every setting. "Patching" is the act of wiring it up; your patch is your current setup, and it's what you save.

That's the tour. From here it's yours — build, listen, and see where it takes you.
