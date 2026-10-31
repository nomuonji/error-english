#!/usr/bin/env python3
"""ドパ英語 Shorts (beat-shorts engine): gate a queue script and its render.

Patterns: beat (8 words on the beat), word, phrase, upgrade, vs (one target per video).

usage:
  beat_to_request.py check   <queue-script-file>             # spec gate before rendering
  beat_to_request.py request <queue-script-file> <video.mp4> # media gate + publish request

`request` also reads <video>.style.json (written by render.js) and stores it in the request,
so later renders can avoid repeating the same look. Writes publish-queue/pending/<name>.request.json
and <id>.mp4. Exit 3 with gate-failure.txt when a gate fails.
"""
import hashlib
import json
import pathlib
import re
import shutil
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import content_ledger  # noqa: E402

Q = pathlib.Path("publish-queue")
PATTERNS = ("beat", "quiz", "word", "phrase", "upgrade", "vs")
SERIES = {"beat": "音ハメ英単語", "quiz": "英語クイズ", "word": "1語で覚える", "phrase": "言えそうで言えない一言",
          "upgrade": "very から卒業", "vs": "どっちを使う？"}
TAGS = {"beat": "#英単語 #英検1級 #語彙力", "quiz": "#英語クイズ #英単語 #英語学習", "word": "#英単語 #語彙力 #英語学習", "phrase": "#英語フレーズ #英会話 #英語学習",
        "upgrade": "#英語表現 #語彙力 #英語学習", "vs": "#英語の違い #英単語 #英語学習"}


def fail(problems):
    pathlib.Path("gate-failure.txt").write_text("\n".join(problems) + "\n", encoding="utf-8")
    print("GATE FAILED:", problems)
    sys.exit(3)


def cap(x):
    return x if isinstance(x, str) else (x or {}).get("cap", "")


def need(spec, keys, p, where=""):
    for k in keys:
        cur = spec
        for part in k.split("."):
            cur = cur.get(part) if isinstance(cur, dict) else None
        if cur in (None, "", []):
            p.append(f"{where}missing {k}")


def check_spec(spec):
    p = []
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,63}", str(spec.get("id", ""))):
        p.append("bad id")
    pat = spec.get("pattern")
    if pat not in PATTERNS:
        return p + [f"pattern must be one of {PATTERNS}"]
    if not spec.get("title") or len(spec["title"]) > 90:
        p.append("title missing or over 90 chars (series tag is appended)")
    if pat == "quiz":
        items = spec.get("items") or []
        if not 3 <= len(items) <= 4:
            p.append(f"{len(items)} items; a quiz holds 3-4 questions")
        for i, it in enumerate(items, 1):
            if it.get("pattern") not in ("word", "phrase", "upgrade", "vs"):
                p.append(f"item {i}: pattern must be word/phrase/upgrade/vs")
                continue
            sub = dict(it, title=it.get("title") or "x")
            p += [f"item {i} ({it.get('id')}): {x}" for x in check_spec(sub)]
        return p
    if pat == "beat":
        words = spec.get("words") or []
        if len(words) != 8:
            p.append(f"{len(words)} words; the beat template is laid out for exactly 8")
        seen = set()
        for i, w in enumerate(words, 1):
            tag = f"word {i} ({w.get('w')})"
            need(w, ["w", "ipa", "pos", "ja", "ex", "exJa"], p, tag + ": ")
            if not re.fullmatch(r"[A-Za-z][A-Za-z' -]{1,15}", str(w.get("w", ""))):
                p.append(f"{tag}: headword must be 2-16 latin letters")
            if str(w.get("w", "")).lower() in seen:
                p.append(f"{tag}: duplicate")
            seen.add(str(w.get("w", "")).lower())
            if len(w.get("ja", "")) > 14:
                p.append(f"{tag}: meaning over 14 chars")
            if len(w.get("exJa", "")) > 30:
                p.append(f"{tag}: translation over 30 chars")
            m = re.fullmatch(r"(.*?)\*(.+?)\*(.*)", str(w.get("ex", "")))
            if not m:
                p.append(f"{tag}: example must mark the word as *word*")
            elif not m.group(2).lower().startswith(str(w.get("w", ""))[:4].lower()):
                p.append(f"{tag}: highlighted form {m.group(2)!r} does not look like the headword")
            if len(str(w.get("ex", ""))) > 60:
                p.append(f"{tag}: example over 60 chars")
        return p
    # one-target templates
    need(spec, ["quiz.answer", "quiz.answerJa", "quiz.prompt"], p)
    if pat == "word":
        need(spec, ["word", "ja", "pos", "examples"], p)
    elif pat == "phrase":
        need(spec, ["jp", "answer.en", "answer.ja", "examples"], p)
    elif pat == "upgrade":
        need(spec, ["basic", "word", "ja", "examples"], p)
    elif pat == "vs":
        need(spec, ["a.word", "a.ja", "a.example", "a.exampleJa", "b.word", "b.ja", "b.example", "b.exampleJa", "rule"], p)
    for i, ex in enumerate(spec.get("examples") or [], 1):
        en = " ".join(ex.get("en") or [])
        if not en or len(en) > 70:
            p.append(f"example {i}: English missing or over 70 chars")
    if len(spec.get("quiz", {}).get("answer", "")) > 70:
        p.append("quiz answer over 70 chars")
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


