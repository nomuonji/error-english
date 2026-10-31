// Templates: lesson spec -> schedule of timed items.
// Times are in "units". The engine snaps every unit to the nearest beat of the track, so the
// same template lands on the beat at 127 BPM or 161 BPM. A unit is ~0.47-0.5 s.
//
// item  : { slot, html, at, until, anim }   anim: slam | pop | up | type | fade
// audio : { at, tts: { text, voice, speed } } | { at, se: "pop" }
// fx    : { at, flash }
// mascot: { at, until, face: "smile" | "talk" | "cry" }
// accent: { at, i }  (palette colour index from that unit on)

export const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const cap = x => (x == null ? "" : typeof x === "string" ? x : x.cap ?? "");

// Wrap occurrences of target words (and their inflections) in <span class="hl">.
function hl(text, terms) {
  let out = esc(text);
  const stems = [...new Set(terms.filter(Boolean).flatMap(t => [t, ...t.split(/\s+/)]))]
    .filter(t => t.length >= 3).sort((a, b) => b.length - a.length);
  for (const t of stems) {
    const stem = t.includes(" ") ? t : t.length > 6 ? t.slice(0, t.length - 2) : t;
    const re = new RegExp(`(?<![\\w>])(${stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\w']*)`, "gi");
    if (re.test(out)) { out = out.replace(re, m => `<span class="hl">${m.replace(/ /g, "&nbsp;")}</span>`); break; }
  }
  return out;
}
// "*word*" marks the highlight explicitly (beat vocab specs)
const starred = s => { const m = String(s).match(/^(.*?)\*(.+?)\*(.*)$/); return m ? `${esc(m[1])}<span class="hl">${esc(m[2])}</span>${esc(m[3])}` : esc(s); };

class Sched {
  constructor() { this.items = []; this.audio = []; this.fx = []; this.mascot = []; this.accent = []; this.units = 0; }
  add(slot, html, at, until, anim = "pop") { this.items.push({ slot, html, at, until, anim }); this.units = Math.max(this.units, until); return this; }
  say(at, text, speed = 1.0, voice = "af_heart") { if (text) this.audio.push({ at, tts: { text, voice, speed } }); return this; }
  se(at, name) { this.audio.push({ at, se: name }); return this; }
  flash(at, a = 0.22) { this.fx.push({ at, flash: a }); return this; }
  face(at, until, face) { this.mascot.push({ at, until, face }); return this; }
  color(at, i) { this.accent.push({ at, i }); return this; }
}

function countdown(s, at, label) {
  // three beats: 3, 2, 1 — the viewer answers in their head
  ["3", "2", "1"].forEach((n, k) => s.add("count", n, at + k, at + k + 1, "slam"));
  if (label) s.add("cue", esc(label), at, at + 3, "fade");
}

function examples(s, ex, at, terms, voices = ["af_heart", "am_michael"]) {
  (ex || []).slice(0, 2).forEach((e, i) => {
    const t = at + i * 8;
    const en = (e.en || []).join(" "), ja = (e.ja || []).join(" ");
    s.color(t, i + 1);
    s.add("tag", "例文", t, t + 8, "fade");
    s.add("line1", hl(en, terms), t, t + 8, "type");
    s.say(t, en, 0.95, voices[i % 2]);
    s.add("line2", esc(ja), t + 4, t + 8, "up");
  });
}

function quiz(s, q, at, terms) {
  const p = (q.prompt || []).map(cap);
  s.color(at, 3);
  s.add("tag", "QUIZ", at, at + 12, "slam");
  s.add("line1", esc(p[0] || ""), at, at + 8, "up");
  s.add("cue", esc(p[1] || "英語で言うと？"), at + 1, at + 4, "fade");
  countdown(s, at + 4);
  s.flash(at + 8).se(at + 8, "pop");
  s.add("line1", hl(q.answer, terms), at + 8, at + 12, "slam");
  s.say(at + 8, q.answer, 0.95);
  s.add("line2", esc(q.answerJa || ""), at + 9, at + 12, "up");
}

function outro(s, at, level) {
  s.color(at, 0);
  s.add("big", "保存して<br>復習しよう", at, at + 8, "slam");
  s.add("sub", `${esc(level || "英検1級")}の単語を毎日、音ハメで`, at + 2, at + 8, "up");
  s.face(at + 1, at + 8, "smile");
}

