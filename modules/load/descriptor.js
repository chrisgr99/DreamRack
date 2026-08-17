// descriptor.js — Load. What the audio thread is costing, on the rack rather than in a profiler.
//
// THE AUDIO THREAD IS ONE THREAD. It cannot spread across cores however many the machine has, so the
// ceiling is one core's worth and that is the number that decides whether a patch plays cleanly. A
// machine that is 5% busy overall can still crackle, which is why the ordinary system meter is no help
// and this exists.
//
// NO PORTS, NO WORKLET, NOTHING TO PATCH. It reads the context's own render-capacity figures, which
// the browser gathers on the audio thread for nothing — so watching the load costs no load.
//
// AS NARROW AS ITS NAME. A meter you are looking at while playing wants to be somewhere permanent,
// and a permanent module has to be cheap in the one thing a rack never has enough of: width.

'use strict';

const params = [
  // WHAT IT IS COSTING NOW, as a percentage of one core: the browser's own average over the last
  // window. READ ONLY — the engine owns it, and a readout you could turn would be a lie you can type.
  { id: 'load', name: 'Load', section: 'meter', curve: 'linear', min: 0, max: 100, default: 0,
    modulatable: false, readOnly: true },
  // THE WORST BLOCK IN THAT WINDOW, which is what actually breaks the sound: an average of 60% with a
  // peak over 100 has already dropped samples, and the average alone would never show it.
  { id: 'peak', name: 'Peak', section: 'meter', curve: 'linear', min: 0, max: 100, default: 0,
    modulatable: false, readOnly: true },
  // THE OTHER HALF OF "IS IT KEEPING UP". The audio thread and the drawing are separate costs with
  // separate symptoms — a rack heavy with cables and note flashes stutters visually while the sound
  // stays perfect — and the frame rate is the one number that says so. There is no GPU figure to read:
  // no browser exposes utilisation to a page, so this measures what can be measured, which is whether
  // the frames are arriving.
  { id: 'fps', name: 'Frame rate', section: 'meter', curve: 'linear', min: 0, max: 240, default: 0,
    modulatable: false, readOnly: true },
  // AND WHETHER IT ACTUALLY BROKE. An underrun is the audible event — the block that did not finish in
  // time — so it gets a lamp rather than a number, and it stays lit long enough to be seen.
  { id: 'under', name: 'Underrun', section: 'meter', curve: 'stepped', default: 'off',
    modulatable: false, readOnly: true, steps: [{ value: 'off' }, { value: 'on' }] },
];

export default {
  apiVersion: 1,
  id: 'wcoast.load',
  name: 'Load',
  abbreviation: 'LOAD',
  category: 'utility',
  scope: 'shared',
  // One meter reads the whole audio thread, so a copy per note would be eight modules saying the same
  // thing — and saying it about themselves.
  sharedFixed: true,
  hp: 3,
  worklets: [],
  menuSectionOrder: ['meter'],
  ports: [],
  params,
};
