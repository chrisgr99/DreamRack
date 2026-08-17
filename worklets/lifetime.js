// lifetime.js — a disposed module's DSP actually stops.
//
// THE BUG THIS EXISTS FOR. An AudioWorkletNode is not collected because you dropped it. The spec ties
// a processor's life to what `process()` RETURNS: while it returns true the node is kept alive and
// called every block, connected or not, referenced or not. Every processor here returns true forever,
// which is right while a module is on the rack and wrong the moment it is deleted — so every module
// ever removed, every patch loaded over another, and every voice copy from every polyphony change went
// on burning audio-thread time until the app was restarted. A session that loaded a few patches ended
// up with hundreds of orphans running, and the symptom is a rack that sounds overloaded while playing
// almost nothing.
//
// WHY A SHIM RATHER THAN SEVENTEEN EDITS. This is a rule about lifetime, not about any module's sound,
// and a rule kept in seventeen places is a rule that will be broken by the eighteenth. Loaded into the
// worklet scope BEFORE any processor, it wraps registerProcessor so every processor — including any
// written later — gets the same ending for free.
const register = globalThis.registerProcessor;

globalThis.registerProcessor = function registerProcessorManaged(name, Klass) {
  class Managed extends Klass {
    constructor(...args) {
      super(...args);
      try {
        // addEventListener rather than onmessage, so a processor that installs its own handler — most
        // of them do, some in the constructor and some later — keeps working untouched.
        this.port.addEventListener('message', (e) => {
          if (e.data && e.data.type === 'dispose') this.__wcoastEnded = true;
        });
        this.port.start();
      } catch (_e) { /* no port: nothing to end it with, and nothing to leak either */ }
    }

    // FALSE ONCE, AND THAT IS THE END. Returning false releases the node; there is no coming back
    // from it, which is why nothing but an explicit dispose sets the flag.
    process(...args) {
      if (this.__wcoastEnded) return false;
      return super.process(...args);
    }
  }
  return register.call(globalThis, name, Managed);
};
