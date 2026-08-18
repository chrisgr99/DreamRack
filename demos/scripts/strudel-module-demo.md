# Strudel — a pattern playing two voice tabs

**Patch** Strudel — two voices
**Modules** strudel = wcoast.strudel, voiceA = wcoast.voice#0, oscA = wcoast.oscillator, filterA = wcoast.filter, envA = wcoast.envelope, outA = wcoast.note-amp#0, voiceB = wcoast.voice#1, outB = wcoast.note-amp#1, osc259 = wcoast.complexOsc259t, envB = wcoast.envelope#1, vcaB = wcoast.vca#1
**Sound** on
**OpenHold** 0.4

## zoom strudel 2.2

## press strudel run

## wait 3.0

## say strudel

Introducing the new Strudel module for DreamRack. It imports the Strudel JavaScript package, so Strudel can play its superdough voices alongside up to eight polyphonic voices constructed in DreamRack.

## zoom strudel 1 left

## press strudel edit

SCRIPT opens the editor.

## say strudel

Routing is written in the pattern.

## point ".rack(1)"

.rack(1) carries the chords, and the bass under them, to V1.

## point ".rack(2)"

.rack(2) carries the line above them to V 2. A fourth part alternates between the two.

## point 's("bd'

Not everything goes to the rack. These parts name a sound instead of a jack, so Strudel plays them
itself: a kick, a snare and hats, from its own sample engine.

## point 's("hh'

Hats, on the same clock as the rack voices.

## say strudel

Highlighting marks what is sounding.

## wait 6.0

Three parts: chords, a line above them, a bass.

## press strudel edit

SCRIPT toggles the editor. The pattern keeps running.

## say strudel

SCRIPT, PLAY, and cycles per second.

## point strudel:noteOut

Eight note output terminals, V1 to V8. Each of which can carry a Strudel polyphonic pattern on a single composite cable. Each note in a pattern with its own properties: pitch, level, duration, pan and timbre.

## point strudel:noteOut

V1, to the first voice tab.

## point strudel:noteOut2

V 2, to the second. Each tab is a voice: the modules on it are duplicated per note.


## point strudel:audioOutL

Strudel's own voices leave the module here, as audio: the drums, into the mixer beside the rack's
own output.

## page p2

The first voice tab.

## point voiceA

Voice In takes the composite cable and unpacks it. Each note is given a voice, and its properties come
out as control voltages: gate, pitch, level, duration, pan and timbre.

## say voiceA

Everything to the right of Voice In is duplicated per voice. One oscillator is drawn; as many run as
there are notes sounding.

## point filterA

The pattern plays this filter's cutoff, note by note, through the timbre lane.

## set filterA resonance 0.62

Nothing is fixed while it runs. Resonance, up.

## wait 5.0

## set filterA cutoff 420

And the cutoff the notes move from.

## wait 5.0

## page p3

The second cable lands here, and this tab is built differently.

## point osc259

One Complex Oscillator instead of an oscillator and a filter. The pattern strikes it, sets its pitch,
and drives its timbre from the same lane that moved the filter next door.

## set osc259 timbre 0.62

Timbre, on the principal oscillator.

## wait 6.0

## choose osc259 pitchMod on

Pitch modulation, on.

## set osc259 modIndex 0.45

Modulation index up: the modulation oscillator now moves the pitch of every note.

## set osc259 modFreq 90

## wait 4.0

## choose osc259 modRange low

Its range to low, and down to a few cycles a second.

## set osc259 modFreq 40

## wait 5.0

## set osc259 modFreq 900 over 14

Moving it up through the range while the pattern plays.

## wait 8.0

## zoom out

Two parts, two instruments, one pattern.

## wait 4.0
