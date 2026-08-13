# What a demo says

This file is the source. Edit it, run `npm run speech`, and the app says the new words — nothing is
generated from it and no code needs touching.

## Voice

- voice: Jamie (Premium)
- rate: 175

The voice every fragment is rendered in, and its speed in words per minute. Change either and
`npm run speech` re-renders everything in the new voice.

`say -v '?'` in a terminal lists what is installed. Only the **premium** and **enhanced** voices are
worth using — the plain ones are the old-generation synthesiser and sound it.

# What things are called

Every phrase below that says `{target}` has this table's wording dropped into it. The whole noun
phrase is written here rather than assembled from parts, so you control two things at once: saying
enough to disambiguate — *channel A*, not just *the output* — and how the sentence scans. Jamie
stumbles on two stressed nouns in a row, so "the output terminal of channel A" reads better aloud
than "the channel A output terminal", and leaving "terminal" stranded at the end of a sentence is
what made it sound robotic in the first place.

Use the words a reader can SEE on the panel, not the internal name. The oscillator's principal output
is `prinFinalOut` in the code and prints as "final" under PRINCIPAL OSC OUTPUTS — so that is what the
narration should describe.

A control with no entry falls back to its name from the module descriptor, which is usually terse and
sometimes an abbreviation, so anything a demo actually points at is worth writing here.

| Control | Spoken as |
| --- | --- |
| osc:prinFinalOut | the final output of the principal oscillator |
| osc:timbre | the timbre knob |
| lpg:inA | the input terminal of channel A |
| lpg:outA | the output terminal of channel A |
| lpg:run | the run button on the gate's clock |
| lpg:clkOnA | the clock button for channel A |
| mixer:chanA | the mixer input for channel one |
| mixer:chanB | the mixer input for channel two |
| mixer:chanC | the mixer input for channel three |
| mixer:engine | the engine button on the mixer |
| mixer:master | the master fader |
| mixer:levelA | the fader for channel one |
| mixer:levelB | the fader for channel two |
| mixer:muteA | the enable button under channel one |
| mixer:monitorLevel | the monitor fader |
| osc:prinSquareOut | the square output of the principal oscillator |
| osc:prinSineOut | the sine output of the principal oscillator |
| osc:prinFreq | the big pitch knob |
| osc:symmetry | the symmetry knob |
| osc:order | the order knob |
| osc:pitchMod | the pitch mod button |
| osc:modIndex | the mod index knob |
| osc:modFreq | the modulation oscillator's frequency knob |
| lpg:inB | the input terminal of channel B |
| lpg:levelCvA | the control input on channel A's level knob |
| osc:modTriOut | the triangle output of the modulation oscillator |
| clk:bpm | the tempo window |
| clk:ratio1 | the ratio for clock one |
| clk:ratio2 | the ratio for clock two |
| clk:delay2 | the delay for clock two |
| clk:swing1 | the swing knob for clock one |
| clk:ppqn | the pulses per quarter note |
| clk:run | the clock's run button |
| clk:clkOut | the clock's master output |
| clk:clk1Out | the first clock output |
| clk:clk2Out | the second clock output |
| mar:tClockIn | the rhythm side's clock input |
| mar:dejaVu | the déjà vu knob |
| mar:dejaVuLength | the loop length |
| mar:tBias | the rhythm bias knob |
| mar:xSpread | the spread knob |
| mar:xSteps | the steps knob |
| mar:t1Out | the first gate output |
| mar:x1Out | the first voltage output |
| lpg:outB | the output terminal of channel B |
| lpg:strikeA | the strike button on channel A |
| lpg:decayA | the decay knob on channel A |
| lpg:levelA | the level knob on channel A |
| lpg:clkOnB | the clock button for channel B |
| lpg:rate | the rate knob on the gate's clock |
| lpg:divA | the clock ratio for channel A |
| lpg:divB | the clock ratio for channel B |

# How this file works

Each action the app can narrate has a heading, which is a **camelCase key**. The code asks for the key
by name, so a mistyped heading fails loudly rather than quietly saying nothing. Under each one:

- **Badge** — the words shown in the chip beside the pointer. One value, not a list: it should stay
  put, because it is read at a glance rather than listened to.
