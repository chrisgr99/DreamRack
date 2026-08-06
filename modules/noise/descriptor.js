// descriptor.js — Noise, Wcoast module.
//
// A noise source with no controls at all: five outputs, always running, differing only in spectral
// slope. There is nothing to set, so there is nothing to CV, so the panel is a column of jacks.
//
// WHY FIVE AND WHY THESE. The family is one idea applied twice in each direction. Start with white —
// equal energy at every frequency, slope 0. Integrate it and you lose 6 dB per octave as frequency
// rises: red. Integrate half as hard and you lose 3: pink, which is equal energy per octave and the
// one that sounds "natural" because that is how hearing is spaced. Differentiate instead and you gain
// the same amounts: blue at +3, violet at +6.
//
//   violet  +6 dB/oct   white, differentiated       hiss, almost all top
//   blue    +3 dB/oct   pink, differentiated        bright, thinner than white
//   white    0          uniform                     the reference
//   pink    −3 dB/oct   equal energy per octave     the natural-sounding one
//   red     −6 dB/oct   white, integrated           rumble, almost all bottom
//
// Grey and black, which some noise modules offer, are deliberately absent. Grey is white shaped by an
// inverse equal-loudness curve — a psychoacoustic filter, not a slope, and it would be the only
// output here that depends on an assumption about the listener. Black is near-silence with occasional
// events, which is a random source, not a noise colour; the Random module is where that belongs.
//
// All five run continuously from one generator, so they are correlated: patch white and red together
// and they are the same noise seen through different filters, not two independent sources. That is
// what the real thing does, and it matters when you use one to modulate and another to sound.

const ports = [
  // dir="out" order fixes the worklet's output indices. Bright at the top, dark at the bottom, so the
  // column reads as a spectrum rather than as a list.
  { id: 'violetOut', name: 'Violet', section: 'out', domain: 'audio', dir: 'out' },
  { id: 'blueOut', name: 'Blue', section: 'out', domain: 'audio', dir: 'out' },
  { id: 'whiteOut', name: 'White', section: 'out', domain: 'audio', dir: 'out' },
  { id: 'pinkOut', name: 'Pink', section: 'out', domain: 'audio', dir: 'out' },
  { id: 'redOut', name: 'Red', section: 'out', domain: 'audio', dir: 'out' },
];

export default {
  apiVersion: 1,
  id: 'wcoast.noise',
  name: 'Noise',
  category: 'source',   // module library grouping
  abbreviation: 'NOIS',
  scope: 'voice',
  hp: 5,
  worklets: ['modules/noise/noise-processor.js'],
  menuSectionOrder: ['out'],
  ports,
  params: [],
};
