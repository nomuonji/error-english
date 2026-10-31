#!/usr/bin/env python3
"""Keep the publish queue stocked: write new scripts with OpenCode Go when it runs low.

usage: replenish.py [--min 6] [--max-new 2] [--dry-run]

- Counts queued scripts; while fewer than --min, writes up to --max-new new scripts,
  alternating with the pattern of the last queued one (beat <-> quiz).
- The model gets the content ledger (every word already taught or queued) and must pick
  CEFR C1-C2 words that are not in it, avoiding the stock Eiken-1 word-list favourites.
- A second call checks the draft (meaning, IPA, natural example, highlight) and may fix it.
- Only drafts that pass the same gate as the renderer (beat_to_request.check_spec +
  content_ledger.repeats) are written to publish-queue/scripts/NNNN-<id>.json.

Env: OPENCODE_GO_API_KEY (required), OPENCODE_GO_MODEL (default deepseek-v4.1-flash),
OPENCODE_GO_VERIFY_MODEL (default = OPENCODE_GO_MODEL), OPENCODE_GO_BASE_URL.
"""
import datetime as dt
import json
import os
import pathlib
import re
import sys
import time
import urllib.error
import urllib.request
import uuid

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import beat_to_request as gate  # noqa: E402
import content_ledger  # noqa: E402

Q = pathlib.Path("publish-queue")
BASE = os.environ.get("OPENCODE_GO_BASE_URL", "https://opencode.ai/inference/go/openai/v1/chat/completions")
MODEL = os.environ.get("OPENCODE_GO_MODEL", "deepseek-v4.1-flash")
VERIFY_MODEL = os.environ.get("OPENCODE_GO_VERIFY_MODEL", MODEL)
SESSION = f"error-english-replenish-{uuid.uuid4().hex[:8]}"
AVOID = ("ubiquitous, mitigate, alleviate, exacerbate, meticulous, ephemeral, pragmatic, scrutinize, "
         "deteriorate, eradicate, augment, adhere, plausible, imminent, inevitable, resilient, ambiguous")


def chat(messages, model=MODEL, effort="low", max_tokens=8192):
    key = os.environ.get("OPENCODE_GO_API_KEY", "").strip()
    if not key:
        raise SystemExit("OPENCODE_GO_API_KEY is not set")
    for attempt in range(4):
        body = json.dumps({"model": model, "messages": messages, "reasoning_effort": effort,
                           "temperature": 0.9, "max_tokens": max_tokens}).encode()
        req = urllib.request.Request(BASE, data=body, headers={
            "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Accept": "application/json",
            "User-Agent": "error-english-replenish/1.0", "x-opencode-session": SESSION})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                data = json.loads(r.read())
            text = (data["choices"][0]["message"].get("content") or "").strip()
            if text:
                return text
            # reasoning used the whole budget: give it more room
            max_tokens = min(max_tokens * 2, 32768)
            print(f"  empty content; retrying with max_tokens={max_tokens}", flush=True)
        except (urllib.error.URLError, KeyError, TimeoutError) as e:
            print(f"  retry after {e}", flush=True)
            time.sleep(4 * (attempt + 1))
    raise RuntimeError("OpenCode Go returned no content")


def parse_json(text):
    m = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    raw = m.group(1) if m else text[text.find("{"): text.rfind("}") + 1]
    return json.loads(raw)


def used_terms():
    return sorted({e["term"] for e in content_ledger.ledger()}, key=str.lower)


