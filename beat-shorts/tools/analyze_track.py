#!/usr/bin/env python3
"""Analyse a music track for beat-shorts (run once when adding a track; not used in CI).

usage: analyze_track.py <tracks/ID> [--beats-from beats.json]

Writes into the track folder:
  beats.json     beat times in seconds (librosa beat tracker, or the given list)
  spectrum.json  24 log-spaced bands per video frame (30 fps), normalised 0..1, plus RMS
and prints a measured beatOffset (how far the kick transients sit after the beat times)
and the median beat period, to copy into track.json.

Needs: pip install librosa numpy (local only).
"""
import json
import pathlib
import sys

import librosa
import numpy as np

FPS, BANDS = 30, 24


def main():
    tdir = pathlib.Path(sys.argv[1])
    song = tdir / "song.mp3"
    y, sr = librosa.load(str(song), sr=22050, mono=True)
    if "--beats-from" in sys.argv:
        beats = json.loads(pathlib.Path(sys.argv[sys.argv.index("--beats-from") + 1]).read_text())
    else:
        _, beats = librosa.beat.beat_track(y=y, sr=sr, units="time", tightness=120)
        beats = [round(float(b), 5) for b in beats]
    (tdir / "beats.json").write_text(json.dumps(beats))

    # onset offset: where the strongest transients sit relative to the beat grid
    hop = 64
    env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    best, best_off = -1, 0.0
    for off in np.arange(-0.06, 0.16, 0.005):
        idx = [int((b + off) * sr / hop) for b in beats[1:-2]]
        idx = [i for i in idx if 0 < i < len(env) - 1]
        v = float(np.mean([env[i - 1:i + 2].max() for i in idx]))
        if v > best:
            best, best_off = v, off
    period = float(np.median(np.diff(beats)))

    win = 2048
    edges = np.geomspace(40, 9000, BANDS + 1)
    fr = np.fft.rfftfreq(win, 1 / sr)
    n = int(len(y) / sr * FPS)
    out, rms = [], []
    for i in range(n):
        c = int(i / FPS * sr)
        s = y[max(0, c - win // 2):c + win // 2]
        if len(s) < win:
            s = np.pad(s, (0, win - len(s)))
        sp = np.abs(np.fft.rfft(s * np.hanning(win)))
        out.append([float(np.log1p(sp[(fr >= edges[k]) & (fr < edges[k + 1])].mean())) for k in range(BANDS)])
        rms.append(float(np.sqrt(np.mean(s ** 2))))
    a = np.array(out)
    a = (a - a.min(0)) / (a.max(0) - a.min(0) + 1e-9)
    r = np.array(rms)
    r = r / (r.max() or 1)
    (tdir / "spectrum.json").write_text(json.dumps({"fps": FPS, "bands": np.round(a, 3).tolist(),
                                                     "rms": np.round(r, 3).tolist()}))
    print(json.dumps({"beats": len(beats), "bpm": round(60 / period, 1), "period": round(period, 4),
                      "beatOffset": round(best_off, 3), "duration": round(len(y) / sr, 2)}))


if __name__ == "__main__":
    main()
