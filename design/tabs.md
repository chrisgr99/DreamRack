# Tabs — specification

One rack is one long room. Everything lives in it: the voice you are building, the video
chain, the mixer, the clock. Finding anything means travelling, and under screen
magnification travelling is most of the work.

**Tabs divide the room into pages.** Each page holds a group of modules — a voice, the
video chain, the output section — and signals cross between pages through ports carried on
the tabs themselves. Nothing about the sound changes. What changes is how much of the rack
you have to hold in view at once.

## 1. A tab is a view concept

**The audio graph, the video graph and the patch file do not know that tabs exist.** A tab
decides where a module is *drawn*, and nothing else.

This is the load-bearing rule of the whole feature. Hold it and a cable crossing tabs is
not a new kind of connection at all — it is an ordinary edge whose far end happens to be
drawn on another page, and `patchbay.js`, `video-engine.js` and `patch-io.js` need no new
concepts. Break it, and every question downstream gets harder: a tab would own an output,
the video engine's terminal search would need to be per-page, and the patch file would
grow a second structure describing the same graph.

The one place tabs touch the model is module membership: each module records which tab it
is drawn on. That is a coordinate, like its position in a row.

### The consequence worth accepting deliberately

Because the mixer takes a channel per tab (§5), **dragging a module from one tab to
another is a routing change, not just a visual one.** That follows directly from the
automatic channel and cannot be avoided while keeping it. It is a fair price; it should
not be a surprise.

## 2. The tab bar

The bar sits to the right of the menu bar, sharing its row. The menu bar's height is
already spent, so a tab may grow to that height before it costs any vertical space at all.

### Names

Lettered tabs — **A, B, C, D, E** — plus two permanent named tabs, **Video** and
**Output**.

Most tabs cannot be honestly named. A voice's character changes every few minutes while
you patch, so a descriptive name is stale almost immediately. A letter never lies.

Numbers are avoided because a synth is already full of numbered things, and the mixer is
about to be full of numbered channels. Tab three and channel three would look like they
correspond, and they would not — Video and Output have no channel, so the two numberings
drift apart the moment anything is added. Voice C and channel three are visibly different
kinds of thing, which is exactly what they are.

**The letter is the identity.** An optional nickname may sit alongside it for a tab that
genuinely is one thing, but the letter is what ports pair by and what the patch file
refers to, so retitling a tab never moves anything.

### Order

Video and Output are pinned to the right end, keeping the letters as one contiguous run
and making the bar read left to right as the signal path: voices, then video, then out.
They are also the two tabs that never move, so their positions stay memorable.

The lettered tabs may be reordered. Since the direction a cable runs carries information
(§4), reordering visibly reroutes every crossing — tabs get arranged to keep the runs
clean, the way modules already are.

### Count

Kept small: about five letters plus Video and Output.

This is not tidiness. **The visualisation depends on every tab being visible at once.** A
cable pointing toward a tab only means something if the tab is on screen; the moment the
bar can scroll or overflow into a menu, a cable can point at nothing. Capping the count
removes tab scrolling, overflow menus, and the whole class of problems that follow.

### Colour

Each lettered tab carries an identifying colour, dark and desaturated. Colour is doing two
jobs in the same square inch — domain on the jacks, identity on the tab — so the tab
colour must recede and let the jacks stay the brightest thing in it. The same rule the
faceplates already follow.

Colour never replaces the letter. It fails for anyone who cannot separate the hues, and it
cannot be spoken aloud or written in the tutorial.

### Keyboard

Command-one through command-seven select by **position**, as browser tabs do — so the
shortcut works whatever a tab is called, and naming and keyboard access stay independent
decisions.

## 3. Ports

A tab carries jacks. **They look exactly like the jacks on any module**: same domain
colour, same input and output symbolism, same size.

That is not consistency for its own sake. It is what makes the flip below readable — if a
tab port had its own visual language, seeing it as an input on one page and an output on
another would be a new rule to learn. Being an ordinary jack, it is simply what a jack
looks like from the other side.

### Publish and subscribe

A tab's port is not a destination — it is a **publication**. A signal published on tab B
can be taken from A, from C, and from the mixer at once. One source, tapped from anywhere,
which is what a banana multiple does on hardware.

Fan-out therefore costs nothing: a voice feeding the mixer, a sidechain and a video
modulator is one publication and three taps, not three cables competing for one tab.

### The flip

**Every port reverses when you cross the wall.** A publish port is an input on its own tab
— you patch into it to send — and an output on every other tab, where you patch from it to
take.

Receive ports exist too, with the polarity reversed, and their direction is fixed when
they are created. Publish ports alone would be sufficient — anything can be routed by
publishing at the source and taking at the destination — but keeping both means you never
have to change tabs to make a connection, whichever end you happen to be standing at. That
travel is most of what the feature exists to avoid.

A tab is a **portal**: a way in from outside, a way out from inside. There is nothing to
learn beyond that.

### Creating ports

Every tab has **one port by default**, its main output. That covers the common case with
no decision at all, and it is what the mixer subscribes to (§5).

Further ports are added by **right-clicking the tab**, and removed the same way. Ports are
never created automatically by dragging a cable near a tab: automatic creation that
persists leaves litter to clean up later, and creation that vanishes when the cable is
pulled makes a port's position depend on whether it is occupied — which destroys the one
thing that makes the flip legible (below).

Two or three ports on a tab should be plenty.

### Ports are identified by position

