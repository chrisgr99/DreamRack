// adapter.js — a Strudel pattern event becomes a note on the rack's cable.
//
// Verified against the real thing (design/strudel-module.md §2): Strudel calls its output as
// (hap, deadline, duration, cps, t), and a chord arrives as several events sharing one `t` — which is
// already this rack's convention for a chord, so nothing has to be gathered or reassembled.
//
// PURE, and importable by node --test: no DOM, no audio context, no Strudel. It takes the numbers and
// gives back a note.

'use strict';

// 0V IS MIDDLE C. The rack's pitch is relative — an oscillator multiplies its own frequency by two to
// the power of the volts — so an absolute anchor is a convention rather than a fact, and middle C is
// the one every other instrument on the desk agrees with.
export const A_MIDI = 60;

export function midiToVolts(midi) { return (midi - A_MIDI) / 12; }

// Strudel hands a note as a NAME ("c3", "eb4") or a NUMBER (MIDI). Names are converted by Strudel's own
// noteToMidi, passed in, so the rack never grows a second opinion about what E flat means.
export function pitchOf(value, noteToMidi) {
  const v = value.note !== undefined ? value.note : value.n;
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') return midiToVolts(v);
  try { return midiToVolts(noteToMidi(String(v))); } catch (_e) { return null; }
}

// A hap's own length is in CYCLES; seconds is what a note carries. `sustain` overrides it when the
// pattern says so, which is how a staccato pattern stays staccato at any tempo.
export function durationOf(value, hapDuration, cps) {
  if (typeof value.sustain === 'number') return Math.max(0.01, value.sustain);
  const secs = (hapDuration || 0) / (cps || 1);
  return Math.max(0.01, secs);
}

// Strudel's pan runs 0..1 with 0.5 in the middle; the rack's runs -1..1 with 0 in the middle.
export function panOf(value) {
  if (typeof value.pan !== 'number') return 0;
  const p = value.pan * 2 - 1;
  return p < -1 ? -1 : p > 1 ? 1 : p;
}

export function levelOf(value) {
  const g = typeof value.gain === 'number' ? value.gain
    : typeof value.velocity === 'number' ? value.velocity : 0.8;
  return g < 0 ? 0 : g > 1 ? 1 : g;
}

// The whole conversion: an event and the clock it belongs to, in; a note and when to play it, out.
// `sampleAt` turns a context time into a frame — the one thing that needs the live audio clock, so it
// is passed in rather than reached for.
export function toNote(hap, cps, t, { noteToMidi, sampleAt, handle }) {
  const value = (hap && hap.value) || {};
  const pitch = pitchOf(value, noteToMidi);
  if (pitch === null) return null;             // an event with no note is a sample trigger; not ours
  const hapDur = hap.whole ? Number(hap.whole.end) - Number(hap.whole.begin) : 0;
  const duration = durationOf(value, hapDur, cps);
  return {
    handle,
    at: sampleAt(t),
    pitch,
    level: levelOf(value),
    duration,
    pan: panOf(value),
    // The note ends by its own duration at the far end; the off is belt and braces, and it is what
    // makes an interrupted pattern fall silent rather than hang.
    offAt: sampleAt(t + duration),
  };
}
