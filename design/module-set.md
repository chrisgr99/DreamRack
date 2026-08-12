# The utility module set — design

DreamRack is West Coast, and it has the West Coast modules: the Complex Oscillator, the Quad Function
Generator, the Quad Low Pass Gate. What it does not have is the ordinary furniture — a filter, a VCA,
an envelope with a gate input, a noise source, a delay. Every modular has these, and without them a
patch runs out of moves early.

So: ten utility modules, built one at a time against one faceplate pattern. The types are generic and
the behaviour is taken from what is typical rather than copied from any particular maker's module.

## The set

Six of the eleven are built. The widths below are what each one ACTUALLY came out at, not what was
estimated before it was drawn — the VCA, the Envelope and the Octave each needed a little more than
the guess, which is the usual direction of travel and worth recording rather than quietly correcting.

| Module | Controls | Ins | Outs | HP | State |
|---|---|---|---|---|---|
| **VCO** | Coarse, Fine, Lin FM, Exp FM, Pulse width, Feedback, sync mode | 1V/oct, sync, lin FM, exp FM, PW | sine, tri, saw, pulse | 10 | **built** |
| **Noise** | none | — | violet, blue, white, pink, red | 5 | **built** |
| **Filter** | Cutoff, Resonance, Drive | audio | low, high, band | 8 | **built** |
| **VCA** | Level, response | audio, CV | out | 6 | **built** |
| **Envelope** | Attack, Decay, Sustain, Release | gate, retrigger | env, inverted, end-of-cycle | 10 | **built** |
| **Delay** | Time, Feedback, Tone, Mix | audio, clock | wet, mix | 8 | |
| **Sample & Hold** | slew, manual sample | signal, trigger | out | 5 | |
| **Shift Register** | stage count | signal, clock | one per stage | 6 | |
| **Random** | Rate, Probability, Spread, Shape | trigger, offset | stepped, linear, exponential, smoothed | 8 | |
| **Octave** | octave offset −4…+4 | 1V/oct | 1V/oct | 4 | **built** |
| **Wavetable Oscillator** | Coarse, Fine, Position, FM | 1V/oct, sync, position | four shapes | 12 | |

Overlaps with what already exists are deliberate and were considered: Random beside the Source of
Entropy, Envelope beside the Quad Function Generator, VCA beside the Quad Low Pass Gate. A wider
choice of ways to do the same thing is what a rack is for.

## The faceplate pattern

Nine rules. `panel/grammar.js` enforces most of them by construction, which is the point — a panel is
declared as bands and rows and the grammar decides the millimetres.

1. **Every modulatable parameter is a knAck.** Value on the ring, CV jack in the centre, attenuverter
   on the lower half when patched. This is the whole efficiency argument. A conventional panel spends
   three controls and three labels per parameter (knob, attenuverter, jack); we spend one. The Filter's
   nine become three; the Delay's twelve become four.
2. **Bands, separated by a full-width rule**, each with a capitalised header at the left. Reading
   order is reaching order: the control you touch first is top-left.
3. **Outputs in one row along the bottom edge**, full size, evenly spaced, lowercase italic labels.
   They are what a cable has to find. The exception is a module that is ONLY outputs — Noise — where a
   column is right, because a row of five would force the panel three times wider than it deserves.
4. **Signal inputs sit with what they feed**, not gathered into an input block. A filter's audio in
   belongs beside the cutoff.
5. **A choice with no CV is a lamp row** — lamps side by side, each clickable, labelled beside. The
   grammar sets the `step-indicator` role itself, because forgetting it renders perfectly and produces
   a control nobody can operate.
6. **A momentary action is a red button.**
7. **No sliders except on a mixer.** Everything here is scroll-operated and nothing is dragged. A
   mixer keeps faders because you read four levels against each other by eye.
8. **Width is set by the widest row**, which after the knAck rewrite is nearly always the output row.
   The grammar warns at generate time when a row overflows, rather than letting it overlap silently.
9. **Green for 1V/oct**, declared as `role: 'pitch'` on the port. The host colours from the role, not
   the label.

## Order of work

Noise first, because it has no controls and so tests the grammar and nothing else. Then VCA, Filter,
Envelope, Octave, Sample & Hold, Delay, Shift Register, Random, Wavetable — cheapest first, except
that the Filter is early because it changes what the instrument can do more than anything else here.

## What is verified for each module

Not "it renders". For each one: the panel-coverage check passes, every param and port is bound to an
element, the module instantiates in the rack without console errors, and the DSP is MEASURED in an
OfflineAudioContext against what the descriptor claims — frequencies, slopes, levels, and the absence
of non-finite samples. Two real errors were caught that way in the first two modules: an oscillator
feedback range that was chaotic over the top quarter of its travel, and noise outputs that were three
times too loud and clipping.
