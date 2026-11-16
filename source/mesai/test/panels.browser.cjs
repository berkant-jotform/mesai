// Reachability of new settings, including the bottom of compact themed panels.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require(process.env.MESAI_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'../../..');
(async()=>{const server=http.createServer((q,r)=>{const p=path.join(root,new URL(q.url,'http://localhost').pathname);fs.readFile(p,(e,b)=>{r.writeHead(e?404:200,{'Content-Type':p.endsWith('.html')?'text/html':p.endsWith('.js')?'text/javascript':'application/octet-stream'});r.end(e?'':b)});});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,...(process.env.MESAI_CHROME?{executablePath:process.env.MESAI_CHROME}:{})});let count=0;
try{const p=await browser.newPage({viewport:{width:1440,height:900}});for(const theme of ['saydam','knight','bozkir','bozkira','cizelge','sutunlar','clock'])for(const lang of ['tr','en'])for(const size of ['full','compact']){
 await p.goto('http://127.0.0.1:'+server.address().port+'/preview.html?theme='+theme);await p.waitForFunction(()=>window.__mesai?.state().st.code==='ready');await p.evaluate(d=>window.postMessage({type:'mesai-preview',...d},location.origin),{theme,lang,size});await p.waitForTimeout(100);
 if(size==='compact'&&theme!=='saydam'){await p.locator('#mesai-host [data-a=themes]').first().click();await p.locator('#mesai-host .theme-panel [data-a=set]').click();}else await p.locator('#mesai-host '+(theme==='saydam'?'.sy-tb ':'.hd ')+'[data-a=set]').click();
 for(const selector of ['[data-e=motion]','[data-e=sound]','[data-e=soundVolume]','[data-e=soundLead]','[data-a=soundTry][data-v=week]']){
 const ctl=p.locator('#mesai-host .set '+selector);await ctl.scrollIntoViewIfNeeded();const accessible=await ctl.evaluate(e=>{const r=e.getRootNode(),w=r.querySelector('.w').getBoundingClientRect(),a=e.getBoundingClientRect(),x=a.x+a.width/2,y=a.y+a.height/2,h=r.elementFromPoint(x,y);return x>=w.left&&x<=w.right&&y>=w.top&&y<=w.bottom&&(h===e||e.contains(h));});assert(accessible,`${theme}/${lang}/${size}: ${selector} is covered or outside window`);count++;
 }
 await p.locator('#mesai-host .set .panel-head [data-a]').last().click();assert.equal(await p.locator('#mesai-host .set').count(),0,'Settings closes');count++;
 }console.log(count+' themed panel reachability assertions passed');}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exit(1)});
