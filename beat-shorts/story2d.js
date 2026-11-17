// Flat 2D skins for the "story" pattern (no three.js): chat | paper | poster.
// Same contract as engine.js: window.renderAt(t) draws time t, window.INFO = { duration, audio, ... }.
// Added 2026-11-17 for the Shorts recovery experiment: give the channel looks that are
// visibly unlike the neon particle template every earlier video used.
import { build } from "./templates.js";

const UNIT = 0.48;
const get = p => fetch(p).then(r => { if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); });
const [SPEC, STYLE, STYLES] = await Promise.all([get(".job/spec.json"), get(".job/style.json"), get("styles.json")]);
const TDIR = `tracks/${STYLE.track}/`;
const [TRACK, BEATS_ALL] = await Promise.all(["track.json", "beats.json"].map(f => get(TDIR + f)));
const PAL = STYLES.cardPalettes[STYLE.palette];
const THEME = STYLE.theme;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const easeBack = x => { x = clamp(x); const c = 2.2; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

// ---------------------------------------------------------------- timing (identical to engine.js)
const EX = STYLE.excerpt || 0;
const B = BEATS_ALL.map(b => b + TRACK.beatOffset - EX).filter(b => b >= -0.001 && b < TRACK.duration - EX);
const period = TRACK.period || (B[B.length - 1] - B[0]) / (B.length - 1);
const S = build(SPEC);
const k = Math.max(1, Math.round(UNIT / period));
const exact = Math.abs(k * period - UNIT) / UNIT < 0.12;
const unitBeat = u => exact ? Math.round(u * k) : Math.round((u * UNIT) / period);
const beatT = i => i < B.length ? B[i] : B[B.length - 1] + (i - B.length + 1) * period;
const T = u => beatT(unitBeat(u));
const DURATION = Math.min(TRACK.duration - EX, T(S.units) + 1.2);
window.INFO = { duration: DURATION, excerpt: EX, track: STYLE.track, style: STYLE,
  audio: S.audio.map(a => ({ ...a, t: T(a.at) })), units: S.units, firstWordT: T(8) };
function beatIndex(t) { let lo = 0, hi = B.length - 1; if (t < B[0]) return -1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (B[m] <= t) lo = m; else hi = m - 1; } return lo; }

// ---------------------------------------------------------------- page
const root = document.getElementById("root");
root.classList.add(THEME);
for (const [k2, v] of Object.entries(PAL)) root.style.setProperty(`--${k2}`, v);
const keep = { chat: ["bg", "head", "view", "foot", "flash"], paper: ["bg", "brand", "bar", "flash"], poster: ["bg", "disc", "brand", "bar", "flash"] }[THEME];
if (!keep) throw new Error(`unknown flat theme ${THEME}`);
for (const el of [...root.children]) if (!keep.includes(el.id)) el.remove();
const flash = document.getElementById("flash");
const barFill = document.querySelector("#bar i");
// poster: the colour field changes with each accent cue
const FIELDS = [[PAL.ink, PAL.a1, PAL.bg1, PAL.a3], [PAL.a1, PAL.ink, PAL.bg1, PAL.a3], [PAL.a2, PAL.ink, PAL.bg1, PAL.ink], [PAL.bg2, PAL.a1, PAL.ink, PAL.a1]];
const accentAt = t => { let i = 0; for (const a of S.accent) if (T(a.at) <= t) i = a.i; return i; };

