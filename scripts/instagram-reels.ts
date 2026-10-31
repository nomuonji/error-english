// Instagram Reels cross-post for the publish queue (after the YouTube upload succeeds).
//
// Token: data/instagram-token.json (refreshed copy kept in the Actions cache) or the
// INSTAGRAM_ACCESS_TOKEN secret. Account: INSTAGRAM_ACCOUNT_ID (Instagram professional account id).
// Works with both token kinds:
//   - Instagram Login token (starts with "IG"): graph.instagram.com, expires in 60 days,
//     refreshed by `refresh` (monthly workflow) into the cache file.
//   - Facebook Login / Page token: graph.facebook.com; a Page token made from a long-lived
//     user token does not expire.
// The video is sent as bytes (resumable upload), so no public hosting is needed.
//
// CLI: scripts/instagram.ts
import fs from 'node:fs';
import path from 'node:path';

const V = 'v21.0';
const CACHE = path.resolve('data/instagram-token.json');

export function token(): string {
  try {
    const t = JSON.parse(fs.readFileSync(CACHE, 'utf8')).access_token;
    if (t) return t;
  } catch { /* fall back to the secret */ }
  const t = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!t) throw new Error('INSTAGRAM_ACCESS_TOKEN is not set');
  return t;
}
const host = (t: string) => (t.startsWith('IG') ? 'https://graph.instagram.com' : 'https://graph.facebook.com');
const account = () => {
  const id = process.env.INSTAGRAM_ACCOUNT_ID;
  if (!id) throw new Error('INSTAGRAM_ACCOUNT_ID is not set');
  return id;
};

async function api(method: string, url: string, body?: Record<string, string>) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok || data.error) {
    throw new Error(`${method} ${url.split('?')[0]} -> ${res.status}: ${data.error?.message ?? text.slice(0, 300)}`);
  }
  return data;
}

export async function preflight(): Promise<string> {
  const t = token();
  const me = await api('GET', `${host(t)}/${V}/${account()}?fields=username&access_token=${encodeURIComponent(t)}`);
  return me.username ?? account();
}

export async function refresh(): Promise<void> {
  const t = token();
  if (!t.startsWith('IG')) {
    console.log('Facebook/Page token: no refresh needed (a Page token from a long-lived user token does not expire).');
    return;
  }
  const r = await api('GET', `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(t)}`);
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify({ access_token: r.access_token, refreshedAt: new Date().toISOString(), expiresIn: r.expires_in }));
  console.log(`Instagram token refreshed; valid for ${Math.round(r.expires_in / 86400)} more days.`);
}

export async function postReel(video: string, caption: string): Promise<string> {
  const t = token(), h = host(t), id = account();
  // 1. container for a resumable upload
  const c = await api('POST', `${h}/${V}/${id}/media`, {
    media_type: 'REELS', upload_type: 'resumable', caption: caption.slice(0, 2200), share_to_feed: 'true', access_token: t,
  });
  // 2. send the bytes
  const bytes = fs.readFileSync(video);
  const up = await fetch(`https://rupload.facebook.com/ig-api-upload/${V}/${c.id}`, {
    method: 'POST',
    headers: { Authorization: `OAuth ${t}`, offset: '0', file_size: String(bytes.length) },
    body: bytes,
  });
  if (!up.ok) throw new Error(`upload -> ${up.status}: ${(await up.text()).slice(0, 300)}`);
  // 3. wait until Instagram has processed it (up to ~5 min)
  for (let i = 0; i < 30; i++) {
    const s = await api('GET', `${h}/${V}/${c.id}?fields=status_code,status&access_token=${encodeURIComponent(t)}`);
    if (s.status_code === 'FINISHED') break;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error(`processing ${s.status_code}: ${s.status ?? ''}`);
    if (i === 29) throw new Error('processing did not finish in time');
    await new Promise((r) => setTimeout(r, 10000));
  }
  // 4. publish
  const p = await api('POST', `${h}/${V}/${id}/media_publish`, { creation_id: c.id, access_token: t });
  return String(p.id);
}
