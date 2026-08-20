// tools/render-speech.mjs — render the demo narration to files that ship with the app.
//
//   npm run speech            render anything missing
//   npm run speech -- --force re-render everything
//
// Walks every demo in demos/ plus the gesture phrase table, renders each distinct line once with
// the Mac's `say`, compresses it to AAC, and writes demos/speech/index.json mapping the text's id to
// its file and its DURATION — the duration is what lets a note's hold default to the length of its
// own narration instead of being a number someone has to guess.
//
// Fragments are keyed by a hash of the text, so re-wording one note re-renders one file and leaves
// the rest alone. Files whose text no longer appears anywhere are deleted, so the folder cannot
// silently accumulate the narration of sentences that were edited away.
//
// macOS only, and deliberately so: this runs at AUTHORING time, and its output is what ships. The
// app itself never shells out to `say`, which is why the browser build has narration at all.
'use strict';

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, readFile, writeFile, mkdir, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { speechId } from '../host/demo/speech-id.js';
import { parseActions, parseControls, createPhraseBook, parseVoiceSettings } from '../host/demo/phrases.js';
import { parseTutorial, tutorialLines } from '../host/tutorial-md.js';
import { parseDemoMd } from '../host/demo/demo-md.js';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEMOS = path.join(ROOT, 'demos');
const SCRIPTS = path.join(DEMOS, 'scripts');   // one JSON per demo; index.json is the drop-down's list
const OUT = path.join(DEMOS, 'speech');

// The voice and its speed are declared in demos/phrases.md, beside the words it will speak — same
// decision, same file. These are only the fallbacks if that section is missing.
const DEFAULT_VOICE = 'Karen (Premium)';
const DEFAULT_RATE = 175;   // words per minute
const BITRATE = 32000;      // AAC, mono — ~5 kB per second of speech, and indistinguishable at this size

const force = process.argv.includes('--force');
const argOf = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };

let VOICE = DEFAULT_VOICE, RATE = DEFAULT_RATE;

// A voice change means every fragment is stale, so the index records which voice made it and a
// mismatch forces the lot to be re-rendered. Otherwise half the narration would keep the old voice.
let voiceChanged = false;

async function voiceExists() {
  const { stdout } = await run('say', ['-v', '?']);
  return stdout.split('\n').some((l) => l.startsWith(VOICE));
}

// Read the voice and rate out of demos/phrases.md, with a command-line override on top.
async function readVoiceSettings() {
  try {
    const s = parseVoiceSettings(await readFile(path.join(DEMOS, 'phrases.md'), 'utf8'));
    if (s.voice) VOICE = s.voice;
    if (Number.isFinite(s.rate) && s.rate > 0) RATE = s.rate;
  } catch { /* fall back to the defaults above */ }
  const v = argOf('--voice'); if (v) VOICE = v;
  const r = Number(argOf('--rate')); if (Number.isFinite(r) && r > 0) RATE = r;
}

// Every line the app can speak: the notes and title cards of every demo, plus the whole gesture
// phrase table (both verbosities, every kind of control).
async function collect() {
  const lines = new Set();
  // What each control IS, taken from what the scripts do with it: a patch endpoint is a terminal, a
  // numeric value a knob, anything else a button. That is all the renderer needs to avoid making
  // sentences no demo can ask for, and it needs no descriptors to work it out.
  const kinds = {};
  const seenVoices = new Set();          // verbosity levels the scripts actually ask for
  const noteKind = (ref, kind) => { if (ref) kinds[ref] = kind; };

  let files = [];
  try { files = (await readdir(SCRIPTS)).filter((f) => (f.endsWith('.json') || f.endsWith('.md')) && f !== 'index.json'); } catch { /* no demos yet */ }
  for (const f of files) {
    let demo;
    try {
      const text = await readFile(path.join(SCRIPTS, f), 'utf8');
      demo = f.endsWith('.md') ? parseDemoMd(text, { id: f.replace(/\.md$/, '') }) : JSON.parse(text);
    } catch { continue; }
    if (demo.voice) seenVoices.add(String(demo.voice));
    for (const k of ['intro', 'outro']) if (demo[k]) lines.add(demo[k]);
    for (const s of demo.steps || []) {
      if (s.note) lines.add(s.note);
      // The CAPTIONS too. A demo can be run with the captions spoken instead of the long narration —
      // the short line read aloud beside the same choreography — and that voice has to be rendered
      // like any other or the run comes up silent.
      if (s.caption) lines.add(s.caption);
      if (s.say) lines.add(s.say);          // a step's own override of the stock gesture phrase
      if (s.voice) seenVoices.add(String(s.voice));
      if (s.do === 'patch') { noteKind(s.from, 'terminal'); noteKind(s.to, 'terminal'); }
      if (s.do === 'set') noteKind(s.target, typeof s.to === 'number' ? 'knob' : 'button');
    }
  }

  // The TUTORIAL's own prose, block by block — the Listen button beside each one plays these. Same
  // pipeline as the demos' notes, because it is the same voice saying the same kind of thing.
  try {
    const steps = parseTutorial(await readFile(path.join(ROOT, 'host', 'tutorial.md'), 'utf8'));
    for (const line of tutorialLines(steps)) lines.add(line);
  } catch { console.warn('render-speech: host/tutorial.md not readable — tutorial not narrated.'); }

  // The phrase table LAST, now that the kinds are known.
  try {
    const md = await readFile(path.join(DEMOS, 'phrases.md'), 'utf8');
    const book = createPhraseBook(parseActions(md), parseControls(md));
    // ONLY WHAT A DEMO CAN REACH. The table is crossed with every control and carries a short form
    // beside every long one, which came to 1335 lines — three quarters of everything rendered, most
    // of it unspoken: no demo declares short verbosity, and a third of the controls the table names
    // appear in no script. A demo that starts asking for either puts the lines back by declaring it.
    const levels = ['long', 'after', 'combined'];
    for (const d of seenVoices) if (d === 'short') levels.push('short');
    for (const p of book.all(kinds, { levels, onlyUsedRefs: true })) lines.add(p);
  } catch { console.warn('render-speech: demos/phrases.md not readable — no gesture phrases rendered.'); }

  return [...lines].map((t) => String(t).trim().replace(/\s+/g, ' ')).filter(Boolean);
}

