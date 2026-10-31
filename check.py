import glob,os
from faster_whisper import WhisperModel
m=WhisperModel('small.en',device='cpu',compute_type='int8')
out=[]
for d in ('joy','cheer'):
    for f in sorted(glob.glob(d+'/*.mp3')):
        seg,_=m.transcribe(f,language='en',beam_size=5)
        out.append(f'{d}\t{os.path.basename(f)[:-4]}\t'+' '.join(s.text.strip() for s in seg))
open('report4.txt','w').write('\n'.join(out)+'\n');print('\n'.join(out))
