'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const SITE=path.join(__dirname,'..','site'),DATA=process.env.DATA_DIR||path.join(__dirname,'..','data'),DB=path.join(DATA,'db.json');
const WORDS=JSON.parse(fs.readFileSync(path.join(SITE,'words.json'),'utf8'));
const FLD={n:'au',s:'aus',f:'auf',j:'auj'};
function wordsOut(){const ch=db.audio||{};return WORDS.map(w=>{const o={...w};if(w.iso&&w.ctx)for(const [x,f] of Object.entries(FLD)){const sel=ch[w.en+'|'+x]||(w.def&&w.def[x])||'iso';const p=(sel==='ctx'&&w.ctx[x])?w.ctx[x]:w.iso[x];if(p)o[f]=p}return o})}
const INT=[1,1,3,7,14,30];
let db={families:[],audio:{}};try{db=JSON.parse(fs.readFileSync(DB,'utf8'))}catch(e){}
fs.mkdirSync(DATA,{recursive:true});
const save=()=>{fs.writeFileSync(DB+'.tmp',JSON.stringify(db));fs.renameSync(DB+'.tmp',DB);setImmediate(()=>{try{thabatCheck()}catch(e){console.error('thabat',e.message)}})};
const rid=()=>crypto.randomBytes(18).toString('base64url');
const today=()=>new Date(Date.now()+3*3600e3).toISOString().slice(0,10);
const add=(d,n)=>{const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
function state(k){const m={};const seenDay={};
 for(const s of k.log){const id=s.en+s.date;if(seenDay[id]&&!s.force)continue;seenDay[id]=1;
  const w=m[s.en]||(m[s.en]={box:0,fails:0,last:s.date,first:s.date});
  if(s.known){w.box=Math.max(w.box,3);w.known=true}else if(s.ok)w.box=Math.min(w.box+(w.n?1:0)+(w.n?0:1),5);else{w.box=0;w.fails++}
  w.n=1;w.last=s.date;w.due=add(s.date,INT[w.box])}
 return m}
function recall(k){// تذكّر الكلمة من أول مراجعة بعد يوم أو أكثر من تعلّمها
 const first={},res={};for(const s of k.log){if(!(s.en in first)){first[s.en]=s.date;continue}if(!(s.en in res)&&s.date>first[s.en])res[s.en]=s.ok}
 const v=Object.values(res);return{n:v.length,ok:v.filter(Boolean).length}}
const ORIGIN=process.env.ORIGIN||'https://kalimati.wardyat.net';
// ───── تكامل ثبات (THABAT_CONTRACT.md): ثبات يملك الحسابات والنقاط؛ هنا رمز موقّع يُعرّف الولد، وحدث إنجاز موقّع يُرسَل لثبات ─────
const THABAT_URL=(process.env.THABAT_URL||'https://thabat.wardyat.net').replace(/\/$/,''),HSECRET=process.env.THABAT_HABIT_SECRET||'';
function thabatKid(token){// يتحقق من رمز ثبات ويرجع ولد كلماتي المقابل (يُنشأ تلقائياً في عائلة داخلية بلا رابط أب)
 if(!HSECRET||!token)return null;const [pl,sg]=String(token).split('.');if(!pl||!sg)return null;
 const want=crypto.createHmac('sha256',HSECRET).update(pl).digest(),got=Buffer.from(sg,'base64url');
 if(got.length!==want.length||!crypto.timingSafeEqual(got,want))return null;
 let o;try{o=JSON.parse(Buffer.from(pl,'base64url').toString('utf8'))}catch(e){return null}
 if(!o||o.h!=='word'||!(o.e>Date.now())||!o.k)return null;
 let f=db.families.find(x=>x.thabat);if(!f){f={name:'ثبات',parent:rid(),kids:[],thabat:true};db.families.push(f)}
 let k=f.kids.find(x=>x.thabat===o.k);if(!k){k={id:rid().slice(0,6),name:String(o.n||'').slice(0,30),token:rid(),newPerDay:1,log:[],hears:{},thabat:o.k};f.kids.push(k)}
 else if(o.n)k.name=String(o.n).slice(0,30);
 save();return k}
let reporting=false;
const AD=n=>String(n).replace(/\d/g,d=>'٠١٢٣٤٥٦٧٨٩'[d]);
function habitBody(k,t){// حدث v2: الإنجاز + تسجيلات اليوم (≤10) + نص إحصاء للأب
 const units=new Set(k.log.filter(x=>x.date===t).map(x=>x.en)).size,
  rs=Object.entries(k.recs||{}).filter(([,v])=>v.date===t&&v.id).slice(-10).map(([en,v])=>({id:v.id,secs:v.secs||3,label:en.slice(0,60),t:v.t})),
  all=Object.values(k.recs||{}).filter(v=>v.date===t),ok=all.filter(v=>v.mark!==false).length,rc=recall(k),pct=rc.n?Math.round(rc.ok/rc.n*100):null,
  txt=[all.length?`نطق ${AD(ok)} من ${AD(all.length)}`:null,pct!==null?`تذكّر ${AD(pct)}٪`:null].filter(Boolean).join(' · ');
 const o={kidId:k.thabat,habit:'word',date:t,units,secs:0,confirmed:true};if(rs.length)o.recs=rs;if(txt)o.stats={text:txt};return JSON.stringify(o)}
function sendHabit(k,t,onFail){const body=habitBody(k,t);
 return fetch(THABAT_URL+'/api/v2/habit-events',{method:'POST',headers:{'content-type':'application/json','x-signature':crypto.createHmac('sha256',HSECRET).update(body).digest('hex')},body})
  .then(r=>{if(!r.ok)throw new Error('http '+r.status)}).catch(e=>{console.error('thabat report failed',e.message);onFail&&onFail()})}
function thabatCheck(){if(!HSECRET||reporting)return;const t=today();
 for(const f of db.families)for(const k of f.kids){if(!k.thabat||k.reported===t)continue;
  if(!(k.log.some(x=>x.date===t)&&plan(k).items.length===0))continue;// أنهى جلسة اليوم: لا بقي جديد ولا مراجعة
  reporting=true;k.reported=t;
  sendHabit(k,t,()=>{k.reported=null}).finally(()=>{reporting=false;fs.writeFileSync(DB+'.tmp',JSON.stringify(db));fs.renameSync(DB+'.tmp',DB)});
  return}}
function card(f){const t=today();return{contract:'wardyat.module-card',version:1,module:{id:'kalimati',title:'كلمة',subtitle:'حفظ كلمات إنجليزية',icon:'🔤',url:ORIGIN},family:{name:f.name},generatedAt:new Date().toISOString(),
 kids:f.kids.map(k=>{const s=state(k),rc=recall(k),learned=Object.keys(s).length,strong=Object.values(s).filter(w=>w.box>=4).length,days7=new Set(k.log.filter(x=>x.date>=add(t,-6)).map(x=>x.date)).size,pct=rc.n?Math.round(rc.ok/rc.n*100):null,done=k.log.some(x=>x.date===t),
  weak=Object.entries(s).filter(([,w])=>w.fails>=2||w.box===0).map(([en])=>en);
  return{ref:k.id,name:k.name,deepLink:ORIGIN+'/k/'+k.token,today:{done,label:done?'أنهى جلسة اليوم':'لم يبدأ جلسة اليوم'},
   headline:learned?`${learned} كلمة${pct!==null?' · تذكّر '+pct+'%':''}`:'لم يبدأ بعد',
   metrics:[{key:'learned',label:'كلمات تعلّمها',value:learned,unit:'word'},{key:'strong',label:'كلمات راسخة',value:strong,unit:'word'},{key:'days7',label:'أيام التمرين (آخر ٧)',value:days7,unit:'day'},{key:'recall',label:'تذكّر أول مراجعة',value:pct,unit:'percent'}],
   attention:weak.length?[{type:'weak_words',label:'كلمات تحتاج دعماً',items:weak.slice(0,10)}]:[]}})}}
const KIND={s6:'اختيار الكلمة',r2:'اختيار الكلمة',s5:'بناء الكلمة',r3:'بناء الكلمة',s7:'الحرف الناقص',s9:'اسمع واكتب'};
function signals(k){const st=(k.steps||[]).filter(x=>KIND[x.s]),by={},conf={};
 for(const x of st){const g=by[KIND[x.s]]||(by[KIND[x.s]]={n:0,ok1:0,lat:[],help:0});g.n++;if(!x.errs)g.ok1++;if(x.lat!=null)g.lat.push(x.lat);g.help+=x.help+x.ear;for(const c of x.conf)conf[c]=(conf[c]||0)+1}
 const med=a=>{if(!a.length)return null;a=a.slice().sort((x,y)=>x-y);return a[a.length>>1]};
 return{n:st.length,kinds:Object.entries(by).map(([name,g])=>({name,n:g.n,firstAttemptPct:Math.round(g.ok1/g.n*100),medianLatMs:med(g.lat),help:g.help})),confusions:Object.entries(conf).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([c,n])=>({pair:c,n}))}}
