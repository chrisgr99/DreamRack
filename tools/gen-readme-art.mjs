// gen-readme-art.mjs — the small illustrations the README uses to show the visual language.
//
// DRAWN FROM THE SAME NUMBERS THE APP USES, not redrawn by eye: the jack colours, the dashed
// direction ring's third-of-the-band width, the bipolar dot at 0.34 of the hole, the cable hues. If a
// colour or a proportion changes in the app, this script is re-run and the pictures follow. A diagram
// that drifts from the thing it describes is worse than no diagram.
//
// DARK ONLY. One picture per idea, on a dark faceplate: it reads on GitHub in either theme, and a
// second set to keep in step was work for no gain. The app still generates both for its own panels —
// that is a different problem, where the panel has to sit in a rack that is one theme or the other.
//
// Run: node tools/gen-readme-art.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(fileURLToPath(new URL('..', import.meta.url)), 'docs', 'img');

// ---- the app's own values -----------------------------------------------------------------------
const JACK = {
  audio: '#f3c40b', cv: '#ff7300', trigger: '#5aa0e6', pitch: '#39a85a',
  luma: '#babab6', rgb: '#e0359b',
};
const NOTE = { light: '#141418', dark: '#ffffff' };
const HOLE = '#000000';
const BIPOLAR = '#ffffff';
const THEME = {
  light: { face: '#d9d9d4', ink: '#163a69', edge: '#000000', note: NOTE.light, cap: '#3b3b40' },
  dark: { face: '#232327', ink: '#c9d6e6', edge: '#8a8a90', note: NOTE.dark, cap: '#c9d6e6' },
};

const R = 3.6;           // jack radius, mm
const RH = R * 0.53;     // hole
const FONT = 'Arial Narrow, Helvetica, Arial, sans-serif';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const txt = (x, y, s, { size = 2.4, fill, anchor = 'middle', italic = true, weight = 700 } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}"${italic ? ' font-style="italic"' : ''}` +
  ` fill="${fill}" text-anchor="${anchor}" font-family="${FONT}">${esc(s)}</text>`;

// A jack exactly as the app paints one: the coloured body, a thin edge on the light face only, the
// hole, and the dashed direction ring — hugging the OUTER edge for an output, the HOLE for an input,
// each a third of the coloured band wide.
function jack(cx, cy, colour, dir, th, { bipolar = false } = {}) {
  const band = R - RH, w = band / 3;
  const ringR = dir === 'out' ? R - w / 2 : RH + w / 2;
  const circ = 2 * Math.PI * ringR;
  const n = Math.max(6, Math.round(circ / (w * 1.6)));
  const seg = circ / (2 * n);
  return [
    `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${colour}"${th === 'light' ? ' stroke="#000" stroke-width="0.3"' : ''}/>`,
    `<circle cx="${cx}" cy="${cy}" r="${RH}" fill="${HOLE}"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${ringR.toFixed(3)}" fill="none" stroke="#000" stroke-width="${w.toFixed(3)}"` +
      ` stroke-dasharray="${seg.toFixed(3)} ${seg.toFixed(3)}"/>`,
    bipolar ? `<circle cx="${cx}" cy="${cy}" r="${(RH * 0.34).toFixed(3)}" fill="${BIPOLAR}"/>` : '',
  ].join('\n  ');
}

function page(w, h, th, body) {
  const t = THEME[th];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 4}" height="${h * 4}">
  <rect x="0" y="0" width="${w}" height="${h}" rx="2" fill="${t.face}"/>
  ${body}
