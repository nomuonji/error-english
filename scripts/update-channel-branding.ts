// Owner-requested (2026-10-20): update this channel's title / description / keywords
// from channel/branding.json. If the API refuses the title, the description and keywords
// are still applied and the run says the title must be changed in YouTube Studio.
import fs from 'node:fs';
import { google } from 'googleapis';

async function main() {
  const want = JSON.parse(fs.readFileSync('channel/branding.json', 'utf8'));
  const auth = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground',
  );
  auth.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });
  const yt = google.youtube({ version: 'v3', auth });

  const list = await yt.channels.list({ part: ['brandingSettings', 'snippet'], mine: true });
  const ch = list.data.items?.[0];
  if (!ch?.id) throw new Error('No channel for these credentials');
  console.log(`Channel ${ch.id}: "${ch.snippet?.title}"`);

  const base = { ...(ch.brandingSettings?.channel ?? {}) } as Record<string, unknown>;
  base.description = want.description;
  base.keywords = want.keywords;

  const update = async (withTitle: boolean) => {
    const channel = { ...base };
    if (withTitle) channel.title = want.title;
    else delete channel.title;
    await yt.channels.update({ part: ['brandingSettings'], requestBody: { id: ch.id, brandingSettings: { channel } } });
  };

  try {
    await update(true);
    console.log('Updated title, description and keywords.');
  } catch (e: any) {
    console.log('Title update refused:', e?.errors?.[0]?.reason ?? e?.message);
    await update(false);
    console.log('Updated description and keywords only. Change the title in YouTube Studio.');
  }

  const after = await yt.channels.list({ part: ['brandingSettings', 'snippet'], id: [ch.id] });
  const a = after.data.items?.[0];
  console.log(JSON.stringify({
    title: a?.snippet?.title,
    brandingTitle: a?.brandingSettings?.channel?.title,
    description: a?.brandingSettings?.channel?.description?.slice(0, 40),
  }));
}

main().catch((e) => {
  console.error(e?.errors ?? e);
  process.exit(1);
});
