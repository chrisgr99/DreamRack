# What a demo says

This file is the source. Edit it, run `npm run speech`, and the app says the new words — nothing is
generated from it and no code needs touching.

## Voice

- voice: Karen (Premium)
- rate: 150

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
| dly:audioIn | the delay's input |
| dly:clockIn | the delay's clock input |
| dly:mixOut | the delay's mix output |
| dly:time | the time knob |
| dly:feedback | the feedback knob |
| dly:tone | the tone knob |
| mixer:chanC | the mixer input for channel three |
| lpg:outB | the output terminal of channel B |
| lpg:strikeA | the strike button on channel A |
| lpg:decayA | the decay knob on channel A |
| lpg:levelA | the level knob on channel A |
| lpg:clkOnB | the clock button for channel B |
| lpg:rate | the rate knob on the gate's clock |
| lpg:divA | the clock ratio for channel A |
| lpg:divB | the clock ratio for channel B |
| videoOut:imageIn | the video output's image input |
| videoOut:window | the window button on the video output |
| videoOut:test | the test pattern button |
| field:fieldOut | the field output |
| field:field | the field selector — which way the space is read |
| field:scale | the scale knob, which zooms the space |
| field:polar | the polar knob, which bends the grid round the centre |
| field:twist | the twist knob, which turns the space further the further out you go |
| field:tile | the tile knob, which repeats the space across the frame |
| field:quantise | the quantise knob, which steps the field into bands |
| field:scroll | the scroll knob, which drifts the picture on its own |
| field:rotate | the rotate knob, which turns the whole space |
| field:offsetXCv | the X jack in the middle of the coordinate field's X knob |
| field:offsetYCv | the Y jack in the middle of the coordinate field's Y knob |
| shapes:fieldIn | the field input on shapes |
| shapes:shapeOut | the shape output of shapes |
| shapes:centre | the centre knob on shapes |
| shapes:width | the width knob on shapes |
| shapes:soft | the soft knob on shapes |
| shapes:mode | the mode switch on shapes |
| timeMachine:imageIn | the image input on the time module |
| timeMachine:imageOut | the image output of the time module |
| timeMachine:mode | the mode selector on the time module |
| timeMachine:spread | the spread knob on the time module |
| poly:sides | the sides knob, which counts the corners |
| poly:size | the size knob |
| poly:star | the star knob, which pulls the corners into points |
| poly:outline | the outline knob, which hollows the shape out |
| poly:shapeOut | the polygon's output |
| sym:sectors | the sectors knob, which sets how many times the frame is folded |
| sym:rotate | the rotate knob, which turns what is folded |
| sym:spread | the spread knob, which decides how much of the frame is folded |
| sym:mode | the fold switch |
| sym:imageIn | symmetry's image input |
| sym:imageOut | symmetry's output |
| grid:cols | the columns knob |
| grid:rows | the rows knob |
| grid:brick | the brick knob, which offsets alternate rows |
| grid:vary | the vary knob, which makes the cells differ |
| grid:imageIn | the grid's image input |
| grid:imageOut | the grid's output |
| col:spread | the spread knob, which stretches the image across the palette |
| col:shift | the shift knob, which slides it along |
| col:cycle | the cycle knob, which turns the palette under the picture |
| col:palette | the palette list |
| col:imageIn | the colorizer's image input |
| col:imageOut | the colorizer's output |
| chr:hue | the hue knob, which turns every colour at once |
| chr:sat | the saturation knob |
| chr:contrast | the contrast knob |
| chr:level | the level knob |
| chr:imageIn | chroma's image input |
| chr:imageOut | chroma's output |
| maths:aIn | the A input on video maths |
| maths:bIn | the B input |
| maths:outImage | the output of video maths |
| maths:op | the operation list |
| maths:amount | the amount knob, which dials the operation in |
| out:imageIn | the video output's image input |
| videoMaths:aIn | the A input on video maths |
| videoMaths:bIn | the B input on video maths |
| videoMaths:outImage | the output of video maths |
| videoMaths:op | the operation selector on video maths |
| compositor:aIn | the A input on the compositor |
| compositor:bIn | the B input on the compositor |
| compositor:keyIn | the key input on the compositor |
| compositor:imageOut | the compositor's output |
| compositor:mode | the blend list on the compositor |
| compositor:key | the key amount knob on the compositor |
| lfo:fnA | the function generator's channel A output |
| lfo:fnB | the function generator's channel B output |
| lfo:modeA | the mode switch for channel A |
| lfo:modeB | the mode switch for channel B |
| lfo:attackA | the attack knob on channel A |
| lfo:decayA | the decay knob on channel A |
| lfo:quadEnAB | the quadrature button for channels A and B |

