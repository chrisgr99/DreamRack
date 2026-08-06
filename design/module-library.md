# The module library — design

A visual chooser: right-click empty rack background and pick a module by looking at it, rather than by
reading its name in a submenu. Built because the module set is about to triple, and a list of
twenty-five names is a worse way to find a filter than a wall of faceplates is.

## What you see

A floating window titled **Library**, with ordinary window furniture — drag it by the title bar, close
it with the X, and it remembers where you left it. It opens centred the first time.

Three regions: a search field across the top, a column of category checkboxes down the left, and the
thumbnail grid filling the rest.

**Thumbnails are the modules' own `panel.svg` files.** Not a second set of artwork — the same file the
rack loads. A panel that changes shows its change here as soon as the panels are regenerated, and
there is nothing to keep in step.

**Sized so the lines survive.** A stroke thinner than one device pixel cannot be drawn as one: the
browser spreads it across two and dims both, and the whole panel goes faint. The rack draws modules at
about 3.37 px/mm. The first thumbnails were 1.32, where a 0.355mm section rule lands at 0.47px and is
painted at half strength — which looked like an eyesight problem and was arithmetic. The sizes are now
230 / 300 / 365 / 433 px, and the default of 365 (2.84 px/mm) puts the frame, the section rules and the
knob pointers all at a whole pixel or more. 433 is exactly the size a module draws in the rack. The
finest hairlines — a lamp outline at 0.2366mm — stay under a pixel even at rack size, so they are not
what to size for.

**Uniform height, natural width.** Faceplates are all one rack row tall and differ only in width, from
3 HP to 34 HP. Scaling them to a common height keeps those widths true, so the grid tells you that the
Complex Oscillator takes four times the space of the Octave shifter. Fixed-width cards would have
smeared the wide modules, padded the narrow ones, and thrown that information away. Four sizes,
remembered.

## Getting there, and where the module lands

- **Right-click on empty rack background** opens it. That gesture used to open the application menu;
  the menu is still on the bar and under the title-bar hamburgers, and this is worth more.
- **Left-click on empty rack background** dismisses the library, or any open menu, and does nothing
  else. It must stay that way: clicking empty space is how you let go of a carried cable.
- **Rack ▸ Add module** is unchanged, for anyone who looks in menus.

There is deliberately **no Library entry on the menu bar**. It was designed and then dropped: two
gestures are enough, and a bar title that opens a window instead of dropping a menu behaves unlike its
neighbours.

**Placement.** The chosen module goes in the row you right-clicked, then slides left until it butts
against whatever is already there — the right-hand edge of the nearest module left of the cursor, or
the start of the row. No gap in front of it and no manual nudging. A row with no space left simply
extends past the window edge, which costs some horizontal scrolling and is assumed to be a thing you
would not choose. Opened without a click point, it falls back to the end of the emptiest row.

## Categories

Declared per module as `category` in the descriptor, so a module's grouping lives with the rest of its
truth. Anything with no category falls into Utility rather than disappearing.

    source · processor · modulation · sequencing · utility · video

Search and the checkboxes combine: matching modules, in the categories still ticked. Choices are
remembered. There are no page restrictions — a video module may be placed on any tab, and if you put a
Video Output on an audio page then video is processed and output there. Unusual, not prevented.

## Performance

This is the part that decided the implementation, because the same problem made the tutorial scroll
badly.

A faceplate is several hundred SVG shapes — every knob is circles, a pointer, tick marks and a label.
Inlined, twenty-five of them is north of twenty thousand live page elements to lay out and hit-test.

An `<img>` fixes the element count but not the drawing cost: an SVG image is re-drawn by the browser
for each region that scrolls into view, so a grid of them hesitates as you scroll. Each thumbnail is
therefore **painted once into a canvas** and displayed as that. A canvas is a flat bitmap; scrolling
it is pure compositing. The raster happens on open, on a theme change and on a size change — never
per frame. The canvas also performs the crop, drawing the panel at an offset so the 3U mounting
margins fall outside the box.

Three supporting rules: the window is **built once and hidden**, not rebuilt per open; searching and
filtering **hide cards** rather than reconstructing the grid; and the source images are fetched and
decoded up front rather than lazily — lazy loading is right for a page of photographs and wrong for
fifteen small drawings, where it means each one is fetched AND rasterised at the moment it scrolls
into view.

Measured: first open 19ms, subsequent opens 3ms, 14 image elements, whole page 7,030 elements.
