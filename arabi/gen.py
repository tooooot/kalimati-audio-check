import json,os,urllib.request,time
K=os.environ['ELEVENLABS_API_KEY'];AR='FZeLZd39ejvLgzR2gY0t';EN='hpp4J3VqNfWAUOO0d1Us'
for d in('ar','en'):os.makedirs(f'arabi/out/{d}',exist_ok=True)
def tts(voice,text,path,speed=1.0,stab=0.75):
    if os.path.exists(path) and os.path.getsize(path)>1000:return
    body=json.dumps({'text':text,'model_id':'eleven_multilingual_v2','voice_settings':{'stability':stab,'similarity_boost':0.8,'speed':speed}}).encode()
    for t in range(3):
        try:
            r=urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_64',data=body,headers={'xi-api-key':K,'Content-Type':'application/json'})
            open(path,'wb').write(urllib.request.urlopen(r,timeout=90).read());return
        except Exception as e:
            print('retry',path,e);time.sleep(3)
    raise SystemExit('failed '+path)
for w in json.load(open('arabi/gen_input.json')):
    s,tx,en=w['slug'],w['tx'],w['en']
    tts(AR,tx,f'arabi/out/ar/{s}.mp3')
    tts(AR,tx,f'arabi/out/ar/{s}_s.mp3',speed=0.7)
    tts(AR,tx,f'arabi/out/ar/{s}_f.mp3',speed=1.15)
    tts(AR,f'{tx}! رَائِع!',f'arabi/out/ar/{s}_j.mp3',stab=0.6)
    tts(EN,en+'.',f'arabi/out/en/{s}.mp3',stab=0.7)
print('done')
