// Generic fail-closed handoff for reviewed The Annotated World episodes.
// Rendered media is taken from the specific reviewed Actions artifact, never rerendered.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const repo = 'nomuonji/The-Annotated-World';
const clip = process.argv[2] || '';
const need = (ok, message) => { if (!ok) throw Error('AW release blocked: ' + message); };
need(/^aw-[0-9]{3}-[a-z0-9-]+$/.test(clip), 'invalid clip ID');
const api = endpoint => JSON.parse(execFileSync('gh', ['api', endpoint], { encoding: 'utf8', maxBuffer: 8000000 }));
const sourceSha = api('repos/' + repo + '/commits/main').sha;
need(/^[a-f0-9]{40}$/.test(sourceSha), 'source commit unavailable');
const load = file => {
  const response = api('repos/' + repo + '/contents/productions/' + clip + '/' + file + '?ref=' + sourceSha);
  need(response.encoding === 'base64', 'source file unavailable: ' + file);
  return JSON.parse(Buffer.from(response.content, 'base64').toString('utf8'));
};
const status = load('status.json'), brief = load('brief.json');
const mediaSha = status.render?.sha256;
const review = brief.deliveryReview || {};
const owner = status.ownerAuthorization || {};
need(status.clipId === clip && ['reviewed','private_uploaded'].includes(status.stage), 'ledger must be reviewed/private_uploaded (published videos are never re-uploaded)');
need(owner.publicReleaseAuthorized === true && typeof owner.scope === 'string' && owner.scope.includes(clip), 'no episode-specific owner public-release authorization');
need(status.script?.renderMatchesBrief === true && status.render?.renderMatchesBrief === true, 'render and source brief do not match');
need(/^[a-f0-9]{64}$/.test(mediaSha || ''), 'missing reviewed MP4 digest');
need(Array.isArray(status.blockers) && status.blockers.length === 0, 'review blockers remain');
need(['sourceText','sourceRights','ttsTerms','editorial','media'].every(k => status.gates?.[k] === 'confirmed'), 'required editorial/rights/media gates not confirmed');
need(status.render?.mediaReview?.approved === true && status.render.mediaReview.mediaSha256 === mediaSha, 'specific media has not been reviewed');
need(brief.publication?.approved === true && brief.source?.rightsReviewed === true && brief.music?.rightsReviewed === true, 'brief lacks rights/publication approval');
need(review.approved === true && review.mediaSha256 === mediaSha && typeof review.reviewer === 'string' && review.reviewer.trim() && typeof review.evidence === 'string' && review.evidence.trim(), 'review evidence for exact MP4 is missing');
need(brief.source?.articleReview?.basis === 'site-content', 'site textbook is not established as source of truth');
need(brief.speaker?.audioKind === 'synthetic' || brief.source?.originalAudioChecked === true, 'original recording verification missing');
need(typeof brief.speaker?.disclosure === 'string' && brief.speaker.disclosure.trim(), 'speech identity disclosure missing');
need(typeof brief.source?.url === 'string' && /^https:\/\//.test(brief.source.url), 'source URL missing');
need(typeof brief.editorial?.articleUrl === 'string' && /^https:\/\/the-annotated-world\.pages\.dev\/read\//.test(brief.editorial.articleUrl), 'reviewed article link missing');
const used = [brief.hooks?.find(x => x.id === brief.selectedHook), ...(brief.body || [])];
need(used.length > 1 && used.every(Boolean), 'selected hook/body missing');
const visuals = used.filter(s => ['portrait', 'archive'].includes(s.visual?.pattern));
need(visuals.every(s => s.visual?.rightsReviewed === true && typeof s.visual.credit === 'string' && s.visual.credit.trim()), 'visual rights/credit unreviewed');
need(!used.some(s => s.role === 'QUOTE' && s.visual?.pattern === 'archive') || brief.speaker?.portraitRightsReviewed === true, 'speaker portrait not cleared');

const artifactUrl = status.render?.artifactUrl || '';
const matched = artifactUrl.match(/^https:\/\/github\.com\/nomuonji\/The-Annotated-World\/actions\/runs\/([0-9]+)\/artifacts\/([0-9]+)$/);
need(matched, 'exact source Actions artifact URL is missing');
const runId = matched[1], artifactId = matched[2];
const run = api('repos/' + repo + '/actions/runs/' + runId);
const artifact = api('repos/' + repo + '/actions/artifacts/' + artifactId);
need(run.conclusion === 'success' && artifact.expired === false && String(artifact.workflow_run?.id) === runId, 'source render run or artifact invalid/expired');
need(artifact.size_in_bytes > 0, 'render artifact empty');

const folder = path.resolve('aw-delivery');
fs.mkdirSync(folder, { recursive: true });
const archive = path.resolve('/tmp/aw-reviewed-' + clip + '.zip');
need(!!process.env.GITHUB_TOKEN, 'GitHub Actions token missing');
execFileSync('curl', ['--fail','--silent','--show-error','--location',
  '-H','Authorization: Bearer ' + process.env.GITHUB_TOKEN,
  'https://api.github.com/repos/' + repo + '/actions/artifacts/' + artifactId + '/zip',
  '--output',archive], { stdio: 'inherit' });
execFileSync('unzip', ['-oq',archive,'-d',folder]);
const video = path.join(folder,'annotated-short.mp4');
need(fs.existsSync(video), 'reviewed MP4 absent from artifact');
const digest = createHash('sha256').update(fs.readFileSync(video)).digest('hex');
need(digest === mediaSha, 'downloaded MP4 does not match approved SHA256');
for (const name of ['timeline.json','report.json','captions.srt','contact-sheet.jpg']) {
  need(fs.existsSync(path.join(folder,name)), 'missing media evidence ' + name);
}
const report = JSON.parse(fs.readFileSync(path.join(folder,'report.json'),'utf8'));
need(Number.isFinite(report.durationSec) && report.durationSec >= 20 && report.durationSec <= 180, 'unreviewed clip duration');
need(Number.isInteger(report.cueCount) && report.cueCount > 0, 'missing caption QA count');
const credits = [...new Set(used.map(s => s.visual?.credit).filter(Boolean))];
if (used.some(s => s.role === 'QUOTE' && s.visual?.pattern === 'archive')) credits.push(brief.speaker.portraitCredit);
let description = brief.editorial.payoff + '\n\n'
  + '原典: ' + brief.source.url + '\n'
  + '対訳・注釈教材: ' + brief.editorial.articleUrl + '\n'
  + brief.speaker.name + ' — ' + brief.speaker.disclosure + '\n'
  + '引用英文・字幕は既存サイト教材に基づきます。\n'
  + '素材・出典:\n' + [...new Set(credits)].join('\n') + '\n';
if (brief.speaker.voiceId?.startsWith('kokoro:')) {
  description += '合成音声: Kokoro-82M (Apache-2.0) https://huggingface.co/hexgrad/Kokoro-82M\n';
}
description += '音楽: The Annotated World original procedural score\n#TheAnnotatedWorld #英語学習 #Shorts';
need(description.length < 4700 && brief.title?.length > 0 && brief.title.length <= 100, 'YouTube metadata outside limits');
const delivery = {
  format: 'annotated-world-delivery/v1', clipId: clip, sourceSha, sha256: digest,
  title: brief.title, description, publicationApproved: true, rightsReviewed: true,
  selectedHook: brief.selectedHook, reviewer: review.reviewer, reviewEvidence: review.evidence,
  sourceArtifactId: Number(artifactId), sourceRunId: Number(runId)
};
fs.writeFileSync(path.join(folder,'delivery.json'), JSON.stringify(delivery,null,2) + '\n');
console.log(JSON.stringify({ readyForPrivateUpload:true, clipId:clip, sourceSha, sha256:digest, artifactId, runId }));
