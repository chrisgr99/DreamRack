# Video — shapes and structure

**Modules** field = coordinate-field, poly = polygon, maths = video-maths, sym = symmetry, grid = grid, col = colorizer, chr = chroma, out = video-out
**Patch** Video — shapes and structure
**Screen** full
**Page** video
**Sound** on
**Pace** brisk
**OpenHold** 0.4

## title How to build this in a video synthesizer

How to build this in a video synthesizer.

## wait 1

## example Video — shapes, unpatched

## stage off

## say

> Eight modules, and no connections yet

We will use eight modules, left to right in the order they are used, and no connections yet.

## point field

> Coordinate Field

The Coordinate Field,

## point poly

> Polygon

the Polygon,

## point maths

> Video Maths

Video Maths,

## point sym

> Symmetry

Symmetry,

## point grid

> Grid

the Grid,

## point col

> Colorizer

the Colorizer,

## point chr

> Chroma

Chroma,

## point out

> Video Output

and the Video Output.

## point field

> Next: Coordinate Field — the space everything is drawn in

The Coordinate Field provides the space. It decides where everything is, and warps that space before
anything is drawn in it.

## point maths

> And Video Maths — where two pictures meet

Video Maths meets two pictures against each other: multiply, difference, or the brighter of the two.

## patch field:fieldOut -> maths:aIn

> The field into A

## patch maths:outImage -> out:imageIn

> Out to Video Output, which ends every chain — now there is a picture

## stage below

## choose field field angle

## set field quantise 11.5 over 1

## point poly

> Next: Polygon — a shape with corners

The Polygon draws an actual shape — sides, size, a star control — rather than cutting a slice out of
a gradient.

## patch poly:shapeOut -> maths:bIn

> The Polygon into B

## choose maths op max

> MAX keeps the brighter of the two

## set poly sides 6 over 1

## set poly star 0.4 over 1

## set poly size 0.83 over 1

## set poly outline 0.07 over 1

## set maths amount 0.63 over 1

## set field twist 1.47 over 1

## set field polar 0.54 over 1

## set field tile 1.43 over 1

## set field scroll 0.2 over 1

> Scroll — the only thing moving in this patch

## point sym

> Next: Symmetry — folds the frame about its centre

Symmetry folds the frame into sectors, which is what turns a drifting texture into a figure.

## repatch out:imageIn -> sym:imageIn

> Move the output cable into Symmetry

## patch sym:imageOut -> out:imageIn

> And Symmetry to the screen

## set sym sectors 5.74 over 1

## choose sym mode repeat

## set sym rotate -0.93 over 1

## set sym spread 0.78 over 1

## point grid

> Next: Grid — repeats it into cells

The Grid repeats what it is given into rows and columns, with gaps between them.

## repatch out:imageIn -> grid:imageIn

> The same again: the cable into the Grid

## patch grid:imageOut -> out:imageIn

## set grid cols 4.34 over 1

## set grid rows 2.22 over 1

## set grid brick 0.36 over 1

## set grid vary 0.99 over 1

## point col

> Next: Colorizer — brightness becomes colour

The Colorizer reads brightness as a position along a palette. Everything before it is monochrome.

## repatch out:imageIn -> col:imageIn

> Here comes the colour

## patch col:imageOut -> out:imageIn

## set col spread 1.58 over 1

## set col shift 0.5 over 1

## set col cycle 0.17 over 1

## point chr

> Next: Chroma — hue, saturation, contrast

Chroma works on the colour picture: turning every hue at once, draining or lifting the saturation,
hardening the contrast.

## repatch out:imageIn -> chr:imageIn

> Chroma last, before the output

## patch chr:imageOut -> out:imageIn

## set chr hue 0.96 over 1

## set chr sat 0.18 over 1

## set chr contrast 1.55 over 1

## set chr level 1.13 over 1

## wait 5