BEAT_SCHEMA = """{
  "words": [  // exactly 8
    {"w": "eschew", "ipa": "/ɪsˈtʃuː/", "pos": "動", "ja": "（意図的に）避ける",
     "ex": "She *eschews* social media entirely.", "exJa": "彼女はSNSを一切避けている。"}
  ]
}"""
QUIZ_SCHEMA = """{
  "items": [  // exactly 3; item 1 is "word", items 2-3 are two DIFFERENT patterns from phrase / upgrade / vs
    {"pattern": "word", "id": "en-word-petrichor", "word": "petrichor", "pos": "名詞", "ja": "雨が降り始めた時の土の匂い",
     "examples": [{"en": ["I love the smell of petrichor."], "ja": ["雨の降り始めの匂いが好きだ"]}],
     "quiz": {"prompt": ["That smell after rain is called ___.", "空欄に入る単語は？"], "answer": "That smell after rain is called petrichor.", "answerJa": "雨のあの匂いを petrichor と言う"}},
    {"pattern": "phrase", "id": "en-phrase-on-tenterhooks", "jp": "ハラハラしながら待ってる",
     "answer": {"en": "I'm on tenterhooks.", "ja": "ハラハラしながら待ってる"}, "emphasis": ["on tenterhooks"],
     "examples": [{"en": ["We were on tenterhooks all night."], "ja": ["一晩中ハラハラしていた"]}],
     "quiz": {"prompt": ["合否の連絡を、ハラハラして待っている", "英語で言ってみて"], "answer": "I'm on tenterhooks waiting for the results.", "answerJa": "結果をハラハラしながら待っている"}},
    {"pattern": "upgrade", "id": "en-upgrade-flabbergasted", "basic": "very surprised", "word": "flabbergasted", "ja": "仰天した・あっけにとられた",
     "hookLines": [{"cap": "すごく驚いた = very surprised"}],
     "examples": [{"en": ["I was flabbergasted by the news."], "ja": ["そのニュースに仰天した"]}],
     "quiz": {"prompt": ["その値段に、仰天した", "英語で言ってみて"], "answer": "I was flabbergasted by the price.", "answerJa": "その値段に仰天した"}},
    {"pattern": "vs", "id": "en-vs-disinterested-uninterested",
     "a": {"word": "disinterested", "ja": "利害関係のない・公平な", "example": "We need a disinterested judge.", "exampleJa": "公平な審判が必要だ"},
     "b": {"word": "uninterested", "ja": "興味がない", "example": "He seemed uninterested in the movie.", "exampleJa": "彼は映画に興味がなさそうだった"},
     "rule": [{"cap": "disinterested ＝ 利害がない → 公平"}, {"cap": "uninterested ＝ 興味がない"}],
     "quiz": {"prompt": ["We want a ___ third party.", "dis？ un？"], "answer": "We want a disinterested third party.", "answerJa": "公平な第三者に入ってほしい"}}
  ]
}"""

RULES = f"""ルール:
- 学習者は英検1級レベルの日本人。CEFR C1〜C2の、ネイティブが実際に使う語・表現だけを選ぶ。
- 英検1級の単語帳の定番すぎる語（例: {AVOID}）は避ける。
- 「使用済み」リストにある語・表現（活用形・言い回し違いを含む）は絶対に使わない。
- 意味・発音記号（アメリカ英語のIPA）・品詞は辞書どおり正確に。自信のない語は選ばない。
- 例文は日常で自然に使う短い文（60文字以内）。和訳は自然な日本語（30文字以内）。意味（ja）は14文字以内。
- 出力は指定のJSONだけ。説明文は書かない。"""


def draft(kind, used, feedback=""):
    schema = BEAT_SCHEMA if kind == "beat" else QUIZ_SCHEMA
    task = ("音ハメ英単語（8語）の台本を作ってください。8語は品詞が偏らないように。ex では見出し語の形を *語* で囲む。pos は 動/形/名/副 の1文字。"
            if kind == "beat" else
            "英語クイズ（3問）の台本を作ってください。1問目は word、2・3問目は phrase / upgrade / vs から異なる2つ。id は en-<pattern>-<見出し語> の英小文字とハイフン。例は形の見本で、中身は使わないこと。")
    msgs = [{"role": "system", "content": "あなたは英語教材の編集者です。正確さを最優先します。"},
            {"role": "user", "content": f"{task}\n\n{RULES}\n\n使用済み（使わない）:\n{', '.join(used)}\n\nJSONの形:\n{schema}"
             + (f"\n\n前回の案は次の理由で不合格でした。直して全体を出し直してください:\n{feedback}" if feedback else "")}]
    return parse_json(chat(msgs))


