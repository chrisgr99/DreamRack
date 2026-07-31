// descriptor.js — Video Output. The terminal of the video graph, as the Mixer is the
// terminal of the audio graph: no output jacks, because it IS the output.
//
// It owns the output window and the final treatment of the image. It deliberately does NOT
// own the WebGL context or the engine — those belong to the rack (see host/video-engine.js),
// so that a monitor probe can look at a video chain before anything has been committed to a
// screen, and a patch with no video pays nothing.
//
// Only one makes sense in a rack. Unlike the Mixer it is not pinned, because video is
// optional and should not occupy rack space for someone who never uses it — it is an ordinary
// addable, deletable module that simply leaves the Add menu while one exists.

'use strict';

const params = [];
const ports = [];

// The image in. rgb, so a monochrome chain still drops straight in: the connection rules let
// luma broadcast to all three channels, which is why an oscillator can reach this with no
// encoder and no colorizer in between.
ports.push({ id: 'imageIn', name: 'Image', section: 'out', domain: 'rgb', dir: 'in' });

// WINDOW — open or close the floating output window. The module's most-used control, so it
// is a lamp you can see the state of rather than a menu item you have to remember.
// TRANSIENT: never saved with a patch. Opening the output window needs a user gesture, which a
// patch load does not have — a saved "on" would be refused and quietly fall back to the in-app
// pane, giving a different window from the one the patch asked for. So it always comes up closed
// and is opened by a click, the same reasoning as the engine coming up off.
params.push({ id: 'window', name: 'Window', section: 'out', curve: 'stepped',
  steps: [{ value: 'off' }, { value: 'on' }], default: 'off', transient: true });

// BRIGHT — master brightness, and the one video parameter that most wants CV: fading the
// whole image from an envelope is the video equivalent of a master fader. A knАck, so the
// cable and the knob share one control.
params.push({ id: 'bright', name: 'Brightness', section: 'out', curve: 'linear', min: 0, max: 1, default: 1, glideMs: 0 });
params.push({ id: 'brightDepth', name: 'Brightness depth', section: 'out', curve: 'linear', min: -1, max: 1, default: 1, glideMs: 0, subControl: true });
ports.push({ id: 'brightCv', name: 'Brightness', section: 'out', domain: 'control', dir: 'in', target: 'bright', via: 'brightDepth' });

// LIMIT — a ceiling on output brightness. A plain knob, set and forget. It is here BEFORE
// feedback arrives rather than after: feedback runs away to white, and a full-screen white
// flash is genuinely unpleasant — worse under magnification. Same argument as the brick-wall
// limiter on the audio master.
params.push({ id: 'limit', name: 'Limit', section: 'out', curve: 'linear', min: 0.2, max: 1, default: 1, glideMs: 0 });

// RES — internal render resolution, as a fraction of 1080p. The dial that buys headroom on
// weaker hardware, and the honest way to degrade under load rather than stuttering. A switch,
// not a knob: changing it reallocates framebuffers, so it must not be sweepable.
params.push({ id: 'res', name: 'Resolution', section: 'out', curve: 'stepped',
  steps: [{ value: 'qtr' }, { value: 'half' }, { value: 'threeQ' }, { value: 'full' }], default: 'half' });

// FRAME — the framing. Square and vertical are here because that is what the places these
// clips get posted want, and deciding it at render time costs nothing.
params.push({ id: 'frame', name: 'Framing', section: 'out', curve: 'stepped',
  steps: [{ value: '16:9' }, { value: '1:1' }, { value: '9:16' }], default: '16:9' });

// TEST — the built-in pattern instead of the input, so the module shows something the moment
// it is placed, and stays useful for checking the window, the framing and the resolution.
params.push({ id: 'test', name: 'Test pattern', section: 'out', curve: 'stepped',
  steps: [{ value: 'off' }, { value: 'on' }], default: 'on' });

export default {
  id: 'video-out',
  apiVersion: 1,
  name: 'Video Output',
  abbreviation: 'VidOut',
  worklets: [],
  // No output jacks — it is the terminal, so there is nothing to derive an identity from.
  // Declared: this module's business is the image.
  signalIdentity: ['rgb'],
  // A live thumbnail of what is being output, in panel mm. The rack places a canvas here and
  // the video engine blits into it, so the module is visibly alive without opening the window.
  // Declared as data rather than drawn, because it is a canvas over the SVG, not SVG.
  preview: { x: 5, y: 12, w: 42, h: 23.63 },
  singleton: true,      // one per rack; leaves the Add menu while one exists
  ports,
  params,
};
