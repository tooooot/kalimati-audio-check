# يولّد كل كلمة داخل جملة بروح مختلفة ثم يقصّ الكلمة وحدها بتوقيت ElevenLabs
import json,base64,urllib.request,subprocess,os,re,sys,time
env=dict(os.environ)
K=env['ELEVENLABS_API_KEY'];V='hpp4J3VqNfWAUOO0d1Us'
STY={ # روح: (نص، ثبات، أسلوب، سرعة)
 'n':('The word is {w}.',0.6,0.0,0.95),
 'j':('Hooray! {w}!',0.3,0.7,1.0),
 'f':('Look, look! {w}!',0.4,0.5,1.05),
 's':('Listen carefully. {w}.',0.7,0.0,0.8)}
W=[{'en':l.strip()} for l in open('words.txt') if l.strip()]
only=sys.argv[1:] or None
def gen(w,sty,alt=0):
    tpl,stab,style,speed=STY[sty]
    word=w['en'].lower() if sty!='j' else w['en'].capitalize()
    if alt: tpl={'n':'Say {w}.','j':'Yay, {w}!','f':'Wow! {w}!','s':'Slowly now. {w}.'}[sty]
    text=tpl.format(w=word)
    body=json.dumps({'text':text,'model_id':'eleven_multilingual_v2','voice_settings':{'stability':stab,'similarity_boost':0.8,'style':style,'use_speaker_boost':True,'speed':speed}}).encode()
    r=urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{V}/with-timestamps?output_format=mp3_44100_128',data=body,headers={'xi-api-key':K,'Content-Type':'application/json'})
    d=json.loads(urllib.request.urlopen(r,timeout=120).read())
    slug=re.sub(r'[^a-z0-9]+','-',w['en'].lower()).strip('-')
    tag=f'{slug}_{sty}{"b" if alt else ""}'
    open(f'ctx/raw/{tag}.mp3','wb').write(base64.b64decode(d['audio_base64']))
    al=d['alignment'];ch=''.join(al['characters']);i=ch.lower().rfind(word.lower())
    a=max(0,al['character_start_times_seconds'][i]-0.05);b=al['character_end_times_seconds'][i+len(word)-1]+0.15
    json.dump({'text':text,'start':a,'end':b,'word':word},open(f'ctx/raw/{tag}.json','w'))
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',f'ctx/raw/{tag}.mp3','-ss','%.3f'%a,'-to','%.3f'%b,'-af','afade=t=out:st=%.3f:d=0.08,loudnorm=I=-18:TP=-2:LRA=7'%max(0,b-a-0.08),'-ar','44100','-b:a','64k',f'out/{tag}.mp3'],check=True)
    return tag
for w in W:
    if only and w['en'] not in only: continue
    for sty in STY:
        slug=re.sub(r'[^a-z0-9]+','-',w['en'].lower()).strip('-')
        if os.path.exists(f'out/{slug}_{sty}.mp3'):continue
        try:gen(w,sty)
        except Exception as e:print('FAIL',w['en'],sty,e,flush=True);time.sleep(3)
    print(w['en'],flush=True)