def verify(kind, body):
    msgs = [{"role": "system", "content": "あなたは英語辞書の校閲者です。誤りに厳しく、正しいものはそのまま通します。"},
            {"role": "user", "content": "次の英語教材JSONを校閲してください。各項目の意味・品詞・発音記号・例文の自然さ・和訳・*語* の囲み・クイズの答えが正しいか確認し、"
             "誤りがあれば直したJSON全体を返してください。形式: {\"ok\": true/false, \"problems\": [\"...\"], \"fixed\": <直したJSON全体。直す必要がなければ null>}\n\n"
             + json.dumps(body, ensure_ascii=False)}]
    return parse_json(chat(msgs, model=VERIFY_MODEL, effort="high", max_tokens=16384))


def queued():
    return sorted(Q.glob("scripts/*.json"))


def next_number():
    nums = [int(m.group(1)) for p in Q.rglob("*.json") if (m := re.match(r"(\d{4})-", p.name))]
    return max(nums or [0]) + 1


def series_number(kind):
    n = 0
    for p in list(Q.glob("published/*.script.json")) + queued():
        try:
            n += json.loads(p.read_text(encoding="utf-8")).get("pattern") == kind
        except json.JSONDecodeError:
            pass
    return n + 1


def build(kind, body, day):
    n = series_number(kind)
    if kind == "beat":
        ws = " / ".join(w["w"] for w in body["words"][:3])
        return {"id": f"beat-gen-{day}-{n:03d}", "pattern": "beat", "level": "英検1級",
                "title": f"英検1級の単語、何個わかる？ {ws} ほか【音ハメ英単語 #{n}】",
                "summary": "英検1級レベル（CEFR C1〜C2）の単語8個を、ビートに合わせて一気に確認。意味が出る前に答えてみてください。",
                "words": body["words"], "generatedBy": MODEL}
    names = "・".join(it.get("word") or (it.get("answer") or {}).get("en", "").rstrip(".")
                     or f"{it['a']['word']} / {it['b']['word']}" for it in body["items"])
    return {"id": f"quiz-gen-{day}-{n:03d}", "pattern": "quiz", "level": "英検1級",
            "title": f"英語クイズ3問、何問わかる？ {names}"[:88],
            "summary": "英検1級〜それ以上の英語を3問。カードがめくれる前に答えてみてください。",
            "items": body["items"], "generatedBy": MODEL}


def make(kind, day):
    used, feedback = used_terms(), ""
    for attempt in range(4):
        print(f"[{kind}] draft {attempt + 1}", flush=True)
        try:
            body = draft(kind, used, feedback)
            v = verify(kind, body)
            if v.get("fixed"):
                body = v["fixed"]
            spec = build(kind, body, day)
        except (json.JSONDecodeError, KeyError, TypeError, ValueError, RuntimeError) as e:
            feedback = f"JSONが読めない/欠けている: {e}"
            print("  failed:", e, flush=True)
            continue
        problems = gate.check_spec(spec) + content_ledger.repeats(spec, None)
        if not problems:
            if v.get("problems"):
                print(f"  verifier fixed: {v['problems']}", flush=True)
            return spec
        feedback = "\n".join(problems)
        print("  rejected:", problems, flush=True)
    return None


def main():
    args = sys.argv[1:]
    want = int(args[args.index("--min") + 1]) if "--min" in args else 6
    max_new = int(args[args.index("--max-new") + 1]) if "--max-new" in args else 2
    dry = "--dry-run" in args
    q = queued()
    print(f"queued: {len(q)} (min {want})")
    if len(q) >= want:
        return
    last = json.loads(q[-1].read_text(encoding="utf-8")).get("pattern") if q else "quiz"
    kind = "quiz" if last == "beat" else "beat"
    day = dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).strftime("%Y%m%d")
    made = 0
    while len(queued()) < want and made < max_new:
        spec = make(kind, day)
        if spec is None:
            print(f"::warning title=Replenish failed::no {kind} draft passed the gate")
            break
        name = f"{next_number():04d}-{spec['id']}.json"
        text = json.dumps(spec, ensure_ascii=False, indent=2) + "\n"
        if dry:
            print(f"--- would write {name}\n{text}")
            break
        (Q / "scripts" / name).write_text(text, encoding="utf-8")
        print(f"wrote {name}")
        made += 1
        kind = "quiz" if kind == "beat" else "beat"


if __name__ == "__main__":
    main()
