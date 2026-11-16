// Release-critical failure/recovery checks. Uses the same built bookmark as the main suite.
module.exports=async function({test,page,click,ready,until,H,sh,seedFor,DB,NOV3,BUNDLE,fs,path,SHOTS}){
  const assert=require('node:assert/strict');
  const state=p=>p.evaluate(()=>window.__mesai.state().S);
  const open=async(opts={})=>{const p=await page(NOV3,{seed:seedFor({plan:{'2026-11-04':{s:510,e:1170}},ooo:{'2026-11-04':{m:30}}}),...opts});await p.evaluate(()=>portal.open());await click(p);await ready(p);return p;};
  const set=async(p,key,value)=>{await p.fill(H+'[data-c="'+key+'"]',value);await p.press(H+'[data-c="'+key+'"]','Enter');};
  const settings=async p=>{if(!await p.locator(H+'.set').isVisible())await p.locator(H+'[data-a="set"]').last().click();};
  const upload=async(p,body)=>{const chooser=p.waitForEvent('filechooser');await p.click(H+'[data-a="restore"]');await(await chooser).setFiles({name:'mesai-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(body))});await p.waitForTimeout(200);};
  await test('Reliability: a primitive saved state does not prevent opening or overwrite the original',async()=>{
    const p=await page(NOV3,{fresh:true});try{await p.evaluate(()=>{localStorage.setItem('mesai.v3','true');portal.open();});await click(p);await ready(p);assert.equal(await p.evaluate(()=>localStorage.getItem('mesai.v3')),'true');assert.ok(await sh(p,'.field-error'));}finally{await p.ctx.close();}
  });
  await test('Reliability: invalid backup shapes cannot delete existing plans',async()=>{
    const p=await open();try{await settings(p);const before=await state(p);await upload(p,{ppl:[],cfg:{W:1},ui:{theme:'clock'}});assert.deepEqual((await state(p)).ppl,before.ppl);assert.equal((await state(p)).cfg.W,before.cfg.W);assert.match(await sh(p,'.toast'),/Geçerli bir Mesai yedeği değil/);}finally{await p.ctx.close();}
  });
  await test('Reliability: malformed nested backup is rejected atomically',async()=>{
    const p=await open();try{await settings(p);const before=await state(p);await upload(p,{ppl:{'1001':{plan:'broken',ooo:{}}},cfg:{W:1}});assert.deepEqual((await state(p)).ppl,before.ppl);assert.equal((await state(p)).cfg.W,before.cfg.W);}finally{await p.ctx.close();}
  });
  await test('Reliability: valid exported backup restores hours, plans and shared settings',async()=>{
    const p=await open();try{await settings(p);const original=await state(p);await set(p,'W','48');await upload(p,original);assert.equal((await state(p)).cfg.W,original.cfg.W);assert.deepEqual((await state(p)).ppl['1001'].plan,original.ppl['1001'].plan);}finally{await p.ctx.close();}
  });
  await test('Reliability: storage denial never drops the unsaved edit during another tab update',async()=>{
    const p=await open();try{await settings(p);await p.evaluate(()=>{const set=Storage.prototype.setItem;window.__denySave=true;Storage.prototype.setItem=function(k,v){if(k==='mesai.v3'&&window.__denySave)throw new DOMException('full','QuotaExceededError');return set.call(this,k,v);};});await set(p,'W','48');assert.equal((await state(p)).cfg.W,48);assert.ok(await sh(p,'.field-error'));
      await p.evaluate(()=>{const other=JSON.parse(localStorage.getItem('mesai.v3'));other.cfg.D=10;window.__denySave=false;localStorage.setItem('mesai.v3',JSON.stringify(other));window.__denySave=true;dispatchEvent(new StorageEvent('storage',{key:'mesai.v3',newValue:JSON.stringify(other)}));});
      assert.equal((await state(p)).cfg.W,48);assert.equal((await state(p)).cfg.D,10);assert.ok(await sh(p,'.field-error'),'unsaved local changes still need a warning');
      await p.evaluate(()=>window.__denySave=false);await set(p,'start','08:15');assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('mesai.v3')).cfg.W),48);
    }finally{await p.ctx.close();}
  });
  await test('Reliability: focused partial time survives a second tab changing settings',async()=>{
    const p=await open();try{await p.click(H+'[data-a="sel"][data-v="2"]');await p.fill(H+'[data-e="e"]','19:');const q=await page(NOV3,{ctx:p.ctx});await q.evaluate(()=>portal.open());await click(q);await ready(q);await settings(q);await set(q,'W','48');await until(p,async()=>(await state(p)).cfg.W===48);assert.equal(await p.inputValue(H+'[data-e="e"]'),'19:');await p.fill(H+'[data-e="e"]','19:45');await p.press(H+'[data-e="e"]','Enter');assert.equal((await state(p)).ppl['1001'].plan['2026-11-04'].e,1185);}finally{await p.ctx.close();}
  });
  await test('Reliability: no queued portal reads or saves run after closing the tool',async()=>{
    const p=await open();try{await p.evaluate(()=>{const original=Storage.prototype.setItem;window.__afterCloseSaves=[];Storage.prototype.setItem=function(k,v){if(window.__closedForQA&&k==='mesai.v3')window.__afterCloseSaves.push(k);return original.call(this,k,v);};const marker=document.createElement('div');document.body.append(marker);});await p.waitForTimeout(30);await p.evaluate(()=>{window.__mesai.close();window.__closedForQA=true;});await p.waitForTimeout(1400);assert.deepEqual(await p.evaluate(()=>window.__afterCloseSaves),[]);assert.equal(await p.locator('#mesai-host').count(),0);}finally{await p.ctx.close();}
  });
  await test('Reliability: missing selected month never replaces its saved attendance with zero',async()=>{
    const p=await open();try{const before=(await state(p)).ppl['1001'].days['2026-11-02'];await p.evaluate(()=>{document.querySelector('#form_pdks #grid_kesin_giris_cikis tbody')?.replaceChildren();document.querySelector('#form_pdks .gridContainer tbody')?.replaceChildren();});await p.waitForTimeout(2200);assert.deepEqual((await state(p)).ppl['1001'].days['2026-11-02'],before);await p.evaluate(db=>{db['1001']['2026-11'][0].ev[3][0]='18:46:10';portal.setDB(db);const sel=document.querySelector('#Personel_Id');sel.dispatchEvent(new Event('change'));},DB);await ready(p);await until(p,async()=>(await state(p)).ppl['1001'].days['2026-11-02'].min===before.min+60);}finally{await p.ctx.close();}
  });
  await test('Reliability: full and single-theme bookmarks share plans without resetting full-package theme',async()=>{
    const p=await open({seed:seedFor({plan:{'2026-11-04':{e:1170}}},{theme:'knight'})});try{const q=await page(NOV3,{ctx:p.ctx});await q.evaluate(()=>portal.open());await q.evaluate(fs.readFileSync(path.join(__dirname,'../../../bookmarks/saydam.js'),'utf8'));await ready(q);await settings(q);await set(q,'D','10');await until(p,async()=>(await state(p)).cfg.D===10);assert.equal((await state(p)).ui.theme,'knight');assert.equal((await state(q)).ui.theme,'saydam');assert.equal((await state(q)).ppl['1001'].plan['2026-11-04'].e,1170);await p.reload();await p.evaluate(db=>{portal.setDB(db);portal.setDelay(30);portal.open();},DB);await click(p);await ready(p);assert.equal((await state(p)).ui.theme,'knight');assert.equal((await state(p)).ppl['1001'].plan['2026-11-04'].e,1170);}finally{await p.ctx.close();}
  });
  await test('Reliability: settings stay open across repeated edits in Saydam and Bozkır',async()=>{
    const p=await open();try{for(const theme of ['saydam','bozkir','bozkira']){await p.evaluate(theme=>{window.__mesai.state().S.ui.theme=theme;window.__mesai.poke();},theme);await settings(p);for(const w of ['44','46','45']){await set(p,'W',w);assert.ok(await p.locator(H+'.set').isVisible());assert.equal((await state(p)).cfg.W,+w);}await p.click(H+'[data-a="dismiss"][data-panel="settings"]');assert.equal(await p.locator(H+'.set').count(),0);}}finally{await p.ctx.close();}
  });
  await test('Reliability: replacing a same-version older build closes it instead of keeping old code',async()=>{
    const p=await open();try{const before=(await state(p)).ppl['1001'].plan;await p.evaluate(()=>{const old=window.__mesai,close=old.close;old.build='older-build';old.close=function(){window.__closedOldBuild=true;close();};});await click(p);await ready(p);assert.equal(await p.evaluate(()=>window.__closedOldBuild),true);assert.deepEqual((await state(p)).ppl['1001'].plan,before);assert.equal(await p.locator('#mesai-host').count(),1);}finally{await p.ctx.close();}
  });
  await test('Reliability: a backup finishing after close cannot overwrite the active session',async()=>{
    const p=await open();try{await settings(p);const before=await p.evaluate(()=>localStorage.getItem('mesai.v3'));await p.evaluate(()=>{File.prototype.text=function(){return new Promise(resolve=>window.__finishBackup=resolve);};});const chooser=p.waitForEvent('filechooser');await p.click(H+'[data-a="restore"]');await(await chooser).setFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from('{}')});await until(p,()=>p.evaluate(()=>!!window.__finishBackup));await p.evaluate(()=>{window.__mesai.close();window.__finishBackup(JSON.stringify({cfg:{W:1},ppl:{}}));});await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>localStorage.getItem('mesai.v3')),before);}finally{await p.ctx.close();}
  });

  await test('Reliability: a real test-browser restart retains theme, target, OOO and planned exit',async()=>{
    const profile=fs.mkdtempSync('/private/tmp/mesai-release-qa-'),anchor=await open(),type=anchor.ctx.browser().browserType();await anchor.ctx.close();
    let ctx;try{const options={headless:true,viewport:{width:1440,height:900}};if(process.env.QA_ENGINE==='chrome')options.executablePath='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';ctx=await type.launchPersistentContext(profile,options);let p=await open({ctx});await settings(p);await set(p,'W','48');await p.click(H+'[data-a="dismiss"][data-panel="settings"]');await p.click(H+'[data-a="themes"]');await p.click(H+'[data-a="theme"][data-v="knight"]');await ctx.close();ctx=await type.launchPersistentContext(profile,options);p=await open({ctx});const saved=await state(p);assert.equal(saved.ui.theme,'knight');assert.equal(saved.cfg.W,48);assert.equal(saved.ppl['1001'].plan['2026-11-04'].e,1170);assert.equal(saved.ppl['1001'].ooo['2026-11-04'].m,30);}finally{if(ctx)await ctx.close();fs.rmSync(profile,{recursive:true,force:true});}
  });
  await test('Reliability: repeated two-tab edits retain independent plans and settings',async()=>{
    const p=await open();try{const q=await open({ctx:p.ctx});await settings(p);await settings(q);for(let i=0;i<8;i++){await set(p,'W',String(40+i));await set(q,'D',String(8+i*.25));}await until(p,async()=>(await state(p)).cfg.D===9.75);const a=await state(p),b=await state(q);assert.equal(a.cfg.W,47);assert.equal(b.cfg.W,47);assert.equal(a.cfg.D,9.75);assert.equal(b.cfg.D,9.75);assert.equal(a.ppl['1001'].plan['2026-11-04'].e,1170);assert.equal(b.ppl['1001'].ooo['2026-11-04'].m,30);}finally{await p.ctx.close();}
  });

  await test('Reliability: a week rollover cannot carry an unfinished exit into a different date',async()=>{
    const p=await open();try{await p.click(H+'[data-a="sel"][data-v="2"]');await p.fill(H+'[data-e="e"]','19:');await p.evaluate(()=>window.__nowOverride=Date.UTC(2026,10,9,9));await p.waitForTimeout(2300);assert.notEqual(await p.inputValue(H+'[data-e="e"]'),'19:');assert.equal((await state(p)).ppl['1001'].plan['2026-11-11'],undefined);}finally{await p.ctx.close();}
  });

  await test('Reliability: unavailable browser storage warns but editing and backup still work',async()=>{
    const p=await page(NOV3,{fresh:true});try{await p.evaluate(()=>{Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('blocked','SecurityError');}});portal.open();});await click(p);await ready(p);await settings(p);await set(p,'W','48');assert.equal((await state(p)).cfg.W,48);assert.ok(await sh(p,'.field-error'));const download=p.waitForEvent('download');await p.click(H+'[data-a="backup"]');const file=await download;assert.match(file.suggestedFilename(),/mesai-yedek/);}finally{await p.ctx.close();}
  });

  await test('Reliability: a failed automatic month read restores the original portal period',async()=>{
    const p=await page(Date.UTC(2026,11,1,10),{seed:seedFor({})});try{await p.evaluate(()=>{portal.open();document.querySelector('#Donem_Id').addEventListener('change',function(){if(this.value==='2026-11'){const block=document.createElement('div');block.className='blockUI';document.querySelector('#form_pdks').append(block);}});});await click(p);await until(p,()=>p.evaluate(()=>document.querySelector('#Donem_Id').value==='2026-11'&&window.__mesai.state().st.job?.phase==='load'));await p.evaluate(()=>window.__mesai.state().st.job.at=Date.now()-26000);await until(p,()=>p.evaluate(()=>document.querySelector('#Donem_Id').value==='2026-12'),6000,'restore December after failed November read');}finally{await p.ctx.close();}
  });

  await test('Reliability: incomplete attendance in a backup cannot poison calculations',async()=>{
    const p=await open();try{await settings(p);const before=await state(p);await upload(p,{ppl:{'1001':{days:{'2026-11-02':{}}}}});assert.deepEqual((await state(p)).ppl,before.ppl);assert.ok(Number.isFinite(await p.evaluate(()=>window.__mesai.state().st.v.done)));}finally{await p.ctx.close();}
  });

  await test('Reliability: explicitly restoring a valid backup repairs a corrupted storage slot',async()=>{
    const p=await page(NOV3,{fresh:true});try{await p.evaluate(()=>{localStorage.setItem('mesai.v3','true');portal.open();});await click(p);await ready(p);await settings(p);await upload(p,{cfg:{W:48},ppl:{'1001':{plan:{'2026-11-04':{e:1170}}}}});assert.equal((await state(p)).cfg.W,48);assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('mesai.v3')).cfg.W),48);assert.equal(await p.evaluate(()=>window.__mesai.state().st.storageError),false);assert.ok(await p.evaluate(()=>window.__mesai.state().st.v.done>9*3600000));await p.reload();await p.evaluate(db=>{portal.setDB(db);portal.open();},DB);await click(p);await ready(p);assert.equal((await state(p)).cfg.W,48);assert.equal((await state(p)).ppl['1001'].plan['2026-11-04'].e,1170);}finally{await p.ctx.close();}
  });

};
