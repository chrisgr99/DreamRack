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

### The output window
A second window — a BrowserWindow under Electron, a popup with a transferred
OffscreenCanvas in the browser — carrying nothing but the canvas. Movable to another
monitor, resizable, and remembering its size and position the way the main window does.

**No sync generation and no genlock.** We are drawing frames, not producing a video
signal. A large part of the hardware world's complexity does not apply.

## 3. The module set

Each module's domain is given, because the split decides the shape of the set: the
processing is monochrome, and colour happens at two specific places.

### First set — enough to be worth using
1. **Video Output** · rgb in. Owns the window and the final image. Terminal module, one
   per rack, like the Mixer. Inputs: the image, plus a background colour.
2. **Coordinate warp** · luma. Emits a transformed coordinate space: translate, rotate,
   scale, polarise, twist, mirror, tile. CV over every one. The workhorse.
3. **Shapes** · luma. Thresholds and window comparators over a coordinate input — bars,
   rectangles, discs, rings, wedges — with CV over position, size and edge softness.
4. **Video oscillator** · luma out. Per-pixel high-frequency source with CV over
   frequency, shape and phase. The origin of texture, moiré and interference.
5. **Video maths** · luma. Multiply, ring-modulate, difference, min, max, mix. Nearly
   free to build and combinatorially enormous.
6. **Encoder** · three luma in, rgb out. The bridge to colour, and the one that gives the
   patched look: three independently processed monochrome chains become red, green and
   blue. With CV over each channel's gain.
7. **Decoder** · rgb in, three luma out. The way back, and the only sanctioned route from
   colour to monochrome — the connection rules deny it silently precisely so this module
   is where the choice gets made.
8. **Colorizer** · luma in, rgb out. A different job from the encoder: one channel mapped
   through a palette, with CV over palette position and rotation. The quick route to
   colour when three chains are more than the patch needs.

### Second set — where it gets strange
9. **Frame feedback** · luma or rgb. Last frame, affinely or polar-transformed, blended
   under the new frame. This single module produces the tunnelling, blooming, recursive
   imagery that people build whole instruments around. Ping-pong framebuffers; the
   one-frame delay is the effect, not a defect.
10. **Keyer / compositor** · rgb. Luma and chroma keys, soft keys, layer blending.
11. **Scan processor** · luma. Rutt/Etra style geometric displacement driven by an
    input's brightness.
12. **External source** · rgb out. Camera or a still image as a texture input.
13. **Image to CV** · luma or rgb in, control out. Average, movable probe, and centroid
    X/Y — the loop back to the audio side. See section 4.

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
2. **Does the video graph allow cycles anywhere, or only through the feedback module?**
   Allowing them everywhere is more modular and makes every cable a potential feedback
   path; restricting them to one module is far easier to reason about and to draw.
3. **What happens to a video patch on save/load?** Video edges are ordinary graph edges
   and should serialise like any other, but the framebuffer state does not — a restored
   feedback patch starts from black.
4. **The exact white for luma jacks**, per section 2 — a tuning job at implementation,
   not a design decision.

## 8. Build sequence

Phases, in the sense the sequencer used them — each ends somewhere you can see whether
the idea is working.

### Phase 0 — Spike, outside the rack
A standalone page: a window, a WebGL2 context, two hard-coded passes with the second
sampling the first, driven by fake uniforms. No rack integration. **Checkpoint:** a
moving image on screen and a measured frame time for twenty passes at 1080p, so
question 1 is answered before anything is designed around the answer.

### Phase 1 — The domains and one module
Both `luma` and `rgb` domains, the patchbay's logical-edge handling and its connection
rules, the video engine, the output window, and **Video Output** alone showing a test
pattern with CV over one parameter. Both domains land here even though only `rgb` is
used yet — retrofitting a second domain after modules exist means revisiting every
descriptor and every jack.
**Checkpoint:** a cable from an LFO visibly moves something in a separate window that
can be dragged to another monitor.

### Phase 2 — A patchable monochrome chain
Coordinate warp, Shapes and Video maths — all luma — plus **Colorizer** to reach the rgb
input of Video Output. Video cables between modules become real and the topological sort
earns its keep. **Checkpoint:** three luma modules in series produce an image none of
them could alone.

### Phase 3 — Three chains and real colour
Video oscillator, **Encoder** and **Decoder**. This is where the two-domain split pays
off: three independently processed monochrome chains driving red, green and blue.
**Checkpoint:** the same shape patched through three chains with different warps per
channel, giving colour fringing that a single RGB chain cannot produce — and moiré
responding to a CV sweep.

### Phase 4 — Feedback
Frame feedback with its transform. **Checkpoint:** the tunnel.

### Phase 5 — Closing the loop
**Image to CV**: the GPU-side reduction, the once-per-frame readback, and the average,
probe and centroid outputs. **Checkpoint:** a shape drifting across the frame moves an
oscillator's pitch — the image playing the synth that is drawing it.

### Phase 6 — Capture
`captureStream` into `MediaRecorder`, with framing options and the patch audio as the
soundtrack. **Checkpoint:** a shareable clip written to a file.