async function durationOf(file) {
  const { stdout } = await run('afinfo', [file]);
  const m = /estimated duration:\s*([\d.]+)/.exec(stdout);
  return m ? Math.round(Number(m[1]) * 1000) / 1000 : 0;
}

async function render(text, id) {
  const aiff = path.join(OUT, `${id}.aiff`);
  const m4a = path.join(OUT, `${id}.m4a`);
  await run('say', ['-v', VOICE, '-r', String(RATE), '-o', aiff, text]);
  await run('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', String(BITRATE), '-c', '1', aiff, m4a]);
  const secs = await durationOf(m4a);
  await unlink(aiff).catch(() => {});
  return secs;
}

async function main() {
  if (process.platform !== 'darwin') { console.error('render-speech: macOS only (needs `say`).'); process.exit(1); }
  await readVoiceSettings();
  if (!(await voiceExists())) {
    console.error(`render-speech: voice "${VOICE}" is not installed.`);
    console.error('Add it in System Settings > Accessibility > Spoken Content > System Voice > Manage Voices,');
    console.error("then set it in demos/phrases.md. `say -v '?'` lists what you have.");
    process.exit(1);
  }
  console.log(`voice: ${VOICE} at ${RATE} wpm`);
  await mkdir(OUT, { recursive: true });

  const lines = await collect();
  const wanted = new Map(lines.map((t) => [speechId(t), t]));

  let old = {};
  try {
    const prev = JSON.parse(await readFile(path.join(OUT, 'index.json'), 'utf8'));
    voiceChanged = prev.voice !== VOICE || prev.rate !== RATE;
    if (!voiceChanged) old = prev.fragments || {};
    else console.log(`voice changed from ${prev.voice} at ${prev.rate} wpm — re-rendering everything`);
  } catch { /* first run */ }

  const fragments = {};
  let made = 0, kept = 0;
  for (const [id, text] of wanted) {
    const file = `${id}.m4a`;
    const have = !force && old[id] && await stat(path.join(OUT, file)).then(() => true).catch(() => false);
    if (have) { fragments[id] = old[id]; kept++; continue; }
    const secs = await render(text, id);
    fragments[id] = { file, secs, text };
    made++;
    process.stdout.write(`  ${secs.toFixed(2)}s  ${text}\n`);
  }

  // Sweep fragments whose text no longer appears in any script or in the phrase table.
  let swept = 0;
  for (const f of await readdir(OUT)) {
    if (!f.endsWith('.m4a')) continue;
    if (!wanted.has(f.replace(/\.m4a$/, ''))) { await unlink(path.join(OUT, f)); swept++; }
  }

  await writeFile(path.join(OUT, 'index.json'),
    JSON.stringify({ voice: VOICE, rate: RATE, fragments }, null, 1) + '\n');

  const total = Object.values(fragments).reduce((a, x) => a + x.secs, 0);
  console.log(`${Object.keys(fragments).length} fragments (${made} rendered, ${kept} kept, ${swept} swept) — ${total.toFixed(1)}s of speech`);
}

main().catch((e) => { console.error('render-speech failed:', e.message); process.exit(1); });