Occupied ports never renumber, so the second port on a tab is the second port from both
sides of the wall. Two signals running from A to B are port one and port two on both
views.

This is what lets a signal be followed through a portal with no annotation at all. It is
also why ports from connections invisible on the current page are still drawn, occupied
but stubbed: hiding them would give a tab a different number of ports depending on where
you stand, and a port's position would stop identifying it.

### Domain typing through the portal

A tab port cannot declare its domain in advance — it takes the type of whatever occupies
it. The legality rule runs end to end through the portal: plug rgb in at A and the B side
is an rgb source, and will not connect to a luma input. The existing rule, applied across
the gap rather than at a jack.

## 4. Cables that cross

**A crossing cable is drawn running to the tab itself**, in the tab bar — not to a gutter
or a docking lane elsewhere in the window. The tab is the destination, so the tab is where
the cable should end.

The direction of the run is information. A cable heading up and to the right is going
somewhere different from one heading up and to the left, and with every tab visible at
once (§2) that reading is reliable.

Following a cable is done with the view: pan up along it, click the tab it lands on, and
follow it back down to the module it reaches. No labels, no tags — text at the endpoint
costs more to read than the cable costs to follow.

Cables keep their **domain colour** — audio, control, luma, rgb — like any other cable.
Nothing about crossing a tab changes what kind of signal it is.

### Detaching

The existing rule is unchanged: grab the end and move away in the cable's direction. A
crossing cable comes off in your hand as a live end that can be dropped anywhere,
including on a different tab.

Because each crossing occupies its own port, there is never any ambiguity about which one
was grabbed. And the cable running to the tab is a far larger target than the port it
lands on, so the port only has to be big enough to see and to drop onto — not to grab
precisely.

### Rendering note

A crossing cable is anchored at one end to scrolling rack content and at the other to the
tab bar, which does not scroll. Its shape therefore changes as the rack is panned, always
pointing at its tab. It cannot be drawn purely in rack coordinates; it lives in a layer
spanning both spaces.

## 5. The mixer, and the Output tab

The mixer does not know about tabs. **It knows about publish ports**, and the interface
guarantees one per tab and labels the channel with the tab's letter. The engine stays
flat.

Nothing is summed implicitly. A tab's default port is fed by an ordinary short cable from
whatever ends the chain — usually a VCA — so what leaves a tab is always visible and
always chosen. Summing "everything unpatched" would sweep control voltages into the audio
path and produce a mix full of thumps for no visible reason.

This removes the dullest crossings in the patch. Every voice tab would otherwise run the
same cable to the mixer, N runs carrying no information at all.

### Not every tab has a channel

It is a channel **per publish port carrying audio**, not per tab. Video's output goes to
Video Output, not the mixer. Output *is* the mixer. A tab holding only clock and modulation
produces no audio. The channel list is dynamic and sometimes sparse.

### More than one output per tab

A voice wanting a main out and an aux send to a reverb needs two publish ports. Allowed,
with one as the default, and the mixer groups them under the tab's letter — so the clean
one-to-one holds in the common case without walling off the first thing that breaks it.

### The channel strip is a table of contents

The mixer and the tab bar become two views of one list. This makes tab identity
load-bearing, which is why the letter and not the nickname is what a channel is named by.

### The Output tab

Holds the mixer, master processing, and the output module — which is **separate from the
mixer**. They do different jobs, and separating them opens the space between them for
master effects, which currently has nowhere to live. It also leaves the master enable
owned by a small single-purpose module, the right shape for something that guards against
runaway sound.

## 6. Muting

Each mixer channel has a mute, and **the same state appears as a button on the tab
itself**. One state, two faces — not two mute systems that can disagree.

That gives the thing the Output tab would otherwise cost: silencing a voice, or the
master, without leaving the page you are working on.

**Mute means the audio channel, not the tab.** A voice tab also sending modulation to
another tab keeps sending it while muted. That matches hardware and is far less surprising
than a mute that silently stops a filter sweeping somewhere else.

## 7. What tabs are not

**Tabs are not polyphony.** A tab is spatial, author-time, arbitrary, one instance each; a
voice in the polyphonic sense is runtime multiplicity — N copies of one graph differing
only in what note they play. Building the second out of the first would mean either
hand-editing eight identical pages, or propagating every edit across them, at which point
they are not tabs but one thing viewed through an index.

Tabs make a patch's voices *understandable* by giving each one a page. Polyphony, if it
comes, belongs on a subgraph and is a separate feature.

## 8. Layout of a tab

Three things share a tab: an area to click to select it, the letter or name, and the
ports.

**Ports go below the name, not beside it.** Tabs multiply horizontally and there is only
one bar vertically, so width is the scarce axis. Stacking costs a little of the height the
menu bar has already paid for; placing them to the right costs width that multiplies by
the number of tabs.

If the two lines still do not fit within the menu bar's height, names truncate before a
second row is added — with a colour identifying the tab and a full name on hover, a
clipped name loses little.

## 9. Open questions

- Whether a port's polarity can be changed after creation, or whether it must be removed
  and remade.
- What a crossing cable looks like from a third tab, where neither end is visible. Nothing
  is the obvious answer; the stub on the occupied port may be enough.
- Whether the Video tab's publish ports should reach the mixer at all — an rgb signal
  cannot, but a luma signal used as audio-rate modulation is not obviously wrong.
- How tab membership appears in the patch file and in the AI mirror. A tab is a natural
  unit of description and may improve both.
