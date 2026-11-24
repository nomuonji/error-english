// Publish the exact owner-approved, private-uploaded episode 001 and verify public readback.
// Never create or change a video without the exact private receipt and digest.
import {google} from 'googleapis';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const need=(v,s)=>{if(!v)throw Error('PUBLIC RELEASE BLOCKED: '+s)};
const dir=path.resolve(process.argv[2]||'aw-delivery');
const r=JSON.parse(fs.readFileSync(path.join(dir,'receipt.json'),'utf8'));
const meta=JSON.parse(fs.readFileSync(path.join(dir,'delivery.json'),'utf8'));
const video=fs.readFileSync(path.join(dir,'annotated-short.mp4'));
const digest=createHash('sha256').update(video).digest('hex');
const expected='194c6a7ba04ecf056fe070b8fdebc3faee4d9db107f4ce68c3590951d6aee9ac';
need(digest===expected&&meta.sha256===digest&&r.sha256===digest,'wrong actual MP4');
need(meta.publicationApproved===true&&meta.rightsReviewed===true&&r.clipId==='aw-001-zizek-ai-consequences','release gate mismatch');
need(/^[a-zA-Z0-9_-]{11}$/.test(r.videoId||'')&&r.channelId==='UCBy9F1fD4SQTyjTK8yfZGhA','uploaded video/channel receipt missing');
const {YOUTUBE_CLIENT_ID:id,YOUTUBE_CLIENT_SECRET:secret,YOUTUBE_REFRESH_TOKEN:token}=process.env;
need(id&&secret&&token,'existing YouTube OAuth absent');
const auth=new google.auth.OAuth2(id,secret,'https://developers.google.com/oauthplayground');
auth.setCredentials({refresh_token:token});
const yt=google.youtube({version:'v3',auth});
async function main(){
const mine=await yt.channels.list({part:['snippet'],mine:true});
need(mine.data.items?.length===1&&mine.data.items[0].id===r.channelId,'OAuth channel identity mismatched');
const prior=await yt.videos.list({part:['snippet'],id:['7u0H0AkkLD4']});
need(prior.data.items?.[0]?.snippet?.channelId===r.channelId,'historic channel ownership mismatch');
const read=async()=>{
 const x=await yt.videos.list({part:['snippet','status','processingDetails'],id:[r.videoId]});
 const v=x.data.items?.[0];
 need(v?.snippet?.channelId===r.channelId,'uploaded video not found in expected channel');
 need(v.snippet.description?.includes('AW-CLIP:'+r.clipId)&&v.snippet.description?.includes('AW-SHA256:'+digest),'uploaded video identity/digest marker mismatch');
 need(v.status?.uploadStatus!=='failed'&&v.processingDetails?.processingStatus!=='failed','YouTube reports processing/upload failure');
 return v;
};
let v=await read();
if(v.status?.privacyStatus!=='public'){
 need(v.status?.privacyStatus==='private','prior privacy must be private');
 // Processing can take time after upload. Do not switch a video that YouTube has not processed.
 for(let i=0;i<12&&v.processingDetails?.processingStatus==='processing';i++){
  await new Promise(resolve=>setTimeout(resolve,15000));v=await read();
 }
 need(v.processingDetails?.processingStatus!=='processing','YouTube video still processing');
 await yt.videos.update({
  part:['status'],
  requestBody:{id:r.videoId,status:{privacyStatus:'public',selfDeclaredMadeForKids:false}}
 });
 v=await read();
}
need(v.status?.privacyStatus==='public','public privacy readback failed');
const receipt={...r,privacy:'public',publicationVerifiedAt:new Date().toISOString(),watchUrl:'https://www.youtube.com/watch?v='+r.videoId};
fs.writeFileSync(path.join(dir,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({published:true,...receipt}));

}
main().catch(e=>{console.error(String(e?.message||e));process.exitCode=1});
