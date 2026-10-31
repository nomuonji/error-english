// Beat-synced vocabulary Short renderer (three.js scene captured frame by frame).
// usage: node render.js <spec.json> <out.mp4> [--preview t1,t2,...]
// The scene (index.html) is deterministic in time: every frame is renderAt(i / FPS),
// so sync with the music comes from the track's beat map, not from real-time playback.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { chromium } = require("playwright");

const ROOT = __dirname;
const [specPath, outPath] = process.argv.slice(2);
const previewArg = process.argv.indexOf("--preview");
const FPS = 30;
if (!specPath || !outPath) { console.error("usage: node render.js <spec.json> <out.mp4> [--preview t1,t2]"); process.exit(2); }

const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
const track = JSON.parse(fs.readFileSync(path.join(ROOT, "tracks", spec.track, "track.json"), "utf8"));
fs.mkdirSync(path.join(ROOT, ".job"), { recursive: true });
fs.writeFileSync(path.join(ROOT, ".job", "spec.json"), JSON.stringify(spec));

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".woff2": "font/woff2", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.normalize(path.join(ROOT, decodeURIComponent(req.url.split("?")[0])));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 120000 }).catch(() => {});
  if (errors.length || !(await page.evaluate(() => window.READY === true))) throw new Error("scene failed to load: " + errors.join(" | "));

  if (previewArg > 0) {
    fs.mkdirSync(outPath, { recursive: true });
    for (const t of process.argv[previewArg + 1].split(",").map(Number)) {
      await page.evaluate(t => window.renderAt(t), t);
      await page.screenshot({ path: path.join(outPath, `t${t.toFixed(2)}.jpg`), type: "jpeg", quality: 85 });
    }
  } else {
    const song = path.join(ROOT, "tracks", spec.track, "song.mp3");
    // Size cap matters: a failed run commits the mp4 to git. ~5 Mbps keeps a 46 s Short near 30 MB.
    const ff = spawn("ffmpeg", ["-y", "-v", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
      "-i", song, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-maxrate", "5M", "-bufsize", "10M",
      "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", outPath], { stdio: ["pipe", "inherit", "inherit"] });
    const ffDone = new Promise((res, rej) => ff.on("close", c => c === 0 ? res() : rej(new Error("ffmpeg exit " + c))));
    const N = Math.round(track.duration * FPS), t0 = Date.now();
    for (let i = 0; i < N; i++) {
      await page.evaluate(t => window.renderAt(t), i / FPS);
      const buf = await page.screenshot({ type: "jpeg", quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
      if (i % 150 === 0) console.log(`frame ${i}/${N} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end();
    await ffDone;
    if (errors.length) throw new Error("page errors during render: " + errors.join(" | "));
    // contact sheet of the word slams for the review artifact
    const sheet = outPath.replace(/\.mp4$/, ".sheet.jpg");
    const L = track.layout;
    const beats = JSON.parse(fs.readFileSync(path.join(ROOT, "tracks", spec.track, "beats.json"), "utf8"));
    const ts = spec.words.map((_, j) => beats[L.introBeats + j * L.beatsPerWord + 7] + track.beatOffset - 0.1);
    const sel = ts.map(t => `eq(n\\,${Math.round(t * FPS)})`).join("+");
    await new Promise(r => spawn("ffmpeg", ["-y", "-v", "error", "-i", outPath, "-vf", `select='${sel}',scale=270:480,tile=4x2`, "-frames:v", "1", sheet], { stdio: "inherit" }).on("close", r));
  }
  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
