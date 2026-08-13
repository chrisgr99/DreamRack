// descriptor.js — Delay, Wcoast module.
//
// A delay line with feedback, a tone control on what comes back, and a wet/dry mix. Modelled on
// VCV Fundamental's Delay (GPL-3.0), which is why this project is GPL-3.0.
//
// WHAT IS WORTH TAKING FROM IT. Three things, and none of them is the delay line itself, which is a
// ring buffer anyone can write. First, TIME is exponential over four decades — a millisecond to ten
// seconds — because a linear time knob spends most of its travel in the last second and has nothing
// left for the flams and comb effects at the short end, which is where a delay stops being an echo
// and becomes a timbre. Second, a CLOCK input takes the time over: patch one and the delay is in
// tempo, and TIME becomes a ratio to it rather than a duration. Third, TONE is ONE knob doing two
// jobs from the middle — below noon it takes the top off each repeat, above noon it takes the bottom
// out — which is what makes a feedback path decay into something rather than merely quieter.
//
// EVERY KNOB IS A knAck, per the module set's first rule: the value on the ring, the CV jack in its
// centre, the attenuverter on its lower half once something is patched. Fundamental spends twelve
// controls on this panel — four knobs, four attenuverters, four jacks. Here it is four.

'use strict';

const ports = [
  // THE AUDIO IN SITS WITH TIME, not in an input block: it is the thing being delayed, and the first
  // question you have about a delay is how long.
  { id: 'audioIn', name: 'Audio in', section: 'in', domain: 'audio', dir: 'in' },
  // A CLOCK TAKES THE TIME OVER. Patched, the delay is a division of the incoming tempo and the TIME
  // knob chooses which; unpatched it is a duration and the knob is that duration. Declared in the
  // trigger domain so it reads blue, like every other jack that carries a pulse.
  { id: 'clockIn', name: 'Clock', section: 'in', domain: 'trigger', dir: 'in' },

  // The four CV inputs, each in the centre of the knob it drives. `via` is what makes the depth ring
  // work: the patchbay puts the cord through an attenuator gain it owns and drives from that param.
  { id: 'timeCv', name: 'Time CV', section: 'delay', domain: 'control', dir: 'in', target: 'time', via: 'timeDepth' },
  { id: 'feedbackCv', name: 'Feedback CV', section: 'delay', domain: 'control', dir: 'in', target: 'feedback', via: 'feedbackDepth' },
  { id: 'toneCv', name: 'Tone CV', section: 'tone', domain: 'control', dir: 'in', target: 'tone', via: 'toneDepth' },
  { id: 'mixCv', name: 'Mix CV', section: 'tone', domain: 'control', dir: 'in', target: 'mix', via: 'mixDepth' },

  // BOTH ENDS OF THE MIX. `wet` is the repeats alone, for feeding something else or for a send; `mix`
  // is what the MIX knob says. A delay with only a mixed output cannot be used as a send, and one with
  // only a wet output makes you carry a mixer to hear it in place.
  { id: 'wetOut', name: 'Wet', section: 'out', domain: 'audio', dir: 'out' },
  { id: 'mixOut', name: 'Mix', section: 'out', domain: 'audio', dir: 'out' },
];

const params = [
  // EXPONENTIAL, A MILLISECOND TO TEN SECONDS — Fundamental's own range, and its reasoning: at the
  // short end a delay is a comb filter and a doubler, and a linear knob has no travel to spend there.
  // ONE KNOB, BOTH JOBS — which is what the original does, and why it needs neither a second control
  // nor a display. Free-running it is a duration, a millisecond to ten seconds. Clocked it is a RATIO
  // to the incoming beat, and the same travel now spans the same four decades of it: the knob at a
  // half-second gives exactly one beat, at a quarter half a beat, at a second two. Nothing on the
  // panel changes, because nothing needs to — the number under your hand tells you which it is.
  { id: 'time', signal: 'audio', name: 'Time', section: 'delay', curve: 'exp', min: 0.001, max: 10, default: 0.5, unit: 's' },
  { id: 'timeDepth', name: 'Time CV depth', section: 'delay', curve: 'linear', min: -1, max: 1, default: 1, glideMs: 10 },

  // Stops short of 1. At unity the loop neither grows nor decays and the delay becomes a looper that
  // never forgets — musical for about four seconds and then a wall. 0.98 still runs for a minute.
  { id: 'feedback', signal: 'audio', name: 'Feedback', section: 'delay', curve: 'linear', min: 0, max: 0.98, default: 0.5, unit: '' },
  { id: 'feedbackDepth', name: 'Feedback CV depth', section: 'delay', curve: 'linear', min: -1, max: 1, default: 1, glideMs: 10 },

  // ONE KNOB, TWO FILTERS, FROM THE MIDDLE. Noon is flat. Turned down it lowpasses the feedback path,
  // so each repeat is darker than the last; turned up it highpasses, so they thin out instead. Both
  // are the same gesture — take something away each time round — and which one you want depends on
  // what is going through it, which is why it is a knob and not a switch.
  { id: 'tone', signal: 'audio', name: 'Tone', section: 'tone', curve: 'linear', min: 0, max: 1, default: 0.5, unit: '' },
  { id: 'toneDepth', name: 'Tone CV depth', section: 'tone', curve: 'linear', min: -1, max: 1, default: 1, glideMs: 10 },

  { id: 'mix', signal: 'audio', name: 'Mix', section: 'tone', curve: 'linear', min: 0, max: 1, default: 0.5, unit: '' },
  { id: 'mixDepth', name: 'Mix CV depth', section: 'tone', curve: 'linear', min: -1, max: 1, default: 1, glideMs: 10 },
];

export default {
  apiVersion: 1,
  id: 'wcoast.delay',
  name: 'Delay',
  category: 'processor',
  abbreviation: 'DLY',
  scope: 'voice',
  hp: 8,
  worklets: ['modules/delay/delay-processor.js'],
  menuSectionOrder: ['in', 'delay', 'tone', 'out'],
  ports,
  params,
};
