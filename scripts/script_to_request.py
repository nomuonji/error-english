#!/usr/bin/env python3
"""After Animation Factory rendered a lesson script: gate it and write a publish request.

usage: script_to_request.py <queue-script-file> <animation-factory-dir>
Writes publish-queue/pending/<same-name>.request.json and <id>.mp4 (runner only).
Exit 3 (with a reason file) when an automatic gate fails.
"""
import hashlib
import json
import pathlib
import re
import shutil
import sys

name, af = sys.argv[1], pathlib.Path(sys.argv[2])
Q = pathlib.Path("publish-queue")
spec = json.loads((Q / "scripts" / name).read_text(encoding="utf-8"))
pid = spec["id"]
out = af / "outputs" / "shorts" / pid
rep = json.loads((out / "report.json").read_text(encoding="utf-8"))
brief = json.loads((af / "productions" / pid / "short.json").read_text(encoding="utf-8"))

problems = []
if rep.get("status") != "technical_pass":
    problems.append(f"render status {rep.get('status')}")
if not 20 <= float(rep["seconds"]) <= 120:
    problems.append(f"length {rep['seconds']}s outside 20-120s")
lufs = rep.get("loudness", {}).get("integratedLUFS")
if lufs is None or not -19 <= float(lufs) <= -11:
    problems.append(f"loudness {lufs} LUFS outside -19..-11")
for w in rep.get("warnings", []):
    if "clip line is long" in w and len(w) > 140:
        problems.append(w)
if problems:
    pathlib.Path("gate-failure.txt").write_text("\n".join(problems) + "\n", encoding="utf-8")
    print("GATE FAILED:", problems)
    sys.exit(3)

series = {"word": "ちょっと難しい英単語", "upgrade": "very から卒業", "vs": "どっちを使う？", "phrase": "言えそうで言えない一言"}
hashtags = {"word": "#英単語 #英語学習 #語彙力", "upgrade": "#英語表現 #英語学習 #語彙力",
            "vs": "#英語の違い #英語学習 #英文法", "phrase": "#英語フレーズ #英会話 #英語学習"}
p = spec["pattern"]
desc = (out / "description.txt").read_text(encoding="utf-8").strip().split("\n")[2:]
desc = [re.sub(r"^映像: ", "写真: ", l) for l in desc]
body = "\n".join([spec.get("summary", ""), "", *desc, "", hashtags[p] + " #shorts"]).strip()
tags = ["英語学習", series[p], "英語", "English vocabulary", "advanced English"]
for k in ("word", "basic"):
    if spec.get(k):
        tags.append(spec[k])
if p == "vs":
    tags += [spec["a"]["word"], spec["b"]["word"]]
if p == "phrase":
    tags.append(spec["answer"]["en"])
mp4 = Q / "pending" / f"{pid}.mp4"
shutil.copy(out / "video.mp4", mp4)
req = {"sourceRepo": "nomuonji/animation-factory", "sourceSha": (af / ".sha").read_text().strip(),
       "assetName": mp4.name, "sha256": hashlib.sha256(mp4.read_bytes()).hexdigest(),
       "title": brief["title"][:100], "description": body[:5000], "categoryId": "27", "tags": tags,
       "script": name}
(Q / "pending" / name.replace(".json", ".request.json")).write_text(
    json.dumps(req, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("request written for", pid, rep["seconds"], "s")
