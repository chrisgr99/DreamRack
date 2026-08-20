# Video — adding colour

**Modules** field = coordinate-field, shapes = shapes, maths = video-maths, time = time-machine, comp = compositor, out = video-out, enc = encoder, chr = chroma, col = colorizer
**Sound** on
**OpenHold** 0.4

## example Video — colour

## page video

## set out window on

## stage full

> How to build this in a modular

## wait 3

## example Video — before colour

## set out window on

## stage right

## page video

> Where the video demo left off

The video page, where the earlier demo left it. A coordinate field, a shape cut out of it, and the
picture on Video Output.

## point out

> All of it monochrome so far

Everything so far is monochrome.

## point shapes:shapeOut

> Luma is one channel — the same value to R, G and B

Video modules carry luma, a single channel. A luma cable into a colour input sends the same value to
red, green and blue, which is grey.

## point col

> Colorizer: brightness reads as a place on a palette

Colorizer is the short route to colour. It reads brightness as a position along a palette.

## patch field:fieldOut -> col:imageIn

> Next: the field into the Colorizer

The field feeds it, not the shape. A gradient reaches more of a palette than an edge does.

## repatch shapes:shapeOut -> col:imageOut

> Move the output cable onto it

Move the output cable onto the Colorizer.

## choose col palette spectrum

> Try the spectrum palette

Spectrum is every hue at full saturation.

## choose col palette heat

> Now heat: black, red, orange, white

Heat runs black through red and orange to white.

## set col spread 1.4 over 3

> Spread: reach more of the palette

Spread stretches what the image covers across more of the palette. Most images use a narrow range of
brightness, so without it most of a palette is never seen.

## set col shift -0.15 over 2

> Shift: slide along it

Shift slides that window along the palette.

## set col cycle 0.4 over 6

> Cycle: turn the palette under a still picture

Cycle rotates the palette under the picture. The image has not moved; the colours have.

## set col cycle 0 over 3

> Back to the start

## point enc

> Encoder: three chains become red, green and blue

Encoder is the other route. Three separate chains become red, green and blue.

## patch field:fieldOut -> maths:aIn

> Next: the field into Video Maths

## patch shapes:shapeOut -> maths:bIn

> And the shape beside it

## choose maths op diff

> Difference: light only where they disagree

Video Maths on difference lights only where the field and the shape disagree, which is the edges.

## patch maths:outImage -> enc:rIn

> Those edges become red

The edges become red.

## patch shapes:shapeOut -> enc:gIn

> The shape itself becomes green

The shape itself becomes green.

## patch shapes:shapeOut -> time:imageIn

> Next: the shape into Time

## choose time mode trails

> Set it to trails

## patch time:imageOut -> enc:bIn

> The lagging copy becomes blue

Blue is the shape delayed. It lags the other two, so a moving shape drags a wake behind it.

## repatch col:imageOut -> enc:imageOut

> Move the output cable to the Encoder

Move the output cable to the Encoder. Three chains that differ, so the edges come out coloured. One
chain could not produce this.

## set enc gainG 0.6 over 3

> Green down

Each channel has a gain.

## set enc gainB 1.6 over 3

> Blue up

## set enc gainG 0.85 over 2

> Green back

## set enc gainB 1.15 over 2

> Balance: edges, shape, wake

Balance between edges, shape and wake.

## point chr

> Chroma: hue, saturation, level, contrast

Chroma works on a colour picture: hue, saturation, level and contrast.

## repatch out:imageIn -> chr:imageIn

> Next: insert it before the output

## patch chr:imageOut -> out:imageIn

> And out again

Insert it before the output.

## set chr hue 0.5 over 8

> Hue: turn every colour at once

Hue rotates every colour in the frame at once.

## set chr hue 0.12 over 3

> Settle on this one

## set chr sat 0 over 3

> Saturation to zero — still a picture

Saturation at zero gives the picture in grey. It drains against luminance, so the picture is still
there.

## set chr sat 1.35 over 3

> Past one, it exaggerates

Past one it exaggerates.

## set chr contrast 1.3 over 2

> A little more contrast

## point comp

> Compositor: run both routes at once

Both routes can run at once. The Compositor takes two pictures.

## repatch out:imageIn -> comp:aIn

> Next: the Encoder route into A

The encoder route into A.

## patch col:imageOut -> comp:bIn

> The Colorizer into B

The Colorizer, still set to heat, into B.

## patch comp:imageOut -> out:imageIn

> Compositor out to the output

## choose comp mode mix

> Blend: crossfade

## patch shapes:shapeOut -> comp:keyIn

> Next: the shape as the key

## set comp key 0.9 over 3

> Now the blend is decided per pixel

The shape is the key, so the crossfade is decided per pixel rather than once for the frame. The
shapes carry the palette and the encoder route fills the gaps between them.

## set comp mix 0.25 over 4

> Favour the Encoder route

Mix moves the balance between the two routes.

## set comp mix 0.75 over 4

> Favour the Colorizer route

## set comp mix 0.5 over 3

> Half and half

## set col cycle 0.6 over 10

> Leave the palette cycling

With the patch finished, the colours are the thing to move: the palette cycling under one route,

## set chr hue 0.45 over 10

> And the hue turning

and the hue turning on the other.

## wait 4
