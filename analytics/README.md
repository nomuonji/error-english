# YouTube Analytics and agent feedback

This directory stores read-only YouTube Analytics snapshots and evidence-backed feedback for the lesson generator.

## Data flow

1. The YouTube Analytics snapshot workflow runs daily at 12:00 JST. It calls the Analytics API with the existing YouTube OAuth secrets and writes:
   - \`latest.json\`: most recent successful snapshot.
   - \`snapshots/YYYY-MM-DD.json\`: daily history.
2. The Analytics feedback agent runs daily at 23:30 JST, analyzes the latest snapshot through the existing OpenCode Go connection, and writes:
   - \`feedback/latest.json\`: current editorial findings and at most two controlled experiments.
   - \`feedback/YYYY-MM-DD.json\`: the dated feedback record.
3. The 00:07 JST queue replenisher reads only feedback whose \`basedOnCollectedAt\` exactly matches the latest snapshot and whose source snapshot is no older than 36 hours. It passes the findings and experiment instructions into the OpenCode Go lesson-generation prompt. If the feedback is missing, stale, or mismatched, the generator refuses to create new scripts rather than silently ignoring analytics.

## Analytics scope and metrics

The collector uses the existing \`YOUTUBE_CLIENT_ID\`, \`YOUTUBE_CLIENT_SECRET\`, and \`YOUTUBE_REFRESH_TOKEN\` GitHub Actions secrets. The refresh token must include \`https://www.googleapis.com/auth/yt-analytics.readonly\` in addition to the existing upload permission.

The collector intentionally does **not** request monetary/revenue scopes. It records:
- Daily channel activity over the latest complete 28-day window.
- Top videos over the same window, including views, engaged views, watch time, average view duration/percentage, likes, comments, shares, and subscriber changes.
- Audience-retention curves for up to 15 recent or top-performing videos.

The reporting window ends three JST calendar days before collection to reduce incomplete-day comparisons. Missing/limited rows are not interpreted as zero. Retention queries are isolated per video; one unavailable video does not invalidate the rest of the snapshot.

The JSON includes video IDs and locally available publication metadata from \`publish-queue/published\`. Other videos may have null metadata; their metrics remain valid.

## Feedback safeguards

- Every saved finding must point to a metric coordinate in the source snapshot. The analyzer reads the value back from the source; unsupported or invented evidence coordinates are discarded.
- The model is instructed not to compare raw totals across videos with different exposure periods, infer swipe-away rate from engaged views, claim causes from correlations, or invent Studio-only metrics unavailable in the API.
- Findings can be empty when evidence is insufficient. Such a report is stored as \`insufficient_data\`; the generator is told not to over-optimize from it.
- A recommendation that requires changing the renderer is recorded for review, not implemented automatically. The generation agent may apply only script-level experiments within the existing JSON schema.

## Manual verification

After merge, run **Actions → YouTube Analytics snapshot → Run workflow**. A successful run proves the configured refresh token can call YouTube Analytics API v2 and creates \`analytics/latest.json\`. The feedback agent then runs on its 23:30 JST schedule (or can be run manually from its workflow). Confirm that \`analytics/feedback/latest.json\` references the same \`collectedAt\` value as \`analytics/latest.json\`.
