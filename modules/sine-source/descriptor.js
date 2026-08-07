// descriptor.js — Sine Source, Wcoast module.
//
// The smallest useful thing in the rack: one sine, tunable by knob and playable by 1V/oct. It was the
// panel editor's proof-of-concept and it stays as a known-good test signal now that the Oscillator
// does the real work.

export default {
  "apiVersion": 1,
  "id": "sine-source",
  "name": "Sine Source",
  "category": "source",
  category: 'source',   // module library grouping
  "params": [
    {
      "id": "freq",
      "signal": "audio",
      "name": "Frequency",
      "min": 20,
      "max": 2000,
      "default": 220,
      "unit": "Hz",
      "curve": "exp"
    }
  ],
  "ports": [
    {
      "id": "pitchIn",
      "name": "1V/oct",
      "role": "pitch",
      "domain": "control",
      "dir": "in"
    },
    {
      "id": "out",
      "name": "Out",
      "domain": "audio",
      "dir": "out"
    }
  ]
};