const events = SPEC.storyboard;
const storyItems = S.items.filter(i => i.slot === "story");
let items;
if (THEME === "chat") {
  // every event is one message; it stays in the thread after its time (a chat keeps history)
  const feed = document.getElementById("feed");
  const sizes = { small: 40, medium: 46, large: 58, huge: 76 };
  items = storyItems.map((it, i) => {
    const ev = events[i], el = document.createElement("div");
    const voice = ev.speech?.voice;
    const kind = (ev.size === "large" || ev.size === "huge") && (i === 0 || !voice) ? "card"
      : voice === "am_michael" ? "l" : voice === "af_heart" ? "r" : "sys";
    el.className = `msg ${kind}`;
    el.style.fontSize = (kind === "sys" ? 36 : sizes[ev.size] || sizes.medium) + "px";
    el.innerHTML = it.html;
    feed.appendChild(el);
    return { el, t0: T(it.at), kind };
  });
} else {
  const positions = { upper: { top: 330, height: 440 }, center: { top: 690, height: 560 }, lower: { top: 1050, height: 520 } };
  const sizes = THEME === "poster" ? { small: 50, medium: 66, large: 92, huge: 128 } : { small: 46, medium: 60, large: 80, huge: 108 };
  items = storyItems.map(it => {
    const el = document.createElement("div"), p = positions[it.position] || positions.center;
    el.className = "slot";
    Object.assign(el.style, { top: p.top + "px", height: p.height + "px", alignItems: it.align === "left" ? "flex-start" : "center",
      textAlign: it.align === "left" ? "left" : "center", fontSize: (sizes[it.size] || sizes.large) + "px" });
    const html = it.anim === "type" ? it.html.split(/ (?![^<]*>)/).map(w => `<span class="w">${w}</span>`).join(" ") : it.html;
    el.innerHTML = `<div class="story-text">${html}</div>`;
    root.insertBefore(el, flash);
    return { el, t0: T(it.at), t1: T(it.until), anim: it.anim, position: it.position, words: it.anim === "type" ? [...el.querySelectorAll(".w")] : null };
  });
}
await document.fonts.ready;
await Promise.all([...document.fonts].map(f => f.load().catch(() => {})));
if (THEME !== "chat") for (const it of items) {
  const inner = it.el.firstElementChild, maxH = it.el.clientHeight - 20;
  let fs = parseFloat(getComputedStyle(it.el).fontSize);
  while ((inner.scrollWidth > it.el.clientWidth || inner.scrollHeight > maxH) && fs > 36) { fs -= 2; it.el.style.fontSize = fs + "px"; }
}

// ---------------------------------------------------------------- frame
window.renderAt = function (t) {
  const bi = beatIndex(t), since = bi >= 0 ? t - B[bi] : 99, kick = Math.exp(-since / 0.12);
  if (THEME === "chat") {
    for (const it of items) {
      const d = t - it.t0;
      if (d < 0) { it.el.style.display = "none"; continue; }
      it.el.style.display = "block";
      const a = easeBack(d / 0.28);
      it.el.style.transform = `scale(${0.6 + 0.4 * a})`;
      it.el.style.opacity = clamp(d / 0.12);
    }
  } else {
    for (const it of items) {
      const { el, t0, t1 } = it;
      if (t < t0 || t >= t1) { el.style.opacity = 0; continue; }
      const d = t - t0, exit = clamp((t1 - t) / 0.1);
      let op = clamp(d / 0.06), tf = "";
      if (it.anim === "slam") tf = `scale(${1.5 - 0.5 * easeBack(d / 0.22)})`;
      else if (it.anim === "pop") tf = `scale(${0.6 + 0.4 * easeBack(d / 0.24)})`;
      else if (it.anim === "up") tf = `translateY(${36 * (1 - easeOut(d / 0.25))}px)`;
      else if (it.anim === "fade") op = clamp(d / 0.15);
      else if (it.anim === "type") {
        const span = Math.max(0.6, Math.min(1.8, (t1 - t0) * 0.45)), n = it.words.length;
        it.words.forEach((w, i) => { const a = clamp((d - span * i / n) / 0.08); w.style.opacity = a; w.style.transform = `translateY(${10 * (1 - a)}px)`; });
      }
      if (THEME === "paper" && it.anim !== "type") tf += ` rotate(${(it.position === "upper" ? -1 : it.position === "lower" ? 0.8 : 0)}deg)`;
      el.style.opacity = op * exit; el.style.transform = tf;
    }
    const [p0, p1] = S.progress || [0, S.units];
    if (barFill) barFill.style.width = clamp((t - T(p0)) / (T(p1) - T(p0))) * 100 + "%";
  }
  if (THEME === "poster") {
    const [field, disc, fg, hlc] = FIELDS[accentAt(t) % FIELDS.length];
    root.style.setProperty("--field", field); root.style.setProperty("--disc", disc);
    root.style.setProperty("--fg", fg); root.style.setProperty("--hlc", hlc);
    document.getElementById("disc").style.transform = `scale(${1 + kick * 0.035}) translateY(${Math.sin(t * 0.6) * 30}px)`;
  }
  let fl = 0;
  for (const f of S.fx) { const d = t - T(f.at); if (d >= 0 && d < 0.08) fl = Math.max(fl, f.flash * 0.6 * (1 - d / 0.08)); }
  flash.style.opacity = fl;
};
window.READY = true;
window.renderAt(0);
