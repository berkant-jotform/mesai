// Exercise the exact built bookmark on synthetic attendance; never uses a real portal session.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const PW=require(process.env.MESAI_PLAYWRIGHT||'playwright'),engine=process.env.MESAI_ENGINE||'chromium',root=path.resolve(__dirname,'../../..'),bundle=fs.readFileSync(path.join(root,'mesai.js'),'utf8'),version=JSON.parse(fs.readFileSync(path.join(root,'version.json'))),results=[],errors=[];
const server=http.createServer((q,r)=>{r.writeHead(200,{'content-type':'text/html'});r.end(fs.readFileSync(path.join(__dirname,'portal.html')));});
let browser;
const read=p=>p.evaluate(()=>{const {st,S}=__mesai.state();return {now:st.v.now,actual:st.v.today.actual,done:st.v.done,cfg:S.cfg,plans:S.ppl['1001'].plan,ooo:S.ppl['1001'].ooo,types:S.ppl['1001'].types};});
const css=p=>p.locator('#mesai-host');
async function open(theme='saydam',kind='open',size='full',extra={}){
 const ctx=await browser.newContext({viewport:extra.viewport||{width:1440,height:1000},colorScheme:extra.look||'light',reducedMotion:extra.reduced?'reduce':'no-preference'}),p=await ctx.newPage();p.on('pageerror',e=>errors.push({engine,message:e.message}));p.setDefaultTimeout(7000);
 await ctx.route('https://berkant-jotform.github.io/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(version)}));
 const now=kind==='week'?Date.UTC(2026,10,6,15,59,58):kind==='day'?Date.UTC(2026,10,3,17,29,58):Date.UTC(2026,10,3,13,42),ui={theme,look:extra.look||'light',lang:extra.lang||'tr',themeCatalog:version.themeCatalog,cmp:size==='compact',w:size==='pocket'?220:null,syv:extra.view||'day',pos:[16,16]};
 if(extra.motion!==undefined)ui.motion=extra.motion;
 await p.addInitScript(({now,ui,version})=>{window.__MESAI_NOW=()=>window.testNow??now;localStorage.setItem('mesai.v3',JSON.stringify({ui}));localStorage.setItem('mesai.release',JSON.stringify({...version,at:Date.now()}));}, {now,ui,version});
 await p.goto('http://127.0.0.1:'+server.address().port+'/portal.html');
 const wk=(date,ev,x={})=>({date,ev,...x}),days=kind==='week'?[2,3,4,5].map(d=>wk('2026-11-0'+d,[['08:30:00','G'],['18:00:00','Ç']])).concat(wk('2026-11-06',[['09:00:00','G']],{today:true})):[wk('2026-11-02',[['08:30:00','G'],['17:30:00','Ç']]),wk('2026-11-03',[['08:30:00','G']],{today:true})];
 if(extra.closed)days[days.length-1].ev.push(['12:30:00','Ç']);
 await p.evaluate(days=>{portal.setDelay(30);portal.setDB({'1001':{'2026-11':days}});portal.open({period:'2026-11',person:'1001',persons:[['1001','Test person']]});},days);
 await p.evaluate(bundle);await p.waitForFunction(()=>window.__mesai?.state().st.code==='ready');p.ctx=ctx;return p;
}
async function settle(p){await p.waitForTimeout(450);await p.waitForFunction(()=>{const m=__mesai.motionState();return m.phase==='idle'&&!m.openingPending;});}
async function activate(p,selector){const b=css(p).locator(selector).first();if(engine==='webkit'){await b.focus();await b.press('Space');}else await b.click();}
async function crossing(p,kind){await settle(p);await p.evaluate(kind=>{const v=__mesai.state().st.v;testNow=kind==='week'?v.hit.t:v.milestone;},kind);await p.waitForFunction(()=>__mesai.motionState().phase==='earned');}
const run=async(name,fn)=>{if(process.env.MESAI_MATCH&&!new RegExp(process.env.MESAI_MATCH).test(name))return;try{await fn();results.push({name,pass:true});console.log('✓ '+name);}catch(e){results.push({name,pass:false,error:e.stack});process.exitCode=1;console.log('✗ '+name+': '+e.message.slice(0,200));}};
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await PW[engine].launch({headless:true,...(engine==='chromium'&&process.env.MESAI_CHROME?{executablePath:process.env.MESAI_CHROME}:{})});
for(const theme of ['saydam','knight','bozkir','bozkira','cizelge','sutunlar','clock'])await run(theme+' opening preserves actual hours and cleans every layer',async()=>{const p=await open(theme),before=await read(p);await p.waitForFunction(()=>__mesai.motionState().phase==='opening');const d=await p.evaluate(()=>{const r=document.querySelector('#mesai-host').shadowRoot;return {completion:!!r.querySelector('.motion-completion'),confetti:r.querySelectorAll('.motion-paper,.completion-rays').length,active:__mesai.motionState().activeEffects,rect:r.querySelector('.motion-refraction')?getComputedStyle(r.querySelector('.motion-refraction')).maskImage:null};});assert.equal(d.completion,false);assert.equal(d.confetti,0);assert.ok(d.active>0);if(theme==='saydam')assert.match(d.rect,/radial-gradient/);await settle(p);assert.deepEqual(await read(p),before);assert.equal(await p.evaluate(()=>__mesai.motionState().activeEffects),0);await p.ctx.close();});
for(const theme of ['saydam','bozkir','bozkira','knight','clock'])for(const kind of ['day','week'])await run(theme+' '+kind+' completion fits without blocking controls',async()=>{const p=await open(theme,kind);await crossing(p,kind);await p.waitForTimeout(750);const d=await p.evaluate(()=>{const r=document.querySelector('#mesai-host').shadowRoot,c=r.querySelector('.motion-completion'),w=r.querySelector('.w'),a=c.getBoundingClientRect(),b=w.getBoundingClientRect();return {text:c.textContent,fit:c.scrollWidth<=c.clientWidth+3&&c.scrollHeight<=c.clientHeight+5,inside:a.left>=b.left-1&&a.right<=b.right+1&&a.top>=b.top-1&&a.bottom<=b.bottom+1,confetti:r.querySelectorAll('.motion-paper,.completion-rays').length,cleanFills:[...r.querySelectorAll('[data-motion-effect] rect[fill]')].every(n=>getComputedStyle(n).stroke==='none'),button:r.querySelector('[data-a="set"]')?.getBoundingClientRect().width};});assert.match(d.text,kind==='day'?/9 saat/:/45 saat/);assert.ok(d.fit);assert.ok(d.inside);assert.equal(d.confetti,0);assert.ok(d.cleanFills,'Filled light sweeps must not inherit icon outlines');assert.ok(d.button>20);if(process.env.QA_SHOTS){fs.mkdirSync(process.env.QA_SHOTS,{recursive:true});await p.screenshot({path:path.join(process.env.QA_SHOTS,engine+'-'+theme+'-'+kind+'.png')});}await p.ctx.close();});
await run('planning motion follows the edited day and respects reduced motion', async () => {
 const p = await open('saydam');
 try {
  const update = async (value) => {
   const field = css(p).locator('.sy-bar [data-e=e]');
   await field.fill(value);
   return field.evaluate((input) => {
    const root = input.getRootNode();
    input.blur();
    return {
     exit: root.querySelector('[data-planned-exit]')?.textContent,
     animated: root.querySelector('.main').getAnimations({subtree:true}).some(a => a.id === 'mesai-plan'),
     celebration: !!root.querySelector('.motion-completion')
    };
   });
  };
  await activate(p,'.sy-day[data-v="4"]');
  assert.deepEqual(await update('17:00'), {exit:'17:00', animated:true, celebration:false});
  await p.emulateMedia({reducedMotion:'reduce'});
  await p.waitForFunction(() => !document.querySelector('#mesai-host').shadowRoot.querySelector('.main').getAnimations({subtree:true}).some(a => a.id === 'mesai-plan'));
  assert.deepEqual(await update('16:45'), {exit:'16:45', animated:false, celebration:false});
 } finally { await p.ctx.close(); }
});
for(const [theme,size,view,effect] of [
 ['saydam','full','day',''], ['saydam','compact','day',''],
 ['saydam','full','kum',''], ['saydam','compact','kum',''],
 ['knight','full','day','longsword'], ['bozkir','full','day','arrow'],
 ['bozkira','full','day','arrow'], ['clock','full','day','constellation'],
 ['cizelge','full','day',''], ['sutunlar','full','day','']
])await run('plan effect '+theme+' '+size+' '+view, async () => {
 const p=await open(theme,'open',size,{view});
 try{
  const before=await read(p);
  const host=css(p);
  const animatedDay=host.locator(':is(button,.cl)[data-a=sel][data-v="4"]').first();
  await animatedDay.click();
  const input=host.locator(theme==='saydam'?'.sy-bar [data-e=e]':'.ed [data-e=e]');
  await input.fill('17:00');
  await input.press('Enter');
  if (effect) {
   const layer=host.locator('[data-plan-effect="'+effect+'"]').first();
   await layer.waitFor({state:'attached'});
   const aligned=await layer.evaluate(e=>{
    const b=e.getBoundingClientRect(), w=e.getRootNode().querySelector('.w').getBoundingClientRect();
    return b.width>0&&b.height>0&&b.left>=w.left-1&&b.right<=w.right+1&&b.top>=w.top-1&&b.bottom<=w.bottom+1&&getComputedStyle(e).pointerEvents==='none';
   });
   assert.equal(aligned,true,'the effect stays inside the tool and lets clicks through');
  } else {
   assert.ok(await animatedDay.evaluate(el=>el.getAnimations({subtree:true}).some(a=>a.id==='mesai-plan')));
  }
  if(theme==='saydam'){
   assert.equal(await host.locator('[data-motion-effect]').count(),0);
   assert.ok(await host.locator('.sy-low .plan-jump').evaluate(e=>e.offsetWidth<=e.parentElement.clientWidth));
  }
  assert.equal(await host.locator('[data-planned-exit]').textContent(),'17:00');
  assert.equal(await host.locator('.motion-completion').count(),0);
  if(process.env.QA_SHOTS){
   fs.mkdirSync(process.env.QA_SHOTS,{recursive:true});
   await p.waitForTimeout(470);
   await p.screenshot({path:path.join(process.env.QA_SHOTS,theme+'-'+size+'-'+view+'.png')});
  }
  await p.waitForFunction(()=>__mesai.motionState().phase==='idle');
  assert.equal(await host.locator('[data-plan-effect]').count(),0);
  const after=await read(p);
  assert.equal(after.actual,before.actual);
  assert.equal(after.done,before.done);
 }finally{await p.ctx.close();}
});
for(const [theme,size,view]of [['saydam','compact','day'],['saydam','compact','kum'],['bozkir','compact','day'],['bozkira','pocket','day'],['clock','pocket','day']])await run(theme+' '+size+' '+view+' fits a small window',async()=>{const p=await open(theme,'week',size,{view,viewport:{width:1000,height:760}});await crossing(p,'week');const d=await p.evaluate(()=>{const r=document.querySelector('#mesai-host').shadowRoot,c=r.querySelector('.motion-completion'),w=r.querySelector('.w'),a=c.getBoundingClientRect(),b=w.getBoundingClientRect();return {width:c.clientWidth,height:c.clientHeight,scrollW:c.scrollWidth,scrollH:c.scrollHeight,text:c.textContent,fit:c.scrollWidth<=c.clientWidth+3&&c.scrollHeight<=c.clientHeight+5,inside:a.left>=b.left-1&&a.right<=b.right+1&&a.top>=b.top-1&&a.bottom<=b.bottom+1};});assert.ok(d.fit,JSON.stringify(d));assert.ok(d.inside,JSON.stringify(d));await p.ctx.close();});
await run('opening repeats while an earned milestone never replays',async()=>{const p=await open('saydam','day');await crossing(p,'day');await settle(p);await p.evaluate(()=>__mesai.poke());await p.waitForFunction(()=>__mesai.motionState().phase==='opening');assert.equal(await css(p).locator('.motion-completion').count(),0);assert.ok(await p.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('mesai.effects.v1'))).length)>0);await p.ctx.close();});
await run('selecting a different day cannot get today’s achievement label',async()=>{const p=await open('saydam','day');await settle(p);await activate(p,'[data-a="sel"][data-v="2"]');await p.evaluate(()=>testNow=__mesai.state().st.v.milestone);await p.waitForTimeout(1300);assert.equal(await css(p).locator('.motion-completion').count(),0);await p.ctx.close();});
await run('scroll and pointer actions cancel without disabling the clicked control',async()=>{const p=await open('bozkir');await p.waitForFunction(()=>__mesai.motionState().phase==='opening');await p.evaluate(()=>document.querySelector('#mesai-host').shadowRoot.querySelector('.main').dispatchEvent(new Event('scroll')));assert.equal(await p.evaluate(()=>__mesai.motionState().activeEffects),0);await p.evaluate(()=>__mesai.poke());await p.waitForFunction(()=>__mesai.motionState().phase==='opening');await activate(p,'[data-a="set"]');assert.ok(await p.evaluate(()=>__mesai.state().st.set));assert.equal(await p.evaluate(()=>__mesai.motionState().activeEffects),0);await p.ctx.close();});
await run('reduced motion has a static milestone and unchanged calculations',async()=>{const p=await open('saydam','day','full',{reduced:true});await settle(p);assert.equal(await p.evaluate(()=>__mesai.motionState().activeAnimations),0);await crossing(p,'day');const before=await read(p);assert.match(await css(p).locator('.motion-completion').textContent(),/9 saat/);assert.equal(await p.evaluate(()=>__mesai.motionState().activeAnimations),0);await settle(p);assert.deepEqual(await read(p),before);await p.ctx.close();});
await run('disabled effects remain disabled after reopening the bookmark',async()=>{const p=await open('saydam','open','full',{motion:false});await settle(p);await p.evaluate(()=>__mesai.poke());await p.waitForTimeout(900);assert.equal(await p.evaluate(()=>__mesai.motionState().activeEffects),0);await p.ctx.close();});
await run('English and dark Knight completion remain readable',async()=>{const p=await open('knight','day','full',{lang:'en',look:'dark'});await crossing(p,'day');assert.match(await css(p).locator('.motion-completion').textContent(),/9 hours.*complete/);await p.ctx.close();});
await run('closing mid-effect leaves no work or surviving widget',async()=>{const p=await open('bozkira');await p.waitForFunction(()=>__mesai.motionState().phase==='opening');await p.evaluate(()=>__mesai.close());await p.waitForTimeout(500);assert.equal(await css(p).count(),0);await p.ctx.close();});
for(const size of ['full','compact'])await run('Saydam view reveal '+size+' preserves the selected day and earned amount',async()=>{
 const p=await open('saydam','open',size);
 try{
  const host=css(p), toggle=view=>activate(p,'.sy [data-a="syv"][data-v="'+view+'"]');
  await activate(p,'.sy-day[data-v="4"]');
  const baseline=await read(p), earnedArc=await host.locator('[data-key=week-arc]').getAttribute('stroke-dasharray');
  await toggle('kum');
  await p.waitForFunction(()=>__mesai.motionState().phase==='view');
  assert.match(await host.locator('.sy-kday').textContent(),/Cuma/);
  const svg=host.locator('.sy-kum-visual svg');
  assert.equal(await svg.locator('[data-motion-effect]').count(),0);
  assert.ok(await svg.evaluate(e=>e.parentElement.getAnimations().some(a=>a.effect.getKeyframes().every(k=>k.opacity!=null&&!k.transform))));
  assert.equal(await svg.locator('[data-key=plan-4]').evaluate(e=>e.classList.contains('sel')),true);
  assert.deepEqual(await read(p),baseline);
  await toggle('day');
  assert.equal(await host.locator('.sy-kum-visual').count(),0);
  assert.equal(await host.locator('[data-key=week-arc]').getAttribute('stroke-dasharray'),earnedArc);
  assert.match(await host.locator('.sy-content .lt').textContent(),/Cuma/);
  await toggle('kum');
  await activate(p,'.sy-day[data-v="2"]');
  assert.match(await host.locator('.sy-kday').textContent(),/Çarşamba/);
  await p.waitForFunction(()=>__mesai.motionState().phase==='idle');
  assert.equal(await host.locator('[data-motion-effect]').count(),0);
  assert.deepEqual(await read(p),baseline);
 }finally{await p.ctx.close();}
});
await run('Kum saati redistributes only planned bands and the live ripple follows the earned surface',async()=>{
 const p=await open('saydam','open','full',{view:'kum'});
 try{
  const host=css(p), svg=host.locator('.sy-kum-visual svg'), baseline=await read(p);
  const attr=(key,name)=>svg.locator('[data-key="'+key+'"]').getAttribute(name);
  const snapshot=async()=>({
   earned:await attr('bottom-fill','height'), surface:await attr('bottom-surface','cy'),
   thursday:await attr('plan-3','height'), friday:await attr('plan-4','height')
  });
  const initial=await snapshot();
  assert.equal(await svg.locator('.impact').getAttribute('cy'),initial.surface);
  assert.ok(Math.abs(Number(initial.surface)-(596-266*baseline.done/(45*3600000)))<.06);
  const startOfLeader=key=>svg.locator('[data-key="label-'+key+'"] path').evaluate(e=>{const p=e.getPointAtLength(0);return [p.x,p.y]});
  const [neckX]=await startOfLeader('plan-1');
  const [,earnedY]=await startOfLeader('total');
  assert.ok(neckX>188&&neckX<220);
  assert.ok(Math.abs(earnedY-Number(initial.surface))<.15);
  await activate(p,'.sy-day[data-v="4"]');
  const field=host.locator('.sy-bar [data-e=e]');
  await field.fill('17:00');await field.press('Enter');
  assert.ok(await svg.locator('[data-key=plan-4]').evaluate(e=>{
   getComputedStyle(e).height;
   return e.getAnimations().some(a=>a.transitionProperty==='height');
  }));
  const updated=await snapshot();
  assert.equal(updated.earned,initial.earned);
  assert.equal(updated.surface,initial.surface);
  assert.ok(Number(updated.friday)<Number(initial.friday));
  assert.ok(Number(updated.thursday)>Number(initial.thursday));
  assert.equal(await svg.locator('[data-motion-effect]').count(),0);
  if(process.env.QA_SHOTS){
   await p.waitForTimeout(200);
   await p.screenshot({path:path.join(process.env.QA_SHOTS,'saydam-kum-bands.png')});
  }
  assert.equal((await read(p)).done,baseline.done);
  await p.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await svg.locator('.sy-flow').isVisible(),false);
  await p.waitForFunction(()=>__mesai.motionState().activeEffects===0);
 }finally{await p.ctx.close();}
});
await run('Gün marker glides to the requested exit while earned hours stay put',async()=>{
 const p=await open('saydam');
 try{
  const host=css(p), track=host.locator('.sy-trk'), field=host.locator('.sy-bar [data-e=e]');
  const baseline=await read(p), ring=host.locator('[data-key=day-arc]');
  const arc=await ring.getAttribute('stroke-dasharray');
  await field.fill('12:00');await field.press('Enter');
  const frames=await track.locator('.knob').evaluate(e=>{
   const a=e.getAnimations().find(a=>a.id==='mesai-plan');
   return a&&{left:e.style.left,keyframes:a.effect.getKeyframes()};
  });
  assert.ok(frames);
  assert.ok(parseFloat(frames.keyframes[0].left)>parseFloat(frames.left));
  assert.equal(frames.keyframes.at(-1).left,frames.left);
  assert.equal(await track.getAttribute('aria-valuetext'),'12:00');
  assert.equal(await track.getAttribute('aria-valuenow'),'720');
  assert.equal(await host.locator('[data-planned-exit]').textContent(),'12:00');
  assert.equal(await host.locator('[data-motion-effect]').count(),0);
  assert.equal(await ring.getAttribute('stroke-dasharray'),arc);
  assert.equal((await read(p)).actual,baseline.actual);
  assert.equal((await read(p)).done,baseline.done);
 }finally{await p.ctx.close();}
});
await run('Kum saati stream stays off when motion is disabled or attendance is closed',async()=>{
 for(const motion of [true,false]){
  const p=await open('saydam','open','compact',{view:'kum',motion,closed:motion});
  try{
   const host=css(p);
   assert.equal(await host.locator('.sy-flow').isVisible(),false);
   if(!motion){
    await activate(p,'.sy [data-a=syv][data-v=day]');
    assert.equal(await p.evaluate(()=>__mesai.motionState().phase),'idle');
   }
  }finally{await p.ctx.close();}
 }
});
await run('Saydam glass selection slides under the active label and respects reduced motion',async()=>{
 const p=await open('saydam','open','compact',{viewport:{width:390,height:520}});
 try{
  const host=css(p), view=host.locator('.sy .vseg'), lens=view.locator('.sy-selection-lens');
  const active=view.locator('button.on');
  const aligned=el=>{const a=el.getBoundingClientRect(), b=el.parentElement.querySelector('button.on').getBoundingClientRect();return Math.abs(a.x-b.x)<1&&Math.abs(a.width-b.width)<1;};
  assert.ok(await lens.evaluate(aligned));
  const box=await view.boundingBox();
  if(await p.evaluate(()=>matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-transparency:no-preference)').matches)){
   await p.mouse.move(box.x+box.width*.24,box.y+box.height*.35);
   await p.waitForFunction(()=>{const el=document.querySelector('#mesai-host').shadowRoot.querySelector('.vseg');return Math.abs(parseFloat(el.style.getPropertyValue('--glass-x'))-24)<=2;});
   assert.match(await view.evaluate(e=>getComputedStyle(e,'::after').backgroundImage),/radial-gradient/);
  }
  await view.locator('[data-v=kum]').click();
  assert.ok(await lens.evaluate(e=>e.getAnimations().some(a=>a.transitionProperty==='left')));
  assert.equal(await active.getAttribute('data-v'),'kum');
  await p.waitForFunction(()=>!document.querySelector('#mesai-host').shadowRoot.querySelector('.vseg .sy-selection-lens').getAnimations().length);
  assert.ok(await lens.evaluate(aligned));
  await p.emulateMedia({reducedMotion:'reduce'});
  await view.locator('[data-v=day]').click();
  assert.equal(await lens.evaluate(e=>e.getAnimations().length),0);
  assert.doesNotMatch(await view.evaluate(e=>getComputedStyle(e,'::after').backgroundImage),/radial-gradient/);
  assert.ok(await lens.evaluate(aligned));
 }finally{await p.ctx.close();}
});
assert.deepEqual(errors,[]);
})().catch(e=>{errors.push({message:e.stack});process.exitCode=1;console.error(e);}).finally(async()=>{if(browser)await browser.close();server.close();const report={engine,version:version.version,bundleSHA256:crypto.createHash('sha256').update(bundle).digest('hex'),results,errors};if(process.env.QA_OUTPUT)fs.writeFileSync(process.env.QA_OUTPUT,JSON.stringify(report,null,2)+'\n');console.log(results.filter(r=>r.pass).length+' motion checks passed; '+results.filter(r=>!r.pass).length+' failed');});
