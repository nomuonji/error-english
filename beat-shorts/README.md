# beat-shorts — 音ハメ英単語Shorts

A three.js scene, synced to a Suno track's beat map, showing 8 advanced words
(英検1級 / CEFR C1–C2). Rendered frame by frame in headless Chromium and published
by the regular queue (`.github/workflows/publish-queue.yml`).

## Add a video to the queue

Put `publish-queue/scripts/NNNN-beat-<name>.json` on main:

```json
{
  "id": "beat-eiken1-04",
  "pattern": "beat",
  "track": "lexicon-drop",
  "level": "英検1級",
  "title": "英検1級の単語、何個わかる？ … 【音ハメ英単語 #4】",
  "summary": "one line for the description",
  "words": [
    { "w": "eschew", "ipa": "/ɪsˈtʃuː/", "pos": "動", "ja": "（意図的に）避ける",
      "ex": "She *eschews* social media entirely.", "exJa": "彼女はSNSを一切避けている。" }
  ]
}
```

Exactly `track.layout.words` words (8 for lexicon-drop). Mark the word in `ex` with `*…*`.
Limits checked by `scripts/beat_to_request.py check`: meaning ≤ 14 chars, translation ≤ 30,
example ≤ 60, headword 2–16 latin letters, no duplicates.

## Per-word timing (8 beats = 2 bars)

beat 1 word slam + shockwave + camera shake · 2 IPA · 3 part of speech + meaning
(the viewer has one beat to guess) · 5 example · 6 highlight pulse · 7 translation · 8 exit.
Intro 2 bars, recap 1 word per beat, outro 4 bars.

## Tracks

`tracks/<id>/` holds `song.mp3`, `beats.json` (Suno `audio-analysis` beat times),
`spectrum.json` (24-band per-frame energies, 30 fps), and `track.json`
(`beatOffset`, `duration`, `layout`, `credit`, `license`).
`beatOffset` is measured against kick transients, because Suno's beat times sat ~80 ms early.

**lexicon-drop was made on the Suno free plan: non-commercial use only, with attribution.**
Replace it with a track made on a paid plan before the channel is monetized.

## Local preview

```bash
cd beat-shorts && npm ci && npx playwright install chromium
node render.js ../publish-queue/scripts/0016-beat-eiken1-01.json /tmp/pv --preview 4.6,7.5,35
node render.js ../publish-queue/scripts/0016-beat-eiken1-01.json out/video.mp4
```
