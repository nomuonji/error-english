# beat-shorts — ドパ英語 Shorts engine

Every Short on the channel is rendered here: a three.js background synced to the music's
beat map, text that lands on the beat, English pronunciation by Kokoro, and the channel
mascot. Published by the regular queue (`.github/workflows/publish-queue.yml`).
Animation Factory is not used any more (owner decision 2026-11-01).

## Two skins that must not look alike

| | neon skin (`index.html` + `engine.js`) | card skin (`card.html` + `card.js`) |
|---|---|---|
| patterns | `beat` (and the single-target templates) | `quiz` |
| background | three.js, dark neon (core / grid / galaxy / city) | flat 2D pastel, drifting shapes (circles / blocks / rings / stripes / dots) |
| hero | big word slammed on the beat, 3-2-1 numbers | white quiz card that flips to the answer, ring timer |
| type | Archivo Black + Noto/Dela Gothic | Nunito + M PLUS Rounded |
| music | lexicon-drop, error-bgm | error-bgm |

The channel posts both kinds alternately; keeping them visibly different (and each look used
thinly, below) is what keeps the channel from reading as one template repeated.
The mascot appears only on the closing card, fading in where it stands.

## quiz (card skin)

`{"pattern": "quiz", "title", "summary", "level", "items": [3-4 lesson specs]}` — each item is a
`word / phrase / upgrade / vs` lesson spec as below. One question ≈ 8 s: card slides in →
timer drains over 3 beats (ticks) → card flips to the answer, pronounced → example bubble.

## Templates (`templates.js`, field `pattern` of a queue script)

| pattern  | what the viewer gets (≈30 s unless noted) |
|----------|--------------------------------------------|
| `beat`   | 8 words, one per 2 bars, recap one per beat (≈46 s) |
| `word`   | one word → 3-2-1 → meaning, 2 examples, quiz, recap |
| `phrase` | 「日本語」→ 3-2-1 → the English phrase, 2 examples, quiz, recap |
| `upgrade`| very X → 3-2-1 → the stronger word, 2 examples, quiz, recap |
| `vs`     | A vs B → 3-2-1 → how to tell them apart, an example each, quiz, recap |

`word / phrase / upgrade / vs` read the lesson specs that used to go to Animation Factory
unchanged (`examples[].en/ja`, `quiz.prompt/answer/answerJa`, `meaning[].cap`, ...).
`beat` specs: see `publish-queue/scripts/*-beat-*.json` (`*word*` marks the highlight).

Times in a template are units of ~0.48 s; the engine snaps each unit to the nearest beat of
the chosen track, so a template works at 127 BPM and at 161 BPM.

## Styles: many looks, each used thinly (`styles.json`)

Each render picks one value per dimension of its skin. neon: scene (4), palette (8), Japanese
display font (2), track excerpt (lexicon-drop, error-bgm @0/54/92 s). card: palette (6), motif (5),
error-bgm excerpt (3).
`render.js` chooses the **least recently used** value of each dimension from the `style`
stored in earlier publish requests, so consecutive videos never share a look. Add a scene to
`scenes.js`, a palette to `styles.json` or a track to `tracks/` to widen the pool.

## Tracks (`tracks/<id>/`)

`song.mp3`, `beats.json`, `spectrum.json`, `track.json` (`beatOffset`, `period`, `duration`,
`excerpts`, `credit`, `license`). Add one with `python3 tools/analyze_track.py tracks/<id>`
(needs librosa locally) and copy the printed `beatOffset`/`period` into `track.json`.

- lexicon-drop: Suno **free plan** — non-commercial use only, credit Suno. Replace before monetising.
- error-bgm: the BGM of the channel's earlier error-message series; source not recorded.

## Assets from the earlier series

`assets/mascot/` (the channel character: smile / talk / cry) and `assets/se/` (pop,
follow_me, ...) come from `public/` of the old Remotion series.

## Local preview

```bash
cd beat-shorts && npm ci && npx playwright install chromium
pip install kokoro-onnx==0.6.1 soundfile numpy
node render.js ../publish-queue/scripts/<file>.json /tmp/pv --preview 1,4,9,20 [--style core,neon,NotoJP,error-bgm,54]
node render.js ../publish-queue/scripts/<file>.json out/video.mp4
```

## No repeated words (content ledger)

`scripts/content_ledger.py` collects every taught or queued target: published scripts,
queued scripts and `publish-queue/ledger-extra.json` (videos made outside the queue, e.g. the
long-form 10 words). The render gate (`beat_to_request.py check`) stops a script whose word or
phrase is already there, ignoring case, punctuation and simple inflections (eschew = eschews,
placate = placated, "I'm on tenterhooks" = "on tenterhooks"). A deliberate review lists the
words in `"repeatOk": [...]`. `python3 scripts/content_ledger.py list` prints the ledger for
whoever writes the next scripts.

## Automatic scripts (OpenCode Go)

`.github/workflows/replenish-queue.yml` (00:07 JST daily) runs `scripts/replenish.py`: when fewer
than 6 scripts are queued it drafts new ones (beat and quiz alternately) with OpenCode Go
(`deepseek-v4.1-flash`, override with the `OPENCODE_GO_MODEL` repository variable), has a second
call check meanings / IPA / examples, and commits only drafts that pass the render gate and the
content ledger. Secret: `OPENCODE_GO_API_KEY`. `dry_run=true` prints one draft without committing.
