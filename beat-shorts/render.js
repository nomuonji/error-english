// Beat-synced Shorts renderer (three.js scene captured frame by frame, audio mixed with ffmpeg).
// usage: node render.js <spec.json> <out.mp4> [--preview t1,t2,...] [--style ...]
//   --style neon: scene,palette,jpFont,track,excerpt   card (pattern quiz): palette,motif,track,excerpt
//
// 1. style: least recently used scene / palette / font / track excerpt (from the publish log)
// 2. schedule: templates.js turns the spec into timed items; the engine snaps them to the beats
// 3. English pronunciation: tts.py (Kokoro) for every `tts` cue
// 4. frames: window.renderAt(i / FPS) -> JPEG -> ffmpeg; audio: music ducked under the voice + SE
// Writes <out>.style.json next to the video (beat_to_request.py stores it in the publish request).
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn, spawnSync } = require("child_process");
const { chromium } = require("playwright");

const ROOT = __dirname, QUEUE = path.join(ROOT, "..", "publish-queue"), FPS = 30;
const args = process.argv.slice(2);
const [specPath, outPath] = args;
const opt = n => { const i = args.indexOf(n); return i > 0 ? args[i + 1] : null; };
if (!specPath || !outPath) { console.error("usage: node render.js <spec.json> <out.mp4> [--preview t1,t2] [--style scene,palette,font,track,excerpt]"); process.exit(2); }

const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
const STYLES = JSON.parse(fs.readFileSync(path.join(ROOT, "styles.json"), "utf8"));
const track = id => JSON.parse(fs.readFileSync(path.join(ROOT, "tracks", id, "track.json"), "utf8"));

// ------------------------------------------------------------------ style
function history() {
  const out = [];
  for (const dir of ["published", "pending"]) {
    const d = path.join(QUEUE, dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter(f => f.endsWith(".request.json"))) {
      try {
        const r = JSON.parse(fs.readFileSync(path.join(d, f), "utf8"));
        if (r.style) out.push({ when: fs.statSync(path.join(d, f)).mtimeMs, name: f, style: r.style });
      } catch { /* ignore */ }
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name)).map(x => x.style); // queue order = publish order
}
const SKIN = spec.pattern === "quiz" ? "card" : "neon";
function pickStyle() {
  if (opt("--style")) {
    const v = opt("--style").split(",");
    return SKIN === "card"
      ? { skin: "card", palette: v[0], motif: v[1], track: v[2], excerpt: Number(v[3] || 0) }
      : { skin: "neon", scene: v[0], palette: v[1], jpFont: v[2], track: v[3], excerpt: Number(v[4] || 0) };
  }
  const h = history().filter(s => (s.skin || "neon") === SKIN);
  const seed = parseInt(crypto.createHash("sha1").update(spec.id).digest("hex").slice(0, 8), 16);
  const lastUse = (key, val) => { for (let i = h.length - 1; i >= 0; i--) if (key(h[i]) === val) return i; return -1; };
  const choose = (vals, key) => vals.map((v, i) => [lastUse(key, v), (seed + i * 7919) % 1000, v]).sort((a, b) => a[0] - b[0] || a[1] - b[1])[0][2];
  const minDur = spec.pattern === "beat" ? 47 : spec.pattern === "quiz" ? 8 + 16 * spec.items.length * 0.5 : 32;
  const pool = STYLES.trackPools[SKIN];
  const te = choose(pool.flatMap(t => track(t).excerpts.filter(e => track(t).duration - e >= minDur).map(e => `${t}@${e}`)),
    s => `${s.track}@${s.excerpt}`);
  const base = { skin: SKIN, track: te.split("@")[0], excerpt: Number(te.split("@")[1]) };
  if (SKIN === "card") return { ...base, palette: choose(Object.keys(STYLES.cardPalettes), s => s.palette), motif: choose(STYLES.motifs, s => s.motif) };
  return { ...base, scene: choose(STYLES.scenes, s => s.scene), palette: choose(Object.keys(STYLES.palettes), s => s.palette),
    jpFont: choose(STYLES.jpFonts, s => s.jpFont) };
}

const style = pickStyle();
fs.mkdirSync(path.join(ROOT, ".job"), { recursive: true });
fs.writeFileSync(path.join(ROOT, ".job", "spec.json"), JSON.stringify(spec));
fs.writeFileSync(path.join(ROOT, ".job", "style.json"), JSON.stringify(style));
console.log("style:", JSON.stringify(style));

// ------------------------------------------------------------------ server
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".woff2": "font/woff2", ".webp": "image/webp", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.normalize(path.join(ROOT, decodeURIComponent(req.url.split("?")[0])));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});

