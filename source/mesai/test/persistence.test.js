const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Persistence=require('../src/persistence');
const clone=x=>JSON.parse(JSON.stringify(x));
const initial={ui:{theme:'saydam',themeCatalog:'bozkir-2026-11'},cfg:{W:45,D:9},ppl:{'1001':{plan:{'2026-11-13':{s:510,e:1080}},ooo:{},types:{}}}};
let checks=0;
const check=(name,fn)=>{fn();checks++;console.log('✓ '+name);};
let saved=JSON.stringify(initial),fail=false;
const storage={getItem:()=>saved,setItem:(k,v)=>{if(fail)throw Error('QuotaExceededError');saved=v;}};
const make=()=>{const state=JSON.parse(saved);return {state,store:Persistence(storage,'mesai.v3',state)};};
check('old whole-state writes reproduce lost theme and plan',()=>{
  const a=make(),b=make();a.state.ui.theme='knight';a.state.ppl['1001'].plan['2026-11-13'].e=1140;
  saved=JSON.stringify(a.state);saved=JSON.stringify(b.state);
  assert.equal(JSON.parse(saved).ui.theme,'saydam');assert.equal(JSON.parse(saved).ppl['1001'].plan['2026-11-13'].e,1080);
});
saved=JSON.stringify(initial);
const a=make(),b=make();
check('a stale portal refresh cannot overwrite theme and planned exit',()=>{
  a.state.ui.theme='knight';a.state.cfg.D=10;a.state.ppl['1001'].plan['2026-11-13'].e=1140;
  a.state=a.store.save(a.state);
  b.state.ppl['1001'].months={'2026-11':123};b.state=b.store.save(b.state);
  assert.equal(b.state.ui.theme,'knight');assert.equal(b.state.cfg.D,10);
  assert.equal(b.state.ppl['1001'].plan['2026-11-13'].e,1140);
});
check('a reopened instance restores theme, daily target and plan',()=>{
  const reopened=make();assert.equal(reopened.state.ui.theme,'knight');assert.equal(reopened.state.cfg.D,10);
  assert.deepEqual(reopened.state.ppl['1001'].plan['2026-11-13'],{s:510,e:1140});
});
check('different settings edited in stale tabs are both retained',()=>{
  const c=make(),d=make();c.state.cfg.W=46;c.store.save(c.state);d.state.cfg.coreE='15:00';d.store.save(d.state);
  assert.equal(JSON.parse(saved).cfg.W,46);assert.equal(JSON.parse(saved).cfg.coreE,'15:00');
});
check('an explicit latest edit wins for the same setting',()=>{
  const c=make(),d=make();c.state.ui.theme='bozkir';c.store.save(c.state);d.state.ui.theme='clock';d.store.save(d.state);
  assert.equal(JSON.parse(saved).ui.theme,'clock');
});
check('resetting one day does not remove another tab’s new day',()=>{
  const c=make(),d=make();c.state.ppl['1001'].plan['2026-11-14']={s:540,e:1080};c.store.save(c.state);
  delete d.state.ppl['1001'].plan['2026-11-13'];d.store.save(d.state);
  assert.equal(JSON.parse(saved).ppl['1001'].plan['2026-11-13'],undefined);
  assert.deepEqual(JSON.parse(saved).ppl['1001'].plan['2026-11-14'],{s:540,e:1080});
});
check('different people’s plans stay separate',()=>{
  const c=make(),d=make();c.state.ppl['1002']={plan:{'2026-11-13':{e:1020}}};c.store.save(c.state);
  d.state.ppl['1001'].ooo['2026-11-13']={m:60};d.store.save(d.state);
  assert.equal(JSON.parse(saved).ppl['1002'].plan['2026-11-13'].e,1020);
  assert.equal(JSON.parse(saved).ppl['1001'].ooo['2026-11-13'].m,60);
});
check('storage refresh preserves unsaved local edits and remote changes',()=>{
  const c=make(),d=make();c.state.cfg.D=11;d.state.ui.theme='knight';d.store.save(d.state);
  c.state=c.store.refresh(c.state);assert.equal(c.state.cfg.D,11);assert.equal(c.state.ui.theme,'knight');
  c.store.save(c.state);assert.equal(JSON.parse(saved).cfg.D,11);
});
check('failed writes retain the edit for a later retry',()=>{
  const c=make();c.state.cfg.W=47;const before=saved;fail=true;
  assert.throws(()=>c.store.save(c.state),/Quota/);assert.equal(saved,before);
  fail=false;c.store.save(c.state);assert.equal(JSON.parse(saved).cfg.W,47);
});
check('malformed saved JSON is not silently replaced with defaults',()=>{
  const c=make(),before=saved;saved='{bad';assert.throws(()=>c.store.save(c.state));assert.equal(saved,'{bad');saved=before;
});
// Execute the real widget startup/save block, including defaults and migrations.
const ui=fs.readFileSync(require.resolve('../src/ui.js'),'utf8');
const startup=ui.slice(ui.indexOf("  var KEY ="),ui.indexOf('  var nowFn ='));
function boot(variant='all'){const order=variant==='all'?['saydam','knight','bozkir','bozkira','cizelge','sutunlar','clock']:/^bozkira?$/.test(variant)?['bozkir','bozkira']:[variant];const ctx={localStorage:storage,C:{clone},TH:{ORDER:order},BUILD:{theme:variant,catalog:'bozkir-2026-11'},MesaiPersistence:Persistence,syncHistory:()=>{},st:{}};vm.createContext(ctx);vm.runInContext(startup,ctx);return ctx;}
check('real widget defaults survive the first save of partial legacy state',()=>{
  saved=JSON.stringify({ui:{theme:'knight'},ppl:{}});const c=boot();c.save(false);
  assert.equal(c.S.ui.theme,'knight');assert.equal(c.S.cfg.D,9);assert.equal(c.S.ui.lang,'tr');
  assert.equal(boot().S.ui.theme,'knight');assert.equal(boot().S.cfg.W,45);
});
check('real widget save reconciles stale tabs and a new session',()=>{
  const c=boot(),d=boot();c.S.ui.theme='bozkir';c.S.cfg.D=10;c.S.ppl['1001']={plan:{'2026-11-13':{s:510,e:1140}}};c.save();
  d.S.ui.bell=true;d.save();const reopened=boot();assert.equal(reopened.S.ui.theme,'bozkir');assert.equal(reopened.S.cfg.D,10);
  assert.equal(reopened.S.ppl['1001'].plan['2026-11-13'].e,1140);assert.equal(reopened.S.ui.bell,true);
});
check('real widget reports a failed save and clears the warning after recovery',()=>{
  const c=boot();c.S.cfg.D=12;fail=true;c.save();assert.equal(c.st.storageError,true);
  fail=false;c.save();assert.equal(c.st.storageError,false);assert.equal(boot().S.cfg.D,12);
});
check('single Saydam leaves the full package’s Knight preference unchanged',()=>{
  saved=JSON.stringify({...initial,ui:{...initial.ui,theme:'knight'}});const c=boot('saydam');
  assert.equal(c.S.ui.theme,'saydam');c.save(false);assert.equal(c.S.ui.theme,'saydam');
  assert.equal(JSON.parse(saved).ui.theme,'knight');assert.equal(boot().S.ui.theme,'knight');
});
check('Bozkır remembers Okçu across both single-bookmark defaults',()=>{
  saved=JSON.stringify({...initial,ui:{...initial.ui,theme:'knight'}});const c=boot('bozkir');
  assert.equal(c.S.ui.theme,'bozkir');c.S.ui.theme='bozkira';c.save();
  assert.equal(boot('bozkir').S.ui.theme,'bozkira');assert.equal(boot('bozkira').S.ui.theme,'bozkira');
  assert.equal(boot().S.ui.theme,'knight');
});
check('existing Okçu selection migrates without a reset',()=>{
  saved=JSON.stringify({...initial,ui:{...initial.ui,theme:'bozkira'}});const c=boot('bozkir');
  assert.equal(c.S.ui.theme,'bozkira');c.save();assert.equal(JSON.parse(saved).ui.bookmarkThemes.bozkir,'bozkira');
});
check('first use of the Okçu bookmark keeps its intended default',()=>{
  saved=JSON.stringify({...initial,ui:{...initial.ui,theme:'knight'}});assert.equal(boot('bozkira').S.ui.theme,'bozkira');
});
check('stale single-theme writes keep another full tab’s latest theme and shared settings',()=>{
  saved=JSON.stringify({...initial,ui:{...initial.ui,theme:'knight'}});const single=boot('saydam'),full=boot();
  full.S.ui.theme='clock';full.S.cfg.W=48;full.save();single.S.cfg.D=10;single.save();
  assert.equal(single.S.ui.theme,'saydam');assert.equal(single.S.cfg.W,48);
  assert.equal(boot().S.ui.theme,'clock');assert.equal(boot().S.cfg.D,10);
});
check('storage refresh cannot activate an unsupported theme in a single package',()=>{
  saved=JSON.stringify(initial);const c=boot('saydam');c.save();const full=boot();full.S.ui.theme='knight';full.save();
  c.S=c.persistence.refresh(c.S);assert.equal(c.S.ui.theme,'saydam');assert.equal(boot().S.ui.theme,'knight');
});
check('corrupted package theme preferences fall back to a bundled theme',()=>{
  saved=JSON.stringify({...initial,ui:{...initial.ui,theme:'knight',bookmarkThemes:{saydam:'clock',bozkir:'unknown'}}});
  assert.equal(boot('saydam').S.ui.theme,'saydam');assert.equal(boot('bozkir').S.ui.theme,'bozkir');
});
check('concurrent first package saves preserve both preference entries',()=>{
  saved=JSON.stringify(initial);const a=boot('saydam'),b=boot('bozkir');a.save();b.S.ui.theme='bozkira';b.save();
  assert.equal(JSON.parse(saved).ui.bookmarkThemes.saydam,'saydam');assert.equal(JSON.parse(saved).ui.bookmarkThemes.bozkir,'bozkira');
});
check('single packages still share personnel plans and OOO',()=>{
  saved=JSON.stringify(initial);const a=boot('saydam'),b=boot('bozkir');
  a.S.ppl['1001'].plan['2026-11-13'].e=1170;a.save();b.S.ppl['1001'].ooo['2026-11-13']={m:30};b.save();
  assert.equal(b.S.ppl['1001'].plan['2026-11-13'].e,1170);assert.equal(boot().S.ppl['1001'].ooo['2026-11-13'].m,30);
});
check('first single-theme use does not invent a full-package theme preference',()=>{
  saved='{}';const c=boot('knight');c.save();assert.equal(c.S.ui.theme,'knight');
  assert.equal(JSON.parse(saved).ui.theme,undefined);assert.equal(boot().S.ui.theme,'saydam');
});
check('a delayed first save preserves new effect and sound choices from another tab',()=>{
  saved=JSON.stringify(initial);const fast=boot(),slow=boot();
  fast.S.ui.motion=false;fast.S.ui.sound=true;fast.S.ui.soundVolume=.6;fast.S.ui.soundLead=15;fast.save();
  slow.S.ppl['1001'].months={'2026-11':123};slow.save();
  assert.equal(JSON.parse(saved).ui.motion,false);assert.equal(JSON.parse(saved).ui.sound,true);assert.equal(JSON.parse(saved).ui.soundVolume,.6);assert.equal(JSON.parse(saved).ui.soundLead,15);
});
console.log(checks+' persistence checks passed');
