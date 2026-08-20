// descriptor.js — Chroma. Colour in, the same picture in different colour out.
//
// The third colour module, and the one that multiplies what the other two can do without adding a
// cable. A Colorizer gives an image ONE palette; put this after it and a slow CV on HUE walks that
// palette through every other colour it could have been, which is a thing no list of palettes can
// offer. After an Encoder it does the same to a three-chain picture, leaving the separation between
// the chains intact — the channels still disagree about where the shape is, they just disagree in
// different hues.
//
// Works in HSV rather than on the three channels directly, because the useful colour gestures are
// rotate the hue, drain or exaggerate the saturation, and lift or crush the value — and none of
// those is expressible as gains on red, green and blue. Gains on the channels is what the Encoder
// already does, and doing it again here would add nothing.
//
// rgb in, rgb out.

'use strict';

const params = [];
const ports = [];

// The CV seam every video module uses: a knob, a control input aimed at it, and no depth — see
// video-maths for why the attenuverters went.
const knack = (id, name, min, max, def) => {
  params.push({ id, name, section: 'chroma', curve: 'linear', min, max, default: def, glideMs: 0 });
  ports.push({ id: `${id}Cv`, name, section: 'chroma', domain: 'control', dir: 'in', target: id });
};

// HUE is a full turn over the knob's travel and it WRAPS, so a ramp patched here cycles rather than
// hitting an end — which is why it is the first parameter in the video set that wants an LFO more
// than it wants a hand.
knack('hue', 'Hue', 0, 1, 0);
// SAT goes past unity to 2, so this is a colour BOOST as well as a drain. At 0 the picture is the
// same picture in grey — drained against LUMINANCE, so a bright colour becomes a light grey and a
// dark one a dark grey, and the image survives losing its colour.
knack('sat', 'Saturation', 0, 2, 1);
// LEVEL scales brightness, and CONTRAST pivots it about mid grey. Contrast is here rather than in a
// luma module because it is the operation that turns a soft picture into a graphic one, and after
// colorizing is exactly where a picture has gone soft.
knack('level', 'Level', 0, 2, 1);
knack('contrast', 'Contrast', 0, 4, 1);

ports.push({ id: 'imageIn', name: 'Image', section: 'chroma', domain: 'rgb', dir: 'in' });
ports.push({ id: 'imageOut', name: 'Out', section: 'chroma', domain: 'rgb', dir: 'out' });

export default {
  id: 'chroma',
  apiVersion: 1,
  name: 'Chroma',
  abbreviation: 'Chr',
  worklets: [],
  category: 'video',   // module library grouping
  signalIdentity: ['rgb'],
  ports,
  params,
};
