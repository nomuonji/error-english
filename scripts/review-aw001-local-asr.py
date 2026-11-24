#!/usr/bin/env python3
"""Analyze the pinned episode-001 voice WAV with local Whisper; no uploads or approvals."""
import sys,json,hashlib,re,difflib
from pathlib import Path
import numpy as np,soundfile as sf
from faster_whisper import WhisperModel
root=Path(sys.argv[1]);timeline=json.loads((root/'timeline.json').read_text())
audio,sr=sf.read(root/'voice-only.wav',always_2d=True)
assert len(timeline)==25 and len(audio)/sr>=96.1
mp4=root/'annotated-short.mp4'
assert hashlib.sha256(mp4.read_bytes()).hexdigest()=='194c6a7ba04ecf056fe070b8fdebc3faee4d9db107f4ce68c3590951d6aee9ac','MP4 mismatch'
mono=audio.mean(axis=1).astype('float32')
sample_rate=16000
from scipy.signal import resample_poly
group_results={}
model=WhisperModel('small',device='cpu',compute_type='int8',download_root='/tmp/whisper-cache')
for group,language,chosen in [('english_quotes','en',[c for c in timeline if c['role']=='QUOTE']),('japanese_editor','ja',[c for c in timeline if c['role']!='QUOTE'])]:
 chunks=[];expected=[]
 for cue in chosen:
  a=int(cue['start']*sr);b=int(cue['speechEnd']*sr)
  assert b>a
  chunks.append(mono[a:b])
  chunks.append(np.zeros(int(0.3*sr),dtype='float32'))
  expected.append(cue.get('en' if language=='en' else 'ja',''))
 data=np.concatenate(chunks)
 data=resample_poly(data,sample_rate,sr).astype('float32')
 segments,info=model.transcribe(data,language=language,beam_size=4,condition_on_previous_text=False,temperature=0)
 recognized=' '.join(s.text.strip() for s in segments)
 reference=' '.join(expected)
 def normalize_en(v):return re.sub(r'[^a-z0-9]+','',v.lower())
 def normalize_ja(v):return re.sub(r'[\s\W_]+','',v)
 norm=normalize_en if language=='en' else normalize_ja
 score=difflib.SequenceMatcher(a=norm(reference),b=norm(recognized),autojunk=False).ratio()
 group_results[group]={'language':language,'expected':reference,'recognized':recognized,'similarity':round(score,3),'segments':len(chosen),'audioDurationSec':round(len(data)/sample_rate,2)}
 if not recognized.strip():group_results[group]['issue']='ASR returned empty speech'
report={'clipId':'aw-001-zizek-ai-consequences','mp4Sha256':'194c6a7ba04ecf056fe070b8fdebc3faee4d9db107f4ce68c3590951d6aee9ac','method':'faster-whisper small CPU int8, independent speech decoding of exact renderer voice-only audio','limitations':'ASR confidence is not ear-listening or word-perfect subtitle validation; Japanese orthography can lower literal similarity; independent full subjective video review still separate','results':group_results}
Path('aw001-local-speech-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({group:{k:v for k,v in data.items() if k in ['language','similarity','segments','audioDurationSec','issue']} for group,data in group_results.items()},ensure_ascii=False))
