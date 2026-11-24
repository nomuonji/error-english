#!/usr/bin/env python3
"""Read-only EN/JA speech audit for any reviewed-render artifact; never approve or upload."""
import argparse
import difflib
import hashlib
import json
import re
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly
from faster_whisper import WhisperModel

p = argparse.ArgumentParser()
p.add_argument("folder", type=Path)
p.add_argument("--clip", required=True)
p.add_argument("--sha256", required=True)
a = p.parse_args()
assert re.fullmatch(r"aw-[0-9]{3}-[a-z0-9-]+", a.clip)
assert re.fullmatch(r"[a-f0-9]{64}", a.sha256)
root = a.folder.resolve()
video = root / "annotated-short.mp4"
assert hashlib.sha256(video.read_bytes()).hexdigest() == a.sha256, "Exact MP4 SHA256 mismatch"
timeline = json.loads((root / "timeline.json").read_text(encoding="utf-8"))
assert isinstance(timeline, list) and len(timeline) > 0, "Empty timeline"
voice, sr = sf.read(root / "voice-only.wav", always_2d=True)
assert sr > 0 and voice.size > 0, "Voice-only WAV missing/empty"
mono = voice.mean(axis=1).astype("float32")
assert np.isfinite(mono).all(), "Voice contains invalid samples"

def normalize(text, lang):
    if lang == "en":
        return re.sub(r"[^a-z0-9]+", "", text.lower())
    return re.sub(r"[\s\W_]+", "", text)

model = WhisperModel("small", device="cpu", compute_type="int8", download_root="/tmp/aw-whisper-cache")
results = {}
for role, lang, chosen in [
    ("english_quotes", "en", [t for t in timeline if t.get("role") == "QUOTE"]),
    ("japanese_editor", "ja", [t for t in timeline if t.get("role") != "QUOTE"])
]:
    assert chosen, "Required speech role absent: " + role
    parts, expected_text = [], []
    for cue in chosen:
        start = int(float(cue["start"]) * sr)
        end = int(float(cue["speechEnd"]) * sr)
        assert 0 <= start < end <= len(mono), "Invalid speech interval: " + role
        parts.append(mono[start:end])
        parts.append(np.zeros(int(0.3 * sr), dtype="float32"))
        expected_text.append(cue.get("en" if lang == "en" else "ja", ""))
    assert all(expected_text), "Missing caption text: " + role
    audio = resample_poly(np.concatenate(parts), 16000, sr).astype("float32")
    segments, _ = model.transcribe(audio, language=lang, beam_size=4,
                                   condition_on_previous_text=False, temperature=0)
    recognized = " ".join(s.text.strip() for s in segments)
    expected = " ".join(expected_text)
    score = difflib.SequenceMatcher(a=normalize(expected, lang),
                                   b=normalize(recognized, lang),
                                   autojunk=False).ratio()
    results[role] = {
        "language": lang, "cues": len(chosen),
        "expected": expected, "recognized": recognized,
        "normalizedSimilarity": round(score, 3),
        "speechSeconds": round(len(audio) / 16000, 2),
        "needsEditorialInspection": score < 0.90
    }
report = {
    "clipId": a.clip, "mp4Sha256": a.sha256,
    "method": "faster-whisper small CPU int8; exact renderer voice-only audio; separated quote and editor speech",
    "limitations": "ASR is not human audition or source-rights clearance. Japanese proper names and orthographic variants may diverge. Actual final-media review stays separate.",
    "results": results
}
out = Path("annotated-world-speech-audit.json")
out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"clipId": a.clip, "sha256": a.sha256, "scores": {
    role: {"language": data["language"], "cues": data["cues"],
           "similarity": data["normalizedSimilarity"],
           "needsEditorialInspection": data["needsEditorialInspection"]}
    for role, data in results.items()
}}, ensure_ascii=False))
