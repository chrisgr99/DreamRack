# Video synthesis — specification

Status: design specification. NOT implemented.

A set of rack modules that take CV from the rest of the patch and generate moving
image — ramps, shapes, texture, layering, feedback — drawn into a window that can be
moved to a second monitor. The patch is the instrument; the image is another output of
it, alongside sound.

Two reasons this earns its place. It is a **differentiator**: browser modulars are not
rare, browser modulars that also synthesise video are. And it is **shareable** — a
short clip of a patch making moving image travels in a way that a screenshot of knobs
does not.

Lineage: the Rutt/Etra Scan Processor, Dan Sandin's Image Processor, and LZX
Industries' Eurorack ecosystem, whose module vocabulary — ramps, shapes, keyers,
colorizers, video oscillators, frame buffers — this follows.

## 1. Design stance

**The signals are the image.** In an analog video synth a voltage stream is scanned
into two dimensions by the raster, so a "video signal" is audio at a few megahertz.
The browser equivalent is a **fragment shader**: a program evaluated per pixel that
already knows its own coordinates. The horizontal and vertical ramps that everything
in that world is built from *are* the shader's x and y. The whole vocabulary maps
across almost one-to-one — shapes are thresholds, keyers are mixes, colorizers are
palette lookups.

**Complexity lives in the patch**, as everywhere else in DreamRack. Modules stay small
and combinable; nothing grows a mode menu.

**Coordinate transformation matters more than shape generation.** Warping the space —
rotate, scale, polarise, twist — and then drawing something simple in it produces far
more than an elaborate shape generator drawing in a flat space. The warp module is the
highest-value item in the set, not the shape module.

### The rate rule — the law this whole design obeys

CV runs at 48 kHz. A display runs at 60 Hz. Anything patched from the audio graph is
therefore **sampled once per frame**, and a 100 Hz LFO driving a position will not look
like 100 Hz motion — it will alias into a slow wobble or stand still.

Analog systems escape this because their oscillators genuinely change thousands of
times *within* one scan line, which is what produces fine texture and moiré.

So the division is absolute:

- **Rack CV supplies PARAMETERS** — position, size, rotation, colour, frequency,
  blend amount — read once per frame.
- **Video-rate signals are generated INSIDE the shader**, per pixel, and never leave
  the GPU.

A video oscillator is therefore a video module with a *frequency* CV input, not
something you patch an audio oscillator into. Get this wrong and the result is a
slideshow.

#### Audio rate does have one route in: as a texture

The rule above forbids audio-rate CV from reaching a *parameter*. It does not forbid
audio-rate signal from reaching the image — it just has to arrive as DATA rather than as
a knob position. One frame's worth of samples uploaded as a one-dimensional texture, read
by the shader along a coordinate, gives genuine audio-rate variation ACROSS the frame:
a 200 Hz waveform becomes two hundred cycles of structure between one edge and the other.

This is the honest equivalent of what analog gets from an oscillator changing thousands
of times within a scan line, and it is the only mechanism in the design that produces
fine texture from the audio patch rather than from a shader's own maths. A module taking
an audio-domain input and emitting luma — the waveform read as a field — is the natural
home for it.

#### Sync by phase, not by edges

A clock resetting a video oscillator is the obvious patch, and doing it by detecting the
pulse's edge is the obvious implementation. It is also the wrong one: the edge happens in
the audio thread and the video sees it at the next frame boundary, so every reset lands
with up to 17 ms of jitter, which reads as sloppiness at any real tempo.

Sample the clock's rising PHASE instead. A phase that climbs from zero to one over each
beat is correct whenever it is read, so a per-frame sample is exact rather than late, and
the video is locked to the beat's position rather than to its edge. Modules therefore
expose *phase* inputs where the hardware idiom would suggest a reset input.

## 2. Architecture

### Multi-pass render-to-texture
Each video module is **one fragment shader rendering into its own framebuffer**. A
video cable is "module X's output texture becomes module Y's input sampler". The graph
is topologically sorted and evaluated once per frame.

This is chosen over compiling the whole patch into a single shader. The single-shader
approach is faster and needs no framebuffers, but it requires a code generator and
**cannot express cycles at all**. Under multi-pass a cycle simply reads the previous
frame's texture — which is exactly what analog video feedback does, and is where the
best imagery comes from. The architecture that is simpler to build is also the one
that gives the wild results.

