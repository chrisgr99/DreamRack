// rack-app.js — the rack front end (bootstrap).
//
// Wires the module registry, the audio host, the Rack, and the output Mixer
// together. The mixer is a pinned rack module (bottom row) — its channel jacks
// and master fader live on its own faceplate. The mixer IS the output — a module
// only makes sound once its output is patched into a mixer channel; the master
// gain feeds your two outputs. Global controls (app menu, start/stop,
// show-network) are reached from the panel menu and the app menu. Every
// per-parameter module control lives on the module faceplates.

import { ModuleRegistry } from '../host/registry.js';
import { SynthHost } from '../host/host.js';
import { Rack } from '../host/rack.js';
import { Recorder } from '../host/recorder.js';
import { createLibrary } from '../host/library.js';
import oscDescriptor from '../modules/complex-oscillator-259t/descriptor.js';
import { create as oscCreate } from '../modules/complex-oscillator-259t/factory.js';
import mixerDescriptor from '../modules/mixer/descriptor.js';
import { create as mixerCreate } from '../modules/mixer/factory.js';
import lpgDescriptor from '../modules/lpg-292/descriptor.js';
import { create as lpgCreate } from '../modules/lpg-292/factory.js';
import fnDescriptor from '../modules/function-gen-281t/descriptor.js';
import { create as fnCreate } from '../modules/function-gen-281t/factory.js';
import galleryDescriptor from '../modules/gallery/descriptor.js';
import { create as galleryCreate } from '../modules/gallery/factory.js';
import sineDescriptor from '../modules/sine-source/descriptor.js';
import { create as sineCreate } from '../modules/sine-source/factory.js';
import vcoDescriptor from '../modules/oscillator/descriptor.js';
import { create as vcoCreate } from '../modules/oscillator/factory.js';
import noiseDescriptor from '../modules/noise/descriptor.js';
import { create as noiseCreate } from '../modules/noise/factory.js';
import envDescriptor from '../modules/envelope/descriptor.js';
import { create as envCreate } from '../modules/envelope/factory.js';
import vcaDescriptor from '../modules/vca/descriptor.js';
import { create as vcaCreate } from '../modules/vca/factory.js';
import filterDescriptor from '../modules/filter/descriptor.js';
import { create as filterCreate } from '../modules/filter/factory.js';
import octDescriptor from '../modules/octave/descriptor.js';
import { create as octCreate } from '../modules/octave/factory.js';
import clockDescriptor from '../modules/clock/descriptor.js';
import marblesDescriptor from '../modules/marbles/descriptor.js';
import delayDescriptor from '../modules/delay/descriptor.js';
import { create as marblesCreate } from '../modules/marbles/factory.js';
import { create as delayCreate } from '../modules/delay/factory.js';
import { create as clockCreate } from '../modules/clock/factory.js';
import progDescriptor from '../modules/programmer-8/descriptor.js';
import { create as progCreate } from '../modules/programmer-8/factory.js';
import vidDescriptor from '../modules/video-out/descriptor.js';
import { create as vidCreate } from '../modules/video-out/factory.js';
import fieldDescriptor from '../modules/coordinate-field/descriptor.js';
import { create as fieldCreate } from '../modules/coordinate-field/factory.js';
import timeDescriptor from '../modules/time-machine/descriptor.js';
import { create as timeCreate } from '../modules/time-machine/factory.js';
import shapesDescriptor from '../modules/shapes/descriptor.js';
import { create as shapesCreate } from '../modules/shapes/factory.js';
import mathsDescriptor from '../modules/video-maths/descriptor.js';
import { create as mathsCreate } from '../modules/video-maths/factory.js';
import voiceDescriptor from '../modules/model-voice/descriptor.js';
import { create as voiceCreate } from '../modules/model-voice/factory.js';
import compositorDescriptor from '../modules/compositor/descriptor.js';
import { create as compositorCreate } from '../modules/compositor/factory.js';
import formulaDescriptor from '../modules/formula/descriptor.js';
import { create as formulaCreate } from '../modules/formula/factory.js';
import { serialize, restore, validate, APP_NAME, APP_VERSION } from '../host/patch-io.js';
import { createStorage } from '../host/storage.js';
import { buildCatalogue, createMirror } from '../host/mirror.js';
import { createAudioTrace } from '../host/audio-trace.js';
import { DEFAULT_RACK, placeRack } from '../host/default-rack.js';
import { createDemoRunner } from '../host/demo/runner.js';
import { createDemoPanel } from '../host/demo/panel.js';
import { createTour, tourSeen } from '../host/tour.js';
import { createPatchNotes } from '../host/patch-notes.js';
import { createComposer } from '../host/feedback.js';
import { createAbout } from '../host/about.js';
import { loadTutorial } from '../host/tutorial-md.js';

function log(msg) { console.log('[wcoast]', msg); }

const registry = new ModuleRegistry();
registry.register({ descriptor: oscDescriptor, create: oscCreate });
registry.register({ descriptor: mixerDescriptor, create: mixerCreate });
registry.register({ descriptor: lpgDescriptor, create: lpgCreate });
registry.register({ descriptor: fnDescriptor, create: fnCreate });
registry.register({ descriptor: galleryDescriptor, create: galleryCreate });
registry.register({ descriptor: sineDescriptor, create: sineCreate });
registry.register({ descriptor: vcoDescriptor, create: vcoCreate });
registry.register({ descriptor: noiseDescriptor, create: noiseCreate });
registry.register({ descriptor: envDescriptor, create: envCreate });
registry.register({ descriptor: vcaDescriptor, create: vcaCreate });
registry.register({ descriptor: filterDescriptor, create: filterCreate });
registry.register({ descriptor: octDescriptor, create: octCreate });
registry.register({ descriptor: clockDescriptor, create: clockCreate });
registry.register({ descriptor: marblesDescriptor, create: marblesCreate });
registry.register({ descriptor: delayDescriptor, create: delayCreate });
registry.register({ descriptor: progDescriptor, create: progCreate });
registry.register({ descriptor: vidDescriptor, create: vidCreate });
registry.register({ descriptor: fieldDescriptor, create: fieldCreate });
registry.register({ descriptor: timeDescriptor, create: timeCreate });
registry.register({ descriptor: shapesDescriptor, create: shapesCreate });
registry.register({ descriptor: mathsDescriptor, create: mathsCreate });
registry.register({ descriptor: compositorDescriptor, create: compositorCreate });
registry.register({ descriptor: voiceDescriptor, create: voiceCreate });
registry.register({ descriptor: formulaDescriptor, create: formulaCreate });

const MODULE_TYPES = [{
  descriptorId: oscDescriptor.id,
  name: 'Complex Oscillator',
  hp: oscDescriptor.hp || 34,
  panelUrl: 'modules/complex-oscillator-259t/panel.svg',
  descriptor: oscDescriptor,
}, {
  descriptorId: lpgDescriptor.id,
  name: 'Quad Low Pass Gate',
  hp: 32,
  panelUrl: 'modules/lpg-292/panel.svg',
  descriptor: lpgDescriptor,
}, {
  descriptorId: fnDescriptor.id,
  name: 'Quad Function Generator',
  // ATTACK and DECAY are knAcks (a cable plugs straight into the knob), so the CV jacks
  // are folded away and the faceplate is ~15% narrower than the original four-column layout.
  hp: 26,
  panelUrl: 'modules/function-gen-281t/panel.svg',
  descriptor: fnDescriptor,
}, {
  descriptorId: galleryDescriptor.id,
  name: 'Control Gallery',
  hp: 53,
  panelUrl: 'modules/gallery/panel.svg',
  descriptor: galleryDescriptor,
}, {
  // Oscillator — the ordinary East Coast VCO, beside the Complex Oscillator rather than competing
  // with it: one oscillator, four phase-coherent shapes, through-zero linear FM, and a feedback knob
  // that modulates its own phase. 13 HP.
  descriptorId: vcoDescriptor.id,
  name: 'VCO',
  hp: 10,
  panelUrl: 'modules/oscillator/panel.svg',
  descriptor: vcoDescriptor,
}, {
  // Noise — five colours from one generator, no controls. First module built from the panel grammar
  // (panel/grammar.js): its whole faceplate is a list of five jacks.
  descriptorId: noiseDescriptor.id,
  name: 'Noise',
  hp: 5,
  panelUrl: 'modules/noise/panel.svg',
  descriptor: noiseDescriptor,
}, {
  // ADSR — the ordinary four-stage envelope, which the rack did not have: the Quad Function Generator
  // is struck, this one is HELD. Its panel draws its own shape and lights the stage running. 10 HP.
  descriptorId: envDescriptor.id,
  name: 'ADSR',
  hp: 10,
  panelUrl: 'modules/envelope/panel.svg',
  descriptor: envDescriptor,
}, {
  // Filter — a state-variable filter with low, band and high live at once, two or four poles, and
  // drive into the input so the filter smooths what the saturation makes. 8 HP.
  descriptorId: filterDescriptor.id,
  name: 'Filter',
  hp: 8,
  panelUrl: 'modules/filter/panel.svg',
  descriptor: filterDescriptor,
}, {
  // Octave — a 1V/oct signal moved whole octaves. No worklet: on 1V/oct an octave is exactly one, so
  // it is a sum the audio graph does for free. 4 HP.
  descriptorId: marblesDescriptor.id,
  name: 'Random Sampler',
  hp: 15,
  panelUrl: 'modules/marbles/panel.svg',
  descriptor: marblesDescriptor,
}, {
  descriptorId: delayDescriptor.id,
  name: 'Delay',
  hp: 8,
  panelUrl: 'modules/delay/panel.svg',
  descriptor: delayDescriptor,
}, {
  descriptorId: clockDescriptor.id,
  name: 'drClckd',
  hp: 12,
  panelUrl: 'modules/clock/panel.svg',
  descriptor: clockDescriptor,
}, {
  descriptorId: octDescriptor.id,
  name: 'Octave',
  hp: 4,
  panelUrl: 'modules/octave/panel.svg',
  descriptor: octDescriptor,
}, {
  // VCA — one signal, one knob, one voltage on the knob. Linear or exponential response. 5 HP.
  descriptorId: vcaDescriptor.id,
  name: 'VCA',
  hp: 6,
  panelUrl: 'modules/vca/panel.svg',
  descriptor: vcaDescriptor,
}, {
  // Sine Source — authored in the panel editor (panel + descriptor drawn), factory
  // hand-written. The Phase 6 closed-loop proof: a drawn module that loads and plays.
  descriptorId: sineDescriptor.id,
  name: 'Sine Source',
  hp: 5,
  panelUrl: 'modules/sine-source/panel.svg',
  descriptor: sineDescriptor,
}, {
  // Sequencer / Programmer Eight — complete: playhead, transport, directed loop window,
  // per-stage select/pulse jacks, both voltage rows with A−B, All Gate, Trigger, the play
  // buttons as a keyboard, and per-stage ratchets. Vertical stage layout, 16 HP.
  descriptorId: progDescriptor.id,
  name: 'Sequencer / Programmer Eight',
  hp: 16,
  panelUrl: 'modules/programmer-8/panel.svg',
  descriptor: progDescriptor,
}, {
  // Video Output — the terminal of the video graph. Not pinned like the mixer: video is
  // optional and should not occupy rack space for someone who never uses it. `singleton` on
  // the descriptor takes it out of the Add menu while one is already in the rack.
  descriptorId: vidDescriptor.id,
  name: 'Video Output',
  hp: 12,
  panelUrl: 'modules/video-out/panel.svg',
  descriptor: vidDescriptor,
}, {
  // Coordinate Field — the first module of the patchable video chain. It owns a coordinate
  // space, moves it, and reads a field out of it; with an image patched in it warps that
  // instead. 16 HP, three columns: place, warp, field.
  descriptorId: fieldDescriptor.id,
  name: 'Coordinate Field',
  hp: 16,
  panelUrl: 'modules/coordinate-field/panel.svg',
  descriptor: fieldDescriptor,
}, {
  // Time — the module a hardware video synth cannot have: a ring of the last 32 frames, read as
  // a delay, as decaying trails, or as a slit-scan where every line comes from a different
  // moment. 10 HP.
  descriptorId: timeDescriptor.id,
  name: 'Time',
  hp: 8,
  panelUrl: 'modules/time-machine/panel.svg',
  descriptor: timeDescriptor,
}, {
  // Shapes — a window comparator over a field. It makes no shapes of its own: which shape you
  // get is decided by what is patched in, so a radius field gives discs and rings, an angle
  // field gives wedges, and an axis field gives bars. 8 HP.
  descriptorId: shapesDescriptor.id,
  name: 'Shapes',
  hp: 8,
  panelUrl: 'modules/shapes/panel.svg',
  descriptor: shapesDescriptor,
}, {
  // Video Maths — two images, one arithmetic. The smallest shader in the set and the largest
  // change to what the rack can do: until this exists a patch has ONE image however many
  // modules it passes through, and interference needs two. 8 HP.
  descriptorId: mathsDescriptor.id,
  name: 'Video Maths',
  hp: 8,
  panelUrl: 'modules/video-maths/panel.svg',
  descriptor: mathsDescriptor,
}, {
  // Compositor — two PICTURES into one, where Video Maths combines single channels. It is what turns
  // a rack full of sources into one image, and where backgrounds live, which is why Video Output has
  // no background input of its own. 8 HP: the eight named blends are folded into two columns.
  descriptorId: compositorDescriptor.id,
  name: 'Compositor',
  hp: 8,
  panelUrl: 'modules/compositor/panel.svg',
  descriptor: compositorDescriptor,
}, {
  // Formula — four images, four knobs and a typed expression, shown on the faceplate. It exists
  // beside Video Maths rather than replacing it: Maths is one cable and a switch, Formula is for
  // when a patch would otherwise be three Maths modules whose arithmetic is spread across the
  // rack and can only be read by navigating to each in turn. 8 HP: the inputs and knobs are
  // stacked two by two, because a module that replaces three others should not be the widest.
  descriptorId: formulaDescriptor.id,
  name: 'Formula',
  hp: 8,
  panelUrl: 'modules/formula/panel.svg',
  descriptor: formulaDescriptor,
}, {
  // Macro Oscillator 2 — a complete instrument in one module: the sound, its envelope and the gate that
  // shapes it. One cable from the clock and it plays. A port of Émilie Gillet's Plaits (MIT); the
  // faceplate is here and the synthesis is not, so the panel can be judged before it is written.
  descriptorId: voiceDescriptor.id,
  name: 'Macro Oscillator 2',
  hp: 14,
  panelUrl: 'modules/model-voice/panel.svg',
  descriptor: voiceDescriptor,
}, {
  // The mixer is a pinned singleton placed at boot, so it is hidden from the module
  // library (no second mixer). Still a normal module type otherwise.
  descriptorId: mixerDescriptor.id,
  name: 'Mixer / Output',
  hp: 51,
  panelUrl: 'modules/mixer/panel.svg',
  descriptor: mixerDescriptor,
  hidden: true,
}];

