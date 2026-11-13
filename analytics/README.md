# YouTube Analytics snapshots

This directory is populated by the \`YouTube Analytics snapshot\` workflow.

- \`latest.json\`: newest successful read-only snapshot.
- \`snapshots/YYYY-MM-DD.json\`: immutable daily collection history.

## Data contract

The collector uses the existing \`YOUTUBE_CLIENT_ID\`, \`YOUTUBE_CLIENT_SECRET\`, and \`YOUTUBE_REFRESH_TOKEN\` GitHub Actions secrets. The refresh token must have the \`yt-analytics.readonly\` OAuth scope in addition to the existing upload permission.

The collector intentionally does **not** request monetary/revenue scopes. It records:
- Daily channel activity over the latest complete 28-day window.
- Top videos over the same window, including views, engaged views, watch time, average view duration/percentage, likes, comments, shares, and subscriber changes.
- Audience-retention curves for up to 15 recent or top-performing videos.

The reporting window ends three JST calendar days before collection to reduce incomplete-day comparisons. Missing/limited rows are not interpreted as zero. Retention queries are isolated per video; one unavailable video does not invalidate the rest of the snapshot.

The JSON includes video IDs and locally available publication metadata from \`publish-queue/published\`. Other videos may have a null metadata field; their metrics remain valid.

## Manual verification

After the workflow is merged, run **Actions → YouTube Analytics snapshot → Run workflow**. A successful run proves the configured refresh token can call YouTube Analytics API v2 and produces \`analytics/latest.json\`. A failed run reports the API error without printing OAuth credentials.