Cost is one full-screen pass per module. At 1080p a modern GPU is untroubled by twenty
of them.

### TWO new signal domains: luma and rgb
`DOMAINS` gains **`luma`** and **`rgb`**, beside `audio`, `control` and `trigger`, each
with its own jack colour. The host already paints jacks from their domain, so this is
mostly data.

**`luma` is a single channel; `rgb` is three.** Keeping them apart is not type pedantry —
it is the compositional idiom of the whole field. In analog video synthesis you build in
monochrome and colourise at the end, or you run **three parallel monochrome chains into
an encoder** so that red, green and blue each get their own processing. That second
pattern is where the characteristic colour comes from, and a single RGBA domain cannot
express it: with one domain you would be forced to process all three channels together,
which is precisely the thing that makes an image look computer-generated rather than
patched.

Three consequences worth having on paper:

- **Most modules are luma.** Warp, shapes, oscillator and maths all work on a single
  channel. That keeps their shaders simple and their framebuffers single-channel — about
  a quarter of the bandwidth of RGBA — so the common case is also the cheap case.
- **The encoder and decoder become first-set modules**, not optional extras. They are the
  bridge between the two domains and therefore between monochrome processing and colour.
- **A colour patch costs more cables.** Three chains where one would do. That is the
  hardware idiom and much of the interest lives there, but it is real work on screen and
  more jacks per panel.

`canConnect` rules:

| from → to | verdict |
|---|---|
| luma → luma, rgb → rgb | allow |
| control → luma, control → rgb | allow — CV driving a video parameter, the commonest cable of all |
| luma → rgb | allow, broadcasting the one channel to all three, so a monochrome chain drops into a colour input without ceremony |
| rgb → luma | **deny** — reducing three channels to one is a creative choice (which channel? weighted luminance?), so it needs the decoder module rather than a silent default |
| luma or rgb → audio, control or trigger | deny — extracting CV from an image is the image-to-CV module's job (section 4) |
| audio or trigger → luma or rgb | deny |

Jack colours: **luma is white** (it is monochrome) and **rgb is magenta**. Neither
collides with the existing yellow, orange, blue and green. The exact shade of the white
is to be tuned during implementation — a pure white risks reading as one of the light
push-button discs, so it may want lifting off pure or carrying a stronger edge, and it
has to hold up on the light face as well as the dark one.

### One context, one canvas

Every video module, every preview and the output share a SINGLE WebGL2 context. This is
not a preference: textures cannot be shared between contexts, so two contexts could not
pass an image from one module to the next at all, and browsers cap a page at around
sixteen. The engine owns the context; modules own passes within it; the output window
receives the result through a transferred `OffscreenCanvas` rather than a context of its
own.

### Render resolution is not display resolution

The engine renders at its own internal resolution and scales to the display. They are
decoupled deliberately: cost is per-pixel per-pass, so this is the one dial that trades
quality for headroom, and it is the honest way to degrade under load (question 1) rather
than stuttering. It defaults BELOW native — the aesthetic tolerates it, and feedback
positively benefits, since a softer buffer is what makes trails bloom rather than alias.

### Video edges are logical, not audio-graph
This is the one genuinely new idea. A luma or rgb cable connects two shader passes; it
wires no AudioNode. The patchbay records the edge, draws the cable, and reports it to the
video engine — and skips the Web Audio connection it would make for any other domain.

### Contract additions
Optional methods on a realized instance, following the pattern already set by
`onReadout(cb)` and `resetState()`: a module that does not implement them is untouched.

- `videoPass()` — returns the module's shader source and its uniform declarations.
- `getVideoInput(portId)` / `getVideoOutput(portId)` — the video equivalents of
  `getInput` / `getOutput`, returning graph handles rather than `{node, index}`.
- `videoUniforms()` — the per-frame parameter values, read from the module's params
  and its sampled CV inputs.

### The video engine
A sibling of the audio host, owning: the WebGL2 context, the framebuffer pool, the
topological sort of the video graph, the per-frame render loop, and the output window.
It is the only thing that knows about GL; modules supply shader text and uniforms and
know nothing about how they are composed.

**Render resolution is decoupled from window size**, so the window can be dragged to a
4K monitor without the patch's cost changing. Resolution is a video-engine setting, not
a per-module one.