# How this file works

Each action the app can narrate has a heading, which is a **camelCase key**. The code asks for the key
by name, so a mistyped heading fails loudly rather than quietly saying nothing. Under each one:

- **Badge** — the words shown in the chip beside the pointer. One value, not a list: it should stay
  put, because it is read at a glance rather than listened to.
- **Long** — what to say early on, when the reader does not yet know the vocabulary.
- **After** — what to say when the move just before it already named the thing.
- **Short** — what to say later, once they do.
- **Combined** — the WHOLE gesture in one sentence, said while the pointer is still travelling: "click
  the enable button", not "move the pointer to the enable button" and then "click it". This is what a
  reel uses. The two-part form is a tutorial's, for a reader being taught the gesture itself.

A gesture is narrated less the more often it happens: in full the first time that kind of action comes
round, briefly the second, and silently after that. And a gesture whose control the step's own NOTE has
already named says nothing at all — the note has done the naming, and saying it again is the same words
twice in two breaths. The badge beside the pointer still shows every time, so what is happening stays
legible without being spoken. A step can override all of this with its own `say`, or force a level with
`voice`.

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

**Combined**
- take a cable from {target}
- let's take a cable from {target}
- we'll start a cable at {target}

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

**Combined**
- and drop it on {target}
- and land it on {target}
- and put it into {target}

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

**Combined**
- let's click {target}
- click {target}
- we'll click {target}

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

**Combined**
- let's turn {target}
- we'll turn {target}
- turn {target}

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

**Combined**
- right click {target}
- let's right click {target}

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

**Combined**
- and choose it
- and take that one

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

**Combined**
- let's open {target}
- open {target}
- we'll open {target}

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

**Combined**
- and take that one
- and choose that
- and there it is

**Long**
- click the value and the list closes on it
- click to choose it

**Short**
- click
- choose it

## moveToCable

**Badge** move pointer

**Long**
- move the pointer to the cable at {target}
- move the pointer to where that cable meets {target}

**Short**
- move to the cable
- move

## pullCable

**Badge** click

**Combined**
- take hold of the cable at {target}
- let's take hold of the cable at {target}

**Long**
- click, and the end of the cable comes away into the pointer
- click, and that end lifts out of the socket

**After**
- click, and it comes away
- click, and it lifts out

**Short**
- click
- take it out

## moveToEmpty

**Badge** move pointer

**Long**
- carry it out to where there is nothing
- carry the loose end clear of the modules

**Short**
- carry it clear
- move it away

## dropAway

**Badge** click

**Combined**
- and let it go where there is nothing, which removes it
- and drop it clear of everything, which takes the cable away

**Long**
- click, and letting it go on empty space removes the cable
- click, and dropped on nothing the cable is gone

**After**
- click, and it is gone
- click, and that cable is removed

**Short**
- click
- drop it

## moveToTitle

**Badge** move pointer

**Combined**
- take hold of the module by its title strip
- let's pick the module up by its title strip

**Long**
- move the pointer to the module's title strip

**Short**
- move to the title strip

## switchPage

**Badge** left click

**Combined**
- let's go to that page
- so we click the tab, and there we are

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
