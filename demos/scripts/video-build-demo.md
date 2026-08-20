# Video — building the picture

**Modules** field = coordinate-field, shapes = shapes, maths = video-maths, time = time-machine, comp = compositor, out = video-out
**Sound** on
**OpenHold** 0.4

## example Video — before colour

## page video

## set out window on

## stage full

> Made in a modular, no camera

## wait 3

## example Video — unpatched

## set out window on

## stage right

## page video

> Six video modules, nothing patched

These are the basic video modules, left to right in the order they are normally used.

## point out

> Video Output ends every chain

Video Output, at the right hand end. Every video chain finishes here. Even with no input it shows a
test pattern.

## point field

> Coordinate Field owns the space

Coordinate Field is the workhorse of the set. It owns a coordinate space, moves that space, and reads
a value out of it as brightness.

## patch field:fieldOut -> out:imageIn

> Next: field straight to the output

Patch it straight to the output, replacing the test pattern.

## choose field field radius

> Radius: distance from the centre

Radius gives distance from the centre of the frame, drawn as brightness. On its own it is a soft
gradient, so there is not much to see yet.

## point shapes

> Shapes cuts an edge out of a gradient

Shapes takes a field and keeps a slice of it. That is how you get something with an edge out of
something that is all gradient.

## repatch field:fieldOut -> shapes:shapeOut

> Move the output cable to Shapes

## patch field:fieldOut -> shapes:fieldIn

> And the field into Shapes

Three modules, two cables.

## set shapes width 0.1 over 2.5

> Width: how much of the field is kept

Narrow the width and what is left is a thin ring.

## set shapes centre 0.32 over 2.5

> Centre: where that slice sits

On a radius field, centre moves the ring in and out.

## set shapes width 0.55 over 2.5

> Open it up and the ring fills in

Open the width right up and the ring becomes a disc. One control gives you both, which is why there
is no shape switch.

## choose shapes mode above

> Keep everything above the slice

The mode switch keeps everything above the slice instead of the slice itself, which turns the same
field into an edge rather than a band.

## set shapes width 0.47 over 2

> Narrow it back for a soft band

## set shapes centre 0.11 over 2

> Set low, the edge sits near the middle

## set shapes soft 0.24 over 2

> Soft turns the cut into a gradient

Soft is what you want when the shape is going to meet something else rather than be looked at on its
own.

## point field

> Back to the field, with an edge to watch

Every one of these controls moves the space that edge is cut out of.

## set field scale 4.5 over 2.5

> Scale zooms the space out

Far enough out and there is nothing left in the frame, which is the honest thing a zoom does.

## set field scale 0.64 over 2.5

> And back in, past where we started

## set field tile 5.24 over 3

> Tile repeats the space across the frame

One shape becomes a row of them, and it costs nothing: the same field is read more than once.

## set field quantise 4.7 over 3

> Quantise steps it into bands

Bands instead of a smooth run, which is what turns a gradient into hard-edged rings.

## set field twist 0.42 over 2.5

> Twist turns it more the further out

So the bands wind round each other.

## set field rotate 0.27 over 2

> Rotate turns the whole thing

## set field polar 0.13 over 2

> Polar bends the grid — a sweep, not a switch

A little of it bends the grid without going all the way round.

## set field scroll 0.51 over 2.5

> Scroll makes it move

Half a frame a second, with nothing patched to do it. The video is running on its own now, out of two
modules and two cables.

## wait 4
