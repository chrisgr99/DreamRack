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
