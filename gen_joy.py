import json,base64,urllib.request,subprocess,os,re,re as _r
K=os.environ['ELEVENLABS_API_KEY'];V='hpp4J3VqNfWAUOO0d1Us';os.makedirs('joy_out',exist_ok=True);os.makedirs('joy_raw',exist_ok=True)
WORDS=[l.strip() for l in open('joy_words.txt') if l.strip()]
VAR={'b':('{w}. Nice!',0.65,0.1,0.95)}
for w in WORDS:
    for k,(tpl,stab,style,sp) in VAR.items():
        text=tpl.format(w=w)
        body=json.dumps({'text':text,'model_id':'eleven_multilingual_v2','voice_settings':{'stability':stab,'similarity_boost':0.8,'style':style,'speed':sp}}).encode()
        r=urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{V}/with-timestamps?output_format=mp3_44100_128',data=body,headers={'xi-api-key':K,'Content-Type':'application/json'})
        d=json.loads(urllib.request.urlopen(r,timeout=120).read());tag=re.sub(r'[^a-z0-9]+','-',w.lower()).strip('-')+'_'+k
        if os.path.exists(f'joy_out/{tag}.mp3'):continue
        open(f'joy_raw/{tag}.mp3','wb').write(base64.b64decode(d['audio_base64']))
        al=d['alignment'];a=max(0,al['character_start_times_seconds'][0]-0.03);b=al['character_end_times_seconds'][len(w)-1]+0.18;dur=b-a
        json.dump({'text':text,'a':a,'b':b},open(f'joy_raw/{tag}.json','w'))
        pk=subprocess.run(['ffmpeg','-hide_banner','-ss',f'{a:.3f}','-t',f'{dur:.3f}','-i',f'joy_raw/{tag}.mp3','-af','volumedetect','-f','null','-'],capture_output=True,text=True).stderr
        m=re.search(r'max_volume: (-?[\d.]+) dB',pk);g=min(12,max(-6,-1-float(m.group(1)))) if m else 0
        subprocess.run(['ffmpeg','-y','-loglevel','error','-ss',f'{a:.3f}','-t',f'{dur:.3f}','-i',f'joy_raw/{tag}.mp3','-af',f'afade=t=out:st={max(0,dur-0.08):.3f}:d=0.08,volume={g:.1f}dB','-ar','44100','-b:a','64k',f'joy_out/{tag}.mp3'],check=True)
print('joy ok')
