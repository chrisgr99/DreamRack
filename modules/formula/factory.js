// factory.js — Formula's realized instance.
//
// The CV seam is the one every video module uses; see coordinate-field. What is new is that the
// SHADER IS BUILT AT RUN TIME from the expression, so videoPass returns different source as the
// expression changes — and the engine, which already recompiles when a module's glsl differs
// from what it holds, needs no special case for that.
//
// A bad expression does NOT change the shader. The last good one keeps running and the error is
// reported for the panel to show. An instrument that goes black while you are mid-word is
// unusable; this way you can type freely and only a valid expression takes effect.
//
// NO BACKTICKS inside the GLSL strings — they are template literals.

'use strict';

import { compileExpression } from './expr.js';

const WINDOW = 32;
const CV_PARAMS = ['k1', 'k2', 'k3', 'k4'];

const HEAD = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTime;
uniform sampler2D u_aIn; uniform int has_aIn;
uniform sampler2D u_bIn; uniform int has_bIn;
uniform sampler2D u_cIn; uniform int has_cIn;
uniform sampler2D u_dIn; uniform int has_dIn;
uniform float u_k1, u_k2, u_k3, u_k4;
out vec4 o;

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  // An unpatched input reads BLACK. Unlike Video Maths there is no useful identity to choose:
  // the expression decides what the term means, so the honest value for "nothing is connected"
  // is nothing.
  float v_A = has_aIn == 1 ? texture(u_aIn, uv).r : 0.0;
  float v_B = has_bIn == 1 ? texture(u_bIn, uv).r : 0.0;
  float v_C = has_cIn == 1 ? texture(u_cIn, uv).r : 0.0;
  float v_D = has_dIn == 1 ? texture(u_dIn, uv).r : 0.0;
  float v_K1 = u_k1, v_K2 = u_k2, v_K3 = u_k3, v_K4 = u_k4;
  // Centred and aspect-corrected, the same space the Coordinate Field works in, so an
  // expression written against X and Y behaves the way the rest of the rack does.
  vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float v_X = p.x, v_Y = p.y, v_T = uTime;
  float result = `;

const TAIL = `;
  o = vec4(vec3(clamp(result, 0.0, 1.0)), 1.0);
}`;

export function create(ctx, services) {
  const { descriptor } = services;
  const values = new Map(descriptor.params.map((p) => [p.id, p.default]));
  let engine = null;
  let compiled = compileExpression(values.get('expr'));
  let lastGood = compiled.ok ? compiled.glsl : '0.0';
  let error = compiled.ok ? null : compiled.error;

  const mute = ctx.createGain();
  mute.gain.value = 0;
  mute.connect(ctx.destination);

  const nodes = new Map();
  for (const id of CV_PARAMS) {
    const src = ctx.createConstantSource();
    src.offset.value = Number(values.get(id));
    const tap = ctx.createAnalyser();
    tap.fftSize = WINDOW;
    src.connect(tap);
    tap.connect(mute);
    src.start();
    nodes.set(id, { src, tap, buf: new Float32Array(WINDOW) });
  }

  function recompile() {
    const r = compileExpression(values.get('expr'));
    if (r.ok) { lastGood = r.glsl; error = null; } else { error = r.error; }
    // The rack rebuilds the video graph on this, which is what gets the new source to the
    // engine. Without it a valid expression would sit there doing nothing until the next cable.
    if (onRecompile) onRecompile();
  }

  let onRecompile = null;
  function onShaderChange(cb) { onRecompile = cb; }

  function attachEngine(e) { engine = e; for (const id of CV_PARAMS) push(id, values.get(id)); }
  function push(id, value) { const n = nodes.get(id); if (n) n.src.offset.value = Number(value); }

  function videoPass() { return { glsl: HEAD + lastGood + TAIL, inputs: ['aIn', 'bIn', 'cIn', 'dIn'] }; }
  function videoUniforms() {
    const out = {};
    for (const id of CV_PARAMS) {
      const n = nodes.get(id);
      n.tap.getFloatTimeDomainData(n.buf);
      let s = 0;
      for (let i = 0; i < n.buf.length; i++) s += n.buf[i];
      out[id] = Math.max(0, Math.min(1, s / n.buf.length));
    }
    return out;
  }

  // What the faceplate shows, and what the editor reports.
  function readoutText() { return String(values.get('expr') || ''); }
  function readoutError() { return error; }

  function getOutput() { return null; }
  function getInput() { return null; }
  function getParam(id) { const n = nodes.get(id); return n ? n.src.offset : null; }
  function supports() { return true; }
  function setParam(id, value) {
    values.set(id, value);
    if (id === 'expr') { recompile(); return; }
    push(id, value);
  }
  function dispose() {
    for (const n of nodes.values()) {
      try { n.src.stop(); } catch (_e) { /* already stopped */ }
      try { n.src.disconnect(); n.tap.disconnect(); } catch (_e) { /* gone */ }
    }
    nodes.clear();
    try { mute.disconnect(); } catch (_e) { /* gone */ }
    engine = null;
  }

  return { getOutput, getInput, getParam, setParam, supports, dispose, attachEngine,
    videoPass, videoUniforms, readoutText, readoutError, onShaderChange };
}