### CV reaches video as uniforms
Video modules' control inputs are ordinary audio-domain connections, sampled once per
frame. The scopes and monitors already tap live signals through AnalyserNodes; this is
the same mechanism at a far lower rate. One tap per connected CV input, read at the top
of each frame.

### The output window — the same document, floated

The requirement is a window carrying nothing but the picture, draggable to a second
monitor, resizable, remembering its size and position the way the main window does.

What decides the mechanism is the constraint above: **textures cannot cross a WebGL
context**, and a second Electron `BrowserWindow` is a second process, so it can never
render this graph. That leaves two shapes, and they differ in where the engine lives.

The engine could live IN the output window, receiving only parameter values — pixels never
cross the boundary, and it fullscreens natively on any display. The cost is that the
window stops being optional: close it and all video stops, including the monitor probes,
whose thumbnails would have to be shipped back over IPC every frame.

**Take the other shape.** The engine stays in the main window and the floating window is a
dumb mirror, opened with the **Document Picture-in-Picture API**. That gives a real
OS-level window — always on top, resizable, draggable to another monitor — which
nonetheless belongs to the *same document and the same JS context*. So there is no IPC, no
pixel copying, no second engine, and one code path for Electron, Chrome and Edge alike.
The monitor probes stay trivial because they render in the same context, and capture
(section 5) comes off the same canvas. Close the window and the canvas returns to a pane
in the rack, so the video never stops — it just changes where it is shown.

**One risk, worth spiking in phase 0:** adopting a canvas element into another document can
drop its WebGL context. If it does, the fallback needs no new architecture — `captureStream`
from the canvas into a video element inside the PiP window, still one context and still no
IPC, at the cost of an encode step and a frame of latency. Ten minutes of phase 0 decides
which, and it is the difference between moving a DOM node and plumbing a stream.

Firefox and Safari have no Document PiP; there the picture stays in a floating pane inside
the app. Same position as file-saving: the full experience on Chromium, everything still
working elsewhere.

**Fullscreen on a projector is a different requirement** and does want a second Electron
window fed by a WebRTC loopback of the canvas stream. That is a presentation feature, not
part of the instrument, and it belongs with capture in the last phase.

**No sync generation and no genlock.** We are drawing frames, not producing a video
signal. A large part of the hardware world's complexity does not apply.

## 3. The module set

Each module's domain is given, because the split decides the shape of the set: the
processing is monochrome, and colour happens at two specific places.

### First set — enough to be worth using
1. **Video Output** · rgb in. Owns the window and the final image. Terminal module, one
   per rack, like the Mixer. Inputs: the image, plus a background colour.
2. **Coordinate warp / fields** · luma. Both halves of the same job: it EMITS a coordinate
   field and it TRANSFORMS one. The fields replace the hardware idea of horizontal and
   vertical ramp voltages, and are the design's most-used signal: X, Y, diagonal, radial,
   angle, mirrored, quantised, scrolling. The transforms are translate, rotate, scale,
   polarise, twist, mirror and tile, with CV over every one. The workhorse.
3. **Shapes** · luma. Thresholds and window comparators over a coordinate input — bars,
   rectangles, discs, rings, wedges — with CV over position, size and edge softness.
4. **Video oscillator** · luma out. Per-pixel high-frequency source with CV over
   frequency, shape and phase. The origin of texture, moiré and interference.
5. **Video maths** · luma. Multiply, ring-modulate, difference, min, max, mix. Nearly
   free to build and combinatorially enormous.
6. **Video mixer / compositor** · luma or rgb. Two images, a blend mode and a mix amount
   under CV, plus an optional third input used as a KEY so the blend is per-pixel rather
   than global. Blend modes: crossfade, add, multiply, screen, difference, lighten,
   darken, alpha-over. Distinct from video maths, which combines single channels
   arithmetically — this one composites pictures, and it is what turns a rack full of
   sources into one image. Luma and chroma keying live here too.
7. **Encoder** · three luma in, rgb out. The bridge to colour, and the one that gives the
   patched look: three independently processed monochrome chains become red, green and
   blue. With CV over each channel's gain.
8. **Decoder** · rgb in, three luma out. The way back, and the only sanctioned route from
   colour to monochrome — the connection rules deny it silently precisely so this module
   is where the choice gets made.
9. **Colorizer** · luma in, rgb out. A different job from the encoder: one channel mapped
   through a palette, with CV over palette position and rotation. The quick route to
   colour when three chains are more than the patch needs.