def study_notes(spec):
    pat = spec["pattern"]
    out = []
    if pat == "quiz":
        for i, it in enumerate(spec["items"], 1):
            out.append(f"Q{i}")
            out += study_notes(it)
        return out
    if pat == "beat":
        for w in spec["words"]:
            out.append(f"・{w['w']} {w['ipa']}（{w['pos']}）＝ {w['ja']}\n  {w['ex'].replace('*', '')}（{w['exJa']}）")
        return out
    if pat == "word":
        out.append(f"・{spec['word']}（{spec.get('pos', '')}）＝ {spec['ja']}")
    elif pat == "phrase":
        out.append(f"・{spec['answer']['en']} ＝ {spec['answer']['ja']}")
    elif pat == "upgrade":
        out.append(f"・{spec['basic']} → {spec['word']} ＝ {spec['ja']}")
    elif pat == "vs":
        for k in ("a", "b"):
            x = spec[k]
            out.append(f"・{x['word']} ＝ {x['ja']}　例: {x['example']}（{x['exampleJa']}）")
    for ex in spec.get("examples", []):
        out.append(f"・{' '.join(ex['en'])} ＝ {'、'.join(ex['ja'])}")
    q = spec["quiz"]
    out.append(f"・{q['answer']} ＝ {q['answerJa']}")
    return out


def main():
    mode, name = sys.argv[1], sys.argv[2]
    spec = json.loads((Q / "scripts" / name).read_text(encoding="utf-8"))
    problems = check_spec(spec) + content_ledger.repeats(spec, Q / "scripts" / name)
    if problems:
        fail(problems)
    if mode == "check":
        print("spec ok:", spec["id"], spec["pattern"])
        return
    video = pathlib.Path(sys.argv[3])
    sec, lufs, mb = duration(video), loudness(video), video.stat().st_size / 1e6
    if not 20 <= sec <= 120:
        problems.append(f"length {sec:.1f}s outside 20-120s")
    if lufs is None or not -17 <= lufs <= -11:
        problems.append(f"loudness {lufs} LUFS outside -17..-11")
    if mb > 90:
        problems.append(f"video {mb:.0f} MB over 90 MB")
    if problems:
        fail(problems)

    style_path = video.with_suffix(".style.json")
    style = json.loads(style_path.read_text()) if style_path.exists() else None
    track = json.loads(pathlib.Path(f"beat-shorts/tracks/{style['track']}/track.json").read_text()) if style else {}
    pat = spec["pattern"]
    srcs = spec.get("sources", []) + [u for it in spec.get("items", []) for u in it.get("sources", [])]
    sources = [f"意味の確認: {s}" for s in srcs] or ["意味の確認: https://dictionary.cambridge.org/"]
    credits = ["英語音声: Kokoro-82M (Apache-2.0) による合成音声"] + ([track["credit"]] if track.get("credit") else [])
    body = "\n".join([spec.get("summary", ""), "", *study_notes(spec), "", *sources, "",
                      "— クレジット —", *credits, "", TAGS[pat] + " #ドパ英語 #shorts"]).strip()
    def targets(x):
        return [x[k] for k in ("word", "basic") if x.get(k)] + ([x["answer"]["en"]] if x["pattern"] == "phrase" else []) + \
            ([x["a"]["word"], x["b"]["word"]] if x["pattern"] == "vs" else [])
    words = [w["w"] for w in spec["words"]] if pat == "beat" else \
        [t for it in spec["items"] for t in targets(it)] if pat == "quiz" else \
        [spec[k] for k in ("word", "basic") if spec.get(k)] + ([spec["answer"]["en"]] if pat == "phrase" else []) + \
        ([spec["a"]["word"], spec["b"]["word"]] if pat == "vs" else [])
    tags = ["ドパ英語", "英語学習", SERIES[pat], "英単語", "English vocabulary", "advanced English", *words]
    title = spec["title"] if "【" in spec["title"] else f"{spec['title']}【{SERIES[pat]}】"
    (Q / "pending").mkdir(parents=True, exist_ok=True)  # empty dirs are not kept in git
    mp4 = Q / "pending" / f"{spec['id']}.mp4"
    shutil.copy(video, mp4)
    sha = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    req = {"sourceRepo": "nomuonji/error-english (beat-shorts)", "sourceSha": sha,
           "assetName": mp4.name, "sha256": hashlib.sha256(mp4.read_bytes()).hexdigest(),
           "title": title[:100], "description": body[:5000], "categoryId": "27", "tags": tags,
           "script": name, "pattern": pat, "style": style}
    (Q / "pending" / name.replace(".json", ".request.json")).write_text(
        json.dumps(req, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"request written for {spec['id']}: {sec:.1f}s {lufs} LUFS {mb:.1f} MB style={style}")


if __name__ == "__main__":
    main()