</svg>\n`;
}

// ---- 1. what a jack tells you ------------------------------------------------------------------
function jacksPicture(th) {
  const t = THEME[th];
  const items = [
    { x: 14, colour: JACK.cv, dir: 'in', cap: ['input', 'dashes hug the hole'] },
    { x: 42, colour: JACK.cv, dir: 'out', cap: ['output', 'dashes hug the rim'] },
    { x: 70, colour: JACK.cv, dir: 'out', cap: ['bipolar', 'swings either way'], bipolar: true },
    { x: 98, colour: JACK.audio, dir: 'out', cap: ['audio out', 'colour = signal type'] },
  ];
  const body = items.map((it) => [
    jack(it.x, 13, it.colour, it.dir, th, { bipolar: it.bipolar }),
    txt(it.x, 23.5, it.cap[0], { size: 3.1, fill: t.ink }),
    txt(it.x, 27.6, it.cap[1], { size: 2.4, fill: t.ink, italic: false, weight: 400 }),
  ].join('\n  ')).join('\n  ');
  return page(112, 32, th, body);
}

// ---- 2. the signal families --------------------------------------------------------------------
function signalsPicture(th) {
  const t = THEME[th];
  const rows = [
    ['audio', JACK.audio], ['control', JACK.cv], ['1V/oct pitch', JACK.pitch],
    ['trigger', JACK.trigger], ['note bundle', t.note], ['video, one channel', JACK.luma],
    ['video, colour', JACK.rgb],
  ];
  const body = rows.map(([name, col], i) => {
    const y = 8 + i * 8;
    return [
      `<path d="M6,${y} C20,${y - 3} 26,${y + 3} 40,${y}" fill="none" stroke="${col}" stroke-width="1.5" stroke-linecap="round"/>`,
      txt(45, y + 1.1, name, { size: 3.0, fill: t.ink, anchor: 'start' }),
    ].join('\n  ');
  }).join('\n  ');
  return page(112, 8 + rows.length * 8, th, body);
}

// ---- 3. a cable over a label -------------------------------------------------------------------
// The cable runs STRAIGHT THROUGH the word and simply is not drawn where the word is — it does not
// bend around it, which is the whole point: nothing moves, nothing dims, the panel just shows through.
//
// The jacks are drawn AFTER the cord so the cord ends where the jack begins. A cable running into the
// black centre of a jack is a drawing mistake nobody makes twice: the hole is where a plug goes.
function cablesPicture(th) {
  const t = THEME[th];
  const maskId = `lbl-${th}`, blurId = `blur-${th}`;
  const d = 'M12,14 C34,10 78,18 100,14';
  const body = [
    `<defs>`,
    `<filter id="${blurId}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.7"/></filter>`,
    `<mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="112" height="34">`,
    `<rect x="0" y="0" width="112" height="34" fill="#ffffff"/>`,
    `<rect x="44" y="9.6" width="24" height="8.8" rx="4.4" fill="#000000" filter="url(#${blurId})"/>`,
    `</mask></defs>`,
    // the cord and its crawling dashes, both cut where the word is
    `<path d="${d}" fill="none" stroke="${JACK.audio}" stroke-width="1.7" stroke-linecap="round" mask="url(#${maskId})"/>`,
    `<path d="${d}" fill="none" stroke="#000000" stroke-width="0.85" stroke-dasharray="2.2 3.4" mask="url(#${maskId})"/>`,
    // the word the cable crosses, drawn where the cord would otherwise have covered it
    txt(56, 15, 'level', { size: 4.0, fill: t.ink }),
    // jacks last: the cord ends at the jack rather than in its hole
    jack(12, 14, JACK.audio, 'out', th),
    jack(100, 14, JACK.audio, 'in', th),
    txt(56, 30, 'a cable runs clear of the lettering it crosses', { size: 2.5, fill: t.ink, italic: false, weight: 400 }),
  ].join('\n  ');
  return page(112, 34, th, body);
}

// ---- 4. a cable takes the colour of the jack it lands on ----------------------------------------
// The clearest case is the one that happens constantly: an oscillator's AUDIO output driving another
// module's modulation input. The signal is audio; the job it does at the far end is modulation; the
// cord is orange because that is what it is DOING, not what it came out of.
function rolesPicture(th) {
  const t = THEME[th];
  const d = 'M12,14 C40,9 72,19 100,14';
  const body = [
    `<path d="${d}" fill="none" stroke="${JACK.cv}" stroke-width="1.7" stroke-linecap="round"/>`,
    `<path d="${d}" fill="none" stroke="#000000" stroke-width="0.85" stroke-dasharray="2.2 3.4"/>`,
    jack(12, 14, JACK.audio, 'out', th),
    jack(100, 14, JACK.cv, 'in', th),
    txt(12, 23.5, 'audio out', { size: 2.7, fill: t.ink }),
    txt(100, 23.5, 'modulation in', { size: 2.7, fill: t.ink }),
    txt(56, 31, 'a cable takes the colour of the jack it lands on —', { size: 2.5, fill: t.ink, italic: false, weight: 400 }),
    txt(56, 34.4, 'what the signal is doing, not where it came from', { size: 2.5, fill: t.ink, italic: false, weight: 400 }),
  ].join('\n  ');
  return page(112, 38, th, body);
}

fs.mkdirSync(OUT, { recursive: true });
const th = 'dark';
fs.writeFileSync(path.join(OUT, 'jacks.svg'), jacksPicture(th));
fs.writeFileSync(path.join(OUT, 'signals.svg'), signalsPicture(th));
fs.writeFileSync(path.join(OUT, 'cables.svg'), cablesPicture(th));
fs.writeFileSync(path.join(OUT, 'roles.svg'), rolesPicture(th));
console.log(`wrote 4 files to ${OUT}`);
