// Owner-only one-off release bridge; fail closed on every unverified review gate.
// No generic source repo, clip, or artifact inputs are accepted.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const source='nomuonji/The-Annotated-World';
const clip='aw-001-zizek-ai-consequences';
const artifactId='14897427515';
const expected='194c6a7ba04ecf056fe070b8fdebc3faee4d9db107f4ce68c3590951d6aee9ac';
const need=(ok,why)=>{if(!ok)throw Error('RELEASE BLOCKED: '+why)};
const api=(p)=>JSON.parse(execFileSync('gh',['api',p],{encoding:'utf8',maxBuffer:5e6}));
const sha=api('repos/'+source+'/commits/main').sha;
need(/^[0-9a-f]{40}$/.test(sha),'source HEAD missing');
const read=(p)=>{
 const data=api('repos/'+source+'/contents/'+p+'?ref='+sha);
 need(data.encoding==='base64','source content encoding');
 return JSON.parse(Buffer.from(data.content,'base64').toString('utf8'));
};
const base='productions/'+clip+'/';
const status=read(base+'status.json'),brief=read(base+'brief.json');
need(status.clipId===clip&&status.stage==='reviewed','production not reviewed');
need(status.ownerAuthorization?.publicReleaseAuthorized===true,'explicit public authorization missing');
need(status.render?.sha256===expected&&status.render?.renderMatchesBrief===true,'render digest/revision mismatch');
need(status.render?.storage?.includes(artifactId),'artifact not pinned by source');
need(['sourceText','sourceRights','ttsTerms','editorial','media'].every(k=>status.gates?.[k]==='confirmed'),'source/rights/final-media review not confirmed');
need(status.blockers?.length===0,'production blockers still open');
need(brief.publication?.approved===true&&brief.source?.rightsReviewed===true&&brief.music?.rightsReviewed===true,'brief publication/rights not approved');
need(brief.speaker?.audioKind==='synthetic'&&brief.speaker?.voiceId==='kokoro:am_michael'&&brief.editor?.voiceId==='kokoro:jf_alpha','unexpected speaker/voice revision');
need(brief.deliveryReview?.approved===true&&brief.deliveryReview?.reviewer&&brief.deliveryReview?.evidence,'real completed media review missing');
need(brief.deliveryReview?.mediaSha256===expected,'owner-approved reviewed media digest missing');
need(typeof brief.editorial?.articleUrl==='string'&&brief.editorial.articleUrl.includes('the-annotated-world.pages.dev'),'source site link missing');
need(typeof brief.source?.url==='string'&&brief.source.url.startsWith('https://www.youtube.com/'),'source attribution missing');
need(brief.speaker?.portraitRightsReviewed===true,'portrait license unreviewed');
const folder=path.resolve('aw-delivery');fs.mkdirSync(folder,{recursive:true});
const zip=path.resolve('/tmp/aw001-reviewed.zip');
const bearer=process.env.GITHUB_TOKEN;
need(bearer,'actions token missing');
execFileSync('curl',['--fail','--silent','--show-error','--location','-H','Authorization: Bearer '+bearer,'https://api.github.com/repos/'+source+'/actions/artifacts/'+artifactId+'/zip','--output',zip],{stdio:'inherit'});
execFileSync('unzip',['-oq',zip,'-d',folder]);
const video=path.join(folder,'annotated-short.mp4');
need(fs.existsSync(video),'rendered MP4 artifact missing');
const digest=createHash('sha256').update(fs.readFileSync(video)).digest('hex');
need(digest===expected,'MP4 digest did not match review');
need(fs.existsSync(path.join(folder,'captions.srt'))&&fs.existsSync(path.join(folder,'report.json')),'caption/report evidence missing');
const report=JSON.parse(fs.readFileSync(path.join(folder,'report.json'),'utf8'));
need(report.durationSec>90&&report.durationSec<100&&report.cueCount===25,'media inspection report mismatch');
const description=brief.editorial.payoff+'\n\n'
 +'原典: '+brief.source.url+'\n'
 +'対訳・注釈教材: '+brief.editorial.articleUrl+'\n'
 +'Slavoj Žižekの公開講演についての批評・解説。掲載教材版の英文を合成音声で朗読したもので、本人の肉声・講演映像ではありません。'
 +' 英文字幕は教材用に整えた表現を含みます。\n\n'
 +'資料写真: '+brief.speaker.portraitCredit+'\n'
 +'合成音声: Kokoro-82M (Apache-2.0) https://huggingface.co/hexgrad/Kokoro-82M\n'
 +'音楽・図解: The Annotated World original production\n'
 +'#TheAnnotatedWorld #英語学習 #Shorts';
need(description.length<4700&&brief.title.length<=100,'YouTube metadata too long');
fs.writeFileSync(path.join(folder,'delivery.json'),JSON.stringify({
 format:'annotated-world-delivery/v1',clipId:clip,sourceSha:sha,sha256:digest,
 title:brief.title,description,publicationApproved:true,rightsReviewed:true,
 reviewer:brief.deliveryReview.reviewer,reviewEvidence:brief.deliveryReview.evidence
},null,2)+'\n');
console.log(JSON.stringify({readyForPrivateUpload:true,clipId:clip,sourceSha:sha,sha256:digest,artifactId}));
