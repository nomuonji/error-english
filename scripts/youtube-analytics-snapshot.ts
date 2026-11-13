import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const METRICS = [
  'views',
  'engagedViews',
  'estimatedMinutesWatched',
  'averageViewDuration',
  'averageViewPercentage',
  'likes',
  'comments',
  'shares',
  'subscribersGained',
  'subscribersLost',
].join(',');

function jstDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return value.year + '-' + value.month + '-' + value.day;
}

function shiftDate(date: string, days: number): string {
  const value = new Date(date + 'T12:00:00.000Z');
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function rowsFrom(response: any): { headers: string[]; rows: Record<string, unknown>[] } {
  const headers = (response?.data?.columnHeaders ?? []).map((column: any) => column.name);
  const rows = (response?.data?.rows ?? []).map((row: unknown[]) =>
    Object.fromEntries(headers.map((header: string, index: number) => [header, row[index]])),
  );
  return { headers, rows };
}

function safeError(error: any): string {
  const message =
    error?.response?.data?.error?.message ??
    error?.response?.data?.error_description ??
    error?.message ??
    String(error);
  return String(message).replace(/\s+/g, ' ').slice(0, 800);
}

function readPublishedVideos(): Array<{
  videoId: string;
  publishedAt: string;
  requestFile: string;
  title?: string;
  description?: string;
  assetName?: string;
  pattern?: string;
  formatId?: string;
  experimentId?: string;
  scriptId?: string;
  summary?: string;
}> {
  const queueDir = path.resolve('publish-queue/published');
  const logFile = path.join(queueDir, 'log.json');
  if (!fs.existsSync(logFile)) return [];

  const log = JSON.parse(fs.readFileSync(logFile, 'utf8')) as Array<any>;
  const requestByFile = new Map<string, any>();

  for (const file of fs.readdirSync(queueDir).filter((name) => name.endsWith('.request.json'))) {
    try {
      requestByFile.set(file, JSON.parse(fs.readFileSync(path.join(queueDir, file), 'utf8')));
    } catch {
      // A malformed historical request must not block analytics collection.
    }
  }

  return log
    .filter((entry) => typeof entry.youtubeVideoId === 'string' && typeof entry.publishedAt === 'string')
    .map((entry) => {
      const request = requestByFile.get(entry.file) ?? {};
      const scriptFile = typeof request.script === 'string' && /^[A-Za-z0-9._-]+\.json$/.test(request.script)
        ? request.script.replace(/\.json$/, '.script.json')
        : undefined;
      let script: any = {};
      if (scriptFile) {
        try {
          script = JSON.parse(fs.readFileSync(path.join(queueDir, scriptFile), 'utf8'));
        } catch {
          // Historical entries may predate the structured script archive.
        }
      }
      return {
        videoId: entry.youtubeVideoId,
        publishedAt: entry.publishedAt,
        requestFile: entry.file,
        title: typeof request.title === 'string' ? request.title : undefined,
        description: typeof request.description === 'string' ? request.description : undefined,
        assetName: typeof entry.assetName === 'string' ? entry.assetName : undefined,
        pattern: typeof request.pattern === 'string' ? request.pattern : (typeof script.pattern === 'string' ? script.pattern : undefined),
        formatId: typeof request.formatId === 'string' ? request.formatId : (typeof script.formatId === 'string' ? script.formatId : undefined),
        experimentId: typeof request.experimentId === 'string' ? request.experimentId : (typeof script.experimentId === 'string' ? script.experimentId : undefined),
        scriptId: typeof script.id === 'string' ? script.id : undefined,
        summary: typeof script.summary === 'string' ? script.summary : undefined,
      };
    })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

async function main() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing one or more required YouTube OAuth secrets.');
  }

  const auth = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'https://developers.google.com/oauthplayground',
  );
  auth.setCredentials({ refresh_token: refreshToken });

  // A successful report query is the actual scope check; the token itself is never logged.
  const analytics = google.youtubeAnalytics({ version: 'v2', auth });
  const endDate = shiftDate(jstDate(), -3); // YouTube reporting data can lag; do not treat partial days as final.
  const startDate = shiftDate(endDate, -27);
  const now = new Date().toISOString();

  const channelResponse = await analytics.reports.query({
    ids: 'channel==MINE',
    startDate,
    endDate,
    metrics: METRICS,
    dimensions: 'day',
    sort: 'day',
    maxResults: 100,
  });

  const videoResponse = await analytics.reports.query({
    ids: 'channel==MINE',
    startDate,
    endDate,
    metrics: METRICS,
    dimensions: 'video',
    sort: '-views',
    maxResults: 200,
  });

  const channel = rowsFrom(channelResponse);
  const videoReport = rowsFrom(videoResponse);
  const publishedVideos = readPublishedVideos();
  const metadataById = new Map<string, (typeof publishedVideos)[number]>(
    publishedVideos.map((video) => [video.videoId, video] as const),
  );

  const topVideoIds = videoReport.rows
    .map((row) => String(row.video ?? ''))
    .filter(Boolean)
    .slice(0, 5);
  const retentionIds = [...new Set([
    ...publishedVideos.slice(0, 10).map((video) => video.videoId),
    ...topVideoIds,
  ])].slice(0, 15);

  const retention: Array<Record<string, unknown>> = [];
  for (const videoId of retentionIds) {
    try {
      const response = await analytics.reports.query({
        ids: 'channel==MINE',
        startDate,
        endDate,
        dimensions: 'elapsedVideoTimeRatio',
        metrics: 'audienceWatchRatio,relativeRetentionPerformance',
        filters: 'video==' + videoId,
        maxResults: 200,
      });
      retention.push({
        videoId,
        metadata: metadataById.get(videoId) ?? null,
        ...rowsFrom(response),
      });
    } catch (error) {
      retention.push({
        videoId,
        metadata: metadataById.get(videoId) ?? null,
        error: safeError(error),
      });
    }
  }

  const snapshot = {
    schemaVersion: 1,
    collectedAt: now,
    timezone: 'Asia/Tokyo',
    channelQuery: 'channel==MINE',
    period: { startDate, endDate, days: 28 },
    freshnessNote: 'The end date is intentionally three JST calendar days before collection to reduce incomplete-day reporting.',
    metrics: METRICS.split(','),
    channelDaily: channel,
    topVideos: videoReport.rows.map((row) => {
      const videoId = String(row.video ?? '');
      return { videoId, metadata: metadataById.get(videoId) ?? null, metrics: row };
    }),
    publishedLogCount: publishedVideos.length,
    retention,
  };

  const outputDir = path.resolve('analytics/snapshots');
  fs.mkdirSync(outputDir, { recursive: true });
  const date = jstDate();
  const serialized = JSON.stringify(snapshot, null, 2) + '\n';
  fs.writeFileSync(path.join(outputDir, date + '.json'), serialized);
  fs.mkdirSync(path.resolve('analytics'), { recursive: true });
  fs.writeFileSync(path.resolve('analytics/latest.json'), serialized);

  console.log(JSON.stringify({
    status: 'ok',
    collectedAt: now,
    period: snapshot.period,
    channelDailyRows: channel.rows.length,
    topVideoRows: videoReport.rows.length,
    retentionRequested: retention.length,
    retentionErrors: retention.filter((item) => 'error' in item).length,
    output: 'analytics/snapshots/' + date + '.json',
  }, null, 2));
}

main().catch((error) => {
  console.error('YouTube Analytics collection failed: ' + safeError(error));
  process.exit(1);
});
