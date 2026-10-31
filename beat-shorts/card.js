// Card skin ("quiz" pattern): a light, flat 2D quiz show — deliberately unlike the neon beat skin.
// 3-4 one-target lessons per video; each question: card in -> timer drains over 3 beats ->
// card flips to the answer (pronounced) -> example bubble. window.renderAt(t), window.INFO as engine.js.
const W = 1080, H = 1920, UNIT = 0.48;
const get = p => fetch(p).then(r => { if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); });
const [SPEC, STYLE, STYLES] = await Promise.all([get(".job/spec.json"), get(".job/style.json"), get("styles.json")]);
const TDIR = `tracks/${STYLE.track}/`;
const [TRACK, BEATS_ALL] = await Promise.all(["track.json", "beats.json"].map(f => get(TDIR + f)));
const PAL = STYLES.cardPalettes[STYLE.palette];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const easeInOut = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const cap = x => (x == null ? "" : typeof x === "string" ? x : x.cap ?? "");
function hl(text, terms) {
  let out = esc(text);
  for (const t of terms.filter(Boolean).sort((a, b) => b.length - a.length)) {
    const stem = t.includes(" ") ? t : t.length > 6 ? t.slice(0, -2) : t;
    const re = new RegExp(`(?<![\\w>])(${stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\w']*)`, "i");
    if (re.test(out)) return out.replace(re, m => `<span class="hl">${m.replace(/ /g, "&nbsp;")}</span>`);
  }
  return out;
}

// ---------------------------------------------------------------- questions
function question(it) {
  const ex = (it.examples || [])[0] || {};
  const exEn = (ex.en || []).join(" "), exJa = (ex.ja || []).join(" ");
  switch (it.pattern) {
    case "word": return { label: "この単語の意味は？", q: `<div class="qmain en">${esc(it.word)}</div><div class="qsub">${esc(it.pos || "")}</div>`,
      sayQ: it.word, a: `<div class="amain">${esc(it.ja)}</div><div class="asub en">${esc(it.word)}</div>`, sayA: it.word,
      exEn, exJa, terms: [it.word, ...(it.emphasis || [])] };
    case "phrase": return { label: "英語で言うと？", q: `<div class="qmain">「${esc(it.jp)}」</div>`,
      a: `<div class="amain en">${esc(it.answer.en)}</div><div class="asub">${esc(it.answer.ja)}</div>`, sayA: it.answer.en,
      exEn, exJa, terms: [...(it.emphasis || []), it.answer.en] };
    case "upgrade": return { label: "もっと強く言うと？", q: `<div class="qmain en">${esc(it.basic)}</div><div class="qsub">${esc(cap(it.hookLines?.[0]))}</div>`,
      sayQ: it.basic, a: `<div class="amain en">${esc(it.word)}</div><div class="asub">${esc(it.ja)}</div>`, sayA: it.word,
      exEn, exJa, terms: [it.word, ...(it.emphasis || [])] };
    case "vs": {
      const p = cap(it.quiz.prompt?.[0]);
      return { label: "空欄に入るのは？", q: `<div class="qmain en" style="font-size:72px">${esc(p)}</div><div class="qsub"><span class="opt">${esc(it.a.word)}</span><span class="opt">${esc(it.b.word)}</span></div>`,
        a: `<div class="amain en" style="font-size:66px">${hl(it.quiz.answer, [it.a.word, it.b.word])}</div><div class="asub">${esc(it.quiz.answerJa)}</div>`, sayA: it.quiz.answer,
        exEn: it.b.example, exJa: `${it.b.word} ＝ ${it.b.ja}`, terms: [it.b.word], sayEx: it.b.example };
    }
  }
  throw new Error(`quiz item pattern ${it.pattern} not supported`);
}

const Q = SPEC.items.map(question);
const PER = 16, INTRO = 4, OUT = 8;
const units = INTRO + Q.length * PER + OUT;

