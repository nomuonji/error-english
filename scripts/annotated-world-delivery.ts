import {google} from 'googleapis';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const must=(v:unknown,msg:string)=>{if(!v)throw Error(msg)};
const mode=process.argv[2]||'verify';
async function main(){
 must(['verify','upload-private'].includes(mode),'Invalid mode');
 const {YOUTUBE_CLIENT_ID:id,YOUTUBE_CLIENT_SECRET:secret,YOUTUBE_REFRESH_TOKEN:token}=process.env;
 must(id&&secret&&token,'Missing existing YouTube OAuth credentials');
 const auth=new google.auth.OAuth2(id,secret,'https://developers.google.com/oauthplayground');
 auth.setCredentials({refresh_token:token});
 const yt=google.youtube({version:'v3',auth});
 const mine=await yt.channels.list({part:['snippet','contentDetails'],mine:true});
 const channel=mine.data.items?.[0];
 must(mine.data.items?.length===1&&channel?.id,'Ambiguous/missing OAuth channel');
 // Use the last known Dopaeigo upload as immutable identity proof, not mutable title.
 const prior=await yt.videos.list({part:['snippet'],id:['7u0H0AkkLD4']});
 must(prior.data.items?.[0]?.snippet?.channelId===channel!.id,'OAuth channel does not own historic Dopaeigo video');
 console.log(JSON.stringify({channelId:channel!.id,title:channel!.snippet?.title,verifiedAgainst:'7u0H0AkkLD4'}));
 if(mode==='verify')return;
 const folder=path.resolve(process.argv[3]||'');
 const file=path.join(folder,'annotated-short.mp4');
 const meta=JSON.parse(fs.readFileSync(path.join(folder,'delivery.json'),'utf8'));
 const digest=createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 must(/^[0-9a-f]{64}$/.test(process.env.EXPECTED_SHA256||'')&&digest===process.env.EXPECTED_SHA256&&digest===meta.sha256,'Approved video digest mismatch');
 must(meta.format==='annotated-world-delivery/v1'&&meta.publicationApproved===true&&meta.rightsReviewed===true,'Publication/rights gate missing');
 must(/^[a-zA-Z0-9_-]+$/.test(meta.clipId)&&/^[0-9a-f]{40}$/.test(meta.sourceSha),'Invalid source identity');
 must(typeof meta.title==='string'&&meta.title.length>0&&meta.title.length<=100&&typeof meta.description==='string'&&meta.description.length<4700,'Invalid metadata');
 const marker='AW-CLIP:'+meta.clipId;
 const playlist=channel!.contentDetails?.relatedPlaylists?.uploads;
 must(playlist,'Cannot inspect upload history for deduplication');
 let next:string|undefined=undefined;
 // Scan all uploaded videos, including private, before inserting. A prior upload with the same
 // clip ID requires review in Studio rather than re-upload. Fail closed if reads fail.
 do {
  const page=await yt.playlistItems.list({part:['snippet','contentDetails'],playlistId:playlist,maxResults:50,pageToken:next});
  const ids=(page.data.items||[]).map(i=>i.contentDetails?.videoId).filter((s):s is string=>!!s);
  if(ids.length){
   const videos=await yt.videos.list({part:['snippet','status'],id:ids});
   const found=videos.data.items?.find(v=>v.snippet?.description?.split('\n').includes(marker));
   if(found){console.log(JSON.stringify({existing:true,videoId:found.id,privacy:found.status?.privacyStatus,clipId:meta.clipId}));return}
  }
  next=page.data.nextPageToken||undefined;
 }while(next);
 const res=await yt.videos.insert({part:['snippet','status'],requestBody:{snippet:{title:meta.title,description:meta.description+'\n\n'+marker+'\nAW-SHA256:'+digest,categoryId:'27',tags:['The Annotated World','英語学習','思想'],defaultLanguage:'ja'},status:{privacyStatus:'private',selfDeclaredMadeForKids:false}},media:{body:fs.createReadStream(file)}});
 must(res.data.id,'Upload returned no video ID; inspect Studio before retry');
 const v=await yt.videos.list({part:['snippet','status'],id:[res.data.id!]});
 const item=v.data.items?.[0];
 must(item?.snippet?.channelId===channel!.id&&item.status?.privacyStatus==='private','Upload readback mismatch; inspect Studio immediately');
 const receipt={clipId:meta.clipId,sourceSha:meta.sourceSha,sha256:digest,videoId:res.data.id,channelId:channel!.id,privacy:'private'};
 fs.writeFileSync(path.join(folder,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify(receipt));
}
main().catch(e=>{console.error(String(e?.message||e).slice(0,500));process.exitCode=1});
