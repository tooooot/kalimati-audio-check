import glob,os,json,re
from faster_whisper import WhisperModel
m=WhisperModel('small.en',device='cpu',compute_type='int8')
norm=lambda s:re.sub(r'[^a-z0-9]','',s.lower())
out=[]
for f in sorted(glob.glob('ctx/raw/*.mp3')):
    tag=os.path.basename(f)[:-4];meta=json.load(open(f'ctx/raw/{tag}.json'))
    seg,_=m.transcribe(f,language='en',beam_size=5)
    t=' '.join(s.text.strip() for s in seg)
    out.append(f"{tag}\t{meta['word']}\t{t}")
open('report5.txt','w').write('\n'.join(out)+'\n');print(len(out))