### Second set — where it gets strange
10. **Frame feedback** · luma or rgb. Last frame, affinely or polar-transformed, blended
   under the new frame. This single module produces the tunnelling, blooming, recursive
   imagery that people build whole instruments around. Ping-pong framebuffers; the
   one-frame delay is the effect, not a defect.
11. **Scan processor** · luma. Rutt/Etra style geometric displacement driven by an
    input's brightness.
12. **External source** · rgb out. Camera or a still image as a texture input.
13. **Image to CV** · luma or rgb in, control out. Average, movable probe, and centroid
    X/Y — the loop back to the audio side. See section 4.

### The video monitor — a probe, not a module

Rate this above any module on the list. A patch of eight video modules has one output, so
without something else you cannot see what the third module in a chain is emitting except
by unplugging the chain and routing it to the output — and the hardware answer, a wall of
monitors, is not available.

The rack already solves this for audio: clip-on oscilloscopes and ear monitors attach to
any terminal and draw a line back to the point they are watching. The video monitor is
the same object for a video jack — a small live picture of whatever that terminal is
emitting, clipped anywhere, as many at once as wanted, with the same callout line and the
same freeze button. It costs one extra small pass per monitor in a context that is already
rendering, and it reuses machinery that exists rather than inventing a preview system.

It is the difference between patching video by prediction and patching it by looking.

### Panel and control conventions

- **knAcks for three or four parameters per module, not for all of them.** Almost every
  video parameter *wants* modulation, which makes it tempting to give every knob a centre
  jack. Resist it: eight knAcks on one panel is a field of identical circles with no
  visual hierarchy, and every one of them is a cable target on a panel already crossed by
  video cables. Choose the parameters that are actually worth automating and leave the
  rest as plain knobs.
- **A knAck always means "a cable here modulates this parameter."** Video signal routing
  uses ordinary jacks. Never a knAck for an image input or output — that would make the
  same control mean two unrelated things.
- **Short fixed labels, no numeric readouts on the faceplate.** FREQ, PHASE, ANGLE, SIZE,
  HUE, SAT, MIX, FEED, ZOOM, ROT, KEY, SOFT. Exact values belong in the right-click menu
  and the inspector, not printed on the panel.
- **Video jacks must differ by more than colour.** luma is white and rgb magenta, but a
  jack that can ONLY be told apart by hue is a jack that cannot be told apart at a glance,
  under magnification, or by anyone whose colour vision differs. Give the video domains a
  distinct outline or shape as well, so the difference survives the colour being missed.

## 4. Video back to CV — in scope

An **image-to-CV** module closes the loop: the image modulates the sound that is making
it. Analog systems do this, and it is a large part of what makes the combination feel
like one instrument rather than a visualiser bolted on.

Outputs, all control-domain:

- **Average** — mean brightness over the frame.
- **Probe** — brightness at one point, whose X and Y are themselves CV inputs, so the
  sampling point can be swept. This is the video answer to the rack's existing scope and
  monitor probes, and the same idea: look at one place and report what is there.
- **Centroid X and Y** — where the brightness is concentrated. The musically useful one:
  a shape drifting across the frame becomes a pair of control voltages that follow it.

It is the only part of the design that pushes against the one-way flow, and it is the
expensive direction: a GPU readback stalls the pipeline. The rule is **never read the
full image**. Reduce on the GPU — successive downsample passes, or a mipmap chain — and
read back a handful of pixels, accepting **one frame of latency**. At 60 Hz that is
about 17 ms, which is unnoticeable for anything a video-derived CV would sensibly
control, and it is honest: the image you are measuring is the one you just saw.

The readback happens once per frame for the whole module, not once per output, so a
module with all four outputs costs the same as one with a single output.

## 5. Capture

Sharing a clip is one of the two reasons for building this, so it should not depend on
an external screen recorder the way `scripted-demo.md` does — that document captures
the whole UI, which is the wrong framing here. The output window is a canvas, so
`captureStream()` into a `MediaRecorder` gives a clean recording of the image alone, at
the render resolution, with the patch's audio as its soundtrack.

A record button on the Video Output module, writing a file. Square and vertical
framings are worth offering, because that is what the places these clips get posted
actually want.

## 6. Non-goals

