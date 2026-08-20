// descriptor.js — Encoder. Three monochrome chains become one colour picture.
//
// This is the module the whole luma-and-rgb split exists for. Keeping the two domains apart is not
// type pedantry: in analog video synthesis the characteristic colour comes from running THREE
// PARALLEL MONOCHROME CHAINS into an encoder, so that red, green and blue each get their own
// processing. A single RGBA domain cannot express that — it forces all three channels through the
// same operations, which is exactly what makes an image look computed rather than patched.
//
// The result is fringing and separation no single chain produces: the same shape run through three
// warps that differ slightly comes out with coloured edges, because the three channels genuinely
// disagree about where the shape is.
//
// DISTINCT FROM THE COLORIZER, which maps one channel through a palette. That is one cable and a
// list; this is three cables and a patch. Both reach colour and they do not look alike.
//
// three luma in, rgb out.

'use strict';

const params = [];
const ports = [];

// The CV seam every video module uses: a knob, a control input aimed at it, and no depth — see
// video-maths for why the attenuverters went.
const knack = (id, name, min, max, def) => {
  params.push({ id, name, section: 'encode', curve: 'linear', min, max, default: def, glideMs: 0 });
  ports.push({ id: `${id}Cv`, name, section: 'encode', domain: 'control', dir: 'in', target: id });
};

// A GAIN PER CHANNEL, and all three modulated. This is the module's only control and it is enough:
// three envelopes on three gains is a colour that moves, and the same envelope on all three is a
// brightness. Above unity so a dim chain can be brought level with the other two rather than the
// other two having to be pulled down to meet it.
knack('gainR', 'Red', 0, 2, 1);
knack('gainG', 'Green', 0, 2, 1);
knack('gainB', 'Blue', 0, 2, 1);

ports.push({ id: 'rIn', name: 'Red', section: 'encode', domain: 'luma', dir: 'in' });
ports.push({ id: 'gIn', name: 'Green', section: 'encode', domain: 'luma', dir: 'in' });
ports.push({ id: 'bIn', name: 'Blue', section: 'encode', domain: 'luma', dir: 'in' });
ports.push({ id: 'imageOut', name: 'Out', section: 'encode', domain: 'rgb', dir: 'out' });

export default {
  id: 'encoder',
  apiVersion: 1,
  name: 'Encoder',
  abbreviation: 'Enc',
  worklets: [],
  category: 'video',   // module library grouping
  signalIdentity: ['rgb'],
  ports,
  params,
};
