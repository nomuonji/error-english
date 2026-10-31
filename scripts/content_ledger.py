#!/usr/bin/env python3
"""Content ledger: every word / phrase the channel has taught or has queued.

Sources: publish-queue/published/*.script.json (published), publish-queue/scripts/*.json
(queued), publish-queue/pending/ requests' scripts, and publish-queue/ledger-extra.json
(videos made outside the queue). Terms are matched loosely: case, punctuation and simple
inflections are ignored (eschew = eschews = eschewed; "I'm on tenterhooks" = "on tenterhooks").

usage:
  content_ledger.py list                 # JSON: every term with where it was used (for script generators)
  content_ledger.py check <script.json>  # exit 3 if the script repeats a term (see "repeatOk")

A script may list deliberate repeats in "repeatOk": ["word", ...] (a review video, say).
"""
import json
import pathlib
import re
import sys

Q = pathlib.Path("publish-queue")


def targets(spec: dict) -> list[str]:
    p = spec.get("pattern")
    if p == "beat":
        return [w["w"] for w in spec.get("words", [])]
    if p == "quiz":
        return [t for it in spec.get("items", []) for t in targets(it)]
    if p in ("word", "upgrade"):
        return [spec["word"]]
    if p == "phrase":
        return [spec["answer"]["en"]]
    if p == "vs":
        return [spec["a"]["word"], spec["b"]["word"]]
    return []


_LEAD = re.compile(r"^(i'm|i am|i was|we're|we were|you're|it's|to|be|get|got)\s+")


def _stem(w: str) -> str:
    for suf, rep in (("ies", "y"), ("ied", "y"), ("ing", ""), ("ed", ""), ("es", ""), ("s", "")):
        if len(w) > len(suf) + 3 and w.endswith(suf) and not w.endswith("ss"):
            w = w[: -len(suf)] + rep
            break
    return w[:-1] if len(w) > 4 and w.endswith("e") else w  # placate / placated / placates


def key(term: str) -> str:
    t = re.sub(r"[^a-z' ]", " ", term.lower()).strip()
    t = _LEAD.sub("", re.sub(r"\s+", " ", t))
    return " ".join(_stem(w) for w in t.split())


def ledger(exclude: pathlib.Path | None = None) -> list[dict]:
    out = []
    files = sorted(Q.glob("published/*.script.json")) + sorted(Q.glob("scripts/*.json"))
    for f in files:
        if exclude and f.resolve() == exclude.resolve():
            continue
        try:
            spec = json.loads(f.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        state = "published" if f.parent.name == "published" else "queued"
        for t in targets(spec):
            out.append({"term": t, "key": key(t), "state": state, "source": f.name})
    extra = Q / "ledger-extra.json"
    if extra.exists():
        for e in json.loads(extra.read_text(encoding="utf-8"))["entries"]:
            for t in e["terms"]:
                out.append({"term": t, "key": key(t), "state": "published", "source": e["source"]})
    return out


def repeats(spec: dict, path: pathlib.Path | None) -> list[str]:
    allowed = {key(x) for x in spec.get("repeatOk", [])}
    used: dict[str, dict] = {}
    for e in ledger(exclude=path):
        used.setdefault(e["key"], e)
    problems, seen = [], set()
    for t in targets(spec):
        k = key(t)
        if k in seen:
            problems.append(f"'{t}' appears twice in this script")
        seen.add(k)
        if k in used and k not in allowed:
            e = used[k]
            problems.append(f"'{t}' was already {e['state']} ({e['source']}); add it to repeatOk only for a deliberate review")
    return problems


def main():
    if sys.argv[1] == "list":
        print(json.dumps(ledger(), ensure_ascii=False, indent=1))
    elif sys.argv[1] == "check":
        path = pathlib.Path(sys.argv[2])
        p = repeats(json.loads(path.read_text(encoding="utf-8")), path)
        for x in p:
            print("REPEAT:", x)
        sys.exit(3 if p else 0)


if __name__ == "__main__":
    main()
