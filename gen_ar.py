import json,os,re,urllib.request
K=os.environ['ELEVENLABS_API_KEY'];AR='FZeLZd39ejvLgzR2gY0t';os.makedirs('out_ar',exist_ok=True)
for w in json.load(open('words_ar.json')):
    slug=re.sub(r'[^a-z0-9]+','-',w['en'].lower()).strip('-');p=f'out_ar/{slug}.mp3'
    if os.path.exists(p):continue
    body=json.dumps({'text':f"يعني {w['ar']}.",'model_id':'eleven_multilingual_v2','voice_settings':{'stability':0.7,'similarity_boost':0.8}}).encode()
    r=urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{AR}?output_format=mp3_44100_64',data=body,headers={'xi-api-key':K,'Content-Type':'application/json'})
    open(p,'wb').write(urllib.request.urlopen(r,timeout=60).read())
print('ar ok')
