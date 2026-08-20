# Sound and monitoring — specification

Two things people want to hear in DreamRack: the **master** (the finished mix out of the
mixer) and the **monitor** (a single terminal, tapped by an ear monitor, to check it in
isolation). They are two independent buses, and above them sits one switch — the
**engine** — that decides whether the rack makes sound at all.

## 1. One engine over two buses

Three pieces of transport state, all mixer params, none of them saved with a patch:

- **`engine`** — the rack makes sound, or it does not. Off at every launch.
- **`masterEnable`** — the master bus (the mixer output). Default on, beneath the engine.
- **`monitorEnable`** — the monitor bus (placed ear monitors). Default off.

A bus is audible only when the engine is on *and* that bus is enabled. Either, both or
neither bus can play; the engine cuts all of it at a stroke.

### Why a switch above the buses

Two independent enables and nothing above them is a defensible design, and it is not this
one. A master switch buys three things worth the extra concept: one obvious place to stop
all sound, a transport the space bar can own, and a single honest answer to "is this thing
live?" — which two peer lamps cannot give, since either might be the one that matters.

### The hazard it introduces, and the rules that close it

A switch above two switches invites silence with a lit lamp: engine off, master lamp on,
nothing audible, no visible reason. Two rules close that gap, and both are load-bearing.

**Starting the engine always enables the master bus** — even if the master was off
beforehand, and it is left on afterwards. Starting the sound must produce sound, or the
master switch has only moved the confusion up a level. This coupling lives in `_setParam`
in `host/rack.js`, not in a menu handler, so the mixer lamp, the menu row and the space
bar cannot drift apart. The engine is the only control in the app that moves another.

**With the engine off, both bus lamps dim** (`.engine-off` in `index.html`). Their own
state is preserved and still legible; the dimming says the engine is what the silence is
about. Monitor rings stop reading "live" for the same reason.

Between them: sound is off for exactly one visible reason at a time.

## 2. Reaching the switches

- **The mixer**, top right: an `ENGINE` caption and lamp centred above the `MON` and
  `MSTR` columns it governs, with those two buses' own enables in the panel-wide enable
  row below. The one place all three are visible together, which is why bus-by-bus choice
  belongs here and not in a menu.
- **The app menu's Sound row**: one line reading `MSTR ● MON ●` — each word beside a round
  enable button, clicking toggles it and the menu stays open, and hovering an OFF button
  auditions that bus without writing the switch. There is no `Engine` row and no Rack menu:
  the engine has the space bar and the mixer's own lamp, and a menu row that duplicated them
  was a third place to keep in step.
- **The space bar**: toggles the engine. No modifier; ignored while typing or while a
  button has focus. Safe as a bare key because patching is a pointer activity.

## 3. Startup and persistence

The three transport params are excluded from save and restore (`TRANSPORT` in
`debug/rack-app.js`), and all three are cleared at the end of boot — engine last, since
that is what guarantees the silence. **The app never comes up making sound**, whatever was
running when it was last closed and whatever monitors a restored patch brings back. A
patch saved mid-performance therefore never reloads silent for a non-obvious reason
either: it reloads with the engine off, which is a visible reason.

`File ▸ New` resets controls to their descriptor defaults, so a new patch also starts with
the engine off and the master bus armed beneath it.

## 4. The audio context is a hidden detail

Web Audio needs a running `AudioContext`, and the user should never think about it. It
wakes lazily on the first thing that needs sound — a bus becoming audible, or a monitor
being placed — and then stays up for the session. Autoplay's user-gesture requirement is
satisfied long before this, since starting the engine is itself a click or a key press.

## 5. Monitoring a terminal

Enabling the monitor bus from a terminal is implicit, so it needs no menu of its own:

- **Opening a monitor** on a terminal enables the monitor bus, so a freshly placed monitor
  is audible immediately (engine permitting). The master is untouched — you are never
  forced to turn the mix off to hear a port.
- **Hovering the monitor entry** in the terminal menu auditions that terminal momentarily
  via `_monPreviewGain`, so a port can be checked before committing a monitor.

A monitor's ring is green and pulsing only while it is genuinely audible: monitor bus on,
engine on, not muted.

## 6. Levels

The master bus carries makeup gain and a brick-wall limiter; the monitor bus has its own
makeup and limiter, and auto-levels against the loudest peak the master has reached in the
session. Ear safety is why both limiters exist, and why the monitor bus is never allowed
to become the louder of the two by accident.

## 7. Open questions

- **Monitor bus auto-disable.** Should removing the last placed monitor turn
  `monitorEnable` back off? Leaving it on is harmless — nothing feeds it — but the lamp
  then reads "on" with nothing to hear.
- **Per-terminal solo.** Monitoring works a whole bus, so several placed monitors sound
  together. Hearing one of many in isolation is rare enough to defer; it would arrive as
  an optional per-monitor solo without disturbing anything here.

## 8. Where it lives

- `modules/mixer/descriptor.js` — the three transport params.
- `modules/mixer/panel.layout.js` — the `ENGINE` caption and lamp; the enable row.
- `host/rack.js` — `_applyAudioRouting` (the engine gates both buses), `engineOn`,
  `toggleEngine`, the engine→master coupling in `_setParam`, monitor-bus construction and
  the live-ring logic.
- `debug/rack-app.js` — the space bar, `soundOn`, the
  `TRANSPORT` exclusion set, and the boot clear-down.
- `index.html` — `.engine-off`, which dims the two bus lamps.
