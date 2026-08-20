// descriptor.js — Colorizer. One channel in, colour out.
//
// The rack could make any image it liked and it came out grey. Every video module before this one
// emits luma, and the only things that speak rgb are the Compositor and Video Output — so a luma
// cable landing on an rgb input was broadcast to all three channels, which is the definition of
// monochrome. This is the short route out of that: brightness is read as a POSITION ALONG A
// PALETTE, so a gradient becomes a colour ramp and a shape's soft edge becomes a fringe.
//
// DISTINCT FROM THE ENCODER, which is the other route. The encoder takes three separately
// processed chains and makes them red, green and blue; that is where the patched look comes from
// and it costs three cables. This is one cable and a list of palettes, for when three chains are
// more than the patch needs.
//
// luma in, rgb out.

'use strict';

const params = [];
const ports = [];

// The CV seam every video module uses: a knob, a control input aimed at it, and no depth — see
// video-maths for why the attenuverters went.
const knack = (id, name, min, max, def) => {
  params.push({ id, name, section: 'colour', curve: 'linear', min, max, default: def, glideMs: 0 });
  ports.push({ id: `${id}Cv`, name, section: 'colour', domain: 'control', dir: 'in', target: id });
};

// SPREAD and SHIFT decide WHICH PART of the palette an image reaches, and they are the difference
// between a picture that uses two colours and one that uses all of them. An image rarely fills the
// range from black to white, so without these most of a palette never gets seen: spread stretches
// what the image does cover across more of the map, and shift slides that window along it.
knack('spread', 'Spread', 0, 4, 1);
knack('shift', 'Shift', -1, 1, 0);
// CYCLE rotates the palette under the image rather than moving the image through it, so a slow CV
// here recolours a still picture. It WRAPS, which on a palette that does not end where it began —
// heat, which runs black to white — puts a hard edge somewhere in the frame. That edge is a
// feature at any speed: it reads as a contour line sweeping through the picture.
knack('cycle', 'Cycle', 0, 1, 0);

params.push({ id: 'palette', name: 'Palette', section: 'colour', curve: 'stepped', default: 'heat',
  steps: [{ value: 'heat' }, { value: 'ice' }, { value: 'spectrum' },
    { value: 'duo' }, { value: 'steps' }] });

ports.push({ id: 'imageIn', name: 'Image', section: 'colour', domain: 'luma', dir: 'in' });
ports.push({ id: 'imageOut', name: 'Out', section: 'colour', domain: 'rgb', dir: 'out' });

export default {
  id: 'colorizer',
  apiVersion: 1,
  name: 'Colorizer',
  abbreviation: 'Col',
  worklets: [],
  category: 'video',   // module library grouping
  signalIdentity: ['rgb'],
  ports,
  params,
};
