// dev-watch.js — edit a file, see it in the app. No quitting, no relaunching.
//
// Started only by `npm run dev`, never by `npm start`, so a real run of the app carries none of this.
//
// IT RELOADS, IT DOES NOT RESTART. Almost everything in this project is renderer code — the rack, the
// modules, the panels, the demos, index.html — and reloading the window picks all of that up in about
// a tenth of a second while the window stays where it is. A full relaunch costs several seconds and
// moves the window. The only files that genuinely need the process back are the main process itself
// and the preload, and for those it says so rather than pretending.
//
// IT REGENERATES PANELS IN PROCESS. A faceplate is generated from its layout, so editing
// panel.layout.js changes nothing until the generator has run — the app would simply show the old
// panel and say nothing. The first version shelled out to `process.execPath` to run gen-panel.js,
// which in an Electron main process is the ELECTRON BINARY, not node: every layout edit launched a
// fresh Electron instance that did nothing, and the reload sat waiting on it. It now imports the
// layout and the renderer directly and writes the files itself. No child process at all, and it is
// faster besides.
//
// The patch survives: the app autosaves its session, so a reload comes back to what was on the rack.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// Everything the renderer loads. Directories are watched recursively.
const WATCH = ['host', 'modules', 'panel', 'debug', 'demos/scripts', 'examples', 'index.html', 'demos/phrases.md'];
// Changing these means the process has to come back; a reload cannot pick them up.
const NEEDS_RESTART = ['electron-main.js', 'electron-preload.js', 'electron-mirror.js', 'dev-watch.js'];
const IGNORE = /(^|\/)(node_modules|\.git|demos\/speech)(\/|$)|\.svg$|~$|\.sw[a-z]$|\.DS_Store$/;

const QUIET_MS = 150;      // wait for an editor to finish writing before acting

// Regenerate one module's panels, in this process. A cache-busting query is required: import() keeps
// modules by URL, so without it the second edit of a layout would re-render the first edit's data.
async function regenerate(root, layoutFile, say) {
  const bust = '?t=' + Date.now();
  const dir = path.dirname(layoutFile);
  const { renderPanel } = await import(pathToFileURL(path.join(root, 'panel/render.js')).href + bust);
  const layout = (await import(pathToFileURL(layoutFile).href + bust)).default;
  const ovPath = path.join(dir, 'panel.overrides.json');
  if (fs.existsSync(ovPath)) {
    const { applyOverrides } = await import(pathToFileURL(path.join(root, 'panel/overrides.js')).href + bust);
    applyOverrides(layout, JSON.parse(fs.readFileSync(ovPath, 'utf8')));
  }
  fs.writeFileSync(path.join(dir, 'panel.svg'), renderPanel(layout, false));
  fs.writeFileSync(path.join(dir, 'panel.dark.svg'), renderPanel(layout, true));
  say('regenerated ' + path.basename(dir) + ' panels');
}

// Every module that has a layout to regenerate from.
function listLayouts(root) {
  const dir = path.join(root, 'modules');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .map((m) => path.join(dir, m, 'panel.layout.js'))
    .filter((f) => fs.existsSync(f));
}

function start(root, onReload, log) {
  const say = log || ((m) => console.log('[dev] ' + m));
  let timer = null;
  const pending = new Set();

  const describe = (files) => {
    const names = files.map((f) => path.relative(root, f));
    return names.length === 1 ? names[0] : names[0] + ' and ' + (names.length - 1) + ' more';
  };

  const flush = async () => {
    timer = null;
    const files = [...pending];
    pending.clear();
    if (!files.length) return;

    if (files.some((f) => NEEDS_RESTART.includes(path.relative(root, f)))) {
      say('main process changed — quit and run npm run dev again for that one');
      return;
    }

    // EVERY panel depends on the shared drawing code, so a change there has to regenerate all of
    // them, not just the module you happen to be editing. Without this, changing a knob's colour in
    // panel/primitives.js reloaded the window against the panels as they were BEFORE the change —
    // which looks exactly like the change not having worked, and cost an afternoon once.
    const shared = files.some((f) => /^panel[\\/].+\.js$/.test(path.relative(root, f)));
    const layouts = shared
      ? listLayouts(root)
      : files.filter((x) => x.endsWith('panel.layout.js'));
    if (shared && layouts.length) say('shared panel code changed — regenerating all ' + layouts.length + ' panels');
    for (const f of layouts) {
      try { await regenerate(root, f, say); }
      catch (e) { say('could not regenerate ' + path.relative(root, f) + ' — ' + e.message); }
    }
    onReload(describe(files));
  };

  const touched = (file) => {
    if (!file || IGNORE.test(file)) return;
    pending.add(file);
    clearTimeout(timer);
    timer = setTimeout(() => { flush().catch((e) => say('watch error — ' + e.message)); }, QUIET_MS);
  };

  let watched = 0;
  for (const rel of WATCH) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) { say('not watching ' + rel + ' (missing)'); continue; }
    const dir = fs.statSync(full).isDirectory();
    try {
      fs.watch(full, { recursive: dir }, (_e, name) => touched(dir ? path.join(full, name || '') : full));
      watched++;
    } catch (e) {
      say('could not watch ' + rel + ' — ' + e.message);
    }
  }
  say('watching ' + watched + ' paths — save a file and the window reloads');
}

module.exports = { start };
