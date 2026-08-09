'use strict';
// Canonical faceplate theme tokens. Two entries — light and dark — that every
// panel is painted from, plus the signal-family colours the host paints onto
// jacks (shared across both themes). Colours are named tokens here so a look
// change happens in one place. See design/faceplate-system.md.

const THEME = {
  // face/ink/frame + knob tokens (ring stroke, cap outline, cap gradient stops).
  // The blue ring gradient itself is theme-independent (see primitives defs()).
  //
  // `strip` is the radio group's metal plate: the SAME metal as a knob cap, LIFTED. It has to be
  // lighter than the cap for one reason — an unlit lamp is a mid grey, and on the dark faceplate the
  // cap's own metal is a mid grey a shade off it, so the lamps would sink into the plate and you
  // would lose the count of how many positions there are. Lifted, the unlit lamps read as holes in
  // it. Same four stops in the same order, so it is recognisably the same material.
  light: {
    face: '#cfcfcf', grain: '#d0d0d0', ink: '#163a69', frame: '#7d7d7d',
    ringStroke: '#004b7a', capStroke: '#666666', cap: ['#f8f8f8', '#bfc3c5', '#f4f4f4', '#777777'],
    strip: ['#f8f8f8', '#d8dbdd', '#f4f4f4', '#9a9a9a'],
    track: '#20242a', trackEdge: '#000000', handle: '#3c4653', handleEdge: '#0d1218', handleLine: '#e6ecf3',
  },
  dark: {
    face: '#262629', grain: '#2a2a2d', ink: '#b8b8bc', frame: '#808085',
    ringStroke: '#6fa8d6', capStroke: '#b8b8bc', cap: ['#3a3d43', '#4c5058', '#5a5f67', '#6b7079'],
    strip: ['#565a62', '#6a6f78', '#7a7f88', '#8b909a'],
    track: '#626771', trackEdge: '#1b1b1e', handle: '#9aa4b2', handleEdge: '#1b1b1e', handleLine: '#1c2026',
  },
};

// Jack art is neutral; the host repaints the outer ring by signal family at load.
const JACK_NEUTRAL = '#8a8a8a';
const JACK_HOLE = '#000000';

// Signal-family colours (from the host's jack colour code — one per family).
const FAMILY = {
  audio: '#f3c40b',    // yellow
  cv: '#ff7300',       // orange (control)
  trigger: '#5aa0e6',  // light blue
  pitch: '#39a85a',    // green (1V/oct)
};

export { THEME, JACK_NEUTRAL, JACK_HOLE, FAMILY };
