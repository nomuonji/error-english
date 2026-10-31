#!/usr/bin/env python3
"""Beat-synced vocabulary Shorts (pattern "beat"): gate a queue script and its render.

usage:
  beat_to_request.py check  <queue-script-file>             # spec gate before rendering
  beat_to_request.py request <queue-script-file> <video.mp4> # media gate + publish request

Writes publish-queue/pending/<same-name>.request.json and <id>.mp4 (runner only).
Exit 3 with gate-failure.txt when a gate fails.
"""
import hashlib
import json
import pathlib
import re
import shutil
import subprocess
import sys

Q = pathlib.Path("publish-queue")
TRACKS = pathlib.Path("beat-shorts/tracks")


def fail(problems):
    pathlib.Path("gate-failure.txt").write_text("\n".join(problems) + "\n", encoding="utf-8")
    print("GATE FAILED:", problems)
    sys.exit(3)


def load(name):
    spec = json.loads((Q / "scripts" / name).read_text(encoding="utf-8"))
    tdir = TRACKS / str(spec.get("track", ""))
    if not (tdir / "track.json").is_file():
        fail([f"unknown track {spec.get('track')!r}"])
    return spec, json.loads((tdir / "track.json").read_text(encoding="utf-8"))


def check_spec(spec, track):
    p = []
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,63}", str(spec.get("id", ""))):
        p.append("bad id")
    words = spec.get("words") or []
    need = track["layout"]["words"]
    if len(words) != need:
        p.append(f"{len(words)} words; track {track['id']} is laid out for exactly {need}")
    if not spec.get("title") or len(spec["title"]) > 100:
        p.append("title missing or over 100 chars")
    seen = set()
    for i, w in enumerate(words, 1):
        tag = f"word {i} ({w.get('w')})"
        for k in ("w", "ipa", "pos", "ja", "ex", "exJa"):
            if not str(w.get(k, "")).strip():
                p.append(f"{tag}: missing {k}")
        if not re.fullmatch(r"[A-Za-z][A-Za-z' -]{1,15}", str(w.get("w", ""))):
            p.append(f"{tag}: headword must be 2-16 latin letters")
        if str(w.get("w", "")).lower() in seen:
            p.append(f"{tag}: duplicate")
        seen.add(str(w.get("w", "")).lower())
        if len(w.get("ja", "")) > 14:
            p.append(f"{tag}: meaning over 14 chars (does not fit one line)")
        if len(w.get("exJa", "")) > 30:
            p.append(f"{tag}: translation over 30 chars")
        ex = str(w.get("ex", ""))
        m = re.fullmatch(r"(.*?)\*(.+?)\*(.*)", ex)
        if not m:
            p.append(f"{tag}: example must mark the word as *word*")
        elif not m.group(2).lower().startswith(str(w.get("w", ""))[:4].lower()):
            p.append(f"{tag}: highlighted form {m.group(2)!r} does not look like the headword")
        if len(ex) > 60:
            p.append(f"{tag}: example over 60 chars")
    return p


def loudness(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "ebur128", "-f", "null", "-"],
                       capture_output=True, text=True)
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    return float(m[-1]) if m else None


def duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                       capture_output=True, text=True)
    return float(r.stdout.strip() or 0)


def main():
    mode, name = sys.argv[1], sys.argv[2]
    spec, track = load(name)
    problems = check_spec(spec, track)
    if problems:
        fail(problems)
    if mode == "check":
        print("spec ok:", spec["id"])
        return
    video = pathlib.Path(sys.argv[3])
    sec, lufs, mb = duration(video), loudness(video), video.stat().st_size / 1e6
    if not 20 <= sec <= 120:
        problems.append(f"length {sec:.1f}s outside 20-120s")
    if lufs is None or not -19 <= lufs <= -11:
        problems.append(f"loudness {lufs} LUFS outside -19..-11")
    if mb > 90:
        problems.append(f"video {mb:.0f} MB over 90 MB")
    if problems:
        fail(problems)

    lines = []
    for w in spec["words"]:
        ex = w["ex"].replace("*", "")
        lines.append(f"・{w['w']} {w['ipa']}（{w['pos']}）＝ {w['ja']}\n  {ex}（{w['exJa']}）")
    body = "\n".join([
        spec.get("summary", ""), "",
        *lines, "",
        "意味の確認: https://dictionary.cambridge.org/",
        "", "— クレジット —", track["credit"], "",
        "#英単語 #英検1級 #語彙力 #英語学習 #shorts",
    ]).strip()
    tags = ["英語学習", "英検1級", "英単語", "音ハメ", "English vocabulary", "advanced English",
            *[w["w"] for w in spec["words"]]]
    (Q / "pending").mkdir(parents=True, exist_ok=True)  # empty dirs are not kept in git
    mp4 = Q / "pending" / f"{spec['id']}.mp4"
    shutil.copy(video, mp4)
    sha = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    req = {"sourceRepo": "nomuonji/error-english (beat-shorts)", "sourceSha": sha,
           "assetName": mp4.name, "sha256": hashlib.sha256(mp4.read_bytes()).hexdigest(),
           "title": spec["title"][:100], "description": body[:5000], "categoryId": "27", "tags": tags,
           "script": name}
    (Q / "pending" / name.replace(".json", ".request.json")).write_text(
        json.dumps(req, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"request written for {spec['id']}: {sec:.1f}s {lufs} LUFS {mb:.1f} MB")


if __name__ == "__main__":
    main()
