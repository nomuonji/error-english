#!/usr/bin/env python3
"""Decide what the scheduled publisher does this run.

Prints key=value lines for $GITHUB_OUTPUT:
  kind=none|video|script, file=<name>, reason=<text>
Order: already-rendered videos in pending/ first (reviewed earlier), then lesson
scripts in scripts/ (rendered on the fly). Guards: config.enabled (unless FORCE),
JST daily cap from published/log.json.
"""
import datetime as dt
import json
import os
import pathlib

Q = pathlib.Path("publish-queue")
cfg = json.loads((Q / "config.json").read_text(encoding="utf-8"))
log = json.loads((Q / "published" / "log.json").read_text(encoding="utf-8"))


def jst_day(iso: str) -> str:
    t = dt.datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return (t + dt.timedelta(hours=9)).date().isoformat()


def out(**kw):
    for k, v in kw.items():
        print(f"{k}={v}")


force = os.environ.get("FORCE") == "true"
today = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=9)).date().isoformat()
done = sum(1 for e in log if jst_day(e["publishedAt"]) == today)
if not cfg.get("enabled") and not force:
    out(kind="none", file="", reason="disabled in publish-queue/config.json")
elif done >= int(cfg.get("maxPerDayJst", 2)) and not force:
    out(kind="none", file="", reason=f"daily cap reached ({done} today)")
else:
    videos = sorted(p.name for p in (Q / "pending").glob("*.request.json"))
    scripts = sorted(p.name for p in (Q / "scripts").glob("*.json"))
    if videos:
        out(kind="video", file=videos[0], reason="rendered video waiting")
    elif scripts:
        out(kind="script", file=scripts[0], reason="lesson script waiting")
    else:
        out(kind="none", file="", reason="queue empty")
