import glob,os,re
from faster_whisper import WhisperModel
m=WhisperModel('small.en',device='cpu',compute_type='int8')
def tr(p,prompt=None):
    seg,_=m.transcribe(p,language='en',beam_size=5,initial_prompt=prompt);return ' '.join(s.text.strip() for s in seg)
out=[]
for d,prompt in (('letters_ind','Spelling letters of the alphabet.'),('letters_cut','Spelling letters of the alphabet.'),('words',None)):
    for f in sorted(glob.glob(d+'/*.mp3')):
        n=os.path.basename(f)[:-4];out.append(f'{d}\t{n}\t{tr(f,prompt)}')
open('report.txt','w').write('\n'.join(out)+'\n');print('\n'.join(out))