// ---------------------------------------------------------------- timing (units snapped to beats)
const EX = STYLE.excerpt || 0;
const B = BEATS_ALL.map(b => b + TRACK.beatOffset - EX).filter(b => b >= -0.001 && b < TRACK.duration - EX);
const period = TRACK.period;
const k = Math.max(1, Math.round(UNIT / period)), exact = Math.abs(k * period - UNIT) / UNIT < 0.12;
const unitBeat = u => exact ? Math.round(u * k) : Math.round((u * UNIT) / period);
const T = u => { const i = unitBeat(u); return i < B.length ? B[i] : B[B.length - 1] + (i - B.length + 1) * period; };
const audio = [];
Q.forEach((q, i) => {
  const u = INTRO + i * PER;
  if (q.sayQ) audio.push({ at: u + 1, tts: { text: q.sayQ, voice: "af_heart", speed: 1.0 } });
  [2, 3, 4].forEach(d => audio.push({ at: u + d + 1, se: "tick" }));
  audio.push({ at: u + 6, se: "pop" });
  audio.push({ at: u + 6, tts: { text: q.sayA, voice: "af_heart", speed: 0.95 } });
  audio.push({ at: u + 10, tts: { text: q.exEn, voice: i % 2 ? "af_heart" : "am_michael", speed: 0.95 } });
});
const DURATION = Math.min(TRACK.duration - EX, T(units) + 1.2);
window.INFO = { duration: DURATION, excerpt: EX, track: STYLE.track, style: STYLE, units, audio: audio.map(a => ({ ...a, t: T(a.at) })) };

// ---------------------------------------------------------------- DOM
const root = document.documentElement.style;
root.setProperty("--ink", PAL.ink); root.setProperty("--a1", PAL.a1); root.setProperty("--a2", PAL.a2); root.setProperty("--a3", PAL.a3);
const stage = document.getElementById("stage"), dots = document.getElementById("dots"), timer = document.getElementById("timer");
const arc = document.getElementById("arc"), tnum = timer.querySelector(".n"), flash = document.getElementById("flash"), mascot = document.getElementById("mascot");
arc.setAttribute("stroke", PAL.a1);
Q.forEach(() => dots.appendChild(document.createElement("i")));
const intro = document.createElement("div"); intro.className = "title";
intro.innerHTML = `英語クイズ<span class="en">${Q.length}</span>問<small>何問わかる？</small>`; document.body.appendChild(intro);
const outro = document.createElement("div"); outro.className = "title";
outro.innerHTML = `何問できた？<small>保存して、あとで復習</small>`; document.body.appendChild(outro);
mascot.src = "assets/mascot/smile.webp";
const cards = Q.map((q, i) => {
  const c = document.createElement("div"); c.className = "card";
  c.innerHTML = `<div class="face front"><span class="chip">Q${i + 1}</span><div class="label">${q.label}</div>${q.q}</div>
    <div class="face back"><span class="chip">A${i + 1}</span><div class="label">${q.label}</div>${q.a}</div>`;
  stage.appendChild(c);
  const b = document.createElement("div"); b.className = "bubble";
  const words = hl(q.exEn, q.terms).split(/ (?![^<]*>)/).map(w => `<span class="w">${w}</span>`).join(" ");
  b.innerHTML = `<div class="ex">${words}</div><div class="ja">${esc(q.exJa)}</div>`;
  document.body.appendChild(b);
  return { c, b, w: [...b.querySelectorAll(".w")], ja: b.querySelector(".ja"), u: INTRO + i * PER };
});
await document.fonts.ready;
await Promise.all([...document.fonts].map(f => f.load().catch(() => {})));
// shrink long answers/questions to fit the card
for (const el of document.querySelectorAll(".qmain, .amain")) {
  const box = el.parentElement.getBoundingClientRect();
  let fs = parseFloat(getComputedStyle(el).fontSize);
  while ((el.scrollWidth > box.width - 110 || el.getBoundingClientRect().height > 430) && fs > 40) { fs -= 4; el.style.fontSize = fs + "px"; }
}

// ---------------------------------------------------------------- background (2D)
const cv = document.getElementById("bg"), g = cv.getContext("2d");
let seed = [...SPEC.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 11);
const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shapes = Array.from({ length: 26 }, () => ({ x: rnd() * W, y: rnd() * H, r: 30 + rnd() * 110, v: 18 + rnd() * 40, rot: rnd() * 6, c: [PAL.a1, PAL.a2, PAL.a3][Math.floor(rnd() * 3)], a: 0.12 + rnd() * 0.18 }));
function drawBg(t, kick) {
  const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, PAL.bg1); gr.addColorStop(1, PAL.bg2);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  if (STYLE.motif === "stripes") {
    g.save(); g.globalAlpha = 0.10; g.fillStyle = PAL.a3; g.translate(W / 2, H / 2); g.rotate(-0.5);
    for (let i = -30; i < 30; i++) g.fillRect(i * 90 + ((t * 30) % 90), -1400, 40, 2800);
    g.restore();
  }
  if (STYLE.motif === "dots") {
    g.save(); g.fillStyle = PAL.ink; g.globalAlpha = 0.07;
    for (let y = 0; y < H; y += 60) for (let x = (y / 60) % 2 * 30; x < W; x += 60) { g.beginPath(); g.arc(x, (y + t * 20) % H, 6, 0, 7); g.fill(); }
    g.restore();
  }
  for (const s of shapes) {
    const y = ((s.y - t * s.v) % (H + 300) + H + 300) % (H + 300) - 150;
    g.save(); g.globalAlpha = s.a; g.translate(s.x, y); g.rotate(s.rot + t * 0.2); g.fillStyle = s.c; g.strokeStyle = s.c; g.lineWidth = 14;
    const r = s.r * (1 + kick * 0.04);
    if (STYLE.motif === "circles" || STYLE.motif === "dots") { g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); }
    else if (STYLE.motif === "blocks") { g.beginPath(); g.roundRect(-r, -r, r * 2, r * 2, r * 0.35); g.fill(); }
    else { g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); }
    g.restore();
  }
}