function pickNew(k,m,skip=[]){const lv=k.level||0,un=WORDS.filter(w=>!m[w.en]&&!w.hold&&!skip.includes(w.en));
 const ge=un.filter(w=>(w.level??2)>=lv).sort((a,b)=>(a.level??2)-(b.level??2));return ge[0]||un[0]||null}
function insights(k){const sg=signals(k),out=[],lv=k.level||0,N=sg.n,pre=N<30?' (مؤشر أولي)':'';
 const tot=sg.kinds.reduce((a,x)=>a+x.n,0),ok1=tot?sg.kinds.reduce((a,x)=>a+x.firstAttemptPct*x.n,0)/tot:null;
 const fast=sg.kinds.filter(x=>x.medianLatMs!=null);const lat=fast.length?fast.reduce((a,x)=>a+x.medianLatMs,0)/fast.length:null;
 if(N>=8&&ok1>=90&&lat!=null&&lat<2500&&lv<5)out.push({id:'up',kind:'up',text:'يجيب صحيحاً من أول محاولة وبسرعة'+pre+'. نقترح رفع المستوى.',action:{label:'ارفع إلى المستوى '+(lv+1),level:lv+1}});
 if(N>=8&&ok1<60&&lv>0)out.push({id:'down',kind:'down',text:'يخطئ كثيراً في أول محاولة ('+Math.round(ok1)+'%)'+pre+'. نقترح كلمات أبسط.',action:{label:'خفّض إلى المستوى '+(lv-1),level:lv-1}});
 const by=Object.fromEntries(sg.kinds.map(x=>[x.name,x]));
 if(by['اختيار الكلمة']&&by['بناء الكلمة']&&by['اختيار الكلمة'].n>=4&&by['بناء الكلمة'].n>=4&&by['اختيار الكلمة'].firstAttemptPct-by['بناء الكلمة'].firstAttemptPct>=30)out.push({id:'spell',kind:'note',text:'يتعرّف على الكلمة المكتوبة لكنه يتعثر في تركيبها بالحروف'+pre+'. يحتاج مزيداً من التهجئة.'});
 if(k.skills&&k.skills.listen>k.skills.read)out.push({id:'read',kind:'note',text:'يفهم الكلمات سماعاً أكثر مما يقرؤها (تعارف: سماع '+k.skills.listen+' / قراءة '+k.skills.read+'). التركيز على الحروف والقراءة.'});
 for(const c of sg.confusions)if(c.n>=3)out.push({id:'c'+c.pair,kind:'note',text:'يخلط بين الحرفين '+c.pair.replace('>',' و ')+' ('+c.n+' مرات).'});
 const help=sg.kinds.reduce((a,x)=>a+x.help,0);if(N>=8&&help/N>0.5)out.push({id:'help',kind:'note',text:'يستعمل المعنى العربي والاستماع كثيراً. قد تناسبه كلمات أبسط أو شرح أكثر.'});
 const sk=(k.steps||[]).filter(x=>x.taps>=10&&x.ms<8000).length;if(sk>=3)out.push({id:'att',kind:'note',text:'ضغط سريع/تخطٍّ في '+sk+' خطوات: يبدو تشتتاً لا ضعفاً في القدرة.'});
 return out}
