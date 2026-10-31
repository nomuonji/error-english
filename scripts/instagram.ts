import fs from 'node:fs';
import { preflight, refresh, postReel } from './instagram-reels';

// CLI for workflows: preflight | refresh | post <video.mp4> <caption-file>
async function main() {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'preflight') {
    try {
      console.log(`Instagram auth ok: @${await preflight()}`);
    } catch (e: any) {
      console.log(`::warning title=Instagram not ready::${e.message} — Reels cross-post will be skipped; YouTube is unaffected.`);
      if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'ok=false\n');
      return;
    }
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'ok=true\n');
  } else if (cmd === 'refresh') {
    await refresh();
  } else if (cmd === 'post') {
    console.log('Instagram media id:', await postReel(a, fs.readFileSync(b, 'utf8')));
  } else {
    console.error('usage: preflight | refresh | post <video> <caption-file>');
    process.exit(2);
  }
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