function beatIndex(t) { let lo = 0, hi = B.length - 1; if (t < B[0]) return -1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (B[m] <= t) lo = m; else hi = m - 1; } return lo; }

// ---------------------------------------------------------------- frame
window.renderAt = function (t) {
  const bi = beatIndex(t), since = bi >= 0 ? t - B[bi] : 9, kick = Math.exp(-since / 0.12);
  drawBg(t, kick);
  const show = (el, a, b) => t >= T(a) && t < T(b);
  // intro / outro titles
  for (const [el, a, b] of [[intro, 0, INTRO], [outro, units - OUT, units]]) {
    if (show(el, a, b)) { const d = t - T(a); el.style.opacity = clamp(d / 0.15) * clamp((T(b) - t) / 0.15); el.style.transform = `translateY(${30 * (1 - easeOut(d / 0.3))}px)`; }
    else el.style.opacity = 0;
  }
  // progress dots
  [...dots.children].forEach((d, i) => {
    const u = INTRO + i * PER;
    d.className = t >= T(u + PER) ? "done" : t >= T(u) ? "on" : "";
  });
  let fl = 0, timerOn = false;
  cards.forEach(({ c, b, w, ja, u }, i) => {
    const t0 = T(u), tFlip = T(u + 6), tEnd = T(u + PER);
    if (t < t0 || t >= tEnd) { c.style.opacity = 0; b.style.opacity = 0; return; }
    const din = t - t0, dout = tEnd - t;
    const slide = (1 - easeOut(din / 0.35)) * 900 - (1 - clamp(dout / 0.3)) * 900;
    const flip = easeInOut((t - tFlip) / 0.35) * 180;
    c.style.opacity = 1;
    c.style.transform = `translateX(${slide}px) rotateY(${flip}deg) scale(${1 + (t >= tFlip ? Math.exp(-(t - tFlip) / 0.15) * 0.04 : 0)})`;
    if (t >= tFlip && t - tFlip < 0.06) fl = 0.25 * (1 - (t - tFlip) / 0.06);
    // timer: drains over units 3..6
    if (t >= T(u + 3) && t < tFlip) {
      timerOn = true;
      const p = clamp((t - T(u + 3)) / (tFlip - T(u + 3)));
      arc.setAttribute("stroke-dashoffset", String(276.5 * p));
      const left = 3 - Math.floor(p * 3);
      tnum.textContent = String(Math.max(1, left));
      timer.style.transform = `scale(${1 + kick * 0.08})`;
    }
    // example bubble from unit 10
    const tb = T(u + 10);
    if (t >= tb) {
      const d = t - tb;
      b.style.opacity = clamp(d / 0.12) * clamp(dout / 0.2);
      b.style.transform = `translateY(${30 * (1 - easeOut(d / 0.25))}px)`;
      const span = Math.min(1.4, (T(u + 13) - tb));
      w.forEach((x, j) => { const a = clamp((d - span * j / w.length) / 0.08); x.style.opacity = a; });
      ja.style.opacity = clamp((t - T(u + 13)) / 0.2);
    } else b.style.opacity = 0;
  });
  timer.style.opacity = timerOn ? 1 : 0;
  flash.style.opacity = fl;
  // mascot: only on the closing card, fades in place
  const m0 = T(units - OUT + 1);
  mascot.style.opacity = t >= m0 ? clamp((t - m0) / 0.4) : 0;
};
drawBg(0, 0);
window.READY = true;
window.renderAt(0);
