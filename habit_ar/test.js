// اختبار عقد ثبات v2: استماع موقّع + حدث الإنجاز مع التسجيلات. بلا شبكة خارجية.
const http=require('http'),fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto'),{spawn}=require('child_process');
const SECRET='test-secret',hm=s=>crypto.createHmac('sha256',SECRET).update(s).digest('hex');
const DATA=fs.mkdtempSync(path.join(os.tmpdir(),'k-')),events=[];let fail=0;
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const today=new Date(Date.now()+3*3600e3).toISOString().slice(0,10);
fs.writeFileSync(DATA+'/db.json',JSON.stringify({audio:{},families:[{name:'ثبات',parent:'p',thabat:true,kids:[{id:'abc123',name:'t',token:'tok1',newPerDay:0,log:[{date:today,en:'Bags',ok:true}],hears:{},thabat:'kid1'}]}]}));
const mock=http.createServer((q,r)=>{let b='';q.on('data',d=>b+=d);q.on('end',()=>{events.push({sig:q.headers['x-signature'],body:b,good:q.headers['x-signature']===hm(b)});r.writeHead(200,{'content-type':'application/json'});r.end('{"ok":true}')})}).listen(0);
const get=(p,h)=>new Promise(res=>http.get('http://127.0.0.1:3000'+p,rs=>{const c=[];rs.on('data',d=>c.push(d));rs.on('end',()=>res({s:rs.statusCode,t:rs.headers['content-type'],b:Buffer.concat(c)}))}));
const post=(p,body,type)=>new Promise(res=>{const q=http.request('http://127.0.0.1:3000'+p,{method:'POST',headers:{'content-type':type}},rs=>{rs.resume();rs.on('end',()=>res(rs.statusCode))});q.end(body)});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const srv=spawn('node',['server/server.js'],{cwd:__dirname,env:{...process.env,PORT:'3000',DATA_DIR:DATA,THABAT_HABIT_SECRET:SECRET,THABAT_URL:'http://127.0.0.1:'+mock.address().port},stdio:'inherit'});
 await sleep(1500);
 const ev1=events[0];ok(ev1&&ev1.good,'حدث الإنجاز الأول موقّع صحيحاً');ok(ev1&&!JSON.parse(ev1.body).recs,'بلا تسجيلات قبل أي تسجيل');
 const audio=Buffer.alloc(3000,7);
 ok(await post('/api/k/tok1/rec?en=Bags',audio,'audio/webm')===200,'رفع تسجيل');
 await sleep(800);const ev2=events[events.length-1],b2=JSON.parse(ev2.body);
 ok(events.length===2&&ev2.good,'إعادة إرسال موقّعة بعد التسجيل');
 ok(b2.recs&&b2.recs.length===1&&b2.recs[0].label==='Bags'&&b2.recs[0].secs>0,'الحدث يحمل التسجيل: '+JSON.stringify(b2.recs));
 ok(b2.stats&&/^نطق ١ من ١/.test(b2.stats.text),'stats.text: '+(b2.stats&&b2.stats.text)+'');ok(b2.confirmed===true&&b2.units===1,'units/confirmed');
 const id=b2.recs[0].id,mk=(i,k,ts)=>`/api/habit/rec/${i}?kid=${k}&ts=${ts}&sig=${hm(`rec|arabic|${i}|${k}|${ts}`)}`;
 let ts=Date.now(),r=await get(mk(id,'kid1',ts));ok(r.s===200&&r.t==='audio/webm'&&r.b.equals(audio),'استماع بتوقيع صحيح يعيد الصوت بنوعه');
 r=await get(`/api/habit/rec/${id}?kid=kid1&ts=${ts}&sig=${'0'.repeat(64)}`);ok(r.s===401,'توقيع خاطئ 401');
 ts=Date.now()-130000;r=await get(mk(id,'kid1',ts));ok(r.s===401,'ts أقدم من دقيقتين 401');
 ts=Date.now();r=await get(mk('nope_1','kid1',ts));ok(r.s===404,'تسجيل غير موجود 404');
 r=await get(mk(id,'other',ts));ok(r.s===404,'ولد آخر لا يصل لتسجيل غيره (404)');
 r=await get(`/api/habit/rec/${id}?kid=kid1&ts=${ts}`);ok(r.s===401,'بلا توقيع 401');
 srv.kill();mock.close();process.exit(fail?1:0)})();