// --------------------------------------------------------------- one word
function word(spec) {
  const s = new Sched(), w = spec.word, terms = [w, ...(spec.emphasis || [])];
  s.color(0, 0);
  s.add("tag", esc(spec.level || "英検1級"), 0, 16, "fade");
  s.add("hero", esc(w), 0, 32, "slam");
  s.say(1, w, 1.0);
  s.add("cue", "この単語、意味わかる？", 1, 4, "fade");
  countdown(s, 4);
  s.flash(8).se(8, "pop");
  s.add("mean", `<span class="pos">${esc((spec.pos || "").slice(0, 1))}</span>${esc(spec.ja)}`, 8, 32, "slam");
  s.add("line1", esc(cap(spec.meaning?.[0])), 10, 16, "up");
  s.say(12, w, 0.8);
  examples(s, spec.examples, 16, terms);
  quiz(s, spec.quiz, 32, terms);
  s.color(44, 0);
  s.add("tag", "今日の単語", 44, 52, "fade");
  s.add("hero", esc(w), 44, 52, "slam");
  s.add("mean", esc(spec.ja), 45, 52, "up");
  s.say(46, w, 0.95);
  outro(s, 52, spec.level);
  return s;
}

// ------------------------------------------------------------- one phrase
function phrase(spec) {
  const s = new Sched(), a = spec.answer, terms = [...(spec.emphasis || []), a.en];
  s.color(0, 0);
  s.add("big", `「${esc(spec.jp)}」`, 0, 8, "slam");
  s.add("cue", "英語で言える？", 1, 4, "fade");
  countdown(s, 4);
  s.flash(8).se(8, "pop");
  s.add("tag", "答え", 8, 16, "fade");
  s.add("hero", esc(a.en), 8, 32, "slam");
  s.add("mean", esc(a.ja), 9, 32, "up");
  s.say(9, a.en, 1.0);
  s.add("line1", esc(cap(spec.meaning?.[0])), 11, 16, "up");
  s.say(13, a.en, 0.8);
  examples(s, spec.examples, 16, terms);
  quiz(s, spec.quiz, 32, terms);
  s.color(44, 0);
  s.add("tag", "今日の一言", 44, 52, "fade");
  s.add("hero", esc(a.en), 45, 52, "slam");
  s.add("mean", esc(a.ja), 46, 52, "up");
  s.say(46, a.en, 0.95);
  outro(s, 52, spec.level);
  return s;
}

// --------------------------------------------------------- very -> stronger
function upgrade(spec) {
  const s = new Sched(), w = spec.word, terms = [w, ...(spec.emphasis || [])];
  s.color(0, 0);
  s.add("hero", esc(spec.basic), 0, 8, "slam");
  s.say(1, spec.basic, 1.0, "am_michael");
  s.add("cue", "もっと強く言うと？", 1, 4, "fade");
  countdown(s, 4);
  s.flash(8).se(8, "pop");
  s.add("ipa", `<s>${esc(spec.basic)}</s> →`, 8, 32, "up");
  s.add("hero", esc(w), 8, 32, "slam");
  s.add("mean", esc(spec.ja), 9, 32, "up");
  s.say(9, w, 1.0);
  s.add("line1", esc(cap(spec.meaning?.[0])), 11, 16, "up");
  s.say(13, w, 0.8);
  examples(s, spec.examples, 16, terms);
  quiz(s, spec.quiz, 32, terms);
  s.color(44, 0);
  s.add("tag", `${esc(spec.basic)} の代わりに`, 44, 52, "fade");
  s.add("hero", esc(w), 44, 52, "slam");
  s.add("mean", esc(spec.ja), 45, 52, "up");
  s.say(46, w, 0.95);
  outro(s, 52, spec.level);
  return s;
}

