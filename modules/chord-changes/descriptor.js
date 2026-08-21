// descriptor.js — Chord Changes. The harmony source: a progression, played against the rack's clock.
//
// See design/harmony.md. The short version: a chord is several notes at one instant, which the note
// cable already carries, so this module needs no new domain — it sends chords as simultaneous note-ons
// with the root lowest, in close position, in a canonical octave, each lasting as long as the chord
// does. Plug it straight into a Voice In and you hear block chords; put an Arpeggiator between them
// and you hear a pattern.
//
// IT NEVER OWNS A TEMPO. A rack has one clock, and this follows it.

'use strict';

const TONICS = ['C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B'];

const ports = [
  { id: 'clockIn', name: 'Clock', section: 'time', domain: 'trigger', dir: 'in' },
  { id: 'resetIn', name: 'Reset', section: 'time', domain: 'trigger', dir: 'in' },
  // Unpatched PLAYS. The worklet can tell an unconnected input from one sitting at zero, so a module
  // you have just placed runs; patch a gate and it obeys it.
  { id: 'runIn', name: 'Run', section: 'time', domain: 'trigger', dir: 'in' },
  { id: 'noteOut', name: 'Note', section: 'out', domain: 'note', dir: 'out' },
  // The harmony, for modules that know nothing about harmony: the root as an ordinary pitch, and a
  // trigger on each change and each bar line.
  { id: 'rootOut', name: '1V/Oct', role: 'pitch', section: 'out', domain: 'control', dir: 'out' },
  { id: 'chordTrig', name: 'Chord', section: 'out', domain: 'trigger', dir: 'out' },
  { id: 'barTrig', name: 'Bar', section: 'out', domain: 'trigger', dir: 'out' },
];

const params = [
  // ---- WHAT IS LOADED, and what of it plays. Both are readouts rather than knobs: neither set of
  // choices is known until a chart exists, and a stepped param must declare its steps up front.
  { id: 'tune', name: 'Tune', section: 'chart', curve: 'text', default: 'Dm7 | G7 | Cmaj7 | %' },
  { id: 'play', name: 'Play', section: 'chart', curve: 'text', default: 'whole tune' },
  { id: 'load', name: 'Load', section: 'chart', curve: 'stepped', default: 'idle', modulatable: false,
    steps: [{ value: 'idle' }, { value: 'go' }] },
  { id: 'chart', name: 'Chart window', section: 'chart', curve: 'stepped', default: 'closed', modulatable: false,
    steps: [{ value: 'closed' }, { value: 'open' }] },
  // Endless at the top, which is what makes a separate LOOP switch unnecessary.
  { id: 'repeats', name: 'Repeats', section: 'chart', curve: 'detent', min: 1, max: 9, default: 9, glideMs: 0 },

  // ---- THE KEY THE CHART IS IN. Set from the chart when one loads.
  { id: 'key', name: 'Key', section: 'key', curve: 'detent', min: 0, max: 11, default: 0, glideMs: 0 },
  { id: 'mode', name: 'Mode', section: 'key', curve: 'stepped', default: 'major',
    steps: [{ value: 'major' }, { value: 'minor' }] },
  // SEPARATE FROM THE KEY, because transposing a tune and rewriting what key it is in are different
  // acts: the Roman numerals stay put while the letters move.
  { id: 'transpose', name: 'Transpose', section: 'key', curve: 'detent', min: -12, max: 12, default: 0, glideMs: 0 },

  // ---- HOW THE CHORD IS PLAYED.
  { id: 'octave', name: 'Octave', section: 'play', curve: 'detent', min: 1, max: 5, default: 3, glideMs: 0 },
  { id: 'voicing', name: 'Voicing', section: 'play', curve: 'stepped', default: 'close',
    steps: [{ value: 'close' }, { value: 'spread' }, { value: 'drop2' }, { value: 'shell' }] },
  // A stab at the bottom, one chord running into the next at the top.
  { id: 'length', name: 'Length', section: 'play', curve: 'linear', min: 0.05, max: 1, default: 0.95, glideMs: 0 },
  { id: 'accent', name: 'Accent', section: 'play', curve: 'linear', min: 0, max: 1, default: 0.3, glideMs: 0 },
  { id: 'notation', name: 'Notation', section: 'play', curve: 'stepped', default: 'letters',
    steps: [{ value: 'letters' }, { value: 'roman' }] },
];

export default {
  apiVersion: 1,
  id: 'wcoast.chord-changes',
  name: 'Chord Changes',
  abbreviation: 'CHG',
  category: 'harmony',
  scope: 'shared',
  hp: 14,
  worklets: ['modules/chord-changes/chord-changes-processor.js'],
  menuSectionOrder: ['chart', 'key', 'play', 'time', 'out'],
  ports,
  params,
  tonics: TONICS,
};