let audioCtx = null;
let host = null;
let rack = null;
let mixer = null;        // { instanceId, instance }
let recorder = null;     // screen+audio recorder (Electron only)
let recBadge = null, recTimer = null;

// A recording that is quietly still running is the failure mode worth designing against,
// so the badge is deliberately hard to miss: fixed to the top-right, above everything,
// with a pulsing dot and the elapsed time. Click it to stop.
function paintRecBadge() {
  if (!recorder) return;
  if (recorder.recording && !recBadge) {
    recBadge = document.createElement('button');
    recBadge.type = 'button';
    recBadge.title = 'Stop recording';
    recBadge.style.cssText = [
      'position:fixed', 'top:10px', 'right:12px', 'z-index:2000',
      'display:flex', 'align-items:center', 'gap:7px',
      'padding:5px 11px 5px 9px', 'border-radius:16px',
      'border:1px solid #b3323c', 'background:#2a1416', 'color:#ffd9dc',
      'font:600 12px/1 -apple-system,system-ui,sans-serif', 'cursor:pointer',
      'font-variant-numeric:tabular-nums', 'box-shadow:0 3px 14px rgba(0,0,0,.5)',
    ].join(';');
    const dot = document.createElement('span');
    dot.style.cssText = 'width:9px;height:9px;border-radius:50%;background:#ff3b30;animation:wcRecPulse 1.6s ease-in-out infinite';
    const time = document.createElement('span');
    recBadge.append(dot, time);
    recBadge.addEventListener('click', () => toggleRecording());
    if (!document.getElementById('wcRecKeyframes')) {
      const st = document.createElement('style');
      st.id = 'wcRecKeyframes';
      st.textContent = '@keyframes wcRecPulse{0%,100%{opacity:1}50%{opacity:.35}}';
      document.head.appendChild(st);
    }
    document.body.appendChild(recBadge);
    const tick = () => {
      const s = Math.floor(recorder.elapsedMs() / 1000);
      time.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    };
    tick();
    recTimer = setInterval(tick, 500);
  } else if (!recorder.recording && recBadge) {
    clearInterval(recTimer); recTimer = null;
    recBadge.remove(); recBadge = null;
  }
}

// WHERE THINGS WENT, said next to where you were looking. Capturing something and having nothing
// happen on screen is indistinguishable from a broken menu item, so every capture answers back.
//
// This replaced a pill pinned to the top-right corner that stayed until dismissed. Two reasons it
// moved: a corner is nowhere near where you just clicked, and — the one that decided it — a
// notification that never goes away is still on screen the NEXT time you take a snapshot, so it
// ends up IN the picture. It keeps everything the pill carried: the filename, and a click that
// reveals the file in Finder. It just expires rather than waiting to be dismissed.
//
// The pointer is tracked continuously because the trigger is not always a click: R starts a
// recording from the keyboard, and the pointer may be anywhere or nowhere useful. Last known
// position, falling back to the top centre of the window.
let lastPointer = null;
document.addEventListener('pointermove', (e) => { lastPointer = { x: e.clientX, y: e.clientY }; }, true);
document.addEventListener('pointerdown', (e) => { lastPointer = { x: e.clientX, y: e.clientY }; }, true);

// Two lines, always: what happened, then which file (or what to do next). Stacked rather than
// strung out on one line because a short wide banner is a thing you have to READ across, while
// two short lines are a thing you take in at a glance — and this has four seconds to be taken in.
let noteEl = null, noteTimer = 0;
// `at` is WHERE THE ACTION HAPPENED, not where the pointer is by the time the work finishes.
// That distinction matters: stopping a recording waits on the recorder to finalise and the last
// chunks to reach disk, and reading the pointer after that wait put "Recording saved" wherever the
// pointer had drifted to — somewhere other than where "Recording started" had appeared. Callers
// capture the position before they await anything, so the pair lands in one place.
function notify(message, { detail = null, path = null, ms = 4000, at = null, sticky = false } = {}) {
  if (noteEl) { clearTimeout(noteTimer); noteEl.remove(); noteEl = null; }
  const note = document.createElement('div');
  note.style.cssText = [
    'position:fixed', 'z-index:2000', 'transform:translate(-50%,-100%)',
    'display:flex', 'flex-direction:column', 'align-items:flex-start', 'gap:2px',
    'padding:8px 13px', 'border-radius:9px',
    'border:1px solid #3d6b46', 'background:#152418', 'color:#cfe9d5',
    'font:600 12.5px/1.4 -apple-system,system-ui,sans-serif',
    'box-shadow:0 4px 18px rgba(0,0,0,.55)', 'transition:opacity .35s',
    'max-width:30ch', 'pointer-events:auto',
  ].join(';');
  const text = document.createElement('span');
  text.textContent = message;
  note.appendChild(text);
  const second = detail || (path ? path.split('/').pop() : null);
  if (second != null || sticky) {
    const sub2 = document.createElement('span');
    sub2.textContent = second == null ? '' : second;
    // A filename wraps rather than truncating: an elided name is no use for finding the file,
    // which is the only reason it is shown.
    sub2.style.cssText = 'opacity:.75;font-weight:400;word-break:break-word';
    note.appendChild(sub2);
  }
  if (path) {
    note.title = `${path}\nClick to show in Finder`;
    note.style.cursor = 'pointer';
    note.addEventListener('click', () => window.wcoast?.record?.reveal?.(path));
  } else {
    note.style.pointerEvents = 'none';
  }
  document.body.appendChild(note);

  // Just above the pointer, then nudged back on screen if that put it over an edge — the same
  // courtesy the menus get.
  const p = at || lastPointer || { x: (window.innerWidth || 800) / 2, y: 90 };
  const r = note.getBoundingClientRect();
  const pad = 8;
  let x = p.x, y = p.y - 14;
  x = Math.min(Math.max(x, pad + r.width / 2), (window.innerWidth || 800) - pad - r.width / 2);
  if (y - r.height < pad) y = p.y + 14 + r.height;      // no room above → below the pointer
  note.style.left = Math.round(x) + 'px';
  note.style.top = Math.round(y) + 'px';

  noteEl = note;
  const fade = (after) => {
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => {
      note.style.opacity = '0';
      setTimeout(() => { note.remove(); if (noteEl === note) noteEl = null; }, 400);
    }, after);
  };
  if (!sticky) fade(ms);
  // A STICKY note stays until the caller says otherwise, and can be rewritten in place — which is
  // how the recording countdown works: one note that counts down and then becomes the confirmation,
  // rather than five notes flickering in and out.
  return {
    set(msg, det) {
      text.textContent = msg;
      const line2 = note.children[1];
      if (line2) line2.textContent = det == null ? '' : det;
    },
    dismissAfter: fade,
    close() { clearTimeout(noteTimer); note.remove(); if (noteEl === note) noteEl = null; },
  };
}

// A still of the window, saved beside the video takes. It goes through the main process rather
// than trying to rasterise the DOM here: capturePage reads the COMPOSITED window, so the scopes'
// live traces, the cables and the video preview are all in it — a DOM-to-image conversion would
// lose every canvas, which is most of what is worth a picture.
function snapshotAvailable() {
  return !!(window.wcoast && window.wcoast.isElectron && window.wcoast.snapshot);
}

