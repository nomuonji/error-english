#!/usr/bin/env python3
"""After Animation Factory rendered a long-form lesson: gate it and write a publish request.

usage: longform_to_request.py <queue-file in publish-queue/longform/> <animation-factory-dir>
Writes publish-queue/pending/<name>.request.json and <id>.mp4 (runner only).
Exit 3 (with gate-failure.txt) when an automatic gate fails.
"""
import hashlib
import json
import pathlib
import shutil
import sys

name, af = sys.argv[1], pathlib.Path(sys.argv[2])
Q = pathlib.Path("publish-queue")
spec = json.loads((Q / "longform" / name).read_text(encoding="utf-8"))
pid = spec["id"]
out = af / "outputs" / "longform" / pid / "final"
rep = json.loads((out / "report.json").read_text(encoding="utf-8"))
film = json.loads((out / "longform.json").read_text(encoding="utf-8"))

problems = []
if rep.get("status") != "technical_pass":
    problems.append(f"render status {rep.get('status')}")
if not 120 <= float(rep["duration"]) <= 3600:
    problems.append(f"length {rep['duration']}s outside 120-3600s")
if (rep.get("width"), rep.get("height")) != (1920, 1080):
    problems.append(f"size {rep.get('width')}x{rep.get('height')}")
if problems:
    pathlib.Path("gate-failure.txt").write_text("\n".join(problems) + "\n", encoding="utf-8")
    print("GATE FAILED:", problems)
    sys.exit(3)

desc = (out / "description.txt").read_text(encoding="utf-8").strip().split("\n")[1:]
n = len(spec.get("words", []))
lead = spec.get("summary") or (
    f"ネイティブは普通に使う上級英単語を{n}語、まとめて覚えます。\n"
    "1語ずつ「発音 → 意味 → 例文 → リピート」をテンポよく。10語ごとに、日本語から英語を思い出すテストがあります。")
body = "\n".join([lead, "", *desc, "", "#英単語 #英語学習 #語彙力 #英語リスニング #CEFR"]).strip()
tags = ["英単語", "英語学習", "語彙力", "上級英語", "English vocabulary", "advanced English", "CEFR"]
tags += sorted({w["cefr"] for w in spec.get("words", []) if w.get("cefr")})
tags += [w["word"] for w in spec.get("words", [])[:8]]
(Q / "pending").mkdir(parents=True, exist_ok=True)
mp4 = Q / "pending" / f"{pid}.mp4"
shutil.copy(out / "video.mp4", mp4)
req = {"sourceRepo": "nomuonji/animation-factory", "sourceSha": (af / ".sha").read_text().strip(),
       "assetName": mp4.name, "sha256": hashlib.sha256(mp4.read_bytes()).hexdigest(),
       "title": film["title"][:100], "description": body[:5000], "categoryId": "27", "tags": tags,
       "script": name, "scriptDir": "longform"}
(Q / "pending" / name.replace(".json", ".request.json")).write_text(
    json.dumps(req, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("request written for", pid, rep["duration"], "s")