function run(cmd, a) {
  const r = spawnSync(cmd, a, { encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr || r.stdout}`);
  return r.stdout;
}

// ------------------------------------------------------------------ audio
function mix(info, video, out) {
  const tr = track(style.track), song = path.join(ROOT, "tracks", style.track, "song.mp3");
  const dur = info.duration;
  const tts = info.audio.filter(a => a.tts);
  let voices = [];
  if (tts.length) {
    const jobs = path.join(ROOT, ".job", "tts.json");
    fs.writeFileSync(jobs, JSON.stringify(tts.map(a => a.tts)));
    voices = JSON.parse(run("python3", [path.join(ROOT, "tts.py"), jobs, path.join(ROOT, ".job", "tts")]).trim().split("\n").pop());
  }
  const se = info.audio.filter(a => a.se && fs.existsSync(path.join(ROOT, "assets", "se", `${a.se}.mp3`)));
  const inputs = ["-i", video, "-ss", String(style.excerpt), "-t", dur.toFixed(3), "-i", song];
  const f = [`[1:a]aresample=48000,aformat=channel_layouts=stereo,afade=t=in:d=0.05,afade=t=out:st=${(dur - 1.4).toFixed(2)}:d=1.4,volume=0.85[mus]`];
  const vlabels = [], slabels = [];
  tts.forEach((a, i) => {
    inputs.push("-i", voices[i].file);
    const ms = Math.max(0, Math.round((a.t + 0.02) * 1000));
    f.push(`[${2 + i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms},volume=1.9[v${i}]`);
    vlabels.push(`[v${i}]`);
  });
  se.forEach((a, i) => {
    inputs.push("-i", path.join(ROOT, "assets", "se", `${a.se}.mp3`));
    const ms = Math.max(0, Math.round(a.t * 1000)), idx = 2 + tts.length + i;
    f.push(`[${idx}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms},volume=${a.se === "tick" ? 0.35 : 0.55}[s${i}]`);
    slabels.push(`[s${i}]`);
  });
  let final;
  if (vlabels.length) {
    f.push(`${vlabels.join("")}amix=inputs=${vlabels.length}:normalize=0:duration=longest,apad,atrim=0:${dur.toFixed(3)},asplit=2[vox][key]`);
    f.push(`[mus][key]sidechaincompress=threshold=0.04:ratio=5:attack=15:release=280:makeup=1[duck]`);
    final = ["[duck]", "[vox]", ...slabels];
  } else final = ["[mus]", ...slabels];
  f.push(`${final.join("")}amix=inputs=${final.length}:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11[aout]`);
  run("ffmpeg", ["-y", "-v", "error", ...inputs, "-filter_complex", f.join(";"), "-map", "0:v", "-map", "[aout]",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", dur.toFixed(3), "-movflags", "+faststart", out]);
}

// ------------------------------------------------------------------ main
(async () => {
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/${SKIN === "card" ? "card.html" : "index.html"}`);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 120000 }).catch(() => {});
  if (errors.length || !(await page.evaluate(() => window.READY === true))) throw new Error("scene failed to load: " + errors.join(" | "));
  const info = await page.evaluate(() => window.INFO);
  console.log(`pattern=${spec.pattern} duration=${info.duration.toFixed(2)}s units=${info.units} audio cues=${info.audio.length}`);

  if (opt("--preview")) {
    fs.mkdirSync(outPath, { recursive: true });
    for (const t of opt("--preview").split(",").map(Number)) {
      await page.evaluate(t => window.renderAt(t), t);
      await page.screenshot({ path: path.join(outPath, `t${t.toFixed(2)}.jpg`), type: "jpeg", quality: 85 });
    }
  } else {
    const silent = outPath.replace(/\.mp4$/, ".silent.mp4");
    // ~5 Mbps keeps a 46 s Short near 30 MB (a failed upload commits the mp4 to git).
    const ff = spawn("ffmpeg", ["-y", "-v", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
      "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-maxrate", "5M", "-bufsize", "10M", "-pix_fmt", "yuv420p", silent],
      { stdio: ["pipe", "inherit", "inherit"] });
    const ffDone = new Promise((res, rej) => ff.on("close", c => c === 0 ? res() : rej(new Error("ffmpeg exit " + c))));
    const N = Math.round(info.duration * FPS), t0 = Date.now();
    for (let i = 0; i < N; i++) {
      await page.evaluate(t => window.renderAt(t), i / FPS);
      const buf = await page.screenshot({ type: "jpeg", quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
      if (i % 150 === 0) console.log(`frame ${i}/${N} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end();
    await ffDone;
    if (errors.length) throw new Error("page errors during render: " + errors.join(" | "));
    mix(info, silent, outPath);
    fs.unlinkSync(silent);
    fs.writeFileSync(outPath.replace(/\.mp4$/, ".style.json"), JSON.stringify(style));
    // review sheet: 8 frames spread over the video
    const sel = Array.from({ length: 8 }, (_, i) => `eq(n\\,${Math.round(N * (i + 0.5) / 8)})`).join("+");
    spawnSync("ffmpeg", ["-y", "-v", "error", "-i", outPath, "-vf", `select='${sel}',scale=270:480,tile=4x2`, "-frames:v", "1",
      outPath.replace(/\.mp4$/, ".sheet.jpg")], { stdio: "inherit" });
  }
  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
