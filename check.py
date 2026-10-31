import glob,os
from faster_whisper import WhisperModel
m=WhisperModel('small.en',device='cpu',compute_type='int8')
out=[]
for f in sorted(glob.glob('variants/*.mp3')):
    seg,_=m.transcribe(f,language='en',beam_size=5,initial_prompt='Spelling letters of the alphabet.' if os.path.basename(f).startswith('L_') else None)
    out.append(f'{os.path.basename(f)[:-4]}\t'+' '.join(s.text.strip() for s in seg))
open('report2.txt','w').write('\n'.join(out)+'\n');print('\n'.join(out))
