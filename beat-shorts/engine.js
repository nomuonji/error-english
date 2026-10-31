// Runtime: spec + style + track -> deterministic frames. window.renderAt(t) draws time t.
// window.INFO = { duration, audio: [{ t, tts | se }], style } for render.js (TTS + mix).
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { build } from "./templates.js";
import { SCENES } from "./scenes.js";

const W = 1080, H = 1920, UNIT = 0.48;
const get = p => fetch(p).then(r => { if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); });
const [SPEC, STYLE, STYLES] = await Promise.all([get(".job/spec.json"), get(".job/style.json"), get("styles.json")]);
const TDIR = `tracks/${STYLE.track}/`;
const [TRACK, BEATS_ALL, SPEC_AUDIO] = await Promise.all(["track.json", "beats.json", "spectrum.json"].map(f => get(TDIR + f)));
const PAL = STYLES.palettes[STYLE.palette];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const easeBack = x => { x = clamp(x); const c = 2.2; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

// ---------------------------------------------------------------- timing
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
window.INFO = {
  duration: DURATION, excerpt: EX, track: STYLE.track, style: STYLE,
  audio: S.audio.map(a => ({ ...a, t: T(a.at) })), units: S.units, firstWordT: T(8),
};
function beatIndex(t) { let lo = 0, hi = B.length - 1; if (t < B[0]) return -1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (B[m] <= t) lo = m; else hi = m - 1; } return lo; }