- **Long** — what to say early on, when the reader does not yet know the vocabulary.
- **After** — what to say when the move just before it already named the thing.
- **Short** — what to say later, once they do.

**After** is what to say when the thing was named a moment ago — the pointer moves to the enable
button, so the click that follows says "click it" rather than naming the button all over again. Used
only at Long verbosity, since that is the only one where the move named anything. Leave it out and
the Long list is used instead.

Long, After and Short are **lists of alternatives**. The app picks a different one each time an action comes
round, so the tenth click does not sound like a recording of the first. The pick varies from one
occurrence to the next but is the same on every replay, so two takes of the same reel narrate
identically.

Several actions share a badge word and a short form while needing quite different long forms — taking
hold of a cable and pressing a button are both a left click, but they want different sentences the
first time you meet them. That is why the headings are more numerous than the badge words.

An empty Long or Short list means say nothing for that action at that verbosity. The badge still shows.

Add headings freely as the demos grow. Adding a *new* one needs a line of code to ask for it; editing
the words under an existing one does not.

---

## moveToOutput

**Badge** move pointer

**Long**
- move the pointer to {target}
- move the pointer across to {target}

**Short**
- move to the output
- move

## moveToInput

**Badge** move pointer

**Long**
- move the pointer to {target}
- move the pointer across to {target}

**Short**
- move to the input
- move

## moveToKnob

**Badge** move pointer

**Long**
- move the pointer to {target}
- move the pointer across to {target}

**Short**
- move to the knob
- move

## moveToButton

**Badge** move pointer

**Long**
- move the pointer to {target}
- move the pointer across to {target}

**Short**
- move to the button
- move

## moveToTab

**Badge** move pointer

**Long**
- move the pointer to the tab
- move the pointer up to the tab

**Short**
- move to the tab
- move

## pickUpCable

**Badge** left click

**Long**
- left click {target} to take hold of a cable
- click {target}, and a cable comes with the pointer

**After**
- click it, and a cable comes with the pointer
- click it to take hold of a cable

**Short**
- click
- click it

## dropCable

**Badge** left click

**Long**
- left click {target} to drop the cable into it
- click {target}, and the cable lands

**After**
- click it, and the cable lands
- and click it

**Short**
- click
- and click

## pressButton

**Badge** left click

**Long**
- left click {target}
- press {target}

**After**
- click it
- press it

**Short**
- click
- press it

## turnKnob

**Badge** scroll-wheel

**Long**
- turn the scroll wheel over {target}
- roll the wheel to move {target}

**After**
- turn the scroll wheel over it
- roll the wheel to move it

**Short**
- scroll
- wheel it

## rightClick

**Badge** right click

**Long**
- right click {target} to open its menu
- right click {target}

**After**
- right click it to open its menu
- right click it

**Short**
- right click

## moveToMenuItem

**Badge** move pointer

**Long**
- move the pointer down the menu
- move down to the item

**Short**
- move

## chooseItem

**Badge** left click

**Long**
- click it
- choose it

**Short**
- click

## moveToReadout

**Badge** move pointer

**Long**
- move the pointer to {target}
- move the pointer across to {target}

**After**
- move the pointer to it
- move across to it

**Short**
- move to the window
- move

## openList

**Badge** left click

**Long**
- click {target} and every value it can take opens over it
- click {target} to open its list of values

**After**
- click it and every value it can take opens over it
- click it to open its list

**Short**
- click to open the list
- open the list

## moveToListItem

**Badge** move pointer

**Long**
- move the pointer down the list to the value
- move down the list

**Short**
- move down the list
- move

## chooseValue

**Badge** left click

**Long**
- click the value and the list closes on it
- click to choose it

**Short**
- click
- choose it

## switchPage

**Badge** left click

**Long**
- left click the tab to go to that page
- click the tab

**After**
- click it to go to that page
- click it

**Short**
- click
- click the tab

# Where the rest of the words are

The narration proper — the sentences on the cards — lives with each demo, in its own file in this
folder: `intro.json`, and one per demo after it. Each step's `note` is what gets spoken and shown.
Editing those by hand is fine for now; from Phase 4 they become editable in the app itself, where you
can hear a line in place and re-dictate it until it sits right.

A step can also override the lot with its own `"say": "..."` where a stock phrase reads badly.

Re-running `npm run speech` after any edit here or there re-renders only the lines that changed.
