// descriptor.js — Macro Oscillator 2. A complete instrument in one module.
//
// A port of Émilie Gillet's Plaits (MIT). One trigger in and a finished note comes out: the sound,
// its envelope and the low pass gate that shapes it are all inside. That is what makes it the right
// module to hang off the clock — everything else in the rack needs a gate, a VCA and something to
// open it, and this needs a cable.
//
// THE NAME IS VCV's, NOT MUTABLE'S. The code is MIT and free to use; the hardware's product name is
// not — the same restriction we hit with Marbles. Audible Instruments, which is VCV's official port
// of the same source, calls this one Macro Oscillator 2, and calls the Marbles port Random Sampler,
// which is already the name we ship that under. One convention, followed twice.
//
// The directory and the descriptor id stay `model-voice`: they are internal, they are in saved
// patches, and renaming them would break every file that mentions this module.
//
// THE PATCHED FLAGS ARE THE DESIGN. In the original, a CV input that has nothing in it is driven by
// the internal decay envelope instead, scaled by that input's attenuverter. So one cable into TRIG
// strikes the gate AND sweeps timbre, morph and pitch by whatever the three trims say. It is why the
// module sounds complete on its own — and it lands exactly on the knАck behaviour we already have,
// where the depth trim is greyed until its jack is patched. Here the grey means something further:
// unpatched, that trim is setting how much the envelope moves the parameter.
//
// THE ENGINE ARRIVES IN STAGES. Stage 0 is the socket every model plugs into — the trigger, the
// internal envelope, the low pass gate and the pitch path — with one plain oscillator so the whole
// chain can be heard and measured. The sixteen models land behind that interface one at a time; see
// model-voice-processor.js.

'use strict';

const params = [];
const ports = [];

// A knАck: the value, the CV jack in the middle of it, and the trim that scales what arrives there.
const knack = (id, name, min, max, def, opts = {}) => {
  params.push({ id, name, section: opts.section || 'voice', curve: opts.curve || 'linear', min, max, default: def, glideMs: 0 });
  ports.push({ id: `${id}Cv`, name, section: opts.section || 'voice', domain: 'control', dir: 'in', target: id, via: `${id}Depth` });
  params.push({ id: `${id}Depth`, name: `${name} amount`, section: opts.section || 'voice', curve: 'linear', min: -1, max: 1, default: 0, glideMs: 10 });
};

// ---- THE MODEL. A list, not a number: the original selects it with two buttons and sixteen lamps,
// which asks you to count. A readout with a pop-up list says "modal resonator" — the one place our
// vocabulary is plainly better than the panel we are porting, and worth the width it costs.
//
// The first ten are what the DSP will carry first: both physical models, the drums, and the four
// oscillators that need no data tables. The rest follow.
params.push({ id: 'model', name: 'Model', section: 'voice', curve: 'stepped', default: 'string',
  steps: [
    { value: 'analog' }, { value: 'shaper' }, { value: 'fm' }, { value: 'grain' },
    { value: 'noise' }, { value: 'particle' }, { value: 'string' }, { value: 'modal' },
    { value: 'kick' }, { value: 'snare' }, { value: 'hat' },
  ] });

// ---- PITCH. Eight octaves on the knob, and the V/oct jack is its own terminal rather than a knАck:
// pitch is the one input that is never an afterthought, and it belongs where a hand goes first.
// A1 TO A9, so the printed gauge means something. The range used to be 20 to 8000, which is close to
// nine octaves but lands on nothing: a scale ring with A1 at one end and A9 at the other only tells
// the truth if those ARE the ends. 27.5 to 7040 is exactly eight octaves of A, and on an exponential
// knob that puts every octave at an even step around the dial — the same gauge the complex
// oscillator's two frequency knobs carry.
params.push({ id: 'freq', name: 'Frequency', section: 'voice', curve: 'exp', min: 27.5, max: 7040, default: 220, unit: 'Hz', glideMs: 0 });
// The jack in the middle of FREQ is their FM input, and the trim beside it is their FM attenuverter:
// a frequency CV with its own depth is a knАck by another name. V/oct stays a plain terminal — it is
// not modulation, it is what note to play, and it takes no attenuator on any instrument.
// FM IS ITS OWN CONTROL, not a trim hiding in the corner of the frequency knob. The ring is how much
// and the jack in its middle is where the modulation arrives — the word FM is one every player knows,
// and it earns its place on the panel.
ports.push({ id: 'fmCv', name: 'FM', section: 'voice', domain: 'control', dir: 'in', target: 'freq', via: 'fmDepth' });
params.push({ id: 'fmDepth', name: 'FM', section: 'voice', curve: 'linear', min: -1, max: 1, default: 0, glideMs: 10 });
ports.push({ id: 'pitchIn', name: '1V/Oct', section: 'voice', domain: 'control', dir: 'in', role: 'pitch' });
// Their MODEL input steps the selection under CV, which is how the module is played as a drum machine.
ports.push({ id: 'modelCv', name: 'Model', section: 'voice', domain: 'control', dir: 'in', target: 'model' });

// ---- THE THREE. What they mean depends on the model, which is the point: one set of hands, sixteen
// instruments. HARMONICS is the balance or spread of what the tone is made of, TIMBRE runs dark to
// bright, MORPH walks through the variations.
// HARMONICS GETS AN ATTENUVERTER, which their panel does not have — theirs takes its CV at full
// strength. All four of the continuous controls here are worth modulating and all four are worth
// taming, and one of them arriving at a fixed depth is an inconsistency you would have to remember.
knack('harmonics', 'Harmonics', 0, 1, 0.4);
knack('timbre', 'Timbre', 0, 1, 0.5);
knack('morph', 'Morph', 0, 1, 0.5);

// ---- THE ENVELOPE AND THE GATE. Two knobs and the module needs no others: DECAY is how long the
// note rings, COLOUR is how the low pass gate behaves as it closes — from a plain volume fall to the
// full vactrol-like darkening that makes a struck sound read as struck.
params.push({ id: 'decay', name: 'Decay', section: 'strike', curve: 'linear', min: 0, max: 1, default: 0.5, glideMs: 0 });
params.push({ id: 'colour', name: 'Colour', section: 'strike', curve: 'linear', min: 0, max: 1, default: 0.5, glideMs: 0 });

// TRIG strikes it. LEVEL opens the gate by hand — an accent input, and the thing that lets a
// sequencer play this dynamically rather than at one volume.
ports.push({ id: 'trigIn', name: 'Trig', section: 'strike', domain: 'trigger', dir: 'in' });
ports.push({ id: 'levelIn', name: 'Level', section: 'strike', domain: 'control', dir: 'in' });

// Two outputs, and they are not the same signal: every model puts a second, related voice on AUX —
// the sub-oscillator, the noise half, the other drum. Patching both is how one module fills a mix.
ports.push({ id: 'out', name: 'Out', section: 'strike', domain: 'audio', dir: 'out' });
ports.push({ id: 'auxOut', name: 'Aux', section: 'strike', domain: 'audio', dir: 'out' });

export default {
  id: 'model-voice',
  apiVersion: 1,
  name: 'Macro Oscillator 2',
  abbreviation: 'MO2',
  category: 'source',
  worklets: ['modules/model-voice/model-voice-processor.js'],
  ports,
  params,
};
