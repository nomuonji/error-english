// Multimodal final-media audit of the exact approved-candidate MP4 (no upload).
// The model's own self-reported verdict is evidence, not automatic legal/public approval.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const file=process.argv[2],subtitle=process.argv[3];
const video=fs.readFileSync(file), srt=fs.readFileSync(subtitle,'utf8');
const sha=createHash('sha256').update(video).digest('hex');
const expected='194c6a7ba04ecf056fe070b8fdebc3faee4d9db107f4ce68c3590951d6aee9ac';
if(sha!==expected)throw Error('Wrong MP4 for multimodal review');
const key=process.env.GEMINI_API_KEY;
if(!key)throw Error('Existing GEMINI_API_KEY not configured; cannot perform perceptual audit');
const prompt=[
 'You are an independent Japanese/English film QA reviewer. Analyze ACTUAL MP4 audio and video, not only the supplied SRT.',
 '96-second bilingual short: English male synthetic quote voice, Japanese female editor voice, each 25 subtitle cue aligned.',
 'Check first frame, every transition, all speech vs on-screen captions for wrong language, omitted syllables, pronunciation, speech cutting, audible glitches, illegible text, overcrowding, bad translation or narrator identity confusion.',
 'Caution: real media listening matters; do NOT assert checks performed if you could not perceive audio. Report unavailable parts as unverified.',
 'Mark material issues with exact timestamps and minimal quoted snippet; avoid copyright-length full transcript.',
 'The source text is editorial site content and synthetic reading, not original person voice.',
 'Respond in valid JSON only with schema {canPerceiveAudio:boolean,checkedAllCues:boolean,overall:string,majorIssues:[{time:string,problem:string}],minorIssues:[{time:string,problem:string}],checks:{englishJapaneseSeparation:string,pronunciation:string,captionSync:string,captionReadability:string,visualContinuity:string,voiceMix:string},summaryJapanese:string}.',
 'The allowed overall values are pass, caution, fail. Do not use pass if checkedAllCues or canPerceiveAudio is false.',
 'SRT content for comparison:\n'+srt
].join('\n');
const payload={contents:[{parts:[{text:prompt},{inlineData:{mimeType:'video/mp4',data:video.toString('base64')}}]}],generationConfig:{responseMimeType:'application/json',temperature:0.1,maxOutputTokens:4096}};
const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(payload)});
const raw=await res.text();
if(!res.ok)throw Error('Gemini API audit unavailable HTTP '+res.status+': '+raw.slice(0,350));
const data=JSON.parse(raw),body=data.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
if(!body)throw Error('Gemini returned no media QA');
let result;try{result=JSON.parse(body)}catch{throw Error('Gemini QA JSON invalid '+body.slice(0,280))}
if(!Array.isArray(result.majorIssues)||!Array.isArray(result.minorIssues))throw Error('QA missing issue arrays');
const audit={clipId:'aw-001-zizek-ai-consequences',sha256:sha,model:'gemini-2.5-flash',auditedAt:new Date().toISOString(),...result};
fs.writeFileSync('aw001-gemini-media-audit.json',JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({mediaAuditCompleted:true,sha256:sha,model:audit.model,canPerceiveAudio:result.canPerceiveAudio,checkedAllCues:result.checkedAllCues,overall:result.overall,majorIssues:result.majorIssues,minorIssues:result.minorIssues,summaryJapanese:result.summaryJapanese}));