- **No video signal standard.** No composite, no sync, no genlock, no interlace.
- **No timeline, no keyframes, no editing.** It is an instrument, not an animation tool.
- **No 3D scene.** Everything is per-pixel over a 2-D coordinate space. A raymarcher
  would be a different project.
- **Not a VJ application.** No clip library, no beat detection, no BPM sync.

## 7. Open questions (decide at implementation)

1. **How many video modules is realistic in one patch?** Twenty passes at 1080p is
   comfortable, but the ceiling should be measured rather than assumed, and the engine
   should degrade honestly (drop render resolution) rather than stutter.
2. **The exact white for luma jacks**, per section 2 — a tuning job at implementation,
   not a design decision.

## 8. Decided

**Cycles go through the feedback module only.** Allowing a loop on any cable would be more
modular, but it makes every cable a potential feedback path, it is hard to draw honestly,
and it means the patchbay can no longer reject cycles — a rule that currently protects the
audio graph. Frame feedback keeps its loop INTERNAL, where the one-frame delay is
explicit and the ping-pong buffers have one owner.

**A video patch saves and restores from the first phase, not the last.** Video edges are
ordinary graph edges and serialise like any other; the framebuffers do not, so a restored
feedback patch starts from black. This is deliberately not deferred: a graph that
evaporates on restart reads as broken, and retrofitting persistence after the module set
exists means revisiting every descriptor.

## 9. Build sequence

Phases, in the sense the sequencer used them — each ends somewhere you can see whether
the idea is working.

Phases 0 to 4 all serve ONE module, Video Output. Almost none of that work is the module:
it is the spine — two domains, a context, an engine, a new kind of patchbay endpoint, and a
window — and the module is the thin thing on top that proves each piece before the next
lands on it.

### Phase 0 — Spike, outside the rack
A standalone page: a WebGL2 context, two hard-coded passes with the second sampling the
first, driven by fake uniforms. No rack integration. It exists to answer three questions
before anything is designed around a guess.

**Checkpoint:** a moving image on screen, plus
1. frame time against pass count at 1080p, answering question 1 by measurement;
2. whether a single-channel R8 framebuffer is meaningfully cheaper than RGBA8, which is the
   assumption the whole luma/rgb split rests on;
3. whether a canvas keeps its WebGL context when moved into a Document Picture-in-Picture
   window — which decides whether the output is a moved DOM node or a piped stream.

Built: `spikes/video-phase0.html`. Delete it once phase 2 supersedes it.

#### Results — Apple M4, ANGLE Metal renderer, 1920×1080

**Q1, answered. Cost is linear in passes and there is a great deal of headroom.**

| passes | RGBA8 ms/frame | R8 ms/frame |
|---|---|---|
| 1 | 0.39 | 0.34 |
| 10 | 2.21 | 1.18 |
| 20 | 3.82 | 2.02 |
| 40 | 7.64 | 3.50 |
| 60 | 12.26 | 5.2 |

About **0.20 ms per RGBA8 pass** and **0.10 ms per R8 pass**, straight-line, so roughly
**80 RGBA8 or 190 R8 full-screen passes fit inside one 60 Hz frame** at 1080p. The spec's
"a modern GPU is untroubled by twenty of them" holds with a factor of four to spare. Twenty
passes cost 3.82 ms, under a quarter of the frame budget.

Consequence for the design: **pass count is not the thing to worry about.** The internal
render-resolution dial stays (it is still how to degrade on weaker hardware), but there is
no need to fuse passes, cache aggressively, or cap the module count in a first version.

**Q2, answered, and it settles the domain split on cost as well as on idiom.** R8 is a
little over **half** the cost of RGBA8 per pass — 47% cheaper at twenty passes — so the
common case, a monochrome chain, is also the cheap one, and a luma patch can be about twice
as deep as an rgb one for the same time. That is a stronger result than "keeping them apart
is the compositional idiom" needed.

**Q3, answered: the canvas SURVIVES the move.** Run in a real window, `requestWindow()`
opens and the canvas — adopted into the PiP window's document — still shows the pattern. A
lost WebGL context paints nothing at all, so an image on screen is proof the context
survived. **The moved-DOM-node route is the one to build**, and the `captureStream` fallback
is not needed: one context, no IPC, no encode, no latency.

