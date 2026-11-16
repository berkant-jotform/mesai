const assert=require('node:assert/strict'),C=require('../src/core'),P=require('../src/persistence');
const MIN=60000,H=60*MIN,DAY=24*H;let cases=0;
// Independent earned-hours oracle across dates, day schedules, leave, holidays,
// lunch gaps, absence and OOO. Future plans must never count as earned time.
for(const start of ['2026-11-02','2026-11-30','2026-12-28','2027-02-01'])for(const dow of [0,1,2,4,6])for(const daily of [7.5,9,10])for(const weekly of [35,45,48])for(const mode of [0,1,2,3]){
 const ws=Date.parse(start+'T00:00:00Z'),now=ws+dow*DAY+13*H,cfg={W:weekly,D:daily,days:mode===3?[0,1,2,3]:[0,1,2,3,4]},data={months:{},days:{},events:{}},store={plan:{},types:{},ooo:{},hol:{}};
 let earned=0,ooo=0;
 for(let i=0;i<7;i++){
  const date=ws+i*DAY,key=C.dkey(date),working=cfg.days.includes(i);data.months[C.mkey(date)]=1;
  if(i===2&&mode===1)store.types[key]='izin';
  if(i===3&&mode===2)store.hol[key]={n:'Test holiday'};
  const credit=working&&(store.types[key]==='izin'||store.hol[key]);
  let actual=0;
  if(i<dow&&(i+mode)%4!==0){actual=(8*60+i*15)*MIN;data.days[key]={first:date+8*H,last:date+8*H+actual,min:actual/MIN};}
  if(i===dow&&working){actual=5*H;data.events[key]=[{t:date+8*H,k:'G'},{t:date+12*H,k:'C'},{t:date+12*H+30*MIN,k:'G'}];}
  if(i<=dow)earned+=credit?Math.max(actual,daily*H):actual;
  if(i===1&&working){store.ooo[key]={m:30};ooo=30*MIN;}
  if(i>dow)store.plan[key]={s:8*60,e:19*60};
 }
 const before=JSON.stringify({data,store,cfg}),w=C.week(data,now,cfg,store,0);
 assert.equal(w.W,weekly*H+ooo);assert.equal(w.done,earned);assert.equal(w.remaining,Math.max(0,w.W-earned));
 for(const r of w.rows){for(const key of ['actual','val','count'])assert.ok(Number.isFinite(r[key])&&r[key]>=0,`${key} invalid ${r.key}`);}
 assert.equal(JSON.stringify({data,store,cfg}),before,'calculation changed the saved inputs');cases++;
}
// Invalid saved or imported structures must be rejected before changing good data.
for(const s of [{ppl:{x:{days:{d:{}}}}},{ppl:{x:{days:{d:{first:0,last:1,min:null}}}}},{ppl:{x:{plan:{d:{e:1e99}}}}},{ppl:{x:{ooo:{d:{m:-1}}}}},{cfg:{W:0}},{cfg:{D:200}},{cfg:{cap:-1}},{cfg:{W:null}},null,true,12,'wrong',[],{ppl:[]},{cfg:[]},{ui:'wrong'},{cfg:{days:'weekdays'}},{ppl:{x:'bad'}},{ppl:{x:{plan:[]}}},{ppl:{x:{plan:{d:'bad'}}}},{ppl:{x:{events:{d:'bad'}}}},{ppl:{x:{events:{d:[{t:2,k:'oops'}]}}}}]){assert.equal(P.valid(s),false);cases++;}
for(const s of [{},{ppl:{}},{ui:{theme:'knight'},cfg:{D:9},ppl:{x:{plan:{'2026-11-03':{s:540,e:1590}},ooo:{'2026-11-03':{m:30,s:null}}}}}]){assert.equal(P.valid(s),true);cases++;}
{let disk='true';const storage={getItem:()=>disk,setItem:(_,v)=>{disk=v;}},p=P(storage,'mesai.v3',{}),valid={cfg:{W:48},ppl:{}};assert.throws(()=>p.save(valid));assert.equal(disk,'true');p.replace(valid);assert.deepEqual(JSON.parse(disk),valid);cases++;}
for(const x of [{ppl:{x:{plan:{d:{s:540,e:3240,m:2700}}}}},{ppl:{x:{days:{d:{first:0,last:172800000,min:1440}}}}}]){assert.equal(P.valid(x),true,'existing extended forecasts and portal records stay readable');cases++;}
console.log(cases+' reliability matrix cases passed');
