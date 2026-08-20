// demo-md.js — a demo written as markdown, which is the form an author edits.
//
// THE WORDS ARE THE PART THAT CHANGES. A demo's choreography settles quickly; its narration is
// rewritten a dozen times, and rewriting it inside JSON means minding quotes and escapes to change a
// sentence. So a demo is a markdown file: one `##` heading per step carrying the move, and ordinary
// prose beneath it as what is said there. Blank prose is a step that says nothing.
//
// The parser produces exactly the step objects the runner already takes (see runner.js), so nothing
// downstream knows the difference — and a JSON demo keeps working untouched.
//
//   # Title of the demo
//
//   **Patch** Strudel — two voices
//   **Modules** strudel = wcoast.strudel, voiceA = wcoast.voice#0
//   **Sound** on
//
//   ## zoom strudel 2.2
//   ## press strudel run
//   ## wait 3
//
//   ## press strudel edit
//   SCRIPT opens the editor.
//
//   ## point ".rack(1)"
//   .rack(1) carries the chords, and the bass under them, to V1.

'use strict';

// One directive line -> one step. The vocabulary is small on purpose: a demo that needs a verb the
// runner does not have is a runner change, not a markdown change.
function stepFor(directive) {
  const say = (s) => s.trim();
  const parts = directive.trim().split(/\s+/);
  const verb = (parts[0] || '').toLowerCase();
  const rest = directive.trim().slice(parts[0].length).trim();

  if (verb === 'wait' || verb === 'pause') return { do: 'pause', for: Number(parts[1]) || 1 };
  if (verb === 'say') return { do: 'say', ...(parts[1] ? { about: parts[1] } : {}) };
  if (verb === 'page') return { do: 'page', to: parts[1] };
  if (verb === 'zoom') {
    if ((parts[1] || '').toLowerCase() === 'out') return { do: 'zoom', to: 'out' };
    const s = { do: 'zoom', at: parts[1] };
    if (parts[2] && !isNaN(Number(parts[2]))) s.to = Number(parts[2]);
    if (parts.includes('left')) s.align = 'left';
    return s;
  }
  if (verb === 'point') {
    // A quoted argument is a phrase in the script window; anything else names a module or a jack.
    const q = /^"([^"]+)"$|^'([^']+)'$/.exec(rest);
    if (q) return { do: 'point', text: q[1] || q[2] };
    return { do: 'point', at: rest };
  }
  if (verb === 'press') {
    // press <module> <param> — a button, which is always set to 'on': the momentary ones toggle and
    // the latching ones are being turned on, which is what a demo presses them for.
    return { do: 'set', target: `${parts[1]}:${parts[2]}`, to: 'on' };
  }
  if (verb === 'set') {
    // "set osc modFreq 400 over 8" — the knob travels for eight seconds, which is how a sweep is
    // heard as a sweep rather than as a jump. Without `over` it moves at the demo's usual pace.
    let words = parts.slice(3);
    let perform = null;
    const at = words.findIndex((w) => w.toLowerCase() === 'over');
    if (at >= 0) { perform = Number(words[at + 1]); words = words.slice(0, at); }
    const v = words.join(' ');
    const n = Number(v);
    const step = { do: 'set', target: `${parts[1]}:${parts[2]}`, to: (v !== '' && !isNaN(n)) ? n : v };
    if (perform > 0) step.perform = perform;
    return step;
  }
  if (verb === 'choose') return { do: 'choose', target: `${parts[1]}:${parts[2]}`, to: parts.slice(3).join(' ') };
  if (verb === 'patch') {
    const [from, to] = rest.split(/\s*(?:->|→)\s*/);
    return { do: 'patch', from: say(from || ''), to: say(to || '') };
  }
  if (verb === 'repatch') {
    // MOVE ONE END of an existing cable, which is what a hand does when a module is inserted into a
    // working chain. The terminal named first must carry exactly ONE cable — an input always does, an
    // output only until something else is taken from it — and the end moves to a terminal of the same
    // kind, an input end to an input and an output end to an output.
    const [at, to] = rest.split(/\s*(?:->|→)\s*/);
    return { do: 'repatch', at: say(at || ''), to: say(to || '') };
  }
  if (verb === 'example' || verb === 'patchfile') return { do: 'example', name: rest };
  // `stage full` / `stage right` / `stage below` — where the video output pane stands. A reel opens on
  // the finished picture filling the window and then settles it beside or under the rack for the build.
  if (verb === 'stage') return { do: 'stage', to: (parts[1] || '').toLowerCase() };
  // `title Some words` — the opening frame, centred over the picture in large letters. It is a say
  // step with nowhere to point and a card of its own, which is what an opening title is.
  if (verb === 'title') return { do: 'say', title: true, caption: rest.replace(/^["']|["']$/g, '') };
  return null;
}

// **Key** value lines in the header, before the first step.
function headerValue(line) {
  const m = /^\*\*([A-Za-z]+)\*\*\s*(.*)$/.exec(line.trim());
  return m ? [m[1].toLowerCase(), m[2].trim()] : null;
}

export function parseDemoMd(md, { id = null } = {}) {
  const lines = String(md || '').split('\n');
  const demo = { id, title: '', steps: [] };
  const modules = {};
  let step = null, prose = [];
  let stepLine = 0, lineNo = 0;
  const flush = () => {
    if (!step) return;
    const note = prose.join(' ').replace(/\s+/g, ' ').trim();
    if (note) step.note = note;
    // WHICH LINE OF THE FILE THIS STEP IS. The mirror publishes the running step, so an assistant
    // asked to reword "the step we are on" can go straight to it instead of matching text. One-based,
    // pointing at the `##` heading.
    step.line = stepLine;
    demo.steps.push(step);
    step = null; prose = [];
  };

  for (const raw of lines) {
    lineNo++;
    const line = raw.trim();
    if (/^#\s+/.test(line)) { demo.title = line.replace(/^#\s+/, '').trim(); continue; }
    const head = /^##\s+(.*\S)\s*$/.exec(line);
    if (head) { flush(); step = stepFor(head[1]); stepLine = lineNo; if (step) step.source = head[1];
      if (!step) console.warn(`[demo-md] unknown step: ${head[1]}`); continue; }
    if (!step) {
      const kv = headerValue(line);
      if (!kv) continue;
      const [k, v] = kv;
      if (k === 'patch') demo.patch = v;
      else if (k === 'sound') demo.sound = /^(on|yes|true)$/i.test(v);
      // CAPTIONS INSTEAD OF A VOICE. The same script, run silent: each step shows its one-line
      // caption and is timed by how long that line takes to READ. Nothing about the choreography
      // changes, so a narrated demo and a captioned one cannot drift apart.
      else if (k === 'mode') demo.mode = v.trim().toLowerCase();
      // WHICH PAGE THE DEMO OPENS ON. Selected before the run starts, with no pointer and no tab
      // click: a demo about the video page has no business spending its first seconds travelling to
      // a tab, and a reader who pressed Run on a video demo knows where they are going.
      else if (k === 'page') demo.startPage = v.trim();
      // WHERE THE PICTURE STARTS — `**Screen** full`. Not `stage`, which already means the RACK a demo
      // opens on: one word for two unrelated things is how a demo came to try to build a rack out of
      // the word "full". A reel that opens on its finished image has to have that image up BEFORE the
      // first step, not after three steps of pressing a button and moving a pane.
      else if (k === 'screen') demo.screen = v.trim().toLowerCase();
      else if (k === 'rate') demo.rate = Number(v) || 1;
      // HOW LONG THE GAPS ARE. `**Pace** brisk` cuts the structural waits — the beat before a
      // gesture, the settle after one, the travel — to a third or so. The words still take as long as
      // they take; what goes is the silence around them, which is what makes a demo feel like it is
      // being shown to someone with time to spare.
      else if (k === 'pace') {
        const brisk = { perform: 0.55, arrive: 0.8, beat: 0.25, settle: 0.25, hold: 1.6 };
        const easy = { perform: 1.0, arrive: 2.0, beat: 0.7, settle: 0.8, hold: 3.0 };
        demo.defaults = { ...(demo.defaults || {}), ...(v.trim().toLowerCase() === 'brisk' ? brisk : easy) };
      }
      else if (k === 'openhold') demo.openHold = Number(v);
      else if (k === 'modules') {
        for (const pair of v.split(',')) {
          const [name, type] = pair.split('=').map((x) => (x || '').trim());
          if (name && type) modules[name] = type;
        }
      }
      continue;
    }
    // A LINE BEGINNING WITH ">" IS THE CAPTION for this step — the short card the silent run shows,
    // beside the sentence the narrated run speaks. Two word tracks over one choreography: shortening
    // the spoken sentence would not give a caption (a caption is a label, not a summary), and a
    // second script file would drift the first time either was edited.
    if (line.startsWith('>')) { step.caption = line.replace(/^>\s*/, '').trim(); continue; }
    if (line) prose.push(line);
  }
  flush();

  // The patch and its names are the first step, which is what the runner's `example` verb is.
  if (demo.patch) demo.steps.unshift({ do: 'example', name: demo.patch, as: modules });
  else if (Object.keys(modules).length && demo.steps[0] && demo.steps[0].do === 'example') demo.steps[0].as = modules;
  return demo;
}
