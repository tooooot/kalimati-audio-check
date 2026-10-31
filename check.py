import glob,os
from faster_whisper import WhisperModel
m=WhisperModel('small.en',device='cpu',compute_type='int8')
out=[]
for d,pr in (('letters_final','Spelling letters of the alphabet.'),('variants2',None)):
    for f in sorted(glob.glob(d+'/*.mp3')):
        seg,_=m.transcribe(f,language='en',beam_size=5,initial_prompt=pr)
        out.append(f'{d}\t{os.path.basename(f)[:-4]}\t'+' '.join(s.text.strip() for s in seg))
open('report3.txt','w').write('\n'.join(out)+'\n');print('\n'.join(out))
