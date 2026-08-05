// host/demo/speech-id.js — the name a spoken fragment is filed under.
//
// Shared by the renderer (node) and the player (browser), because both have to agree on it: the
// renderer writes demos/speech/<id>.m4a, the player asks for the same id. Keying on a hash of the
// TEXT rather than on a step number is what makes re-wording one note re-render one file and leave
// every other fragment alone.
//
// FNV-1a, 32-bit, hex. Not a cryptographic hash and doesn't need to be — a collision here would
// play the wrong sentence, not open a hole, and 32 bits over a few hundred strings is ample.
'use strict';

export function speechId(text) {
  const s = String(text).trim().replace(/\s+/g, ' ');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
