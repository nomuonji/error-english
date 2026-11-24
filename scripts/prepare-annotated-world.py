#!/usr/bin/env python3
"""Package a reviewed Studio v2 render for the existing OAuth holder; never publish."""
import hashlib,json,os,re,subprocess,sys,shutil
from pathlib import Path
root=Path(sys.argv[1]).resolve()
clip=sys.argv[2];sha=sys.argv[3]
assert re.fullmatch(r'[A-Za-z0-9_-]+',clip) and re.fullmatch(r'[0-9a-f]{40}',sha),'Invalid clip or revision'
folder=root/'productions'/clip
brief=folder/'brief.json'
b=json.loads(brief.read_text())
subprocess.run(['node',str(root/'scripts/short-studio.mjs'),'check',str(brief),'--publish'],check=True)
subprocess.run(['node',str(root/'scripts/clip-script.mjs'),'export',str(brief)],check=True,stdout=subprocess.DEVNULL)
# Check explicit editorial approval separately from technical pass; owner approval must identify this revision.
approval=b.get('deliveryReview',{})
assert approval.get('approved') is True and approval.get('reviewer') and approval.get('evidence'),'Missing completed editorial review'
subprocess.run([sys.executable,str(root/'tools/annotated-short/studio.py'),str(brief)],check=True)
out=folder/'output'/b['selectedHook']
video=out/'annotated-short.mp4'
info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(video)]))
v=next(x for x in info['streams'] if x['codec_type']=='video')
assert v['width']*16==v['height']*9 and any(x['codec_type']=='audio' for x in info['streams']),'Need 9:16 and audio'
assert 20<=float(info['format']['duration'])<=180,'Review atypical clip duration separately'
desc=b['editorial']['payoff']+'\n\n原典: '+b['source']['url']+'\n対訳・注釈教材: '+b['editorial']['articleUrl']+'\n'+b['speaker']['name']+' / '+b['speaker']['disclosure']+'\n'
credits=set()
for s in [next(h for h in b['hooks'] if h['id']==b['selectedHook']),*b['body']]:
 if s['visual'].get('credit'):credits.add(s['visual']['credit'])
 if s['role']=='QUOTE' and s['visual']['pattern']=='archive':credits.add(b['speaker']['portraitCredit'])
desc+='\n素材・出典:\n'+'\n'.join(sorted(credits))+'\n音楽: The Annotated World original procedural score\n#TheAnnotatedWorld #英語学習 #Shorts'
assert len(desc)<4700 and len(b['title'])<=100,'Metadata too long'
dest=Path('aw-delivery');dest.mkdir(exist_ok=True)
for f in ['annotated-short.mp4','contact-sheet.jpg','timeline.json','report.json','captions.srt']:
 shutil.copy2(out/f,dest/f)
digest=hashlib.sha256(video.read_bytes()).hexdigest()
(dest/'delivery.json').write_text(json.dumps({'format':'annotated-world-delivery/v1','clipId':clip,'sourceSha':sha,'sha256':digest,'title':b['title'],'description':desc,'publicationApproved':True,'rightsReviewed':True,'selectedHook':b['selectedHook']},ensure_ascii=False,indent=2))
print('Review this artifact and copy the exact SHA256 for a separate private upload:',digest)
