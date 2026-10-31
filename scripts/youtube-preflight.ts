// Fails fast (exit 1) when the YouTube refresh token cannot be exchanged, before anything is
// rendered or moved in the queue. "invalid_grant: Token has been expired or revoked" means the
// YOUTUBE_REFRESH_TOKEN secret must be reissued (an OAuth app left in "Testing" status issues
// refresh tokens that expire after 7 days; publish the app to "In production" to stop that).
import { google } from 'googleapis';

async function main() {
  const { YOUTUBE_CLIENT_ID: id, YOUTUBE_CLIENT_SECRET: secret, YOUTUBE_REFRESH_TOKEN: token } = process.env;
  if (!id || !secret || !token) throw new Error('YouTube secrets are not set');
  const auth = new google.auth.OAuth2(id, secret, 'https://developers.google.com/oauthplayground');
  auth.setCredentials({ refresh_token: token });
  try {
    await auth.getAccessToken();
  } catch (e: any) {
    const why = e?.response?.data?.error_description ?? e?.message ?? String(e);
    console.error(`::error title=YouTube auth failed::${why} - reissue the YOUTUBE_REFRESH_TOKEN secret. The queue was left untouched.`);
    process.exit(1);
  }
  const yt = google.youtube({ version: 'v3', auth });
  const me = await yt.channels.list({ part: ['snippet'], mine: true });
  console.log('YouTube auth ok:', me.data.items?.[0]?.snippet?.title ?? '(no channel)');
}

main().catch((e) => { console.error(e); process.exit(1); });
