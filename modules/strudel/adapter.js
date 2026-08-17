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

// THE EXPRESSION LANES, named in the pattern. Strudel carries any control name straight through to
// the output — `.timbre(0.7)` arrives as `{note:'c3', timbre:0.7}` with nothing registered anywhere —
// so the rack's own lane names ARE the vocabulary, and there is no table of parts to learn.
//
// Aliases for the words a live coder already types: `lpf` and `cutoff` are in HERTZ and this rack's
// lane is a control voltage, so they are mapped logarithmically across the audible range. A pattern's
// explicit `timbre` beats an alias, because it asked for the lane by name.
const LO_HZ = 20, HI_HZ = 20000;
const LOG_LO = Math.log(LO_HZ), LOG_SPAN = Math.log(HI_HZ) - LOG_LO;

export function timbreOf(value) {
  if (typeof value.timbre === 'number') return clamp01(value.timbre);
  const hz = typeof value.lpf === 'number' ? value.lpf
    : typeof value.cutoff === 'number' ? value.cutoff : null;
  if (hz === null || !(hz > 0)) return null;              // nothing asked for; the lane stays where it is
  return clamp01((Math.log(hz) - LOG_LO) / LOG_SPAN);
}

// WHICH VOICE JACK IT LEAVES BY. `.rack(2)` in the pattern, V2 on the faceplate — one number, printed
// where you look for it, so a part is assigned to an instrument by saying which socket it comes out of.
//
// A NUMBER RATHER THAN A NAME, so it needs no quotes in the common case; a string is accepted anyway,
// because a pattern that says .rack("<1 2>") to alternate between two instruments arrives here as one.
// Anything unreadable, out of range, or simply absent goes to V1: a pattern written without a thought
// for routing should play rather than vanish.
export const VOICES = 8;

export function voiceOf(value) {
  const v = value.rack !== undefined ? value.rack : value.orbit;
  const n = typeof v === 'number' ? v : (typeof v === 'string' ? parseInt(v, 10) : NaN);
  if (!Number.isFinite(n)) return 1;
  return n < 1 ? 1 : n > VOICES ? VOICES : Math.round(n);
}

export function pressureOf(value) {
  const p = typeof value.press === 'number' ? value.press
    : typeof value.pressure === 'number' ? value.pressure : null;
  return p === null ? null : clamp01(p);
}

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

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
    voice: voiceOf(value),
    pitch,
    level: levelOf(value),
    duration,
    pan: panOf(value),
    // Null means "not asked for", which is different from zero: an unasked lane keeps whatever the
    // patch has it at rather than being forced shut at every note.
    timbre: timbreOf(value),
    pressure: pressureOf(value),
    // The note ends by its own duration at the far end; the off is belt and braces, and it is what
    // makes an interrupted pattern fall silent rather than hang.
    offAt: sampleAt(t + duration),
  };
}