// --------------------------------------------------------------- A or B
function vs(spec) {
  const s = new Sched(), A = spec.a, B = spec.b;
  s.color(0, 0);
  s.add("heroA", esc(A.word), 0, 44, "slam");
  s.add("vs", "VS", 1, 44, "pop");
  s.add("heroB", esc(B.word), 1, 44, "slam");
  s.add("cue", esc(cap(spec.hookLines?.[0]) || "どっちを使う？"), 2, 4, "fade");
  countdown(s, 4);
  s.flash(8).se(8, "pop");
  s.add("tag", "見分け方", 8, 16, "fade");
  s.add("line1", esc(cap(spec.rule?.[0])), 8, 16, "up");
  s.add("line2", esc(cap(spec.rule?.[1])), 10, 16, "up");
  [[A, 16, "af_heart"], [B, 24, "am_michael"]].forEach(([x, t, v], i) => {
    s.color(t, i + 1);
    s.add("tag", esc(`${x.word} ＝ ${x.ja}`), t, t + 8, "fade");
    s.add("line1", hl(x.example, [x.word]), t, t + 8, "type");
    s.say(t, x.example, 0.95, v);
    s.add("line2", esc(x.exampleJa), t + 4, t + 8, "up");
  });
  s.add("dimB", "", 16, 24, "fade");
  s.add("dimA", "", 24, 32, "fade");
  quiz(s, spec.quiz, 32, [A.word, B.word]);
  s.color(44, 0);
  s.add("tag", "今日のポイント", 44, 52, "fade");
  s.add("heroA", esc(A.word), 44, 52, "slam");
  s.add("heroB", esc(B.word), 44, 52, "slam");
  s.add("line1", esc(cap(spec.recap?.[0])), 45, 52, "up");
  s.add("line2", esc(cap(spec.recap?.[1])), 47, 52, "up");
  s.say(45, A.word, 0.95);
  s.say(47, B.word, 0.95, "am_michael");
  outro(s, 52, spec.level);
  return s;
}

// ------------------------------------------------- eight words on the beat
function vocab8(spec) {
  const s = new Sched(), W = spec.words, N = W.length, level = esc(spec.level || "英検1級");
  const nw = String(N).padStart(2, "0");
  s.color(0, 0);
  s.add("big", level.replace(/(\d+)/g, "<span class='en'>$1</span>"), 0, 4, "slam");
  s.add("sub", `<span class='en'>${N} WORDS</span>`, 2, 4, "up");
  s.add("big", "何個<br>わかる？", 4, 8, "slam");
  s.add("sub", "意味が出る前に答えて", 6, 8, "up");
  W.forEach((w, j) => {
    const t = 8 + j * 8;
    s.color(t, j);
    s.flash(t, 0.16);
    s.add("counter", `<b>${String(j + 1).padStart(2, "0")}</b> / ${nw}`, t, t + 8, "fade");
    s.add("tag", level, t, t + 8, "fade");
    s.add("hero", esc(w.w), t, t + 8, "slam");
    s.say(t, w.w, 1.0, j % 2 ? "am_michael" : "af_heart");
    s.add("ipa", esc(w.ipa), t + 1, t + 8, "up");
    s.add("mean", `<span class="pos">${esc(w.pos)}</span>${esc(w.ja)}`, t + 2, t + 8, "pop");
    s.add("line1", starred(w.ex), t + 4, t + 8, "up");
    s.add("line2", esc(w.exJa), t + 6, t + 8, "up");
  });
  const r = 8 + N * 8;
  W.forEach((w, k) => {
    s.color(r + k, k);
    s.add("tag", "RECAP", r, r + N, "fade");
    s.add("counter", `<b>${String(k + 1).padStart(2, "0")}</b> / ${nw}`, r + k, r + k + 1, "fade");
    s.add("hero", esc(w.w), r + k, r + k + 1, "slam");
    s.add("mean", esc(w.ja), r + k, r + k + 1, "pop");
  });
  const o = r + N;
  s.add("big", "全部<br>わかった？", o, o + 8, "slam");
  s.add("sub", "何個わかったかコメントで", o + 2, o + 8, "up");
  outro(s, o + 8, spec.level);
  s.progress = [8, r];
  return s;
}

export const TEMPLATES = { beat: vocab8, word, phrase, upgrade, vs };

export function build(spec) {
  const f = TEMPLATES[spec.pattern];
  if (!f) throw new Error(`unknown pattern ${spec.pattern}`);
  const s = f(spec);
  s.progress = s.progress || [8, 44];
  return s;
}
