# vendor

`strudel-dreamrack.mjs` — Strudel's engine AND its CodeMirror editor in one bundle, built from
`@strudel/core`, `@strudel/mini`, `@strudel/codemirror` and `@strudel/transpiler` (1.3.0,
AGPL-3.0-or-later).

NOT from `@strudel/web`: that package is itself a prebuilt bundle with core inside it, so bundling it
alongside `@strudel/codemirror` gives TWO copies of core and the app says so on the console. Composed
from the source packages, esbuild dedupes to one.

**One bundle, deliberately.** Two would mean two copies of Strudel's core and two module registries:
the editor's repl could not be handed our output, and the pattern objects one produced would be
strangers to the other. Bundled together, the editor and the output share a single core.

It has **no imports** — an ordinary relative import, no bundler and no import map at runtime, which is
what lets DreamRack keep its no-build-step rule and work offline.

Rebuild with esbuild when Strudel is updated:

    npm i @strudel/core @strudel/mini @strudel/codemirror @strudel/transpiler esbuild
    cat > entry.mjs <<'EOF'
    export { evalScope, repl, controls, noteToMidi, getFrequency, Pattern } from '@strudel/core';
    export * as core from '@strudel/core';
    export * as mini from '@strudel/mini';
    export { StrudelMirror } from '@strudel/codemirror';
    export { transpiler } from '@strudel/transpiler';
    EOF
    npx esbuild entry.mjs --bundle --format=esm --minify --outfile=vendor/strudel-dreamrack.mjs

---

`superdough-dreamrack.mjs` — Strudel's own sound engine (`superdough` 1.3.0, AGPL-3.0-or-later), so a
pattern can play Strudel's voices as well as the rack's. 113kB, and like the other bundle it has NO
imports: esbuild inlines its DSP worklets as `data:` URLs, so there is no worklet file to serve and
nothing to fetch before it can make a sound.

It takes the rack's own AudioContext (`setAudioContext`), so its voices and the rack's are on one
clock and one output.

Rebuild:

    npm i superdough esbuild
    npx esbuild --bundle --format=esm --minify --platform=browser \
      --outfile=vendor/superdough-dreamrack.mjs superdough

SAMPLES ARE NOT BUNDLED. `samples()` fetches a pack when a pattern asks for one; a kit dropped into
`vendor/samples/` is loaded from disk instead, which is what makes the desktop build work offline.
