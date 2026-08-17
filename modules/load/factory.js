// factory.js — Load. No audio, no worklet: it asks the context how the audio thread is doing.
//
// AudioContext.renderCapacity is the browser's own measurement, taken on the render thread as part of
// rendering, so reading it costs nothing — averageLoad and peakLoad as fractions of one render
// quantum's budget, and underrunRatio for the blocks that did not finish in time. Where it is missing
// the module says so with dashes rather than inventing a number.

'use strict';

const WINDOW_S = 0.5;          // often enough to watch while playing, slow enough to read
const UNDER_HOLD_MS = 1200;    // an underrun is one block; the lamp has to outlast it to be seen

export function create(ctx, _services) {
  let report = null;
  let underTimer = null;
  let cap = null;

  const say = (id, v) => { if (report) report(id, v); };

  const onUpdate = (e) => {
    // Fractions of one core; the panel reads percent, which is what everyone thinks in.
    say('load', Math.round((e.averageLoad || 0) * 100));
    say('peak', Math.round((e.peakLoad || 0) * 100));
    if ((e.underrunRatio || 0) > 0) {
      say('under', 'on');
      clearTimeout(underTimer);
      underTimer = setTimeout(() => say('under', 'off'), UNDER_HOLD_MS);
    }
  };

  // THE FRAME RATE, counted rather than asked for. A frame that took longer than the display's period
  // is a frame the rack did not draw in time, and counting arrivals over a window is the whole
  // measurement — no GPU figure exists to read, from here or anywhere else in a page.
  let frames = 0, since = 0, raf = 0, stopped = false;
  const tick = (t) => {
    if (stopped) return;
    if (!since) since = t;
    frames++;
    const elapsed = t - since;
    if (elapsed >= WINDOW_S * 1000) {
      say('fps', Math.round(frames * 1000 / elapsed));
      frames = 0; since = t;
    }
    raf = requestAnimationFrame(tick);
  };
  try { raf = requestAnimationFrame(tick); } catch (_e) { /* no document: nothing to draw */ }

  try {
    cap = ctx.renderCapacity || null;
    if (cap) { cap.addEventListener('update', onUpdate); cap.start({ updateInterval: WINDOW_S }); }
    else console.info('[wcoast] Load: this browser has no renderCapacity; the meter will read zero.');
  } catch (_e) { cap = null; }

  return {
    getOutput: () => null,
    getInput: () => null,
    getParam: () => null,
    setParam: () => {},
    supports: (id) => ['load', 'peak', 'fps', 'under'].includes(id),
    onValueChange: (fn) => { report = fn; },
    dispose: () => {
      clearTimeout(underTimer);
      stopped = true;
      try { cancelAnimationFrame(raf); } catch (_e) { /* never started */ }
      try { if (cap) { cap.stop(); cap.removeEventListener('update', onUpdate); } } catch (_e) { /* gone */ }
    },
  };
}