Both of the behaviours that "survived" does not by itself prove were also confirmed by hand:
the picture keeps **animating** once moved — so the main document's render loop goes on
driving a canvas that now lives in another window — and **closing the window returns the
canvas to its pane** in the page. That is the whole of the output-window design verified
before a line of it is written, including the claim that the video never stops and only
changes where it is shown.

Inside an embedded browser view — the harness this was first attempted in —
`requestWindow()` fails with `InvalidStateError: Internal error: no window`, since there is
no OS window to attach to. Worth knowing: it means automated tests cannot cover the output
window, and that path needs a human at a real window.

#### A measurement note worth keeping

The first version of the spike timed frames around `gl.finish()` and reported **0.07 ms for
sixty 1080p passes**, which is impossible. On Apple's Metal backend through ANGLE, `finish()`
does not block until the GPU is idle, so the timing measured only the CPU cost of submitting
commands. A **one-pixel `readPixels`** is the reliable sync point: it cannot return without
real pixel data, so the driver has to complete the work first. Any future performance work
in this engine should use that, and should distrust any figure that looks too good.

### Phase 1 — Domains and jacks, with nothing rendering
The `luma` and `rgb` domains, the `canConnect` matrix, jack painting with a distinct
outline as well as a colour, and panel-editor and control-library support so a video jack
can be drawn at all. No graphics.
**Checkpoint:** a panel shows a video jack that reads as clearly different from an audio
one; a CV cable into it is allowed and an audio cable refused. The whole domain layer
verified before any GL exists.

### Phase 2 — The context and the test pattern
The rack-owned, lazily created WebGL context; one framebuffer; the test-pattern shader; the
module's descriptor, factory and faceplate; and the preview thumbnail. No window yet.
The test pattern earns its keep: bars for colour, a centre cross for framing, a gradient
for banding, and one moving element so it is visibly live.
**Checkpoint:** place the module and watch the pattern move inside a 20 mm square on its
own panel. The biggest phase, and the whole graphics spine proven with none of the
window's complexity.

### Phase 3 — The floating window
Open and close with its lamp, size and position remembered, `FRAME` and `RES`, and
whichever of the two window mechanisms phase 0 chose.
**Checkpoint:** drag it to a second monitor, resize it, switch to vertical framing, close it
and reopen it where it was.

### Phase 4 — CV reaches a uniform
A new endpoint kind for the patchbay: every target it has today is an AudioParam or a node
input, and a video parameter is neither. Per-frame sampling, `BRIGHT` as a knАck, `LIMIT`.
Persistence rides along, being small once the params exist.
**Checkpoint:** an envelope fades the image, an over-bright input cannot exceed the
ceiling, and it survives a restart.

The phase to watch is 4. The rest is conventional work; "a cable lands on a video
parameter" is a genuinely new shape, and every later video module depends on it.

### Phase 5 — A patchable monochrome chain
Coordinate warp, Shapes and Video maths — all luma — plus **Colorizer** to reach the rgb
input of Video Output. Video cables between modules become real and the topological sort
earns its keep. **Checkpoint:** three luma modules in series produce an image none of
them could alone.

### Phase 6 — Composite, and see inside the patch
**Video mixer / compositor** and the **video monitor** probe. They belong together: the
moment a patch has two sources worth combining is the moment you can no longer tell what
either of them looks like on its own. **Checkpoint:** two sources crossfaded under CV,
with a monitor clipped to each one showing what is going into the blend.

### Phase 7 — Three chains and real colour
Video oscillator, **Encoder** and **Decoder**. This is where the two-domain split pays
off: three independently processed monochrome chains driving red, green and blue.
**Checkpoint:** the same shape patched through three chains with different warps per
channel, giving colour fringing that a single RGB chain cannot produce — and moiré
responding to a CV sweep.

### Phase 8 — Feedback
Frame feedback with its transform. **Checkpoint:** the tunnel.

### Phase 9 — Closing the loop
**Image to CV**: the GPU-side reduction, the once-per-frame readback, and the average,
probe and centroid outputs. **Checkpoint:** a shape drifting across the frame moves an
oscillator's pitch — the image playing the synth that is drawing it.

### Phase 10 — Capture
`captureStream` into `MediaRecorder`, with framing options and the patch audio as the
soundtrack. The projector window belongs here too — an Electron-only second window fed by
a WebRTC loopback of the same stream, for genuine fullscreen on a second display.
**Checkpoint:** a shareable clip written to a file, and the picture filling a projector.