async function takeSnapshot() {
  if (!snapshotAvailable()) return;
  const at = lastPointer && { ...lastPointer };   // where you were when you asked, not after the wait
  // Shut the menu first — and WAIT FOR A FRAME so it is actually gone. capturePage reads what is
  // composited, so a menu still on screen is a menu in the photograph, and taking the snapshot
  // from that very menu is the commonest way to do it.
  if (rack) rack.closeMenus();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const name = `DreamRack ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} `
    + `${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}.png`;
  // Failures here are REPORTED, not swallowed to the console. A menu item that silently does
  // nothing is indistinguishable from a broken one, and the console is not somewhere a user looks.
  try {
    const res = await window.wcoast.snapshot.save(name);
    if (res && res.path) { notify('Image written to Downloads', { path: res.path, at }); return; }
    log(`snapshot: no path returned (${JSON.stringify(res)})`);
    window.alert(`Snapshot failed: ${(res && res.error) || 'the window returned no image'}`);
  } catch (e) {
    log(`snapshot failed: ${e && e.message}`);
    window.alert(`Snapshot failed: ${e && e.message}`);
  }
}

// The lead-in before a take starts rolling. Five seconds of "get ready" so a demonstration can
// begin the moment recording does, rather than opening with a shot of someone reaching for the
// mouse. Pressing R again during the count calls it off.
let countdown = null;

async function toggleRecording() {
  if (!recorder) return;
  const at = lastPointer && { ...lastPointer };   // fixed before any await, so start and stop agree
  if (rack) rack.closeMenus();                    // never leave a menu open over a take
  if (countdown) {                                // a second press during the lead-in calls it off
    clearTimeout(countdown.timer);
    countdown.note.set('Recording cancelled', '');
    countdown.note.dismissAfter(1200);
    const settle = countdown.resolve;
    countdown = null;
    settle(false);                                // let the waiting call return instead of hanging
    return;
  }
  try {
    if (!recorder.recording) {
      // The countdown resolves with its OUTCOME rather than merely finishing: cancelled and
      // completed both end the wait, and only one of them should start a recording.
      const ready = await new Promise((resolve) => {
        const note = notify('Recording starts in', { detail: '5', at, sticky: true });
        let n = 5;
        const tick = () => {
          n -= 1;
          if (n >= 2) { note.set('Recording starts in', String(n)); countdown.timer = setTimeout(tick, 1000); return; }
          // The last beat says "Starting" rather than "1" — by then the number is no longer
          // information — and it carries "Press R to stop", because this is the LAST moment that
          // instruction can be shown. Anything on screen after the stream opens is IN the take,
          // so the note has to say its piece and be gone before recording begins.
          note.set('Starting', 'Press R to stop');
          countdown.timer = setTimeout(() => { countdown = null; resolve(true); }, 1000);
        };
        countdown = { note, resolve, timer: setTimeout(tick, 1000) };
      });
      if (!ready) return;
      // Clear the note and let a frame pass so it is actually off the screen, THEN open the
      // stream. Otherwise the first second of every take is a picture of the countdown.
      if (noteEl) { noteEl.remove(); noteEl = null; }
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const file = await recorder.start();
      if (file) log(`recording to ${file}`);
      return;
    }
  } catch (err) {
    countdown = null;
    log(`recording failed — ${err && err.message ? err.message : err}`);
    notify('Recording failed', { detail: (err && err.message) || String(err), at });
    paintRecBadge();
    return;
  }
  try {
    if (recorder.recording) {
      const file = await recorder.stop();
      if (file) { log(`recording saved — ${file}`); notify('Recording saved to Downloads', { path: file, at }); }
    }
  } catch (err) {
    // A refused screen-share, or a codec the build cannot produce. Say so rather than
    // leaving a badge that never appeared unexplained.
    log(`recording failed — ${err && err.message ? err.message : err}`);
    paintRecBadge();
  }
}
let trace = null;        // audio-trace projection (created after the mixer)

function ensureAudio() {
  if (audioCtx) return;
  audioCtx = new AudioContext();
  host = new SynthHost(audioCtx, registry);
  log(`Audio ready — ${audioCtx.sampleRate} Hz, crossOriginIsolated = ${self.crossOriginIsolated}.`);
}

