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
          const d = e.data;
          if (!d) return;
          if (d.type === 'dispose') this.__wcoastEnded = true;
          // IDLE IS NOT DEAD. A voice copy that nothing is playing stops doing arithmetic but stays in
          // the graph, so waking it is a flag rather than a rebuild — see rack.js.
          else if (d.type === 'idle') this.__wcoastIdle = !!d.idle;
        });
        this.port.start();
      } catch (_e) { /* no port: nothing to end it with, and nothing to leak either */ }
    }

    // FALSE ONCE, AND THAT IS THE END. Returning false releases the node; there is no coming back
    // from it, which is why nothing but an explicit dispose sets the flag.
    process(...args) {
      if (this.__wcoastEnded) return false;
      if (this.__wcoastIdle) {
        // SILENCE WRITTEN, not assumed. Skipping the work leaves whatever the output buffers held, and
        // a repeated block is a buzz rather than a rest, so they are cleared before returning.
        const outputs = args[1];
        if (outputs) for (const out of outputs) for (const ch of out) ch.fill(0);
        return true;
      }
      return super.process(...args);
    }
  }
  return register.call(globalThis, name, Managed);
};