// ---------------------------------------------------------------- three
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(PAL.bg);
scene.fog = new THREE.FogExp2(new THREE.Color(PAL.bg), 0.016);
const camera = new THREE.PerspectiveCamera(62, W / H, 0.1, 400); camera.position.set(0, 0, 18);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.8, 0.5, 0.35);
composer.addPass(bloom); composer.addPass(new OutputPass());
let seed = [...SPEC.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const updateScene = SCENES[STYLE.scene](THREE, scene, camera, rnd);
const baseCam = camera.position.clone();

// ---------------------------------------------------------------- DOM
const ui = document.getElementById("ui");
ui.style.setProperty("--bg", PAL.bg);
document.documentElement.style.setProperty("--bg", PAL.bg);
ui.style.setProperty("--jp", `"${STYLE.jpFont}"`);
const flash = document.getElementById("flash"), bar = document.getElementById("bar"), barFill = bar.querySelector("i");
const mascot = document.getElementById("mascot");
const FACES = { smile: "assets/mascot/smile.webp", talk: "assets/mascot/talk.webp", cry: "assets/mascot/cry.webp" };
await Promise.all(Object.values(FACES).map(src => new Promise(r => { const i = new Image(); i.onload = r; i.onerror = r; i.src = src; })));

const items = S.items.map(it => {
  const el = document.createElement("div");
  el.className = `slot ${it.slot}`;
  if (it.slot === "tag") el.innerHTML = `<span>${it.html}</span>`;
  else if (it.anim === "type") {
    const words = it.html.split(/ (?![^<]*>)/);
    el.innerHTML = words.map(w => `<span class="w">${w}</span>`).join(" ");
  } else el.innerHTML = it.html;
  ui.insertBefore(el, flash);
  return { ...it, el, t0: T(it.at), t1: T(it.until), words: it.anim === "type" ? [...el.querySelectorAll(".w")] : null };
});
await document.fonts.ready;
await Promise.all([...document.fonts].map(f => f.load().catch(() => {})));
// shrink one-line slots that would overflow the safe width
for (const it of items) {
  if (!["hero", "heroA", "heroB", "mean", "cue", "count"].includes(it.slot)) continue;
  it.el.style.whiteSpace = "nowrap";
  const fs = parseFloat(getComputedStyle(it.el).fontSize), r = document.createRange(); r.selectNodeContents(it.el);
  const w = r.getBoundingClientRect().width;
  if (w > 940) it.el.style.fontSize = Math.floor(fs * 940 / w) + "px";
}

const accentAt = t => { let i = 0; for (const a of S.accent) if (T(a.at) <= t) i = a.i; return PAL.colors[i % PAL.colors.length]; };
const slamTimes = items.filter(i => i.anim === "slam").map(i => i.t0).sort((a, b) => a - b);

// ---------------------------------------------------------------- frame
window.renderAt = function (t) {
  const bi = beatIndex(t), tb = bi >= 0 ? B[bi] : 0, since = bi >= 0 ? t - tb : 99;
  const isDown = bi >= 0 && bi % 4 === 0;
  const kick = Math.exp(-since / 0.11) * (isDown ? 1.0 : 0.65);
  const fi = Math.min(SPEC_AUDIO.rms.length - 1, Math.max(0, Math.round((t + EX) * SPEC_AUDIO.fps)));
  const rms = SPEC_AUDIO.rms[fi], bands = SPEC_AUDIO.bands[fi];
  const hex = accentAt(t), color = new THREE.Color(hex);
  const color2 = new THREE.Color(PAL.colors[(PAL.colors.indexOf(hex) + 1) % PAL.colors.length]);
  ui.style.setProperty("--c", hex);

  for (const it of items) {
    const { el, t0, t1 } = it;
    if (t < t0 || t >= t1) { el.style.opacity = 0; continue; }
    const d = t - t0, exit = clamp((t1 - t) / 0.1);
    let op = clamp(d / 0.06), tf = "";
    if (it.anim === "slam") tf = `scale(${1.7 - 0.7 * easeBack(d / 0.2)})`;
    else if (it.anim === "pop") tf = `scale(${0.5 + 0.5 * easeBack(d / 0.22)})`;
    else if (it.anim === "up") tf = `translateY(${40 * (1 - easeOut(d / 0.25))}px)`;
    else if (it.anim === "fade") op = clamp(d / 0.15);
    else if (it.anim === "type") {
      const span = Math.max(0.6, Math.min(1.8, (t1 - t0) * 0.45)), n = it.words.length;
      it.words.forEach((w, i) => { const a = clamp((d - span * i / n) / 0.08); w.style.opacity = a; w.style.transform = `translateY(${12 * (1 - a)}px)`; });
    }
    el.style.opacity = op * exit; el.style.transform = tf;
  }

  // flash
  let fl = 0;
  for (const f of S.fx) { const d = t - T(f.at); if (d >= 0 && d < 0.08) fl = Math.max(fl, f.flash * (1 - d / 0.08)); }
  flash.style.opacity = fl;

  // progress bar
  const [p0, p1] = S.progress;
  bar.style.opacity = t >= T(p0) && t < T(p1) ? 1 : 0;
  barFill.style.width = clamp((t - T(p0)) / (T(p1) - T(p0))) * 100 + "%";

  // mascot: talk alternates mouth on every beat; cry/smile hold
  const m = S.mascot.find(x => t >= T(x.at) && t < T(x.until));
  if (m) {
    const face = m.face === "talk" ? (bi % 2 ? "talk" : "smile") : m.face;
    if (mascot.dataset.face !== face) { mascot.src = FACES[face]; mascot.dataset.face = face; }
    const d = t - T(m.at), out = clamp((T(m.until) - t) / 0.15);
    mascot.style.opacity = clamp(d / 0.12) * out;
    mascot.style.transform = `translateY(${(1 - easeOut(d / 0.25)) * 120 + (1 - out) * 120}px) scale(${1 + kick * 0.05}, ${1 - kick * 0.04})`;
  } else mascot.style.opacity = 0;

  // shake on slams that land on a beat
  const lastSlam = slamTimes.filter(s => s <= t).pop();
  const sh = lastSlam != null ? Math.exp(-(t - lastSlam) / 0.08) : 0;
  ui.style.transform = sh > 0.02 ? `translate(${Math.sin(t * 61) * 10 * sh}px, ${Math.cos(t * 59) * 10 * sh}px)` : "";

  camera.position.x = baseCam.x + Math.sin(t * 53) * 0.3 * sh;
  camera.position.y = (STYLE.scene === "city" ? camera.position.y : baseCam.y) + Math.cos(t * 47) * 0.3 * sh;
  camera.fov = 62 - kick * 3; camera.updateProjectionMatrix();
  const travel = t * 9 + Math.max(0, bi) * 1.6 + (1 - Math.exp(-since / 0.15)) * 1.6;
  updateScene({ t, kick, down: isDown, rms, bands, color, color2, travel });
  bloom.strength = 0.7 + kick * 0.45;
  composer.render();
};
window.READY = true;
window.renderAt(0);
