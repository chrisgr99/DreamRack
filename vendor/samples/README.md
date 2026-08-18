# vendor/samples

A kit for Strudel's own voices, loaded from disk so the desktop build can play a drum with no network.

Drop audio files here and describe them in `strudel.json`, which is superdough's own map format — a
sound name to the files that play it:

```json
{
  "bd": ["bd/kick-01.wav", "bd/kick-02.wav"],
  "sd": ["sd/snare-01.wav"],
  "hh": ["hh/hat-01.wav"]
}
```

The module loads it on the first event that names a sound; when the file is absent — the normal case
in the browser — nothing is loaded and a pattern fetches its own packs with `samples('github:…')`, as
it would in Strudel.

Nothing is committed here yet: what ships is a licensing decision, not a technical one. The full
tidal-drum-machines library is tens of megabytes and belongs on the network; a dozen sounds is a few
hundred kilobytes and belongs in the app.
