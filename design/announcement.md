# DreamRack — forum announcement

Reusable draft of the public announcement post. Written for forum markdown
(Discourse and similar). Paste the body below into a new topic, attach the
screenshot, and replace the sign-off with your name.

**Before posting, check:**

- The sign-off line carries your name (and a role or site line if you want one).
- The screenshot is attached, and the media paragraph still describes it accurately.
- The module list, the requirements, and the "on the list" features still match
  what actually ships.
- Both links resolve.

Structure follows the forum's product-announcement convention: greeting, media,
features, requirements, price and availability, links, sign-off.

---

## Title

Introducing DreamRack — a modular synthesizer with many unique features, that runs in your browser

## Body

Hello all,

I've long wanted a particular kind of software modular synth: one that does more to help me build and understand patches — showing what feeds what, letting me see or hear the signal at any terminal without rewiring, working with less wrist strain, and making efficient use of precious screen space. Since I couldn't find it, I started building it — the modular of my dreams, thus my DreamRack. I'm pleased with how it's turning out, so I decided to share it.

It runs in a browser with nothing to install. The initial modules lean West Coast — Buchla and Serge flavoured — which is where my own interest lies, but nothing in the architecture ties it to that style: modules of any kind drop in as plug-ins. I intend to explore all types, adding them as my own interest leads and as people ask for them.

The screenshot attached below shows a patch mid-flight. Three oscilloscopes are clipped onto terminals, each with a line back to the point it is watching — a green frame means running, red means frozen for a closer look. Two monitors are listening at outputs, one live and one muted. The readout gives the frequency at a terminal. Cables take the colour of the terminal they plug into, so you can read a patch at a glance.

**What's in it**

- **Four modules to start:** a Complex Oscillator (two oscillators, cross-modulation, wavefolding), a Quad Low Pass Gate with its own clock, a Quad Function Generator, and a six-channel Mixer with independent master and monitor buses.
- **See what affects what.** Point at any module and the whole signal chain it belongs to lights up, so you can read what feeds it and what it feeds without tracing cables by eye. The cables show their direction of flow too, so you can see which way a signal is running at a glance.
- **Hear any point in the circuit** without rewiring — hover a terminal to audition it, or drop a monitor that stays live and runs on its own bus, separate from your mix.
- **See any point too.** Clip-on oscilloscopes, as many at once as you like, auto-scaling and auto-triggering, with a freeze button for signals too complex to hold still. Each also reports frequency, level range and DC offset.
- **The knAck** — a new space-saving control type that combines a knob and its CV input in one place: you plug the cable straight into the middle of the knob, rather than giving the parameter a knob and a separate jack beside it. A knAck can also include an attenuverter without taking any more space.
- **Very little dragging.** Knobs turn with the scroll wheel — coarse at the centre, fine at the rim — and patching is click to grab, click to drop, with no button held down.
- **A tutorial that points at things.** Click the eye symbol beside any instruction and the tutorial rings that exact control on your rack and draws a line to it.
- **Open to new modules.** Each is a self-contained folder of plain JavaScript that drops in with no build step and no separate tooling, and there's a visual editor for drawing the faceplates.

**Requirements**

It runs in any modern browser — Chrome, Edge, Firefox or Safari — with nothing to install. Saving patches as named files uses the browser's File System Access feature, which today means Chrome or Edge. In other browsers everything else works the same and your session is remembered and restored when you come back; you just can't export separate named versions.

A desktop version built on Electron is fully working and can be run from source today. A packaged, signed download will follow once the build settles down. Windows and Linux desktop builds are possible too, since Electron is cross-platform, but for now the browser is the easiest route on those.

It isn't a plugin — there is no VST or AU version, and it doesn't run inside a DAW.

One caveat: turn off any page-recolouring extension such as Dark Reader for the site. DreamRack has its own light and dark modes, and those extensions distort the panels.

**Price and availability**

Free. The source is on GitHub, for non-commercial use with attribution.

It's in alpha, and this is the first time it has been public at all — if you try it, you'll be among the first people to use it other than me. So expect rough edges, and things that may need tweaking. 😅 It plays a single voice today; polyphony, input from external sequencers and hosts, and a way to inject test signals into any jack are all on the list.

Even if you have used software modulars before, do run through the interactive tutorial — there are quite a few things here that are new, and it takes you through them one at a time.

**Links**

- Try it now: https://dreamrack.dreamerdevelopment.app/
- Source, README and discussion: https://github.com/chrisgr99/DreamRack
- My projects on GitHub: https://github.com/chrisgr99

Thanks for reading, and I'd genuinely like to hear what you think — especially which modules you'd want next.

[YOUR NAME]
