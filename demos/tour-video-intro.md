# Opening statement — Tour: DreamRack video, no narration

Proposed spoken introduction for `demos/scripts/tour-video-silent.json`. Nothing is said after this;
the rest of the tour is silent.

Written for the Jamie Premium voice at 175 words per minute, which is the rate the whole demo library
renders at.

---

## The text

DreamRack is a modular synthesiser but it can also synthesize video. The video modules are on a separate tab. You connect them with video cables, tweak them with knobs and switches, and you can modulate them with cables to your audio patches.

This is a quick tour of building a video patch from start to finish.

We start at the video output, which is the end of every video chain, and add each earlier module in
turn. A coordinate field produces the picture. A shape module selects part of that picture, which
gives it an edge. A time module stores earlier frames and reuses them. A maths module combines two
pictures arithmetically, and a compositor combines two more, using a third picture to decide which of
them appears at each point.

We add each module by moving one end of one cable, so the output displays a picture throughout.

At the end we add a function generator, which is an audio module, and set it to repeat continuously.
Its output is connected to the coordinate field. After that the picture changes without further
adjustment.

---

## What changed, and why

Everything figurative is out. The earlier draft had modules that *lived* on a page, a chain that *grew*
behind the output, a time module that *held on to* frames, a generator *running on its own*, and a
compositor *laying* one picture over another. Replaced with what each one does: modules are on a page,
frames are stored and reused, the generator repeats, pictures are combined.

Two that are worth naming because they read as plain English but are not literal:

- **"Work backwards"** is gone. Nothing moves backwards; we connect the output first and then add each
  module that comes before it.
- **"Cuts an edge"** is gone. The shape module selects part of a field, and an edge is the result of
  selecting part of it.

Other decisions:

- **"We" and "you"**, as in the other reels.
- **It states the plan rather than describing the result.** No adjectives about how the pictures look.
  The tour shows that in the next forty seconds.
- **It names the modules**, because the tour itself is silent and this is the only point at which they
  are identified.

## If it needs to be shorter

Removing the two middle paragraphs — the module list and the sentence about moving one cable end —
leaves the opening and the ending, which still state what the tour is and how it finishes.
