# Control protocol — how something outside plays DreamRack

How an external sequencer or composition engine plays the rack: a small,
sender-agnostic message protocol arriving at a **module**, which puts what it
receives onto the **note cable** — the same cable a Sequence Out uses, carrying the
same whole notes. GXW is the first client; Strudel and a MIDI translator are
co-clients of the same front door.

The guiding stance: **control enters the synth the way a cable does.** Nothing
reaches into a module's internals, and the sender is decoupled from the patch.

## 1. The receiver is smaller than it used to be

This design once had the receiving module own a voice allocator and put out a pitch
and a gate and a level per voice group. It does not any more, because the rack grew
the thing that does that: **a note is an event on a cable, and Voice In allocates.**
See `voice-pages.md`.

So the module's whole job is: listen, check, convert the timestamp, and re-emit on
the note cable. It has

- **NOTE out** — the chord or line it receives, as note events. One cable to a voice
  tab and the sender is playing the rack.
- **CLOCK out** — a trigger the sender can drive, so the rack's own clocks, envelopes
  and arpeggios lock to the sender's tempo rather than free-running against it.
- **A connected lamp and the port**, because a bridge that is not connected should
  say so on its face rather than by being silent.
- **A CHANNEL setting.** Notes for other channels are ignored, so a second part is a
  second module feeding its own voice tab — which is what the rack's own model would
  do anyway, and cheaper than one module with several outputs.

**No audio output.** The protocol carries control; sound is made by whatever you
patch the note cable into.

## 2. One protocol, two carriers

**The wire format is the note transport's own messages.** `{t:'on', handle, pitch,
level, duration, pan, bendRange}`, `{t:'off', handle}`, `{t:'u', handle, k, v}`, and
`{t:'key', tonic, mode}`. No translation layer, no second vocabulary to keep in
step, and whatever the internal cable learns later the socket speaks for free.

**Pitch is VOLTS per octave**, as it is inside the rack. That is the reason this
exists rather than a MIDI cable: a note number cannot express what an unquantised or
microtonal source is doing. A note number or a frequency is accepted at the door and
converted, for senders that only have those.

**OSC's shape, JSON's encoding, for now.** An address, typed arguments and a time
tag is the right vocabulary, and the time tag is the part that matters — a
standardised way to say "play this at this moment" rather than "play this now, sorry
it is late". But both ends here are JavaScript, so JSON costs nothing, needs no
library, and can be read in a console when a timing bug appears — which on a bridge
it will. JSON also lets a note travel as an OBJECT, where OSC's positional arguments
would force a fixed order and padding for the fields a sender did not send.

**Binary OSC decode on the same socket comes later**, mapping positional arguments
into the same object. That is what buys the ecosystem: Strudel already knows how to
drive an OSC target, and Max, SuperCollider and TouchOSC come with it. The shape
being OSC's from the start is what makes that an adapter rather than a rewrite.

## 3. Time — the part that decides whether this is tight

`time` inside the rack is a **sample frame** of DreamRack's audio clock, which
another process cannot know. So the wire carries **when to play relative to now**,
and the sender runs **ahead**.

- Each event is sent a **look-ahead** early — start with a fixed 40ms — carrying the
  delay from send to sound.
- The receiver converts that into a sample frame on arrival and places the event
  exactly there, the same way the note transport already defers by one block and
  places by timestamp.
- **Constant latency is inaudible; variable latency smears rhythm.** That is the
  whole argument: a fixed look-ahead you cannot hear buys away the jitter of two
  main threads and a socket.
- **Later, a ping refines it.** A periodic round trip measures offset and transit,
  and the look-ahead can shrink towards the real number. Not needed to start.

If an event arrives too late to place — the look-ahead was too small, or the sender
stalled — it is played at the start of the next block rather than dropped. Late is
better than missing, and the connected lamp is where a persistent problem should
show.

## 4. The note model — handle and mandatory duration

- **A handle**, minted by the sender, naming a sounding note so a later message can
  refer to it. A short random session prefix plus a monotonic counter (`s7:1042`):
  collision-free within a sender, namespaced across senders, and readable when
  debugging.
- **A required duration** — the note's natural length AND a dropped-message
  failsafe. A note always ends on its own even if its off never arrives. There are
  no infinite notes; a drone is a generous cap. This is already how the internal
  cable behaves, so the rule costs nothing here.

## 5. Receiver rules, because the medium is lossy

Packets can be dropped, duplicated or reordered. This is the normal condition, not
an edge case, and the door is where it is handled:

- a **note-on for a handle already sounding** is ignored — it dedupes a duplicate
  and does not retrigger;
- a **note-off for an unknown or finished handle** is a no-op, covering a lost
  note-on and a late off;
- **unknown message kinds are ignored**, which is what lets the protocol grow
  without breaking the receivers already written;
- **everything is placed by its timestamp**, never by arrival order.

## 6. Who listens

**DreamRack listens; senders connect.** It is the instrument, and an instrument can
have several sources. The listener lives in the Electron **main process** and hands
messages to the module.

- **Loopback only.** Bind 127.0.0.1, never a public interface.
- **A token in the handshake**, printed on the module, since any local page could
  otherwise knock on the port.
- **Desktop only.** A browser build cannot open a listening socket; the same
  messages could arrive from another tab by other means if that ever matters.
- **Several clients at once** are allowed and their notes are merged, because they
  carry distinct handle prefixes and nothing else in the receiver is stateful. Two
  senders on one channel is the user's problem, not the protocol's.

## 7. The sending end

Discovery is free: the mirror's `catalogue.json` (`ai-mirror.md`) enumerates every
module, port and parameter with its range and curve, so a sender knows what is there
and how to scale into it.

**GXW** is the first client, and the tap already exists — it has a MIDI output that
is currently unused, and wherever that was fed is the point where a note is about to
sound. The same call site emits the richer message instead: volts rather than note
numbers, a real duration, pan, and whatever expression the part is carrying. Sender
duties: mint handles, always include a duration, send offs on a best-effort basis
(the failsafe covers loss), stamp with the look-ahead, and be the tempo master.

**Strudel** speaks the SuperDirt play format already, so pointing it here is largely
repointing its output; a superdough-shaped adapter maps its control names onto these
fields.

**MIDI** stays available as a thin translator for anything that only speaks it —
note-on and off to these messages, synthesising a handle per key and a generous
duration as the failsafe, CC to a tagged update. It is the lossy door, kept open
because some senders have no other.

## 8. Non-goals

- **No audio over the protocol.**
- **No shared audio graph** — sender and rack run separate contexts and talk only
  over this transport.
- **No parameter automation in the first cut.** Driving a named parameter directly
  is tempting and it is how a bridge becomes a remote control rather than an
  instrument input. Notes first.

## 9. Status

Designed, not built. The receiving module is the build unit; the sending end lives
in whichever app drives it. Nothing here now depends on anything that does not
exist: the note cable, its message shapes, the duration failsafe and Voice In's
allocator are all in the rack already, which is why the module is now a door rather
than an engine.
