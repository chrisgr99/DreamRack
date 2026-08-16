// sequencer-processor.js — the bundler.
//
// Five mono inputs in, and NOTES OUT AS EVENTS. It carried them as seven channels on one connection
// once, which worked and could not scale: seven lanes times eight voices is fifty-six channels
// against a browser's cap of thirty-two, and a gate carried as a signal can stop but cannot be NAMED,
// so nothing could ever release one note and leave the others ringing.
//
// So a note is a message now — note-on with a handle, note-off by that handle, and tagged updates in
// between — sent down a port the rack hands to both ends when the cable is made. Worklet to worklet:
// the main thread's scheduling jitter would otherwise land on every note.
//
// THE CABLE IS STILL A WEB AUDIO CONNECTION, carrying one channel of silence. Not ceremony: a worklet
// that reaches the destination through nothing at all is not rendered, so this module would stop
// being called the moment its only link was a message port.
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


// A cable is present when the runtime hands us a non-empty channel array for that input. Asking the
// runtime beats being told: the rack has no reliable moment to tell a worklet that a jack was filled,
// and a module that assumed it was told is a module whose CV inputs silently do nothing.
const patched = (inp) => !!(inp && inp.length && inp[0] && inp[0].length);

// How often a moving control may speak, in samples — once a block. Finer than breath or a bend wheel
// needs, and a power of two so the test is a mask.
const UPDATE_EVERY = 128;
// Below this, nothing has moved worth saying — a thousandth of a volt, which is under two cents.
const UPDATE_DEADBAND = 0.001;

class SequencerProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'level', defaultValue: 0.8, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'duration', defaultValue: 0.25, minValue: 0.01, maxValue: 8, automationRate: 'k-rate' },
      { name: 'pan', defaultValue: 0, minValue: -1, maxValue: 1, automationRate: 'k-rate' },
      { name: 'bendRange', defaultValue: 2, minValue: 0.1, maxValue: 24, automationRate: 'k-rate' },
      // 0 = the gate ends the note, 1 = the duration does and the gate's fall is ignored.
      { name: 'ends', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
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
    this._handle = null;
    this._bendSent = 0;
    this._sent = { pressure: null, timbre: null };
    // EVERY DESTINATION, not one. A note output fans out like any other cable in the rack — one
    // sequencer can play two voice tabs, and a chord source can feed an arpeggiator and a melody at
    // once. Held as a Map keyed by the EDGE that made each port, so pulling one cable takes the right
    // port back and leaves the others running.
    this._outs = new Map();
    this.port.onmessage = (e) => {
      const d = e.data || {};
      if (d.noteOut) {
        this._outs.set(d.edge, d.noteOut);
        if (d.noteOut.start) d.noteOut.start();
      } else if (d.noteOutOff) {
        this._outs.delete(d.noteOutOff);
      }
    };
  }

  // To every cable plugged into the note output.
  _post(m) { for (const p of this._outs.values()) p.postMessage(m); }

  process(inputs, outputs, params) {
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const n = out[0].length;

    const gateIn = inputs[0] && inputs[0][0];
    const pitchIn = inputs[1] && inputs[1][0];
    const levelIn = patched(inputs[2]) ? inputs[2][0] : null;
    const durIn = patched(inputs[3]) ? inputs[3][0] : null;
    const panIn = patched(inputs[4]) ? inputs[4][0] : null;
    const pressIn = patched(inputs[5]) ? inputs[5][0] : null;
    const timbIn = patched(inputs[6]) ? inputs[6][0] : null;

    const kLevel = params.level[0];
    const kDur = params.duration[0];
    const kPan = params.pan[0];
    const holds = params.ends && params.ends[0] > 0.5;

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
        this._handle = this._prefix + ':' + (this._noteSeq++);
        const note = { t: 'on', handle: this._handle, time: at,
          pitch: held.pitch, level: held.level, duration: held.duration, pan: held.pan,
          // What full bend is worth, in semitones, so the far end can give the same movement in
          // volts as well as normalised without knowing this module's knob.
          bendRange: params.bendRange[0] };
        // One structured clone per destination. A note message was measured at about 0.8µs, so the
        // second and third cost nothing worth counting.
        for (const p of this._outs.values()) p.postMessage(note);
        this._bendSent = 0;
        // The continuing values start the note where the source has them, so a note begun mid-breath
        // does not have to wait for the next change before it is heard.
        this._sent = { pressure: null, timbre: null };
        // The same note to the main thread, where the rack lights the cable. One a note, so the cost
        // is nothing, and keeping it separate means the flash never rides on the audio path.
        this.port.postMessage({ note });
      }
      gatePrev = g;

      // The note ends at the gate's fall or at the duration, whichever comes first — and now it can
      // SAY SO, naming the note, which is what lets a voice release one and leave the others ringing.
      // The duration is in the note-on as well, so a lost off still cannot leave a voice sounding.
      if (this._on) {
        this._age++;
        // HOLD lets the duration decide alone, so a note outlives its gate and the next one can begin
        // while it is still sounding. That overlap is what a page needs to play more than one note.
        if ((g <= 0 && !holds) || this._age >= this._len) {
          this._on = false;
          if (this._outs.size && g <= 0 && !holds) {
            this._post({ t: 'off', handle: this._handle,
              time: (typeof currentFrame === 'number' ? currentFrame : 0) + i });
          }
        }
      }

      // BEND, SENT ON CHANGE AND NOT ON A CLOCK. A control that is not moving sends nothing at all,
      // which is most of them most of the time. Measured from the held value, so it is zero at
      // note-on by construction. The receiver ramps to each new value over one interval, so the steps
      // between updates never reach anything.
      //
      // SENT IN VOLTS, RAW. The bend RANGE belongs to the control-voltage output — it says how many
      // semitones count as full deflection there — and not to the pitch itself. Scaling here would
      // make the volts-per-octave output a clamped copy of the CV one, when the whole point of it is
      // that held pitch plus it is exactly where the source has gone.
      if (this._on && (i & (UPDATE_EVERY - 1)) === 0 && this._outs.size) {
        const at = (typeof currentFrame === 'number' ? currentFrame : 0) + i;
        const dv = (pitchIn ? pitchIn[i] : 0) - held.pitch;
        if (Math.abs(dv - this._bendSent) > UPDATE_DEADBAND) {
          this._bendSent = dv;
          this._post({ t: 'u', handle: this._handle, k: 'bend', v: dv, time: at });
        }
        // PRESSURE AND TIMBRE, on the same terms: on change, once a block at most, nothing while
        // they are still. An unpatched input says nothing at all rather than sending zeros — a voice
        // with no breath behind it should fall back to its own envelope, not be held shut by a lane.
        for (const [k, src] of [['pressure', pressIn], ['timbre', timbIn]]) {
          if (!src) continue;
          const v = src[i];
          if (this._sent[k] === null || Math.abs(v - this._sent[k]) > UPDATE_DEADBAND) {
            this._sent[k] = v;
            this._post({ t: 'u', handle: this._handle, k, v, time: at });
          }
        }
      }
      out[0][i] = 0;   // the channel of silence that keeps this module in the rendering graph
    }

    this._gatePrev = gatePrev;
    return true;
  }
}

registerProcessor('wcoast-sequencer', SequencerProcessor);
