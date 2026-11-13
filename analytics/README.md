# YouTube Analytics and My Portal editorial feedback

This directory stores read-only YouTube Analytics snapshots and the evidence-backed editorial feedback produced by the My Portal scheduled agent.

## Data flow

1. GitHub Actions collects YouTube Analytics daily at 12:00 JST using the repository's existing YouTube OAuth secrets. It writes:
   - `latest.json`: most recent successful snapshot.
   - `snapshots/YYYY-MM-DD.json`: daily history.
2. My Portal routine job `dopaeigo-editorial-director` runs at 16:30 JST. The ChatGPT scheduled worker reads the snapshot and project context, analyzes performance, chooses an editorial/format experiment, and writes:
   - `feedback/latest.json`: current findings, format decision and controlled experiments.
   - `feedback/YYYY-MM-DD.json`: dated feedback.
3. In the same routine run, when the publish queue has fewer than six scripts, the agent can create up to two lesson specs in `publish-queue/scripts/`. It may choose any existing pattern or the new data-driven `story` storyboard format. It verifies each JSON against the repo's gate contract, checks the content ledger and reads the committed file back.
4. GitHub Actions continues to render and publish the queue at 11:47 and 19:47 JST. Rendering, media quality gates and public upload remain separate from the editorial agent.

The analysis and lesson generation no longer call the OpenCode Go API. My Portal's scheduled ChatGPT worker is the LLM execution environment. GitHub Actions remains responsible for secret-bearing YouTube API collection and deterministic rendering/upload.

## Analytics scope and metrics

The collector uses the existing `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, and `YOUTUBE_REFRESH_TOKEN` GitHub Actions secrets. The refresh token must include `https://www.googleapis.com/auth/yt-analytics.readonly` in addition to the existing upload permission.

The collector intentionally does **not** request monetary/revenue scopes. It records:
- Daily channel activity over the latest complete 28-day window.
- Top videos over the same window, including views, engaged views, watch time, average view duration/percentage, likes, comments, shares, and subscriber changes.
- Audience-retention curves for up to 15 recent or top-performing videos.
- Locally available publication metadata including pattern, formatId and experimentId where present.

The reporting window ends three JST calendar days before collection to reduce incomplete-day comparisons. Missing/limited rows are not interpreted as zero. Retention queries are isolated per video; one unavailable video does not invalidate the rest of the snapshot.

## Editorial safeguards and agency

- Every finding in feedback must identify the exact metric coordinates and values from the snapshot. Do not invent evidence, swipes, impressions or viewer attributes.
- Do not compare raw totals across videos with different exposure periods or claim causes from correlations.
- The agent may choose the format, sequence, pacing, structure, duration, on-screen positions, animations and voice cues within the validated storyboard DSL.
- The storyboard DSL accepts plain text and whitelisted layout/audio primitives only. It does not execute model-authored HTML, JavaScript or CSS.
- A new storyboard format gets at most one experimental publication per cycle and must carry an experimentId. A single high-performing video is not enough to graduate a format.
- If the desired visual/audio primitive is outside the current DSL, the scheduled agent prepares a separate PR for implementation rather than editing main or injecting arbitrary code.
- If evidence is insufficient or stale, the agent records `insufficient_data` and does not generate new scripts from stale findings.

## Manual verification

After OAuth reauthentication, run **Actions → YouTube Analytics snapshot → Run workflow** once. A successful run proves the configured refresh token can call YouTube Analytics API v2 and creates `analytics/latest.json`. The My Portal agent uses that snapshot during its next 16:30 JST run. Confirm that `analytics/feedback/latest.json` references the same `collectedAt` value as `analytics/latest.json`.