function plan(k){const t=today(),m=state(k);
 const learnedToday=Object.entries(m).filter(([,w])=>w.first===t).map(([en])=>en);
 const recent=Object.entries(m).filter(([,w])=>w.first<t&&w.last!==t).sort((x,y)=>y[1].first<x[1].first?-1:y[1].first>x[1].first?1:0).slice(0,5).map(x=>x[0]);
 const dueAll=Object.entries(m).filter(([,w])=>w.due<=t&&w.last!==t&&w.first<t).sort((x,y)=>x[1].box-y[1].box).map(x=>x[0]);
 const rev=[...new Set([...recent,...dueAll])].slice(0,7).map(en=>({en,mode:'rev',box:m[en].box}));
 let fresh=[];
 if(dueAll.length<=12){const want=Math.max(0,(k.newPerDay||1)-learnedToday.length);
  {const sk=[];for(let i=0;i<want;i++){const w=pickNew(k,m,sk);if(!w)break;sk.push(w.en);fresh.push({en:w.en,mode:'new',box:0})}}}
 return{kid:k.name,placed:!!k.placed,level:k.level||0,items:[...fresh,...rev]}}
const find=(t)=>{for(const f of db.families){if(f.parent===t)return{f,role:'p'};const k=f.kids.find(k=>k.token===t);if(k)return{f,k,role:'k'}}return{}};
const json=(r,c,o)=>{r.writeHead(c,{'content-type':'application/json'});r.end(JSON.stringify(o))};
const MIME={'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.mp3':'audio/mpeg','.webp':'image/webp'};
const RECDIR=path.join(DATA,'rec');fs.mkdirSync(RECDIR,{recursive:true});
const slug=x=>x.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function cleanRec(){const lim=Date.now()-30*864e5;for(const f of db.families)for(const k of f.kids){for(const [en,v] of Object.entries(k.recs||{})){if(new Date(v.date).getTime()<lim){try{fs.unlinkSync(path.join(RECDIR,k.id,slug(en)+'.'+v.ext))}catch(e){}delete k.recs[en]}}}save()}
cleanRec();setInterval(cleanRec,864e5);
http.createServer((q,r)=>{const chunks=[];let got=0;q.on('data',d=>{got+=d.length;if(got<=1.5e6)chunks.push(d)});q.on('end',()=>{try{const raw=Buffer.concat(chunks),body=raw.toString();
 const u=new URL(q.url,'http://x'),p=u.pathname;let m;
 if(p==='/'&&u.searchParams.get('t')){const k=thabatKid(u.searchParams.get('t'));if(!k){r.writeHead(401,{'content-type':'text/plain;charset=utf-8'});return r.end('رمز الدخول غير صالح أو انتهت صلاحيته. افتح كلمة من تطبيق ثبات.')}
  r.writeHead(302,{location:'/k/'+k.token,'cache-control':'no-store'});return r.end()}
 if(p==='/api/_new-family'&&q.method==='POST'&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(q.socket.remoteAddress)){
  const f={name:JSON.parse(body).name,parent:rid(),kids:[]};db.families.push(f);save();return json(r,200,{parent:f.parent})}
 if(m=p.match(/^\/api\/k\/([\w-]+)\/plan$/)){const{k}=find(m[1]);if(!k)return json(r,404,{});return json(r,200,plan(k))}
 if((m=p.match(/^\/api\/k\/([\w-]+)\/loop$/))&&q.method==='POST'){const{k}=find(m[1]);if(!k)return json(r,404,{});
  const a=JSON.parse(body);if(!WORDS.some(w=>w.en===a.en))return json(r,400,{});k.log.push({date:today(),en:a.en,ok:(+a.wrong||0)<3});k.hears=k.hears||{};k.hears[a.en]=(k.hears[a.en]||0)+Math.min(200,+a.hears||0);save();return json(r,200,{})}
 if((m=p.match(/^\/api\/p\/([\w-]+)\/integration$/))&&q.method==='POST'){const{f,role}=find(m[1]);if(role!=='p')return json(r,404,{});const a=body?JSON.parse(body):{};
  if(a.revoke){delete f.integrationKey;save();return json(r,200,{revoked:true})}
  if(!f.integrationKey||a.rotate){f.integrationKey=rid(24);save()}return json(r,200,{url:ORIGIN+'/api/v1/i/'+f.integrationKey})}
 if((m=p.match(/^\/api\/p\/([\w-]+)\/integration$/))&&q.method==='GET'){const{f,role}=find(m[1]);if(role!=='p')return json(r,404,{});return json(r,200,{url:f.integrationKey?ORIGIN+'/api/v1/i/'+f.integrationKey:null})}
 if((m=p.match(/^\/api\/v1\/i\/([\w-]+)$/))&&q.method==='GET'){const f=db.families.find(x=>x.integrationKey&&x.integrationKey===m[1]);if(!f)return json(r,404,{error:'invalid_or_revoked'});
  r.setHeader('access-control-allow-origin','https://ayah.wardyat.net');r.setHeader('x-contract-version','1');return json(r,200,card(f))}
 if((m=p.match(/^\/api\/habit\/rec\/([\w-]{1,64})$/))&&q.method==='GET'){const kid=u.searchParams.get('kid')||'',ts=+u.searchParams.get('ts'),sig=u.searchParams.get('sig')||'';
  if(!HSECRET||!/^[0-9a-f]{64}$/.test(sig)||!(Math.abs(Date.now()-ts)<=120000))return json(r,401,{});
  const want=crypto.createHmac('sha256',HSECRET).update('rec|word|'+m[1]+'|'+kid+'|'+u.searchParams.get('ts')).digest();
  if(!crypto.timingSafeEqual(want,Buffer.from(sig,'hex')))return json(r,401,{});
  let hit=null;for(const f of db.families)for(const k of f.kids)if(k.thabat===kid)for(const v of Object.values(k.recs||{}))if(v.id===m[1])hit={k,v};
  if(!hit)return json(r,404,{});const fp=path.join(RECDIR,hit.k.id,slug(hit.v.id.split('_')[0])+'.'+hit.v.ext);if(!fs.existsSync(fp))return json(r,404,{});
  r.writeHead(200,{'content-type':hit.v.ext==='m4a'?'audio/mp4':'audio/webm','cache-control':'no-store'});return fs.createReadStream(fp).pipe(r)}
 if(p==='/words.json'){r.writeHead(200,{'content-type':'application/json','cache-control':'no-cache'});return r.end(JSON.stringify(wordsOut()))}
 if((m=p.match(/^\/api\/p\/([\w-]+)\/audio$/))&&q.method==='GET'){const{role}=find(m[1]);if(role!=='p')return json(r,404,{});return json(r,200,{words:WORDS.map(w=>({en:w.en,ar:w.ar,iso:w.iso,ctx:w.ctx||null,def:w.def||{},sel:Object.fromEntries(Object.keys(FLD).map(x=>[x,(db.audio||{})[w.en+'|'+x]||null]))})),styles:{n:'عادي',j:'فرِح',f:'سريع',s:'بطيء'}})}
 if((m=p.match(/^\/api\/p\/([\w-]+)\/audio$/))&&q.method==='POST'){const{role}=find(m[1]);if(role!=='p')return json(r,404,{});const a=JSON.parse(body);
  if(!WORDS.some(w=>w.en===a.en)||!FLD[a.style]||!['ctx','iso','bad'].includes(a.src))return json(r,400,{});db.audio=db.audio||{};db.audio[a.en+'|'+a.style]=a.src;save();return json(r,200,{})}
 if((m=p.match(/^\/api\/k\/([\w-]+)\/rec$/))&&q.method==='POST'){const{k}=find(m[1]);if(!k)return json(r,404,{});const en=u.searchParams.get('en'),ext=/mp4|aac/.test(q.headers['content-type']||'')?'m4a':'webm';
  if(!WORDS.some(w=>w.en===en)||raw.length<500||got>1.5e6)return json(r,400,{});fs.mkdirSync(path.join(RECDIR,k.id),{recursive:true});
  for(const e of ['m4a','webm'])try{fs.unlinkSync(path.join(RECDIR,k.id,slug(en)+'.'+e))}catch(x){}
  fs.writeFileSync(path.join(RECDIR,k.id,slug(en)+'.'+ext),raw);k.recs=k.recs||{};const t0=Date.now();k.recs[en]={date:today(),ext,mark:null,id:slug(en)+'_'+t0.toString(36),t:t0,secs:3};save();if(HSECRET&&k.thabat&&k.reported===today())sendHabit(k,today());return json(r,200,{})}
 if((m=p.match(/^\/api\/p\/([\w-]+)\/rec\/(\w+)\/([\w-]+)$/))&&q.method==='GET'){const{f,role}=find(m[1]);if(role!=='p')return json(r,404,{});const k=f.kids.find(k=>k.id===m[2]);
  const en=Object.keys(k?.recs||{}).find(e=>slug(e)===m[3]);if(!en)return json(r,404,{});const v=k.recs[en],fp=path.join(RECDIR,k.id,m[3]+'.'+v.ext);if(!fs.existsSync(fp))return json(r,404,{});
  r.writeHead(200,{'content-type':v.ext==='m4a'?'audio/mp4':'audio/webm','cache-control':'no-store'});return fs.createReadStream(fp).pipe(r)}
 if((m=p.match(/^\/api\/p\/([\w-]+)\/rec\/(\w+)\/([\w-]+)\/mark$/))&&q.method==='POST'){const{f,role}=find(m[1]);if(role!=='p')return json(r,404,{});const k=f.kids.find(k=>k.id===m[2]);
  const en=Object.keys(k?.recs||{}).find(e=>slug(e)===m[3]);if(!en)return json(r,404,{});const ok=!!JSON.parse(body).ok;k.recs[en].mark=ok;if(!ok)k.log.push({date:today(),en,ok:false,force:true});save();return json(r,200,{})}
 if((m=p.match(/^\/api\/k\/([\w-]+)\/steps$/))&&q.method==='POST'){const{k}=find(m[1]);if(!k)return json(r,404,{});const a=JSON.parse(body);if(Array.isArray(a)){k.steps=(k.steps||[]).concat(a.slice(0,80).map(x=>({date:today(),w:String(x.w||'').slice(0,30),s:String(x.s||'').slice(0,12),taps:+x.taps||0,ms:+x.ms||0,lat:x.lat==null?null:+x.lat,errs:+x.errs||0,help:+x.help||0,ear:+x.ear||0,conf:Array.isArray(x.conf)?x.conf.slice(0,5).map(c=>String(c).slice(0,6)):[]}))).slice(-3000);save()}return json(r,200,{})}
 if((m=p.match(/^\/api\/k\/([\w-]+)\/diag$/))&&q.method==='POST'){const{k}=find(m[1]);if(!k)return json(r,404,{});const a=JSON.parse(body);if(Array.isArray(a)){k.diag=(k.diag||[]).concat(a.slice(0,150).map(x=>({date:today(),ev:String(x.ev).slice(0,10),x:String(x.x||'').slice(-28),d:x.d,ct:x.ct,ua:(q.headers['user-agent']||'').slice(0,90)}))).slice(-600);save()}return json(r,200,{})}
 if((m=p.match(/^\/api\/k\/([\w-]+)\/newword$/))&&q.method==='GET'){const{k}=find(m[1]);if(!k)return json(r,404,{});const sk=(u.searchParams.get('skip')||'').split(',').filter(Boolean);const w=pickNew(k,state(k),sk);return json(r,200,{en:w?w.en:null})}
 if((m=p.match(/^\/api\/k\/([\w-]+)\/placement$/))&&q.method==='POST'){const{k}=find(m[1]);if(!k)return json(r,404,{});const a=JSON.parse(body),c=x=>Math.max(0,Math.min(4,Math.round(+x||0)));k.skills={listen:c(a.listen),read:c(a.read),date:today()};k.level=c(a.start!=null?a.start:a.read);k.placed=true;save();return json(r,200,{level:k.level})}
 if((m=p.match(/^\/api\/k\/([\w-]+)\/answer$/))&&q.method==='POST'){const{k}=find(m[1]);if(!k)return json(r,404,{});
  const a=JSON.parse(body);if(!WORDS.some(w=>w.en===a.en))return json(r,400,{});k.log.push({date:today(),en:a.en,ok:!!a.ok,known:!!a.known});save();return json(r,200,{})}
 if(m=p.match(/^\/api\/p\/([\w-]+)$/)){const{f,role}=find(m[1]);if(role!=='p')return json(r,404,{});
  return json(r,200,{name:f.name,kids:f.kids.map(k=>{const s=state(k),t=today();return{id:k.id,name:k.name,token:k.token,newPerDay:k.newPerDay||1,level:k.level||0,placed:!!k.placed,skills:k.skills||null,knownCount:Object.values(state(k)).filter(w=>w.known).length,kidUrl:'/k/'+k.token,doneToday:k.log.some(x=>x.date===today()),signals:signals(k),insights:insights(k),audioDiag:(()=>{const D=(k.diag||[]).filter(x=>x.date>=add(today(),-2));return{sysPause:D.filter(x=>x.ev==='syspause').length,errors:D.filter(x=>x.ev==='error').length,interrupts:D.filter(x=>x.ev==='int').length,plays:D.filter(x=>x.ev==='play').length,ua:D.length?D[D.length-1].ua:null}})(),recs:Object.entries(k.recs||{}).map(([en,v])=>({en,slug:slug(en),date:v.date,mark:v.mark})),recall:recall(k),spam:(k.steps||[]).filter(x=>x.date>=add(today(),-6)&&x.taps>=10&&x.ms<8000).length,hears:Object.entries(k.hears||{}).map(([en,n])=>({en,n})),learned:Object.keys(s).length,strong:Object.values(s).filter(w=>w.box>=4).length,
   days7:new Set(k.log.filter(x=>x.date>=add(t,-6)).map(x=>x.date)).size,weak:Object.entries(s).filter(([,w])=>w.fails>=2||w.box===0).map(([en])=>en)}}),words:WORDS.map(w=>({en:w.en,ar:w.ar,au:w.au}))})}
 if((m=p.match(/^\/api\/p\/([\w-]+)\/kid$/))&&q.method==='POST'){const{f,role}=find(m[1]);if(role!=='p')return json(r,404,{});
  const a=JSON.parse(body);f.kids.push({id:rid().slice(0,6),name:String(a.name).slice(0,30),token:rid(),newPerDay:1,log:[],hears:{}});save();return json(r,200,{})}
 if((m=p.match(/^\/api\/p\/([\w-]+)\/kid\/(\w+)\/settings$/))&&q.method==='POST'){const{f,role}=find(m[1]);if(role!=='p')return json(r,404,{});
  const k=f.kids.find(k=>k.id===m[2]);if(!k)return json(r,404,{});const bb=JSON.parse(body);if(bb.newPerDay!=null)k.newPerDay=Math.max(1,Math.min(3,+bb.newPerDay||1));if(bb.level!=null){k.level=Math.max(0,Math.min(5,+bb.level||0));k.placed=true}save();return json(r,200,{})}
 let file=p.startsWith('/k/')?'index.html':p.startsWith('/p/')?'parent.html':p.startsWith('/a/')?'audio.html':p==='/joy'?'joy.html':p.slice(1)||'index.html';
 const fp=path.join(SITE,file);if(!fp.startsWith(SITE)||!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){r.writeHead(404);return r.end('')}
 const size=fs.statSync(fp).size,ct=MIME[path.extname(fp)]||'application/octet-stream',h={'content-type':ct,'accept-ranges':'bytes','cache-control':/\.(mp3|webp)$/.test(file)?'public,max-age=86400':'no-cache','x-robots-tag':'noindex'};
 const rg=q.headers.range&&q.headers.range.match(/bytes=(\d*)-(\d*)/);
 if(rg){const a=rg[1]===''?size-(+rg[2]):+rg[1],b=rg[1]===''||rg[2]===''?size-1:Math.min(+rg[2],size-1);if(a>b||a>=size){r.writeHead(416,{'content-range':'bytes */'+size});return r.end()}
  r.writeHead(206,{...h,'content-range':`bytes ${a}-${b}/${size}`,'content-length':b-a+1});return fs.createReadStream(fp,{start:a,end:b}).pipe(r)}
 r.writeHead(200,{...h,'content-length':size});fs.createReadStream(fp).pipe(r)
}catch(e){console.error(e);json(r,500,{})}})}).listen(3000);
