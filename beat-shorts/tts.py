#!/usr/bin/env python3
"""English pronunciation for beat-shorts: Kokoro-82M (Apache-2.0) via kokoro-onnx (MIT).

usage: tts.py <jobs.json> <out_dir>
jobs.json: [{"text": "...", "voice": "af_heart", "speed": 1.0}, ...]
Writes <out_dir>/<i>.wav (mono 24 kHz, silence trimmed) and prints [{"file", "duration"}].
Model files are downloaded once into $KOKORO_DIR (default ~/.cache/kokoro).
"""
import json
import os
import pathlib
import sys
import urllib.request

import numpy as np
import soundfile as sf

MODEL_DIR = pathlib.Path(os.environ.get("KOKORO_DIR", pathlib.Path.home() / ".cache" / "kokoro"))
BASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/"
FILES = ("kokoro-v1.0.int8.onnx", "voices-v1.0.bin")
VOICES = {"af_heart", "af_bella", "af_nicole", "am_michael", "am_adam", "bf_emma", "bm_george"}


def main():
    jobs = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
    out = pathlib.Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    for f in FILES:
        p = MODEL_DIR / f
        if not p.exists() or p.stat().st_size < 1_000_000:
            urllib.request.urlretrieve(BASE + f, p.with_suffix(".part"))
            p.with_suffix(".part").rename(p)
    from kokoro_onnx import Kokoro
    k = Kokoro(str(MODEL_DIR / FILES[0]), str(MODEL_DIR / FILES[1]))
    res = []
    for i, j in enumerate(jobs):
        voice = j.get("voice", "af_heart")
        if voice not in VOICES:
            raise SystemExit(f"unknown voice {voice}")
        x, sr = k.create(j["text"], voice=voice, speed=float(j.get("speed", 1.0)), lang="en-us")
        x = np.asarray(x, np.float32)
        thr = 0.01 * (np.max(np.abs(x)) or 1)
        idx = np.where(np.abs(x) > thr)[0]
        if len(idx):
            pad = int(0.03 * sr)
            x = x[max(0, idx[0] - pad): idx[-1] + pad]
        x = x / (np.max(np.abs(x)) or 1) * 0.9
        f = out / f"{i}.wav"
        sf.write(f, x, sr)
        res.append({"file": str(f), "duration": round(len(x) / sr, 3)})
    print(json.dumps(res))


if __name__ == "__main__":
    main()