async function boot() {
  ensureAudio();
  let darkMode = true;   // first run defaults to DARK; a saved choice (below) overrides
  try { const s = localStorage.getItem('wcoast.dark'); if (s !== null) darkMode = s === '1'; } catch (_e) { /* no storage */ }
  // Where the view was left, remembered like dark mode: an app preference, not part of any patch.
  const VIEW_KEY = 'wcoast.view';
  // Unsaved-changes state, declared BEFORE the rack: its onChange fires during
  // relayout and the mixer addModule below, calling onEdit -> markDirty, which
  // reads `dirty` — so `dirty` must already be initialized (no temporal dead zone).
  // `menuStateTimer` is here for exactly the same reason: onEdit/markClean also push the native
  // menu's state, and pushMenuState is hoisted while a `let` beside it would not be.
  let dirty = false, patchName = null, mirror = null, booted = false, menuStateTimer = null, notes = null, examples = [];
  let selectedEntry = null, demoActive = false, demoStop = false, demoPromise = null, demoPanel = null;   // scripted demos (design/scripted-demo.md)
  let viewSaveTimer = null;
  rack = new Rack(document.getElementById('rack'), {
    host, moduleTypes: MODULE_TYPES, rowCount: 2, dark: darkMode, onChange: () => onEdit(),
    // Remember where the view is between runs. Debounced hard: the view moves on every frame of a
    // pan, and this only needs to be right by the time the app closes.
    // The tab bar re-homes itself when the menu bar docks or undocks, and the page is part of what
    // the session remembers, so a switch is worth an autosave.
    onPageChange: () => { pushMenuState(); onEdit(); },
    onViewChange: () => {
      clearTimeout(viewSaveTimer);
      viewSaveTimer = setTimeout(() => {
        try { localStorage.setItem(VIEW_KEY, JSON.stringify(rack.viewState())); } catch (_e) { /* no storage */ }
      }, 400);
    },
  });
  rack.relayout();
  rack.ensureTabBar();   // the page tabs; they re-home themselves as the menu bar docks

  // Stamp the exact source revision into saved patches (serialize reads rack.buildInfo), so a bug
  // report carrying a patch traces to a checkout. Electron-from-source only; the browser build has
  // no repository and leaves this undefined, which patch-io omits.
  if (window.wcoast && window.wcoast.build) {
    try { rack.buildInfo = await window.wcoast.build(); } catch (_e) { /* leave unstamped */ }
  }

  // The output mixer is now a pinned rack module — a terminal singleton placed
  // once at the bottom row (draggable, not deletable) that stays the stable
  // "mixer" patch endpoint. Its master bus defaults on (routing applied below).
  // THE MIXER LIVES ON THE AUDIO OUTPUT PAGE, and only there. It is created on that page and nothing
  // moves a module between pages, so it is pinned to the page as firmly as it is pinned against
  // deletion — free to be dragged anywhere WITHIN the page, and never anywhere else. That is the whole
  // point of the page having its name: it is where the sound leaves, so the thing it leaves through
  // should not be sitting among the oscillators.
  const mixRec = await rack.addModule(mixerDescriptor.id, rack.rowCount - 1, 0, { pinned: true, key: 'mixer', page: 'output' });
  mixer = { instanceId: mixRec.instanceId, instance: mixRec.instance };
  trace = createAudioTrace({ ctx: audioCtx, rack, mixer: mixer.instance });

  // Window recording (Electron only). The picture comes from the window; the sound is
  // tapped off the audio graph, so a take carries exactly what was reaching the speakers.
  recorder = new Recorder(audioCtx, () => rack.audioTapNodes(), { onState: paintRecBadge });

  // Unsaved-changes tracking (state declared above the rack). Any knob, switch,
  // cable, or mixer change dirties the patch; loading or saving cleans it. The
  // title shows a dot while dirty, mirrored to the main process to guard close.
  function updateTitle() { document.title = `DreamRack — ${patchName || 'untitled'}${dirty ? ' •' : ''}`; }
  function setPatchName(n) { patchName = n; updateTitle(); if (mirror) mirror.project(); }
  function markDirty() { if (dirty) return; dirty = true; updateTitle(); window.wcoast?.patch?.setDirty?.(true); }
  function markClean() { dirty = false; updateTitle(); window.wcoast?.patch?.setDirty?.(false); if (mirror) mirror.project(); pushMenuState(); }
  // Any patch edit: mark dirty and re-project the mirror. Also re-check the audio-trace, since a
  // bus enable (masterEnable/monitorEnable) toggling is an edit and changes whether sound plays.
  function onEdit() { markDirty(); autosaveSession(); if (mirror) mirror.project(); updateTrace(); pushMenuState(); }
  // After loading any patch (open/recent/reopen/session-resume/AI-apply): refresh the notes card, and let
  // a note that asked to greet the user pop open.
  // After ANY patch arrives — opened, dropped, pasted, or an example — the engine goes OFF. A patch
  // that started sounding the moment it loaded would be making a noise nobody asked for, from a rack
  // the reader has not even looked at yet. It is the same rule the app starts under: sound happens
  // because you asked for it. Turning the engine off is what guarantees it, so it is cleared last.
  function silenceAfterLoad() {
    if (!mixRec) return;
    rack.applyParam(mixRec, 'masterEnable', 'off');
    rack.applyParam(mixRec, 'monitorEnable', 'off');
    rack.applyParam(mixRec, 'engine', 'off');
  }

  // A patch that asks to show its notes on opening does so — unless a DEMO opened it. A demo is
  // already narrating this patch, and a notes panel unfurling over the modules it is talking about
  // hides the very thing being pointed at.
  function afterLoad() { silenceAfterLoad(); if (!notes) return; notes.refresh(); if (rack.patchNotesOpen && !demoActive) notes.open(); }

  // Master level lives on the mixer module's own faceplate; this is just the last read of
  // it, kept for the AI mirror's `master` field. Re-read it whenever the fader may have
  // moved without us (a bulk reset, a patch restore).
  let masterValue = Number(mixRec.values.get('master'));
  const syncMaster = () => { masterValue = Number(mixRec.values.get('master')); };

  // The transport is the ENGINE over two buses. `soundOn` is true when the engine is on AND at
  // least one bus is enabled — it answers "can this rack be heard?", which is what the mirror and
  // the audio-trace mean by it, so it has to account for all three switches. isPlaying = the audio
  // clock is live (scopes read this to decide when to auto-scale). The context wakes here and
  // stays up; the engine boots off, so the app is silent until asked.
  const busOn = (id) => mixRec.values.get(id) === 'on';
  const soundOn = () => busOn('engine') && (busOn('masterEnable') || busOn('monitorEnable'));
  rack.isPlaying = () => audioCtx.state === 'running';
  audioCtx.resume();
  rack._applyBusEnables();   // apply the initial routing (master on, monitor off)

  // After a bulk control reset (clear-patch command, and its undo/redo) the rack has moved the
  // mixer's own params, so re-read the master level and re-apply the bus routing so the audio
  // matches the restored enables.
  rack.onControlsReset = () => {
    syncMaster();
    rack._applyBusEnables();
  };

  // --- VU meters -------------------------------------------------------------
  // One rAF loop reads the mixer instance's per-channel + master RMS and lights
  // the pre-drawn LED rings (fill the ring when lit, clear it when not).
  const vuColumns = [...mixRec.panel.svg.querySelectorAll('[data-wcoast-role="vu"],[data-wcoast-role="vuMaster"],[data-wcoast-role="vuMonitor"]')].map((g) => ({
    chan: g.getAttribute('data-wcoast-chan'),
    segs: [...g.querySelectorAll('[data-wcoast-seg]')].sort(
      (a, b) => (+a.getAttribute('data-wcoast-seg')) - (+b.getAttribute('data-wcoast-seg'))),
  }));
  const vuColour = (i, n) => { const f = i / (n - 1); return f > 0.85 ? '#ff5a4a' : f > 0.6 ? '#f4c430' : '#3ad16b'; };
  // dB meter: map RMS to dBFS and spread a fixed range across the segments, so the meter
  // tracks perceived loudness (a linear meter crowds everything at the top).
  const VU_FLOOR_DB = -48;
  const vuScale = (rms) => { if (rms <= 0) return 0; const db = 20 * Math.log10(rms); return Math.max(0, Math.min(1, (db - VU_FLOOR_DB) / -VU_FLOOR_DB)); };

  // Master PEAK reader (not RMS): peak is what makes a signal "too loud", so an ear
  // monitor auto-levels against the loudest PEAK the main output has actually reached.
  const masterAn = mixer.instance.analysers && mixer.instance.analysers.master;
  const peakBuf = new Float32Array(masterAn && masterAn.l ? masterAn.l.fftSize : 1024);
  const peakOf = (an) => { if (!an) return 0; an.getFloatTimeDomainData(peakBuf); let p = 0; for (let i = 0; i < peakBuf.length; i++) { const a = Math.abs(peakBuf[i]); if (a > p) p = a; } return p; };
  function paintVU() {
    const lv = mixer.instance.levels();
    if (soundOn() && masterAn) { const mp = Math.max(peakOf(masterAn.l), peakOf(masterAn.r)); if (mp > (rack._sessionMaxMaster || 0)) rack._sessionMaxMaster = mp; }
    for (const col of vuColumns) {
      const n = col.segs.length;
      // The master reads per SIDE ('ML'/'MR'), since the pan knobs above it are meaningless if you
      // cannot see where they are putting the sound. 'M' is the summed reading, kept for any meter
      // that asks for one bar.
      const level = col.chan === 'ML' ? lv.masterL
        : col.chan === 'MR' ? lv.masterR
          : col.chan === 'M' ? lv.master
            : col.chan === 'MON' ? rack.monVuLevel() : (lv.channels[col.chan] || 0);
      const lit = Math.round(vuScale(level) * n);
      for (let i = 0; i < n; i++) col.segs[i].setAttribute('fill', i < lit ? vuColour(i, n) : 'none');
    }
    requestAnimationFrame(paintVU);
  }
  requestAnimationFrame(paintVU);

  // The mixer as a save/load endpoint: its settings are the pinned record's values (it stays the
  // fixed "mixer" key, just now a rack module). The engine and the two bus enables are transport
  // state, NOT persistent mixer settings — sound boots to defaults (engine off; master on, monitor
  // off beneath it; the monitor bus re-enables itself when saved monitors are restored), so they're
  // excluded from save/restore. Otherwise a patch saved with the engine off would reload silent for
  // a non-obvious reason.
  const TRANSPORT = new Set(['engine', 'masterEnable', 'monitorEnable']);
  const mixerIO = {
    key: 'mixer',
    getParams: () => { const o = Object.fromEntries(mixRec.values); for (const k of TRANSPORT) delete o[k]; return o; },
    setParams: (vals) => { for (const [id, v] of Object.entries(vals)) { if (TRANSPORT.has(id)) continue; rack.applyParam(mixRec, id, v); } },
  };

  // AI patch mirror: project the live patch, the module catalogue, and app state
  // to a folder on disk (Electron only; a no-op in a browser).
  mirror = createMirror({
    getPatch: () => serialize(rack, mixerIO),
    getActive: () => ({
      protocolVersion: 1,
      isLive: true,
      patch: { name: patchName, dirty },
      state: { sound: soundOn() ? 'on' : 'off', master: masterValue },
      sync: { lastSyncAt: new Date().toISOString() },
      files: { roundTrip: ['inbox.json'], observationOnly: ['patch.json', 'active.json', 'catalogue.json', 'last-apply-result.json', 'selection.json', 'runtime.json', 'audio-trace.json', 'demo.json', 'AGENTS.md', 'README.md'] },
    }),
    catalogue: buildCatalogue([oscDescriptor, lpgDescriptor], mixerDescriptor),
    applyEdit,
  });

  // Audio-trace + runtime projection: while sound plays AND the mirror is on,
  // measure the live signal at every wired output, each mixer channel, and the
  // master, and write audio-trace.json (plus a small runtime.json). Started and
  // stopped by the On/Off toggle and the mirror enable toggle.
  function pushTrace(t) {
    const master = t.endpoints.find((e) => e.id === 'mixer.master');
    const runtime = {
      protocolVersion: 1, sound: t.sound, master: masterValue,
      vu: master ? { peak_dbfs: master.peak_dbfs, rms_dbfs: master.rms_dbfs } : null,
      at: t.capturedAt,
    };
    mirror.pushFiles({ 'audio-trace.json': t, 'runtime.json': runtime });
  }
  function updateTrace() {
    if (!trace || !mirror) return;
    const want = soundOn() && mirror.isEnabled();
    if (want && !trace.running()) trace.start(pushTrace);
    else if (!want && trace.running()) trace.stop({ writeOff: mirror.isEnabled() });
  }

  // Sticky deixis: project the module the pointer last entered to selection.json,
  // so "make this one louder" resolves. Debounced; never cleared on pointer-leave.
  let selTimer = null;
  rack.onSelect = (rec) => {
    clearTimeout(selTimer);
    selTimer = setTimeout(() => {
      if (!mirror.isEnabled()) return;
      mirror.pushFiles({ 'selection.json': rec ? { id: rec.key, type: rec.descriptorId, name: rec.name } : null });
    }, 200);
  };

  // Save/load: the environment-chosen storage adapter drives the shared core.
  const storage = createStorage();
  const patchText = () => JSON.stringify(serialize(rack, mixerIO), null, 2);
  // A compact patch JSON for embedding in a GitHub bug report / shared post: the bulky frozen-scope trace
  // blobs are stripped (a bug reproduces from the topology + settings, not the captured pixels).
  const trimmedPatchText = () => {
    const obj = serialize(rack, mixerIO);
    for (const p of (obj.probes || [])) { if (p && p.frozen) { p.frozen = false; delete p.wave; delete p.hist; delete p.histIdx; delete p.fastVotes; delete p.forceMode; } }
    return JSON.stringify(obj, null, 2);
  };
  // Session autosave: persist the live patch to localStorage on every edit
  // (debounced) so a relaunch resumes exactly where you left off. Separate from
  // named File saves — this just remembers the last working state.
  const SESSION_KEY = 'wcoast.session';
  // THE SESSION BEFORE THIS ONE, kept so a bad boot cannot silently eat a working patch. The session
  // is overwritten by autosave a moment after startup, so if anything goes wrong while restoring — a
  // thrown error, a module that fails to instantiate, cables that do not come back — the damaged
  // result is written over the only copy and the original is gone. One generation of history costs a
  // few kilobytes and turns that from data loss into an inconvenience. Rolled at BOOT, before the
  // first autosave can run, so it always holds the state the app came up with.
  const SESSION_PREV_KEY = 'wcoast.session.prev';
  let sessTimer = null;
  // Guarded by `booted`: the many addModule edits DURING boot must not overwrite the
  // session with a half-built (e.g. mixer-only) rack — only genuine post-boot edits save.
  // `demoActive` freezes autosave: a running demo rebuilds the rack, which must never overwrite
  // the user's saved session (it's snapshotted and restored around the run).
  function autosaveSession() { if (!booted || demoActive) return; clearTimeout(sessTimer); sessTimer = setTimeout(() => { try { localStorage.setItem(SESSION_KEY, patchText()); } catch (_e) { /* no storage */ } }, 400); }
  function flushSession() { if (!booted || demoActive) return; clearTimeout(sessTimer); try { localStorage.setItem(SESSION_KEY, patchText()); } catch (_e) { /* no storage */ } }
  // Guard the destructive actions (New / Open / Reopen) when there's unsaved work.
  // A DEMO is never asked. It reached File ▸ Examples by script, the user's own patch was snapshotted
  // before the demo began and is put back when it ends — so the one thing this prompt protects is
  // already safe, and a modal appearing over a demonstration is a dead end: the synthetic pointer
  // cannot press it.
  const okToDiscard = () => !dirty || demoActive || window.confirm('You have unsaved changes. Discard them?');

  // The rack a brand-new user gets on a first run, and exactly what File > New rebuilds.
  // Shared between the two so they can never drift apart.
  // The arrangement itself lives in host/default-rack.js, so that a tutorial demo can open on the
  // SAME rack a first-run user meets rather than conjuring its modules as it goes.
  async function placeDefaultModules() {
    // The mixer is pinned and survives File > New, wherever the discarded patch left it — but always
    // on the audio output page, which is not a page this layout otherwise touches.
    rack.placeModule('mixer', rack.rowCount - 1, 0);
    await placeRack(rack, DEFAULT_RACK);
  }

  async function newPatch() {
    if (!okToDiscard()) return;
    // clear() pulls every cable and deletes every module EXCEPT the pinned mixer, which
    // survives still carrying the discarded patch's fader and pan positions — so reset the
    // controls too. The modules placed afterwards are fresh, and start at their defaults.
    rack.clear(); rack.resetAllControls();
    await placeDefaultModules();
    storage.forget(); setPatchName(null); markClean(); afterLoad();
  }
  // RESET TO DEFAULT — the rack and the app exactly as a first-run user meets them.
  //
  // Distinct from File ▸ New, which starts a new PATCH and leaves your view settings where you put
  // them. This also returns dark mode, the row count, the menu bar and the zoom, because the thing
  // it exists for is recovery: "put everything back" should not leave you hunting for the one
  // setting it decided was yours to keep.
  //
  // The order matters. Row count is set BEFORE the modules are placed, since placeDefaultModules
  // lays out against the current number of rows and would otherwise put the mixer in a row that is
  // about to disappear.
  async function resetToDefault() {
    rack.confirm(
      'Reset to default? This puts your modules back to the initial complement and state, '
      + 'and returns the view settings to their defaults. Unsaved work is lost.',
      'Reset', async () => {
        rack.clear();
        rack.resetAllControls();
        setRows(2);
        if (!rack.isDark()) toggleDark();
        setMenuBar(true);
        rack.resetZoom();
        await placeDefaultModules();
        // Silent, the way a launch is: the engine last, since that is what guarantees it.
        rack.applyParam(mixRec, 'masterEnable', 'off');
        rack.applyParam(mixRec, 'monitorEnable', 'off');
        rack.applyParam(mixRec, 'engine', 'off');
        storage.forget(); setPatchName(null); markClean(); afterLoad();
      });
  }

  async function openPatch() {
    if (!okToDiscard()) return;
    let f;
    try { f = await storage.open(); } catch (e) { log(`open failed: ${e.message}`); return; }
    if (!f) return;
    try { await restore(JSON.parse(f.text), rack, mixerIO); setPatchName(f.name); markClean(); afterLoad(); }
    catch (e) { console.error('[wcoast] open failed: ' + ((e && e.stack) || e)); log(`restore failed: ${e.message}`); window.alert(`Could not open patch: ${e.message}`); }
  }
  // ---- WORK STATE, CARRIED BY THE REPOSITORY ---------------------------------------------------
  // CAPTURE before leaving a machine, RESTORE after cloning on the next one. The transport is git:
  // the app runs from its own checkout, so `patches/` beside it travels with a commit and a push.
  //
  // The saved patches are ordinary files and the main process copies them itself. The two things that
  // are NOT files — the live session and the view transform — live in this window's storage, so they
  // are handed over from here.
  async function captureWork() {
    if (!(window.wcoast && window.wcoast.captureWork)) { log('capture: Electron only'); return; }
    flushSession();   // whatever is on the rack right now, not what it was 400ms ago
    let view = null;
    try { view = JSON.parse(localStorage.getItem(VIEW_KEY) || 'null'); } catch (_e) { /* none */ }
    const r = await window.wcoast.captureWork({ session: patchText(), view });
    if (!r || r.error) { log(`capture failed: ${(r && r.error) || 'unknown'}`); return; }
    log(`captured ${r.copied} patches + session to patches/ — commit and push to carry them`);
  }
  async function restoreWork() {
    if (!(window.wcoast && window.wcoast.restoreWork)) { log('restore: Electron only'); return; }
    if (!okToDiscard()) return;   // it replaces the rack you are looking at
    const r = await window.wcoast.restoreWork();
    if (!r || r.error) { log(`restore failed: ${(r && r.error) || 'unknown'}`); return; }
    if (r.session) {
      try {
        await restore(JSON.parse(r.session), rack, mixerIO);
        setPatchName(null); markClean(); afterLoad();
      } catch (e) {
        console.error('[wcoast] work restore failed: ' + ((e && e.stack) || e));
        log(`restore failed: ${e.message}`);
      }
    }
    // The view goes back AFTER the modules, since laying them out resets the transform.
    if (r.view) { try { rack.setViewState(r.view); localStorage.setItem(VIEW_KEY, JSON.stringify(r.view)); } catch (_e) { /* ignore */ } }
    log(`restored ${r.added} patches to Documents (${r.kept} already there, left alone)`);
  }

  async function savePatch() {
    try { const name = await storage.save(patchText()); if (name) { setPatchName(name); markClean(); } }
    catch (e) { log(`save failed: ${e.message}`); window.alert(`Could not save: ${e.message}`); }
  }
  async function saveAsPatch() {
    try { const name = await storage.saveAs(patchText()); if (name) { setPatchName(name); markClean(); } }
    catch (e) { log(`save failed: ${e.message}`); window.alert(`Could not save: ${e.message}`); }
  }
  // Open one of the recent saves. Same guard as Open — it discards the current work.
  async function openRecent(id) {
    if (!okToDiscard()) return;
    let f;
    try { f = await storage.openRecent(id); } catch (e) { log(`open failed: ${e.message}`); return; }
    if (!f) { window.alert('That patch could not be opened — it may have been moved or renamed.'); return; }
    try { await restore(JSON.parse(f.text), rack, mixerIO); setPatchName(f.name); markClean(); afterLoad(); }
    catch (e) { console.error('[wcoast] open failed: ' + ((e && e.stack) || e)); log(`restore failed: ${e.message}`); window.alert(`Could not open patch: ${e.message}`); }
  }

  // The recent list is read when the menu OPENS, not cached at boot: the folder is the truth, and
  // it changes underneath us every time a patch is saved — here or in the Finder.
  let recentFiles = [];
  const refreshRecent = async () => { try { recentFiles = await storage.recent(); } catch (_e) { recentFiles = []; } };

  async function reopenPatch() {
    if (!okToDiscard()) return;
    let f;
    try { f = await storage.reopenLast(); } catch (e) { log(`reopen failed: ${e.message}`); return; }
    if (!f) return;
    try { await restore(JSON.parse(f.text), rack, mixerIO); setPatchName(f.name); markClean(); afterLoad(); }
    catch (e) { console.error('[wcoast] open failed: ' + ((e && e.stack) || e)); log(`restore failed: ${e.message}`); window.alert(`Could not open patch: ${e.message}`); }
  }

  // Bundled example patches (examples/index.json), loaded once. Opening one loads it as a STARTING POINT:
  // storage.forget() means a following Save behaves like Save As, since it isn't a file of the user's own.
  const loadExamples = async () => { try { const r = await fetch('examples/index.json'); if (r.ok) examples = await r.json(); } catch (_e) { examples = []; } pushMenuState(); };
  async function openExample(file, name) {
    if (!okToDiscard()) return;
    let obj;
    try { const r = await fetch('examples/' + file); if (!r.ok) throw new Error('not found'); obj = await r.json(); }
    catch (e) { log(`example load failed: ${e.message}`); window.alert('Could not load that example.'); return; }
    try { await restore(obj, rack, mixerIO); storage.forget(); setPatchName(name); markClean(); afterLoad(); }
    catch (e) { console.error('[wcoast] open failed: ' + ((e && e.stack) || e)); log(`restore failed: ${e.message}`); window.alert(`Could not open example: ${e.message}`); }
  }
  // Edit ▸ Create patch from clipboard — load a patch someone shared (e.g. copied from a GitHub post).
  async function createFromClipboard() {
    if (!okToDiscard()) return;
    let text;
    try { text = await navigator.clipboard.readText(); }
    catch (e) { log(`clipboard read failed: ${e.message}`); window.alert('Could not read the clipboard.'); return; }
    text = (text || '').trim().replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();   // tolerate a pasted code fence
    let obj;
    try { obj = JSON.parse(text); } catch (_e) { window.alert('The clipboard doesn’t contain a patch (it isn’t readable as JSON).'); return; }
    const v = validate(obj, registry);
    if (!v.ok) { window.alert(`That isn’t a valid Wcoast patch: ${v.error}`); return; }
    try { await restore(obj, rack, mixerIO); storage.forget(); setPatchName('from clipboard'); markClean(); afterLoad(); }
    catch (e) { window.alert(`Could not open the patch: ${e.message}`); }
  }

  // Apply an AI-proposed patch (the mirror's inbox.json handoff, in patch.json's
  // format): validate it against the descriptors, confirm with the user, then restore it.
  async function applyEdit(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, error: `invalid JSON: ${e.message}` }; }
    const v = validate(obj, registry);
    if (!v.ok) return v;
    const cur = serialize(rack, mixerIO);
    const summary = `${cur.modules.length} → ${obj.modules.length} modules, ${cur.wiring.length} → ${obj.wiring.length} cables`;
    if (!window.confirm(`Apply the AI-proposed patch?\n\n${summary}`)) return { ok: false, error: 'cancelled by the user' };
    try { await restore(obj, rack, mixerIO); afterLoad(); } catch (e) { return { ok: false, error: `apply failed: ${e.message}` }; }
    markDirty();
    return { ok: true };
  }

  // The commands the two menus share. Both the in-window menu and the native one call THESE, so
  // there is one implementation of each and they can't drift apart.
  let libraryTheme = null;   // set once the library exists; the theme toggle re-skins its thumbnails
  const toggleDark = () => {
    const d = !rack.isDark();
    rack.setDarkMode(d);   // re-skins every module, the pinned mixer included
    if (tour) tour.applyTheme();   // ...and the tutorial card, which is dressed as a faceplate
    if (notes) notes.applyTheme();
    if (composer) composer.applyTheme();
    if (about) about.applyTheme();
    if (typeof libraryTheme === 'function') libraryTheme();
    try { localStorage.setItem('wcoast.dark', d ? '1' : '0'); } catch (_e) { /* no storage */ }
    pushMenuState();
  };
  // The row count is PATCH DATA — it is serialised and restored — so changing it has to mark the
  // patch edited. Without that nothing triggered an autosave, and a rack set to two rows and then
  // quit came back at whatever the session had last recorded for some other reason.
  const setRows = (n) => { rack.setRowCount(n); pushMenuState(); onEdit(); };

  // Keep the native menu's state honest: what's undoable, which mode, which patches. Debounced,
  // because this fires on every edit and the main process rebuilds the menu bar from it.
  function pushMenuState() {
    const m = window.wcoast && window.wcoast.menu;
    if (!m) return;                       // browser: there is no native menu
    clearTimeout(menuStateTimer);
    menuStateTimer = setTimeout(async () => {
      menuStateTimer = null;
      let recent = [];
      try { recent = await storage.recent(); } catch (_e) { /* none */ }
      m.setState({ dark: rack.isDark(), rows: rack.rowCount, canUndo: rack.canUndo(), canRedo: rack.canRedo(),
        recent, examples, videoFollow: rack.videoFollowsPointer() });
    }, 200);
  }

  // The native menu names an action; the renderer runs the same function the in-window menu does.
  if (window.wcoast && window.wcoast.menu) {
    const actions = {
      new: () => newPatch(), open: () => openPatch(), save: () => savePatch(), saveAs: () => saveAsPatch(),
      openRecent: (id) => openRecent(id),
      undo: () => { rack.undo(); pushMenuState(); },
      redo: () => { rack.redo(); pushMenuState(); },
      clearAll: () => rack.confirmDeleteAllCables(),
      toggleDark: () => toggleDark(),
      setRows: (n) => setRows(n),
      fitToWindow: () => rack.resetZoom(),
      captureWork: () => captureWork(),
      restoreWork: () => restoreWork(),
      library: () => library.show(),
      resetToDefault: () => resetToDefault(),
      toggleVideoFollow: () => setVideoFollow(!rack.videoFollowsPointer()),
      // Run the same items the in-window Help menu offers, rather than restating their URLs here.
      readme: () => { const it = rack.helpMenuItems().find((i) => i.label === 'README'); if (it) it.action(); },
      reference: () => { const it = rack.developerMenuItems().find((i) => i.label === 'Developer guide'); if (it) it.action(); },
      tutorial: () => { if (rack.onTutorial) rack.onTutorial(); },
      patchNotes: () => { if (notes) notes.toggle(); },
      openExample: (e) => openExample(e.file, e.name),
      createFromClipboard: () => createFromClipboard(),
      feedback: () => composer.feedback(),
      reportBug: () => composer.reportBug(),
      sharePatch: () => composer.sharePatch(),
      about: () => about.toggle(),
    };
    window.wcoast.menu.onAction(({ action, arg }) => { const fn = actions[action]; if (fn) fn(arg); });
  }

  // The panel menu's File entry opens the File menu, reusing the rack's pop-up menu.
  // Hierarchical menu: the top level shows File / Edit / View; hovering (or clicking) a
  // heading opens its submenu, Electron-style.
  const appMenuItems = (rec) => {
    const file = [
      { label: 'New', action: () => newPatch() },
      { label: 'Open…', action: () => openPatch() },
      { label: 'Save', action: () => savePatch() },
      { label: 'Save As…', action: () => saveAsPatch() },
    ];
    if (examples.length) file.push({ label: 'Examples', submenu: examples.map((e) => ({ label: e.name, action: () => openExample(e.file, e.name) })) });
    if (storage.hasLast && storage.hasLast()) file.push({ label: `Reopen ${storage.lastName()}`, action: () => reopenPatch() });
    // Newest first, in a submenu of its own — a header over a flat run of filenames just reads as
    // more File commands. The file you already have open is listed like any other: clicking it
    // re-reads it from disk, which is how you revert to the last save.
    if (recentFiles.length) {
      file.push({ label: 'Recent', submenu: recentFiles.map((f) => ({ label: f.name, action: () => openRecent(f.id) })) });
    }
    file.push({ label: 'Share this patch…', disabled: true });   // greyed until there's a person-to-person channel
    const edit = [
      { label: 'Undo', disabled: !rack.canUndo(), action: () => rack.undo() },
      { label: 'Redo', disabled: !rack.canRedo(), action: () => rack.redo() },
      { label: 'Create patch from clipboard', action: () => createFromClipboard() },
      { separator: true },
      // Emptying the patch is an edit of the whole patch. It sat under Module because it is about
      // modules, which is true of nearly everything in the app and is not what that menu is for:
      // Module is where you reach for ONE of them.
      { label: 'Clear connections & controls…', action: () => rack.confirmDeleteAllCables() },
    ];
    // View (Dark/Light mode is self-describing: the label names the mode it switches to).
    const view = [
      { label: rack.isDark() ? 'Light mode' : 'Dark mode', action: () => toggleDark() },
      { label: 'Fit to window', action: () => rack.resetZoom() },
      { label: 'Patch notes', action: () => notes.toggle() },   // info about this patch
      // A conventional menu bar across the top, for anyone who looks for one there. ON by
      // default: the title-bar hamburgers are quicker once you know about them, but a menu you
      // have to be told about is a menu most people never find.
      { label: 'Menu bar', checkFn: () => rack.menuBarDocked(), action: () => setMenuBar(!rack.menuBarDocked()) },
      { label: 'Video follows pointer', checkFn: () => rack.videoFollowsPointer(),
        action: () => setVideoFollow(!rack.videoFollowsPointer()) },
      // How many rows the rack stands: the shape of what you are looking at, beside Fit to window
      // and the rest. It lived under Rack, which no longer exists.
      { label: 'Rows', submenu: [1, 2, 3, 4, 5].map((n) => ({
        label: String(n), checkFn: () => rack.rowCount === n, action: () => setRows(n),
      })) },
    ];
    // Capturing what you can SEE belongs under View, beside the other things that change what is
    // on screen — not under File, which is about the patch. Both are desktop only: they need the
    // main process to reach the window's pixels and to write to disk.
    if ((recorder && recorder.available()) || snapshotAvailable()) {
      view.push({ separator: true });
      // "Snapshot VIEW", not just "snapshot": on an instrument, an unqualified snapshot sounds
      // like it might capture the sound or the patch state. This one captures what you can see.
      if (snapshotAvailable()) view.push({ label: 'Snapshot view', action: () => takeSnapshot() });
      if (recorder && recorder.available()) {
        view.push({ label: `${recorder.recording ? 'Stop recording' : 'Record video…'}   R`, action: () => toggleRecording() });
      }
    }
    // MODULE — what the rack is made of, and the two commands that act on the whole set of them.
    // It replaces the old Rack menu: the engine went (the space bar toggles it, and the mixer has the
    // control), Rows went to View, and deleting a page is now the × on the tab itself.
    //
    // NOTHING HERE ACTS ON A PARTICULAR MODULE. Duplicating one, or deleting one, is about a module
    // you have to name — and this menu cannot name it, so it used to arm the pointer and wait for a
    // click to say which. That is a whole extra gesture, and an armed mode you can forget you are in.
    // Right-clicking a module's title bar names it by definition, so those commands live there.
    //
    // What is left is the library, which is about no module in particular. Clearing the patch went to
    // Edit, where the other whole-patch commands are.
    const modulesMenu = [
      { label: 'Module library…', action: () => library.show() },
    ];
    // DR is the application menu, in the position and role the app menu holds on a Mac. DEV is
    // last and abbreviated: it earns a place for the people who need it without taking the width
    // of "Developer" from the menus everyone uses.
    return [
      { label: 'DreamRack', submenu: rack.helpMenuItems().filter((i) => /about/i.test(i.label || '')).concat([
        { separator: true },
        { label: 'Interactive tutorial', action: () => rack.onTutorial && rack.onTutorial() },
      ]) },
      { label: 'File', submenu: file },
      { label: 'Edit', submenu: edit },
      { label: 'View', submenu: view },
      { label: 'Module', submenu: modulesMenu },
      { label: 'Help', submenu: rack.helpMenuItems() },
      { label: 'DEV', submenu: rack.developerMenuItems(rec) },
    ];
  };
  // Read the folder, THEN open. It's a local readdir of a handful of files, so the wait is
  // imperceptible — and opening first and re-opening once it lands makes the menu flicker.
  // A RIGHT-CLICK ON A FACEPLATE opens this — the same items as the bar at the top of the window,
  // summoned where the pointer already is. That is the whole point: the faceplate is the largest
  // target on screen, so the main menu costs no aim at all.
  rack.onAppMenuBar = (x, y, rec) => {
    refreshRecent().then(() => rack.openMenuBar(x, y, appMenuItems(rec)));
  };

  // The MODULE LIBRARY, on right-click over empty rack background and from Modules ▸ Module library.
  // Choosing a card hands the module to the pointer to be carried and placed; the callback is how the
  // library knows to come back once it has been put down.
  const library = createLibrary({
    types: MODULE_TYPES,
    isTaken: (id) => rack.hasModule(id),
    isDark: () => rack.isDark(),
    onChoose: (id, at, done) => rack.startCarryModule(id, done, at),
  });
  rack.onLibrary = () => library.show();
  libraryTheme = library.refreshTheme;

  // The docked bar. It hands the rack a PROVIDER rather than a fixed set of items, so each menu
  // is rebuilt as it opens — a bar that lives all session would otherwise keep the Undo state,
  // the Recent list and the light/dark label it happened to be born with.
  // The pointer-following video picture, remembered like the menu bar: an app preference rather
  // than anything a patch carries. It exists for magnified working — see video-engine.
  const FOLLOW_KEY = 'wcoast.videoFollow';
  function setVideoFollow(on) {
    try { localStorage.setItem(FOLLOW_KEY, on ? '1' : '0'); } catch (_e) { /* no storage */ }
    rack.videoFollowPointer(!!on);
    pushMenuState();
  }

  // Clicking the Video Output module's picture toggles the same thing the menu item does, so the
  // menu's tick has to follow it — otherwise the two disagree about a state they share.
  rack.onVideoFollowChange = (on) => {
    try { localStorage.setItem(FOLLOW_KEY, on ? '1' : '0'); } catch (_e) { /* no storage */ }
    pushMenuState();
  };

  const MENUBAR_KEY = 'wcoast.menuBar';
  function setMenuBar(on) {
    try { localStorage.setItem(MENUBAR_KEY, on ? '1' : '0'); } catch (_e) { /* no storage */ }
    if (!on) { rack.undockMenuBar(); return; }
    rack.dockMenuBar(appMenuItems(null, null), () => appMenuItems(null, null));
    refreshRecent();   // warm the Recent list for the first drop, without blocking the bar
  }
  // Default ON, so a first-time user meets a menu where they expect one.
  let menuBarPref = '1';
  try { const v = localStorage.getItem(MENUBAR_KEY); if (v === '0' || v === '1') menuBarPref = v; } catch (_e) { /* no storage */ }
  setMenuBar(menuBarPref === '1');
  // The pointer follower is remembered but defaults OFF: it is an aid for magnified working, not
  // something to spring on someone who never asked for it. It also does nothing until a video
  // module exists, so switching it on early costs only the engine coming up.
  try { if (localStorage.getItem(FOLLOW_KEY) === '1') setVideoFollow(true); } catch (_e) { /* no storage */ }

  // The interactive tutorial: modeless cards the reader drives with Next/Back. Opens on a first
  // run (unless "Don't show on startup" is set), and always available from Help ▸ Interactive tutorial.
  // The copy lives in host/tutorial.md — one file that is both the tutorial and a readable document.
  // A failure here must not take the app down with it: no tutorial is survivable, a dead boot isn't.
  notes = createPatchNotes({
    getNotes: () => rack.patchNotes,
    setNotes: (v) => { rack.patchNotes = v; },
    getOpen: () => rack.patchNotesOpen,
    setOpen: (v) => { rack.patchNotesOpen = v; },
    isDark: () => rack.isDark(),
    onChange: () => onEdit(),
  });
  rack.onPatchNotes = () => notes.toggle();
  const composer = createComposer({
    repo: 'chrisgr99/DreamRack',
    isDark: () => rack.isDark(),
    getPatchJSON: () => trimmedPatchText(),
    openExternal: (url) => rack._openExternal(url),
    appName: APP_NAME,
    appVersion: APP_VERSION,
    getBuild: () => rack.buildInfo,
  });
  rack.onFeedback = () => composer.feedback();
  rack.onReportBug = () => composer.reportBug();
  rack.onSharePatch = () => composer.sharePatch();
  const about = createAbout({
    appName: APP_NAME,
    appVersion: APP_VERSION,
    author: 'Chris Graham',
    getBuild: () => rack.buildInfo,
    isDark: () => rack.isDark(),
    openExternal: (url) => rack._openExternal(url),
    repoUrl: 'https://github.com/chrisgr99/DreamRack',
    contactUrl: 'https://github.com/chrisgr99',
    onTutorial: () => { if (rack.onTutorial) rack.onTutorial(); },
  });
  rack.onAbout = () => about.toggle();
  loadExamples();   // populate the Examples menu (async; refreshes the native menu when ready)

  let tour = null;
  try {
    const steps = await loadTutorial();
    tour = createTour({ steps, onExternal: (url) => rack._openExternal(url), isDark: () => rack.isDark(),
      onSee: (t, el) => (t ? rack.showCallout(t, el) : rack.clearCallout()),
      canSee: (t) => rack.calloutAvailable(t),
      homePos: (w, h) => rack.tutorialHomePos(w, h),
      // Reading a block aloud: the same pre-rendered narration the demos use, with no animation.
      onSpeak: (text, done) => rack.demo && rack.demo.speakText(text, done),
      onStopSpeak: () => rack.demo && rack.demo.stopSpeech(),
      // DEMONSTRATE hands over: the tutorial closes and the transport takes its place. They never
      // share the screen — the demo needs the rack, and the tutorial window sits over it.
      onDemonstrate: (id, sectionId) => demonstrate(id, sectionId) });
    rack.onTutorial = () => tour.open(0);
    if (!tourSeen()) tour.open(0);
  } catch (e) {
    log('tutorial unavailable: ' + e.message);
  }

  // F1 — the conventional Help key. Opens the Help menu centred in the window, so it's reachable
  // without knowing about right-click or finding the hamburger.
  // NOTE on macOS: F1 is a system brightness key unless "Use F1, F2, etc. as standard function keys"
  // is on in System Settings ▸ Keyboard — otherwise the app never sees it and you need Fn-F1.
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'F1') return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    e.preventDefault();
    rack.openMenu(window.innerWidth / 2, window.innerHeight / 2, rack.helpMenuItems(), { centred: true });
  });

  // Spacebar toggles the ENGINE — a hands-on-keyboard alternative to the Rack menu and the
  // mixer's engine lamp. It follows the engine rather than the master bus because a transport
  // key should be the thing that starts and stops sound outright, and because pressing it to
  // start must never leave you with silence (the engine brings the master bus with it).
  // Ignored while typing in a field, and when a button has focus (Space
  // would "click" it and double-toggle). No modifier, so Cmd/Ctrl-Space and friends pass straight through.
  window.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.code !== 'Space') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.isContentEditable)) return;
    e.preventDefault();
    rack.toggleEngine();
  });

  // R toggles recording. A bare letter is safe here for the same reason Space can toggle
  // the master bus: patching is a pointer activity, so the keyboard is free. Modified R is
  // explicitly excluded so Cmd-R (reload) and friends pass straight through, and e.code
  // keeps it on the physical key rather than the character a layout produces.
  //
  // There is no native menu item for recording, so unlike the standard shortcuts below
  // this one runs in Electron too — it is the only handler for it, so nothing double-fires.
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyR' || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    if (!recorder || !recorder.available()) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.isContentEditable)) return;
    e.preventDefault();
    toggleRecording();
  });

  // Standard shortcuts, for the BROWSER only: in Electron the native menu carries the same
  // accelerators and would fire alongside these.
  window.addEventListener('keydown', (e) => {
    if (window.wcoast && window.wcoast.isElectron) return;
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 's') { e.preventDefault(); if (e.shiftKey) saveAsPatch(); else savePatch(); }
    else if (k === 'o' && !e.shiftKey) { e.preventDefault(); openPatch(); }
    else if (k === 'n' && !e.shiftKey) { e.preventDefault(); newPatch(); }
    else if (k === 'z' && !e.shiftKey) { e.preventDefault(); rack.undo(); }   // undo cable/module topology changes
    else if (k === 'z' && e.shiftKey) { e.preventDefault(); rack.redo(); }    // redo (Cmd/Ctrl-Shift-Z)
  });

  // Warn before a browser tab/window discards unsaved work. In Electron the
  // window close is guarded in the main process (via the mirrored dirty state),
  // so beforeunload here is browser-only to avoid a double prompt.
  if (!(window.wcoast && window.wcoast.isElectron)) {
    window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  }
  // Persist the session on unload (both environments) so a relaunch resumes it.
  window.addEventListener('pagehide', flushSession);

  // Resume the last session if one was saved; otherwise start with one of each so
  // there's something to patch.
  let resumed = false;
  // `started` records that restore got far enough to put modules on the rack, whether or not it
  // finished. It is the difference between "there is nothing here" and "there is a half-built rack
  // here", and only the first of those wants the default modules placed on top of it.
  let started = false;
  try {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      const obj = JSON.parse(saved);
      started = true;   // from here a throw can leave modules behind
      const v = validate(obj, registry);
      // Require at least one module — a module-less session is boot-transient junk,
      // not a patch worth resuming; fall through to the default instead.
      if (v.ok && obj.modules && obj.modules.length) {
        // Settings that no longer fit the descriptors are dropped rather than fatal, so
        // say what was dropped — silently different knob positions are worse than noisy ones.
        for (const w of v.warnings || []) log(`session: ${w}`);
        await restore(obj, rack, mixerIO); syncMaster(); afterLoad(); resumed = true;
        started = true;
        // Re-adopt the file this session was editing, so File > Save writes back to it (not a fresh prompt).
        try { const n = await storage.adoptLast(); if (n) patchName = n; } catch (_e) { /* fileless resume */ }
      }
      else if (!v.ok) log(`session ignored: ${v.error}`);
    }
  } catch (e) {
    // WITH A STACK. This used to log the message alone, and the message alone cannot tell you which
    // of thirty lines in restore() gave up.
    log(`session restore failed: ${e.message}`);
    console.error('[wcoast] session restore failed: ' + ((e && e.stack) || e));
  }
  if (!resumed) {
    // A HALF-RESTORED RACK IS CLEARED FIRST. If restore() threw after adding modules — a module that
    // would not instantiate, a cable that would not reconnect — the rack was left holding them AND
    // then had a full set of defaults placed on top, so every module appeared twice and none of the
    // cables were there. Two symptoms, one cause, and the duplicate pass then autosaved itself over
    // the only good copy of the patch.
    if (started) { try { rack.clear(); } catch (_e) { /* nothing to clear */ } }
    await placeDefaultModules();
  }
  // Roll the backup now: whatever we just read is the last known-good state, and from here the
  // autosave is free to overwrite the live key.
  try {
    const prior = localStorage.getItem(SESSION_KEY);
    if (prior) localStorage.setItem(SESSION_PREV_KEY, prior);
  } catch (_e) { /* no storage */ }
  // Put the view back where it was left. AFTER the modules exist, since relayout resets the transform
  // as it fits the rows — restoring earlier would simply be overwritten.
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v) rack.setViewState(JSON.parse(v));
  } catch (_e) { /* no storage, or nonsense in it — the default view is fine */ }
  // Startup silence: the engine and both buses OFF on every launch, regardless of the last-exited
  // state or any monitors that a restored patch would otherwise re-enable — the app never comes up
  // making sound. The engine is cleared LAST, because turning it off is what actually guarantees
  // the silence and nothing below it can undo that.
  rack.applyParam(mixRec, 'masterEnable', 'off');
  rack.applyParam(mixRec, 'monitorEnable', 'off');
  rack.applyParam(mixRec, 'engine', 'off');
  booted = true;   // from here on, real edits autosave the session
  markClean();     // the resumed/starting patch is the clean baseline, not unsaved work
  await mirror.init();   // read enabled state + push the first mirror snapshot
  // The AI mirror is Electron-only and always on: no toggle UI, no folder-reveal — just
  // ensure it's enabled so the running patch is always mirrored.
  if (mirror.available() && !mirror.isEnabled()) { try { await mirror.setEnabled(true); } catch (_e) { /* ignore */ } updateTrace(); }

  // --- Scripted demos (design/scripted-demo.md): library, floating transport, triggers ---
  // Reels are a named manifest; the floating "Demo" window (DEV ▸ Demos…) chooses one from its
  // drop-down and Runs / Stops / Restarts it, showing the running reel's name. Ctrl-Shift-D starts
  // the selected reel, Escape stops. A demo rebuilds the rack, so the user's whole working state —
  // patch, probes, page and view — is snapshotted and put back around every run.
  let demoList = [];
  try { const res = await fetch('demos/scripts/index.json'); if (res.ok) demoList = (await res.json()).demos || []; }
  catch (_e) { /* no demo library */ }
  // MOST RECENTLY EDITED FIRST. index.json is in the order the reels were written, which is the least
  // useful order for the person writing them: the one you are working on is whichever you last saved,
  // and it was at the bottom. Anything we cannot date keeps the file's own order behind the rest.
  try {
    if (window.wcoast && window.wcoast.demoMtimes) {
      const when = await window.wcoast.demoMtimes();
      demoList = demoList
        .map((d, i) => ({ d, i, t: when[d.file] || 0 }))
        .sort((a, b) => (b.t - a.t) || (a.i - b.i))
        .map((x) => x.d);
    }
  } catch (_e) { /* keep the file's own order */ }

  const loadDemo = async (entry) => {
    // Cache-busted: the whole point of Reload is to pick up an edit made a moment ago, and a cached
    // script would quietly serve the words you just changed.
    const res = await fetch(`demos/scripts/${entry.file}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`demo ${entry.file}: ${res.status}`);
    const obj = await res.json();
    obj.__file = 'demos/scripts/' + entry.file;
    return obj;
  };

  // Project where the demo has got to, so an editing conversation needs no preamble: which script,
  // which step, its exact note and pacing, and the steps either side of it. Written on every step,
  // so "make that shorter" always refers to something readable from outside the app.
  const pushDemoState = () => {
    if (!mirror || !rack.demo) return;
    mirror.pushFiles({ 'demo.json': demoStepping || rack.demo.running ? rack.demo.state() : null });
  };

  // The runner takes the whole app state as one opaque snapshot, captured before every step. That
  // is what makes stepping BACKWARDS as cheap as stepping forwards — for the author checking a
  // script, and for the reader who wants to see a step again.
  rack.demo = createDemoRunner(rack, {
    registerAudio: (node) => rack.addAudioTap(node),   // narration goes into a recording, not just the speakers
    // Load a shipped example, the same route File ▸ Examples takes, so a demo can start from a patch
    // that already works rather than building one first.
    loadExample: async (name) => {
      const entry = (examples || []).find((e) => e.name === name || e.file === name);
      if (!entry) { log(`no example named "${name}"`); return; }
      try {
        const res = await fetch('examples/' + entry.file);
        if (!res.ok) throw new Error(String(res.status));
        await restore(await res.json(), rack, mixerIO, { keepKeys: true });
        syncMaster();
        silenceAfterLoad();   // an example arrives silent, like every other patch
      } catch (e) { log(`example load failed: ${e.message}`); }
    },
    onAvoid: (region) => { if (demoPanel) demoPanel.avoid(region); },   // the transport window steps out of the work
    panelRect: () => (demoPanel ? demoPanel.rect() : null),             // ...and the card then keeps off the window
    snapshot: () => ({ patch: patchText(), page: rack.page, view: rack.viewState() }),
    restoreSnapshot: async (s) => {
      if (!s) return;
      await restore(JSON.parse(s.patch), rack, mixerIO, { keepKeys: true });
      syncMaster();
      if (rack._hasPage(s.page)) rack.selectPage(s.page);
      rack.setViewState(s.view);
    },
  });

  // The transport switches are NOT part of a saved patch (see TRANSPORT above), so they're caught
  // and put back by hand — a demo turns the engine on, and leaving it on afterwards would break the
  // rule that sound only ever starts because you asked for it.
  const grabTransport = () => ({ engine: mixRec.values.get('engine'), masterEnable: mixRec.values.get('masterEnable'), monitorEnable: mixRec.values.get('monitorEnable') });
  const putTransport = (t) => { rack.applyParam(mixRec, 'masterEnable', t.masterEnable); rack.applyParam(mixRec, 'monitorEnable', t.monitorEnable); rack.applyParam(mixRec, 'engine', t.engine); };

  // The user's own state, held for the length of a demo however it was started — a plain Run or a
  // step-through — so whichever one ends can put it back. Held in one place because Stop hands a
  // running demo OVER to stepping rather than tearing it down.
  let demoHeld = null;
  const holdUserState = () => { demoHeld = { snap: patchText(), view: rack.viewState(), page: rack.page, transport: grabTransport() }; };
  async function releaseUserState() {
    const h = demoHeld; demoHeld = null;
    if (!h) return;
    try {
      await restore(JSON.parse(h.snap), rack, mixerIO);
      syncMaster();
      if (rack._hasPage(h.page)) rack.selectPage(h.page);
      rack.setViewState(h.view);
    } catch (e) { log(`demo restore failed: ${e.message}`); }
    putTransport(h.transport);
    markClean();
  }

  async function runDemo(obj, name, { restoreAfter = true, loop = false } = {}) {
    if (!obj || rack.demo.running) return;
    if (restoreAfter && !demoHeld) holdUserState();
    if (tour && tour.isOpen()) tour.close();   // the first-run tutorial card sits over the rack
    demoActive = true; demoStop = false;
    if (demoPanel) demoPanel.setRunning(name || obj.id || 'demo');
    try { do { await rack.demo.run(obj); } while (loop && !demoStop); }
    finally {
      if (demoPanel) demoPanel.setRunning(null);
      // A demo STOPPED mid-way leaves you standing on the step it reached — that is what stopping is
      // for while authoring. Only a demo that ran to its end puts your patch back on its own.
      if (demoStop) { demoStepping = demoStepping || true; showPos(); }
      else {
        demoActive = false;
        await releaseUserState();
        // A finished demo STAYS. The rack is left as the demo built it and the transport is still
        // there, so the obvious next thing — watch that again — is one press away. Going back is the
        // reader's decision, not the clock's: the button says so.
        if (demoPanel) demoPanel.setExitLabel(cameFromTutorial ? 'Return to tutorial' : 'Close');
      }
    }
  }

  let overrideRate = 1, loopWanted = false;   // window controls: pace vs legibility, attract loop

  // A LATCH TAKEN SYNCHRONOUSLY, before the first await. Every other guard here — `rack.demo.running`,
  // `demoActive` — is only set once the script has been fetched and the run has actually begun, so two
  // presses a moment apart both sailed past them and started two demos over the top of each other. A
  // reader who presses again because nothing has visibly happened yet is doing the obvious thing.
  let demoStarting = false;

  async function runSelected() {
    if (!selectedEntry || demoStarting || rack.demo.running || demoActive) return;
    demoStarting = true;
    try {
      let obj; try { obj = await loadDemo(selectedEntry); } catch (e) { log(`demo load failed: ${e.message}`); return; }
      const base = Number(obj.rate) > 0 ? Number(obj.rate) : 1;
      const eff = { ...obj, rate: base * overrideRate };   // global rate override on top of the reel's own
      demoPromise = runDemo(eff, selectedEntry.title || selectedEntry.id, { loop: loopWanted });
      return demoPromise;
    } finally { demoStarting = false; }
  }
  async function stopDemo(why) { if (rack.demo.running) { demoStop = true; rack.demo.stop(why || 'stopDemo'); } if (demoPromise) { try { await demoPromise; } catch (_e) { /* ignore */ } } }
  async function restartDemo() { await stopDemo('Restart button'); runSelected(); }

  // Step-through. The first press stands the demo up the way Run does — the user's work put aside,
  // the rack cleared, sound on — and then performs one step. Leaving step-through is what puts the
  // patch back, so `demoStepping` holds the snapshot until then.
  let demoStepping = null;
  async function enterStepping() {
    if (demoStepping || !selectedEntry) return false;
    let obj; try { obj = await loadDemo(selectedEntry); } catch (e) { log(`demo load failed: ${e.message}`); return false; }
    if (!demoHeld) holdUserState();
    demoStepping = true;
    if (tour && tour.isOpen()) tour.close();
    demoActive = true;
    rack.demo.load(obj);
    await rack.demo.reset();
    return true;
  }
  async function exitStepping() {
    if (!demoStepping) return;
    demoStepping = null;
    rack.demo.stop('leaving step-through');
    await releaseUserState();
    demoActive = false;
    demoPanel.setPosition(0, 0);
    pushDemoState();
  }
  const showPos = () => { demoPanel.setPosition(rack.demo.index, rack.demo.count, (rack.demo.stepAt(rack.demo.index) || {}).do); pushDemoState(); };
  async function stepDemo() { if (!demoStepping && !(await enterStepping())) return; await rack.demo.step(); showPos(); }
  async function backDemo() { if (!demoStepping) return; await rack.demo.back(); showPos(); }
  // Perform the current step properly — full pacing and narration — then stop on the next one.
  async function playStepDemo() { if (!demoStepping && !(await enterStepping())) return; await rack.demo.playStep(); showPos(); }
  // Re-read the script from disk and return to the step we were standing on, so an edit can be heard
  // without losing your place. Steps are replayed with their waits collapsed to get back there.
  async function reloadDemo() {
    if (!selectedEntry) return;
    const at = demoStepping ? rack.demo.index : 0;
    let obj; try { obj = await loadDemo(selectedEntry); } catch (e) { log(`demo reload failed: ${e.message}`); return; }
    if (!demoStepping && !(await enterStepping())) return;
    rack.demo.load(obj);
    await rack.demo.reset();
    await rack.demo.seek(Math.min(at, rack.demo.count));
    showPos();
    log(`demo reloaded at step ${rack.demo.index + 1}`);
  }

  // ---- the tutorial's hand-off ---------------------------------------------
  // Pressing Demonstrate in a section closes the tutorial and opens the transport on that demo, in its
  // reader face. Exiting the transport reopens the tutorial where it was left. One or the other is on
  // screen, never both: the demo needs the rack, and the tutorial window sits over it.
  let cameFromTutorial = null;   // the section id to return to, or null when opened from the DEV menu

  async function demonstrate(id, sectionId) {
    if (demoStarting || rack.demo.running || demoActive) return;   // a second press while one is starting
    const entry = demoList.find((d) => d.id === id);
    if (!entry) { log(`no demo named "${id}"`); return; }
    cameFromTutorial = sectionId || true;
    if (tour) tour.close();
    selectedEntry = entry;
    demoPanel.setMode('reader');
    demoPanel.setTitle(entry.title || entry.id);
    demoPanel.setExitLabel('Return to tutorial');
    demoPanel.open();
    await exitStepping();
    runSelected();
  }

  // Put the transport away and open the tutorial at the section that launched the demo. Shared by the
  // Exit button and by a demo reaching its own end, so both leave you in the same place.
  function returnToTutorial() {
    demoPanel.close();
    const back = cameFromTutorial; cameFromTutorial = null;
    if (back && tour) tour.open(typeof back === 'string' ? back.replace(/^sec-/, '') : 0);
  }

  // Leaving the transport by hand. From the tutorial it goes back there, at the section you pressed
  // the play button in; opened from the DEV menu it simply closes.
  async function leaveDemo() {
    await stopDemo('Close button');
    await exitStepping();
    returnToTutorial();
  }

  selectedEntry = demoList[0] || null;
  // Started from the command line (WCOAST_DEMO=<id>): open the transport on that demo and run it.
  const autoId = new URLSearchParams(location.search).get('demo');
  if (autoId) {
    const entry = demoList.find((d) => d.id === autoId);
    if (!entry) console.warn(`[demo] no demo named "${autoId}"`);
    else { window.__demoTrace = true; setTimeout(() => demonstrate(entry.id), 1200); }
  }
  demoPanel = createDemoPanel({
    demos: demoList,
    onSelect: (e) => { selectedEntry = e; if (demoStepping) exitStepping(); },
    onRun: async () => { await exitStepping(); runSelected(); },
    // TWO-STAGE STOP. Stopping a playback leaves you STANDING ON the step it reached, with the rack as
    // the demo built it — which is the whole point of stopping while authoring: you stop because you
    // want to look at that step, go back a step, or change its words. Pressing Stop again (when
    // nothing is playing) is what puts your own patch back.
    onStop: async () => {
      if (rack.demo.running) { await stopDemo('Stop button'); showPos(); return; }
      await stopDemo('Stop button'); await exitStepping();
    },
    onRestart: restartDemo,
    onRate: (v) => { if (v > 0) overrideRate = v; },
    onCaptions: (v) => rack.demo.setCaptions(!!v),
    onStep: stepDemo, onBack: backDemo, onPlay: playStepDemo, onReload: reloadDemo,
    onClose: leaveDemo,
  });
  // The DEV menu opens it as an AUTHOR tool — picker, Play and Reload — and closing it just closes it.
  // The same two commands the native menu bar carries — see developerMenuItems.
  // THE PANEL EDITOR SAVED A FACEPLATE. Find the module type whose panel file lives in that
  // directory and re-skin its instances — the drawing changes, the patch does not.
  if (window.wcoast && window.wcoast.onPanelSaved) {
    window.wcoast.onPanelSaved(async (dir) => {
      if (!dir) return;
      const type = MODULE_TYPES.find((t) => t.panelUrl === `modules/${dir}/panel.svg`);
      if (!type) { log(`panel saved for "${dir}", which no module on the rack uses`); return; }
      const done = await rack.reskinType(type.descriptorId);
      log(done ? `${type.name} re-skinned from the editor's save` : `${type.name} saved; none placed on the rack`);
    });
  }

  rack.onCaptureWork = () => captureWork();
  rack.onRestoreWork = () => restoreWork();
  rack.onResetDefault = () => resetToDefault();
  rack.openDemoPanel = () => { cameFromTutorial = null; demoPanel.setMode('author'); demoPanel.setExitLabel('Close'); demoPanel.open(); };

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && rack.demo.running) { stopDemo('Escape key'); return; }
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') { e.preventDefault(); runSelected(); }
  }, true);

  // Re-fit once the layout has settled. In Electron the ready-to-show gate means this is
  // already correct; a bare browser settles its flex layout a beat later, so the boot-time
  // fit can be measured too tall.
  requestAnimationFrame(() => rack.relayout());
  pushMenuState();   // seed the native menu now the rack, storage and tutorial all exist

}


// First run only: a small card pointing newcomers at the panel menu's Help, the jack
// menu, and cabling. "Dismiss" closes for now (it returns next launch); "Don't show
// this again" remembers the choice in local storage. The README link opens the browser.
window.addEventListener('DOMContentLoaded', () => {
  if (window.wcoast && window.wcoast.isElectron) {
    log(`Electron — Chromium ${window.wcoast.versions.chrome}, Node ${window.wcoast.versions.node}.`);
  }
  boot().catch((e) => { console.error(`[wcoast] BOOT ERROR`, (e && e.stack) || e); log(`BOOT ERROR: ${e.message}`); });
});
