// Scheduled publisher: uploads the next queued English lesson Short to this channel.
// Guards: config.enabled, per-run count, JST daily cap (from our own publish log),
// duplicate assetName/sha256 in the log. Never retries an upload.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { uploadVideo } from './upload-youtube';

type Req = { assetName: string; sha256: string; title: string; description: string; tags?: string[]; categoryId?: string; sourceRepo: string; sourceSha: string };
type LogEntry = { file: string; assetName: string; sha256: string; youtubeVideoId: string; publishedAt: string };

const Q = path.resolve('publish-queue');
const cfg = JSON.parse(fs.readFileSync(path.join(Q, 'config.json'), 'utf8'));
const logPath = path.join(Q, 'published', 'log.json');
const log: LogEntry[] = JSON.parse(fs.readFileSync(logPath, 'utf8'));

function jstDay(d: Date) {
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

async function main() {
  if (process.env.FORCE !== 'true' && !cfg.enabled) {
    console.log('Queue publisher disabled (publish-queue/config.json enabled=false).');
    return;
  }
  const today = jstDay(new Date());
  const doneToday = log.filter((e) => jstDay(new Date(e.publishedAt)) === today).length;
  let budget = Math.min(Number(cfg.perRun ?? 1), Number(cfg.maxPerDayJst ?? 2) - doneToday);
  if (budget <= 0) {
    console.log(`Daily cap reached (${doneToday} today).`);
    return;
  }
  const pending = fs.readdirSync(path.join(Q, 'pending')).filter((f) => f.endsWith('.request.json')).sort();
  if (!pending.length) {
    console.log('Queue is empty.');
    return;
  }
  for (const file of pending) {
    if (budget <= 0) break;
    const reqPath = path.join(Q, 'pending', file);
    const req = JSON.parse(fs.readFileSync(reqPath, 'utf8')) as Req;
    const video = path.join(Q, 'pending', req.assetName);
    if (!/^[A-Za-z0-9._-]+\.mp4$/.test(req.assetName) || !fs.existsSync(video)) throw new Error(`${file}: video missing`);
    if (!req.title || req.title.length > 100) throw new Error(`${file}: bad title`);
    if (!req.description || req.description.length > 5000) throw new Error(`${file}: bad description`);
    const digest = createHash('sha256').update(fs.readFileSync(video)).digest('hex');
    if (digest !== req.sha256) throw new Error(`${file}: sha256 mismatch`);
    if (log.some((e) => e.sha256 === digest || e.assetName === req.assetName)) {
      console.log(`${file}: already published; moving out of the queue.`);
    } else {
      let res;
      try {
        res = await uploadVideo(video, req.title, req.description, req.tags ?? [], req.categoryId ?? '27');
      } catch (error) {
        // An upload may have half-succeeded: park the item so no scheduled run retries it.
        fs.mkdirSync(path.join(Q, 'failed'), { recursive: true });
        fs.renameSync(reqPath, path.join(Q, 'failed', file));
        fs.renameSync(video, path.join(Q, 'failed', req.assetName));
        throw error;
      }
      log.push({ file, assetName: req.assetName, sha256: digest, youtubeVideoId: String(res.id), publishedAt: new Date().toISOString() });
      fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + '\n');
      console.log(`Published ${file}: https://youtube.com/shorts/${res.id}`);
      budget -= 1;
    }
    fs.renameSync(reqPath, path.join(Q, 'published', file));
    fs.unlinkSync(video); // the video stays in git history; the queue keeps only what is pending
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
