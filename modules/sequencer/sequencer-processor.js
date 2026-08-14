// sequencer-processor.js — the bundler.
//
// Five mono inputs in, ONE SEVEN-CHANNEL OUTPUT out. The bundle is not a protocol or a message
// queue: it is seven channels on one connection, which is why a note cable is an ordinary Web Audio
// edge and needs no special case in the patchbay the way a video edge does.
//
// THE CHANNEL ORDER IS THE FORMAT. Both ends of a note cable have to agree on it, and a worklet is a
// single file with no imports, so the list below is repeated verbatim in the Voice module's factory.
// Change it in one place and you must change it in the other.
//
//   0 gate       1 while the note sounds
//   1 pitch      1V/oct, captured at note-on and held
//   2 level      velocity, captured at note-on
//   3 duration   seconds, captured at note-on
//   4 pan        -1..1, captured at note-on
//   5 bend       -1..1, how far the pitch has moved since note-on against the bend range
//   6 pressure   continuous, within the note — silent until stage six
//
// PITCH IS ON THE WIRE TWICE: the value the note started on, and how far it has moved since. Held is
// what makes a note a note — a sequencer's next step arriving early must not drag a sounding note
// around with it — and the deviation is what a wheel, a wind controller and MPE all produce, so a
// lane called bend behaves the way anyone who has played one expects.
//
// THE SOURCE STILL PATCHES ONE ORDINARY 1V/OCT SIGNAL. Both lanes are derived here, because this is
// where the note-on moment is known: bend is the pitch input minus the value held at that moment, so
// it starts at exactly zero on every note and needs nothing on the sending side.
//
// A DELTA RATHER THAN THE ABSOLUTE PITCH, because of where it lands. Bend is patched into a
// modulation input, and by the knAck convention every one of those carries a depth trim — so how far
// a bend bends is set on the module being played.
//
// AND NORMALISED TO -1..1, not left in volts. That is what every other modulation signal in the rack
// runs at, so bend is an ordinary control signal in the ordinary control colour, and the trim it
// lands on behaves the way it does for any other CV. The BEND RANGE knob is what turns volts into
// that number: how many semitones of movement count as full deflection, defaulting to the two a MIDI
// instrument ships with. Movement past the range clamps, exactly as a wheel at its stop does.
//
// Pressure is reserved rather than omitted. It costs a channel of silence and saves changing the
// format later, which would mean every saved patch carrying a note cable of the wrong width.

'use strict';

const CH = { GATE: 0, PITCH: 1, LEVEL: 2, DUR: 3, PAN: 4, BEND: 5, PRESSURE: 6 };
const NOTE_CHANNELS = 7;

// A cable is present when the runtime hands us a non-empty channel array for that input. Asking the
// runtime beats being told: the rack has no reliable moment to tell a worklet that a jack was filled,
// and a module that assumed it was told is a module whose CV inputs silently do nothing.
const patched = (inp) => !!(inp && inp.length && inp[0] && inp[0].length);

class SequencerProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'level', defaultValue: 0.8, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'duration', defaultValue: 0.25, minValue: 0.01, maxValue: 8, automationRate: 'k-rate' },
      { name: 'pan', defaultValue: 0, minValue: -1, maxValue: 1, automationRate: 'k-rate' },
      { name: 'bendRange', defaultValue: 2, minValue: 0.1, maxValue: 24, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this._gatePrev = 0;
    this._on = false;
    this._age = 0;          // samples since the note started
    this._len = 0;          // samples the note may last at most
    this._held = { pitch: 0, level: 0, duration: 0, pan: 0 };
    // A handle names one sounding note so a later message can refer to it — which is what makes an
    // early release possible at all. Session prefix plus a counter, per control-protocol.md: free of
    // collisions within a sender, namespaced across senders, and readable when something is wrong.
    this._prefix = 'q' + Math.floor(Math.random() * 46656).toString(36);
    this._noteSeq = 0;
  }

  process(inputs, outputs, params) {
    const out = outputs[0];
    if (!out || out.length < NOTE_CHANNELS) return true;
    const n = out[0].length;

    const gateIn = inputs[0] && inputs[0][0];
    const pitchIn = inputs[1] && inputs[1][0];
    const levelIn = patched(inputs[2]) ? inputs[2][0] : null;
    const durIn = patched(inputs[3]) ? inputs[3][0] : null;
    const panIn = patched(inputs[4]) ? inputs[4][0] : null;

    const kLevel = params.level[0];
    const kDur = params.duration[0];
    const kPan = params.pan[0];
    // Semitones to volts, as the reciprocal so the per-sample work is a multiply. The floor guards
    // against a divide by zero, not against a small range: a tenth of a semitone is a setting anyone
    // working microtonally may well want.
    const bendScale = 12 / Math.max(0.01, params.bendRange[0]);

    const held = this._held;
    let gatePrev = this._gatePrev;

    for (let i = 0; i < n; i++) {
      const g = gateIn ? gateIn[i] : 0;
      // THE RISING EDGE IS THE NOTE. Everything the note carries is read here, once, and then held —
      // see the descriptor for why holding rather than following is the right default.
      if (gatePrev <= 0 && g > 0) {
        held.pitch = pitchIn ? pitchIn[i] : 0;
        held.level = levelIn ? levelIn[i] : kLevel;
        // A duration CV is in seconds, so it reads the same way the knob does and can be set from a
        // sequencer's own step length without a conversion nobody can see.
        held.duration = Math.max(0.001, Math.min(30, durIn ? durIn[i] : kDur));
        held.pan = Math.max(-1, Math.min(1, panIn ? panIn[i] : kPan));
        this._on = true;
        this._age = 0;
        this._len = Math.max(1, Math.round(held.duration * sampleRate));
        // ONE MESSAGE PER NOTE, and it is already shaped like the event the transport will carry
        // (design/voice-pages.md §3): a handle naming this note, the sample it began on, and what it
        // holds. Today only the cable's flash reads it. Nothing here is expensive — measured at about
        // 0.8 microseconds a message, and notes arrive a few times a second, not at audio rate.
        //
        // THE SAMPLE MATTERS EVEN NOW. A message cannot be received before the block it was posted
        // during has finished, so a receiver that acts on arrival is late by however far into the
        // block the edge fell — nothing to 2.7ms, and variable, which smears rhythm. Carrying the
        // sample lets a receiver defer by one block and place the note exactly, turning that jitter
        // into constant latency.
        const at = (typeof currentFrame === 'number' ? currentFrame : 0) + i;
        this.port.postMessage({ note: {
          handle: this._prefix + ':' + (this._noteSeq++),
          time: at,
          pitch: held.pitch, level: held.level, duration: held.duration, pan: held.pan,
        } });
      }
      gatePrev = g;

      // The note ends at the gate's fall or at the duration, whichever comes first.
      if (this._on) {
        this._age++;
        if (g <= 0 || this._age >= this._len) this._on = false;
      }

      const live = this._on ? 1 : 0;
      out[CH.GATE][i] = live;
      // The held values stay on the wire after the gate closes rather than snapping to zero. A voice
      // reading pitch during its own release stage should find the note it is releasing, not silence.
      out[CH.PITCH][i] = held.pitch;
      out[CH.LEVEL][i] = held.level;
      out[CH.DUR][i] = held.duration;
      out[CH.PAN][i] = held.pan;
      // Bend is measured from the held value, so it is zero at note-on by construction and keeps
      // tracking through the release tail — a note let go mid-scoop falls away from where it was.
      const dv = ((pitchIn ? pitchIn[i] : 0) - held.pitch) * bendScale;
      out[CH.BEND][i] = dv > 1 ? 1 : dv < -1 ? -1 : dv;
      out[CH.PRESSURE][i] = 0;
    }

    this._gatePrev = gatePrev;
    return true;
  }
}

registerProcessor('wcoast-sequencer', SequencerProcessor);
