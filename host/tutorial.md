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

- [**Using the tutorial**](#using-the-tutorial) — the three things you can click
- [**Fast first sound**](#fast-first-sound) — open a patch that already works, and turn its knobs
- [**A few essentials**](#a-few-essentials) — the handful of things that work differently here
- [**First sound**](#first-sound) — the shortest path to hearing something
- [**Building a patch**](#building-a-patch) — adding modules, and how cables behave here
- [**Seeing and hearing**](#seeing-and-hearing) — scopes and monitors on any terminal
- [**Getting around**](#getting-around) — pages, and a rack bigger than the window
- [**Saving your work**](#saving-your-work) — saving, loading, and what carries over
- [**Vocabulary**](#vocabulary) — the modular terms this tutorial uses, if you want them

## Using the tutorial

- {icon:listen} Click the speaker button to listen to something.
- {icon:find} Click the question mark button to find something.
- {icon:demo} Click the play button to see a demonstration.

Where there is a demonstration, the short list just above it is not a set of instructions — it is what to ==watch for== while the demonstration runs. Read it, watch, and then try the same thing yourself.

## Fast first sound

A ==patch== is a set of ==modules== wired together to make an "interesting" sound. To start quickly we'll load one that already exists, play it, and learn about it.

Open the **File** menu, go to the ==Examples== submenu and choose **First drone** to load it. Note that opening it will replace what is on the rack.

**Watch for:**

- You'll find example patches in the **File** menu, under **Examples**.
- This one has three modules and one cable.
- The cable goes off the page to the **Mixer / Output** tab.
- It carries on from that tab, on the mixer's page.
- The **ENGINE** button {see:mixer/engine}, above the mixer's output faders, gates the sound. The ==space bar== does the same from anywhere.
- The **Master** fader {see:mixer/master} sets how loud it is.

{demo:fast-first-sound}

Almost every knob and button above the bottom row on the Complex Oscillator can change the sound. Knobs are adjusted by holding the mouse pointer over them (hovering) and scrolling (not dragging) i.e. operating the scroll wheel on your mouse or two finger drag on your trackpad.

- ==Pitch== {see:complexOsc259t/prinFreq} sets the frequency of the sound.
- ==Pitch Mod== {see:complexOsc259t/pitchMod} hands the sound over to the second oscillator on the left, and ==Mod Index== {see:complexOsc259t/modIndex} sets how hard it drives.
- The modulation oscillator's own ==Frequency== {see:complexOsc259t/modFreq} decides what that sounds like: slow is vibrato, fast is a new timbre.
- ==Timbre== {see:complexOsc259t/timbre} folds the waveform — more harmonics, same note.

**Watch for:**

- Point at a knob and scroll. No button is pressed.
- **Pitch** changes the note.
- **Pitch Mod** brings in the second oscillator, and **Mod Index** sets how hard it drives.
- Slow modulation gives vibrato; fast modulation changes the timbre.
- **Timbre** adds harmonics without changing the note.

{demo:fast-knobs}

Then keep going on your own. **Ampl Mod** {see:complexOsc259t/amplMod} and **Timbre Mod** {see:complexOsc259t/timbreMod} drive the principal oscillator in other ways, and any of the three can be on together. **Order** {see:complexOsc259t/order} and **Symmetry** {see:complexOsc259t/symmetry} change the shape of the fold. The modulation oscillator has a ==Range== switch {see:complexOsc259t/modRange} between audio rates and slow ones, and a waveshape {see:complexOsc259t/modWave} of its own — and that is the shape doing the driving.


The sound leaves by a cable you can see. It runs from the oscillator's **Final** output {see:complexOsc259t/prinFinalOut} to the right of the rack, and ends at a button under the **Mixer / Output** tab — because the mixer is on its own page.

**Watch for:**

- One cable leaves the oscillator's **Final** output.
- It ends at a button under the **Mixer / Output** tab.
- On the mixer's page it arrives at input one.
- **Audio 1** goes back to the modules.

{demo:fast-output}

## A few essentials

Even if you've used a software modular before, there are a few things you need to know to succeed in DreamRack.

==Connecting cables:== ==click== an output and the cable follows the pointer with ==no button held==; click an input to connect it, or click empty space to let it go. Clicking a terminal that already has cables does one of two things, and the direction you move the mouse decides which: move along an existing cable and that cable lifts off, or move where there is no cable and you start a new one. Escape leaves everything where it was.

{demo:cables}

==Turning knobs:== ==hover== a knob and ==scroll== (i.e. don't press the mouse button, just turn the scroll wheel). Double-click any knob to reset it.

{demo:knobs}

==Starting the engine:== nothing makes a sound until the engine is on. Press the space bar, or click **Engine** at the top of the **Rack** menu, or the **ENGINE** lamp {see:mixer/engine} on the mixer — all three are the same switch. Press again to stop.

{demo:engine}


==Menus:== the menu bar sits at the top of the window. ==Right-click a faceplate== for the same menu where you are working. Right-click a module's title bar for that module's own menu, and a knob or jack for that control's.

==Getting around:== the rack is split into ==pages==, with a tab for each across the top. Click a tab to go there. There is a section on this below.

## First sound

> **Example** — Click the **Final** output {see:complexOsc259t/prinFinalOut} on the Complex Oscillator, then click **channel A** {see:mixer/chanA} on the mixer. The cable is yellow — the colour of the audio input it landed on.

{demo:first-sound}



> **Example** — On the **Mixer / Output** module, turn on the **ENGINE** {see:mixer/engine} — the **MSTR** bus lamp {see:mixer/masterEnable} lights with it. Then set a comfortable level on the **Master** fader {see:mixer/master}.

That is your first sound. Now change it. Everything below is on the Complex Oscillator, and every control scrolls.


==Pitch:== the big **Pitch** knob {see:complexOsc259t/prinFreq} sets the note. Hover it and scroll (not drag) to hear the sound change.

==Modulate:== the module has two oscillators — the principal one you are hearing, and a modulation oscillator on the left that drives it. Press **Pitch Mod** {see:complexOsc259t/pitchMod} to set how it drives, then scroll **Mod Index** {see:complexOsc259t/modIndex} off its centre to set how far. Now scroll the modulation oscillator's **Frequency** {see:complexOsc259t/modFreq}: slow rates give vibrato, fast ones a new timbre.

==Shape:== **Timbre** {see:complexOsc259t/timbre}, **Order** {see:complexOsc259t/order} and **Symmetry** {see:complexOsc259t/symmetry} fold the waveform. They add harmonics; they do not change the note. Scroll each in turn.

There is more. **Ampl Mod** {see:complexOsc259t/amplMod} and **Timbre Mod** {see:complexOsc259t/timbreMod} drive the principal in place of Pitch Mod, and any of the three can be on together. The modulation oscillator has its own waveshape {see:complexOsc259t/modWave} — triangle, square or sawtooth — and that is the shape doing the driving. Its **Range** switch {see:complexOsc259t/modRange} moves it between audio rates and LFO rates.

The principal oscillator's own waveform is whichever output you cable: **Sine** {see:complexOsc259t/prinSineOut}, **Square** {see:complexOsc259t/prinSquareOut}, or **Final** {see:complexOsc259t/prinFinalOut} — the folded one, which is what you patched.

Move one at a time and listen.

## Building a patch

Carry straight on from the last section, or load **First drone** again for a clean start from something familiar. Either way you have the Complex Oscillator {see:complexOsc259t} going into the mixer, and two modules sitting unused: the Quad Low Pass Gate {see:lpg-292} and the Quad Function Generator {see:quadFn281t}.

The drone is about to be in the way. You do not have to unplug it — every mixer channel has an ==Enable== button {see:mixer/enableA} under its fader, and switching one off silences that channel while leaving everything wired exactly as it is. That is how you audition one part of a patch against another.

> **Example** — Switch **channel one** {see:mixer/enableA} off on the mixer. The cable is still there; the drone is not.

{demo:mute}

Now the Quad Low Pass Gate {see:lpg-292}. It opens and shuts quickly, turning a continuous signal into a short burst — a pluck. Move or resize the tutorial if it covers the module.

> **Example** — Cable the Complex Oscillator's **Square** output {see:complexOsc259t/prinSquareOut} to the gate's **channel A** input {see:lpg-292/inA}, and the gate's **channel A** output {see:lpg-292/outA} to the mixer's **channel two** {see:mixer/chanB}. Nothing sounds: the gate is shut.

{demo:gate-patch}



**Strike** {see:lpg-292/strikeA} opens the gate once. **Decay** {see:lpg-292/decayA} sets the length of the tail.

> **Example** — Press **Strike** on channel A. Scroll **Decay** and press **Strike** again.

{demo:strike}



The gate also has a clock, which strikes a channel repeatedly.

> **Example** — Turn on channel A's **Clock** {see:lpg-292/clkOnA}, then **Run** {see:lpg-292/run} at the bottom of the module. Scroll **Rate** {see:lpg-292/rate} to set the tempo. Channel A's **clock ratio** {see:lpg-292/divA} divides or multiplies that rate.

{demo:gate-clock}



The oscillator now reaches mixer channel A directly and channel B through the gate.

> **Example** — Set the **channel A** {see:mixer/levelA} and **channel B** {see:mixer/levelB} faders against each other. The **Enable** buttons {see:mixer/enableA} below them switch each voice off.

{demo:mixing}



> **Example** — Switch channel A off and shape the plucks with the oscillator controls from the last section, and with channel A's **Level** {see:lpg-292/levelA} and **Decay** {see:lpg-292/decayA} on the gate.

{demo:shaping}



> **Bonus** — Cable the oscillator's **Sine** output {see:complexOsc259t/prinSineOut} to the gate's **channel B** input {see:lpg-292/inB}, and channel B's output {see:lpg-292/outB} to mixer **channel C** {see:mixer/chanC}. Turn on channel B's **Clock** {see:lpg-292/clkOnB} and set its **clock ratio** {see:lpg-292/divB} differently from channel A's. The two plucks drift in and out of phase.

{demo:two-voices}



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

==Pages:== the rack is divided into pages, each with a tab across the top — **Audio 1** to begin with, plus **Mixer / Output** and **Video**. Click a tab to go to that page.

A cable can cross between them. Under every tab is a row of buttons, one per mixer input: drop a cable on one and it connects to the mixer on its own page, leaving a stub at the tab to show where it went. Click the tab to follow it.

{demo:tabs}

Add a page with the ==+== button at the end of the tab bar, and rename one by double-clicking its tab. A rack that has grown past one screenful is usually better split across pages than squeezed onto one.

==Also worth knowing:== the ==Option key== — Alt on Windows — zooms and pans within a page. Hold it and scroll to zoom toward the pointer, move the pointer to travel, and release it to work a control again. It works while you are carrying a cable, so a terminal off the edge of the window is still reachable, and it magnifies a scope in place.

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
