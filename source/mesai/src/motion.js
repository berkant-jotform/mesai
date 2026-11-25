// Theme-aware, local-only motion. Never edits clocks, plans, calculations or storage.
var MesaiMotion = function(options){
  let R=options.root,W=options.window,reduced=false,slow=false,sequence=0,ink='#357f65',handles=[],nodes=[],waits=[],restores=[],phase='idle',destroyed=false,loadToken=0;
  const NS='http://www.w3.org/2000/svg',images={},mq=matchMedia('(prefers-reduced-motion: reduce)');

  const assetRequests={};
  function assetsReady(){
    const theme=options.state().S.ui.theme,name=/^bozkir/.test(theme)?'arrow':theme==='knight'?'longsword':null;
    if(!name)return Promise.resolve();
    if(!assetRequests[name])assetRequests[name]=Promise.resolve().then(()=>options.asset(name==='arrow'?'bzArrow':'timeMarker')).then(img=>{if(img&&!destroyed)images[name]=img;}).catch(()=>{});
    return assetRequests[name];
  }

  function localRect(target){const t=target.getBoundingClientRect(),w=W.getBoundingClientRect(),cs=getComputedStyle(W),sx=w.width/(parseFloat(cs.width)||w.width),sy=w.height/(parseFloat(cs.height)||w.height);return {left:(t.left-w.left)/sx-(parseFloat(cs.borderLeftWidth)||0),top:(t.top-w.top)/sy-(parseFloat(cs.borderTopWidth)||0),width:t.width/sx,height:t.height/sy};}
  function clearEffects(){restoreContent();handles.forEach(a=>a.cancel());handles=[];nodes.forEach(n=>n.remove());nodes=[];}

  
  const pulseFrames=[{opacity:1},{opacity:.68,offset:.35},{opacity:1}];
  function restoreContent(){restores.splice(0).forEach(fn=>fn());}
  function stop(){sequence++;phase='idle';clearEffects();waits.forEach(w=>{clearTimeout(w.id);w.resolve(false);});waits=[];}
  function pause(ms){return new Promise(resolve=>{const item={resolve,id:setTimeout(()=>{waits=waits.filter(x=>x!==item);resolve(true);},ms)};waits.push(item);});}
  function animate(el,keyframes,duration,easing='cubic-bezier(.22,.7,.24,1)'){
    if(!el||!el.isConnected||reduced||mq.matches)return;
    const a=el.animate(keyframes,{duration:duration*(slow?1.7:1),easing,fill:'none'});if(phase==='plan')a.id='mesai-plan';a.finished.catch(()=>{});handles.push(a);return a;
  }
  function el(name,attrs,parent){const n=document.createElementNS(NS,name);if(['path','rect','circle','ellipse'].includes(name))n.setAttribute('stroke','none');Object.entries(attrs||{}).forEach(([k,v])=>n.setAttribute(k,String(v)));if(parent)parent.append(n);return n;}
  function overlay(target,pad=0){
    const t=localRect(target),widthW=W.clientWidth,heightW=W.clientHeight;
    if(!t.width||!t.height)return null;
    const x=Math.max(1,t.left-pad),y=Math.max(1,t.top-pad),right=Math.min(widthW-1,t.left+t.width+pad),bottom=Math.min(heightW-1,t.top+t.height+pad);
    if(right<=x||bottom<=y)return null;
    const s=el('svg',{'viewBox':`0 0 ${right-x} ${bottom-y}`,'width':right-x,'height':bottom-y,'data-motion-effect':'','aria-hidden':'true'});
    if(phase==='plan')s.dataset.planEffect='';
    s.style.cssText=`position:absolute;left:${x}px;top:${y}px;width:${right-x}px;height:${bottom-y}px;pointer-events:none;z-index:5;overflow:hidden;color:${ink}`;
    W.append(s);nodes.push(s);return {s,x,y,width:right-x,height:bottom-y};
  }
  function ringCircle(kind){return Array.from(R.querySelectorAll('.sy-hero .ring svg circle')).find(c=>c.getAttribute('r')===(kind==='week'?'47':'66')&&(c.getAttribute('stroke')||'').includes(kind==='week'?'syR2':'syR1'));}
  function aura(kind,warming=false){
    const circle=ringCircle(kind),outer=ringCircle('day');if(!circle||!outer)return;
    const c=localRect(circle),r=localRect(outer),cx=c.left+c.width/2,cy=c.top+c.height/2,d=r.width*(warming?1.65:kind==='week'?2.15:1.85),a=document.createElement('div');
    a.className='motion-lens '+(warming?'warming':'bloom');a.setAttribute('data-motion-effect','');a.setAttribute('aria-hidden','true');
    a.dataset.cx=cx;a.dataset.cy=cy;
    a.style.cssText=`position:absolute;pointer-events:none;z-index:4;left:${cx-d/2}px;top:${cy-d/2}px;width:${d}px;height:${d}px;border-radius:50%;transform-origin:center;opacity:0;background:radial-gradient(circle,transparent 0 33%,rgba(255,222,185,.38) 43%,${kind==='week'?'rgba(104,214,177,.32)':'rgba(104,192,247,.32)'} 54%,transparent 72%);filter:blur(${warming?5:9}px)`;
    W.append(a);nodes.push(a);
    animate(a,warming?[{opacity:0,transform:'scale(.86)'},{opacity:.9,transform:'scale(1)',offset:.8},{opacity:.75,transform:'scale(1.02)'}]:[{opacity:0,transform:'scale(.93)'},{opacity:1,transform:'scale(1.08)',offset:.24},{opacity:.45,transform:'scale(1.18)',offset:.58},{opacity:0,transform:'scale(1.3)'}],warming?(kind==='week'?900:650):(kind==='week'?2300:1750));
  }
  function weaponCanvas(name,length,height=40){
    const img=images[name];if(!img)return null;const n=document.createElement('canvas'),dpr=Math.min(2,devicePixelRatio||1);n.width=Math.round(length*dpr);n.height=Math.round(height*dpr);n.style.width=length+'px';n.style.height=height+'px';
    const ctx=n.getContext('2d'),scale=length/(img.height||img.naturalHeight);ctx.scale(dpr,dpr);ctx.translate(length/2,height/2);ctx.rotate(-Math.PI/2);ctx.drawImage(img,-(img.width||img.naturalWidth)*scale/2,-(img.height||img.naturalHeight)*scale/2,(img.width||img.naturalWidth)*scale,(img.height||img.naturalHeight)*scale);
    n.dataset.weapon=name;return n;
  }
  function weaponFlight(v,kind){
    const theme=options.state().S.ui.theme,name=/^bozkir/.test(theme)?'arrow':theme==='knight'?'longsword':null;if(!name)return;
    let track=Array.from(R.querySelectorAll('.tr.td .sg')).pop()||R.querySelector('.cwk'),hero=false;
    if(!track){track=R.querySelector('.pocket-values');hero=true;}if(!track)return;
    const r=localRect(track),length=Math.min(hero?105:W.classList.contains('T-compact')?125:kind==='week'?205:185,Math.max(80,r.width*.7)),height=hero?25:38,n=weaponCanvas(name,length,height);if(!n)return;
    const x=Math.max(1,r.left),y=Math.max(1,r.top+(hero?r.height/2:Math.min(r.height/2,17))-height/2),travel=Math.max(0,r.width-length);
    n.setAttribute('data-motion-effect','');n.dataset.flight='true';n.setAttribute('aria-hidden','true');n.style.cssText+=`;position:absolute;left:${x}px;top:${y}px;pointer-events:none;z-index:7;opacity:0;filter:drop-shadow(0 1px 1px rgba(35,27,16,.3))`;
    W.append(n);nodes.push(n);
    animate(n,[{opacity:0,transform:'translateX(0)'},{opacity:1,transform:`translateX(${travel*.06}px)`,offset:.12},{opacity:1,transform:`translateX(${travel}px)`,offset:.65},{opacity:1,transform:`translateX(${travel}px)`,offset:.85},{opacity:0,transform:`translateX(${travel}px)`}],kind==='week'?2700:2300);
  }
  function arc(target,kind,signature,clock=false){
    if(!clock){
      const circle=ringCircle(kind);if(!circle)return;
      const r=localRect(circle),size=r.width+18,band=document.createElement('div');
      band.className='motion-refraction';band.setAttribute('data-motion-effect','');band.setAttribute('aria-hidden','true');
      const inner=(r.width/2-5)/(size/2)*100,outer=(r.width/2+6)/(size/2)*100;
      const mask=`radial-gradient(closest-side,transparent ${inner-3}%,#000 ${inner+1}%,#000 ${outer-2}%,transparent ${outer+2}%)`;
      band.style.cssText=`position:absolute;pointer-events:none;z-index:5;left:${r.left-9}px;top:${r.top-9}px;width:${size}px;height:${size}px;border-radius:50%;opacity:0;background:conic-gradient(from 0deg,transparent 225deg,rgba(240,251,255,.7) 253deg,transparent 290deg);mask-image:${mask};-webkit-mask-image:${mask};filter:blur(.6px);transform-origin:center`;
      W.append(band);nodes.push(band);
      animate(band,[{opacity:0,transform:'rotate(-30deg)'},{opacity:.75,offset:.35},{opacity:0,transform:'rotate(85deg)'}],kind==='week'?1500:1050);
      return;
    }
    const o=overlay(target);if(!o)return;
    const {s,width,height}=o,scale=Math.min(width,height),cx=width*.494,cy=height*.536,r=scale*.282;
    const star=el('g',{fill:ink,opacity:0},s);
    el('path',{d:'M0 -7 1.7 -1.7 7 0 1.7 1.7 0 7 -1.7 1.7 -7 0 -1.7 -1.7Z'},star);
    el('circle',{r:2,fill:'#fff4ce'},star);
    const frames=[];for(let i=0;i<=12;i++){const t=i/12,a=(-145+t*120)*Math.PI/180;frames.push({transform:`translate(${cx+Math.cos(a)*r}px,${cy+Math.sin(a)*r}px)`,opacity:Math.sin(t*Math.PI)*.85});}
    animate(star,frames,kind==='week'?3000:2300);
  }
  function liquid(target){
    const svg=target.matches('svg')?target:target.querySelector('svg');if(!svg)return;
    const surface=svg.querySelector('[data-key="bottom-surface"]:not(.dry)');
    if(!surface)return;
    const y=+surface.getAttribute('cy');
    // Share the actual vessel clip, not the SVG's wider label/legend box.
    const group=el('g',{'clip-path':'url(#syV)','data-motion-effect':'','aria-hidden':'true','pointer-events':'none'},svg);
    nodes.push(group);
    const wave=el('path',{d:`M52 ${y}Q116 ${y-4} 180 ${y}T308 ${y}`,fill:'none',stroke:'#f0fbff','stroke-width':1.5,opacity:0},group);
    animate(wave,[{opacity:0,transform:'none'},{opacity:.62,offset:.3},{opacity:0,transform:'translateY(7px)'}],950);
  }
  function glassReveal(switchView){
    if(blocked()||reduced||mq.matches||options.state().S.ui.motion===false||options.state().S.ui.theme!=='saydam')return;
    const svg=R.querySelector('.sy-kum-visual svg'),ring=R.querySelector('.sy-hero .ring');
    if(!svg&&!ring)return;
    phase='view';palette();
    const token=sequence;
    const fade=[{opacity:.72},{opacity:1}];
    if(switchView)animate(svg?.parentElement||ring,fade,280);
    animate(R.querySelector(svg?'.sy-kum .kt':'.sy-hero .hx'),fade,260);
    pause(320*(slow?1.7:1)).then(elapsed=>{if(elapsed&&sequence===token)stop();});
  }
  function liquidBloom(warming=false,kind='day'){
    const svg=R.querySelector('.sy-kum-visual svg');if(!svg)return;
    const surface=svg.querySelector('[data-key="bottom-surface"]:not(.dry)');if(!surface)return;
    const y=+surface.getAttribute('cy'),g=el('g',{'clip-path':'url(#syV)','data-motion-effect':'','aria-hidden':'true','pointer-events':'none'},svg);nodes.push(g);
    const id='motion-water-'+sequence+'-'+(warming?'warm':'bloom'),defs=el('defs',{},g),gr=el('radialGradient',{id,cx:180,cy:Math.min(565,y+70),r:150,gradientUnits:'userSpaceOnUse'},defs);
    el('stop',{offset:'0%','stop-color':'#fff0dc','stop-opacity':.9},gr);el('stop',{offset:'43%','stop-color':kind==='week'?'#bcefe1':'#c1ecff','stop-opacity':.65},gr);el('stop',{offset:'100%','stop-color':'#b7eaff','stop-opacity':0},gr);
    const light=el('rect',{x:35,y:Math.max(325,y-5),width:290,height:280,fill:`url(#${id})`,opacity:0},g);
    animate(light,warming?[{opacity:0},{opacity:.18}]:[{opacity:0},{opacity:.4,offset:.28},{opacity:0}],warming?650:1600);
  }
  function warmup(v,kind,direction){
    if(kind==='near'||direction==='quiet'||reduced||mq.matches)return;
    if(options.state().S.ui.theme==='saydam'){
      if(R.querySelector('.sy-hero .ring'))aura(kind,true);else liquidBloom(true,kind);
    }else{const bar=Array.from(R.querySelectorAll('.tr.td .sg')).pop();if(bar)animate(bar,[{filter:'brightness(1)'},{filter:'brightness(1.12)'}],kind==='week'?900:650);}
  }
  function column(target,signature){
    const o=overlay(target,2);if(!o)return;const {s,width:w,height:h}=o;
    const p=el('path',{d:`M${w/2} ${h-3}V3`,fill:'none',stroke:'currentColor','stroke-width':2.5,'stroke-linecap':'round',pathLength:100,'stroke-dasharray':'14 86',opacity:0},s);
    animate(p,[{strokeDashoffset:14,opacity:0},{strokeDashoffset:-14,opacity:.8,offset:.2},{strokeDashoffset:-90,opacity:.8,offset:.85},{strokeDashoffset:-102,opacity:0}],1600);
    if(signature){const dot=el('circle',{cx:w/2,cy:5,r:3,fill:'currentColor',opacity:0},s);animate(dot,[{opacity:0},{opacity:0,offset:.5},{opacity:.7,offset:.72},{opacity:0}],2000);}
  }
  function thread(target,signature,theme){
    const o=overlay(target,3);if(!o)return;
    const {s,width:w,height:h}=o,y=h/2;
    const p=el('path',{d:`M3 ${y}H${w-3}`,fill:'none',stroke:'currentColor','stroke-width':theme==='saydam'?2.5:1.8,'stroke-linecap':'round',pathLength:100,'stroke-dasharray':'12 88',opacity:0},s);
    animate(p,[{strokeDashoffset:14,opacity:0},{strokeDashoffset:-14,opacity:.9,offset:.24},{strokeDashoffset:-87,opacity:.85,offset:.8},{strokeDashoffset:-100,opacity:0}],1500);
    if(signature&&h>9){
      const x=Math.max(8,w-12),r=Math.min(4,h/3);
      let d=theme.startsWith('bozkir')?`M${x-9} ${y}h12m-4 -3 4 3-4 3m-10 -3-3 -3m3 3-3 3`:theme==='knight'?`M${x} ${y}q-7 -9-8 -2q0 5 8 2q-5 8 1 7q5-1-1-7`: `M${x-r} ${y}h${r*2}M${x} ${y-r}v${r*2}`;
      const mark=el('path',{d,fill:'none',stroke:'currentColor','stroke-width':1.15,'stroke-linecap':'round','stroke-linejoin':'round',opacity:0},s);
      animate(mark,[{opacity:0},{opacity:0,offset:.4},{opacity:.8,offset:.65},{opacity:0}],2000);
    }
  }
  function completion(v,kind,direction,duration){
    if(kind==='near')return;
    const ui=options.state().S.ui,theme=ui.theme,weekly=kind==='week',tiny=W.classList.contains('T-pocket'),compact=W.classList.contains('T-compact');
    const en=ui.lang==='en',amount=new Intl.NumberFormat(en?'en-GB':'tr-TR',{maximumFractionDigits:2}).format(weekly?v.W/3600000:v.cfg.D/60);
    let target=R.querySelector('.pocket-values'),box=null,passive=null;
    let hourglass=false;
    if(!target&&theme==='saydam'){
      target=R.querySelector('.sy-kum .kt')||R.querySelector('.sy-hero .hx');hourglass=!!R.querySelector('.sy-kum .kt');
      if(hourglass&&target){
        const first=target.querySelector('.sy-k'),last=target.querySelector('.sy-chips'),next=target.querySelector('.sy-knote,.sy-legend');
        if(first&&last){const f=localRect(first),t=localRect(target),lr=localRect(last),end=next?localRect(next).top:lr.top+lr.height+12;box={left:t.left,top:f.top,width:t.width,height:Math.max(86,Math.min(170,end-f.top-8))};passive=Array.from(target.children).filter(n=>n.matches('.sy-k,.sy-big,.sy-chips,.goal-also'));}
      }
    }
    if(!target)target=R.querySelector('.dial-copy')||R.querySelector('.milestone-section')||R.querySelector('.rp > div')||R.querySelector('.cpt');
    if(!box&&target){const r=localRect(target);box={left:r.left,top:r.top,width:r.width,height:tiny?r.height:Math.min(r.height,theme==='clock'?270:190)};}
    if(target&&!tiny){const control=target.querySelector('button,a,input,select');if(control){const top=localRect(control.closest('button,a,input,select')).top;box.height=Math.min(box.height,top-box.top-5);passive=Array.from(target.children).filter(n=>localRect(n).top+localRect(n).height<=top-3);}}
    if(!box||box.width<80||box.height<(tiny?24:52))return;
    const card=document.createElement('div');
    const condensed=!tiny&&box.height<(compact&&/^bozkir/.test(theme)?170:125);
    card.className='motion-completion '+(hourglass?'is-hourglass ':'')+(weekly?'weekly ':'')+(tiny?'tiny ':'')+(condensed?'condensed ':'')+(theme==='saydam'?'glass':theme==='clock'?'celestial':/^bozkir|knight/.test(theme)?'manuscript':'plain');
    card.setAttribute('data-motion-effect','');card.setAttribute('aria-hidden','true');
    card.style.cssText=`position:absolute;pointer-events:none;z-index:6;left:${Math.max(2,box.left)}px;top:${Math.max(2,box.top)}px;width:${Math.min(box.width,W.clientWidth-4)}px;height:${Math.max(tiny?52:66,box.height)}px;--completion-ink:${ink}`;
    const time=new Date(v.now),clock=String(time.getUTCHours()).padStart(2,'0')+':'+String(time.getUTCMinutes()).padStart(2,'0');
    card.innerHTML=`<div class="completion-mark"><svg viewBox="0 0 56 56" style="stroke:none"><circle class="completion-disc" cx="28" cy="28" r="24"/><circle class="completion-rim" cx="28" cy="28" r="24" pathLength="100"/><path class="completion-check" d="m16 28 8 8 17-18" pathLength="100"/></svg></div><div class="completion-copy"><span class="completion-kicker">${en?(weekly?'WEEKLY GOAL':'DAILY GOAL'):(weekly?'HAFTALIK HEDEF':'GÜNLÜK HEDEF')}</span><strong>${amount} ${en?'hours':'saat'}</strong><span class="completion-done">${en?'complete':'tamamlandı'}</span><small>${clock}${tiny?'':en?' · Nicely done!':weekly?' · Eline sağlık!':' · Eline sağlık.'}</small></div><svg class="completion-flourish" viewBox="0 0 160 18"><path d="M2 9h50q18-14 28 0q10 14 28 0h50M55 9q10 12 25 0q15-12 25 0"/></svg>`;
    if(passive)passive=passive.concat(Array.from(target.querySelectorAll('.goal-also,.pill')).filter(n=>n.tagName!=='BUTTON'&&!n.querySelector('button,a,input,select')));
    if(target)[...new Set(passive||[target])].forEach(n=>{const old=n.style.visibility;n.style.visibility='hidden';restores.push(()=>{n.style.visibility=old;});});
    W.append(card);nodes.push(card);
    const namedWeapon=/^bozkir/.test(theme)?'arrow':theme==='knight'?'longsword':null;
    if(namedWeapon&&images[namedWeapon]){const holder=card.querySelector('.completion-mark'),canvas=weaponCanvas(namedWeapon,tiny?52:94,tiny?28:42);holder.replaceChildren(canvas);holder.classList.add('has-weapon');}
    if(theme==='saydam'&&!tiny&&!hourglass){
      const text=card.querySelector('.completion-copy strong'),mark=card.querySelector('.completion-mark'),tr=localRect(text),mr=localRect(mark);mark.style.top=(tr.top+tr.height/2-mr.top-mr.height/2)+'px';
      if(card.scrollWidth>card.clientWidth+1)mark.style.display='none';
    }
    if(theme==='saydam'){
      const svg=card.querySelector('.completion-mark svg'),disc=svg?.querySelector('.completion-disc'),rim=svg?.querySelector('.completion-rim');
      if(svg&&disc&&rim){
        const id='motion-glass-'+sequence,defs=el('defs',{},svg),g=el('linearGradient',{id,x1:'0%',y1:'0%',x2:'85%',y2:'100%'},defs);
        [['0%','#ffffff',.98],['42%','#e1f5fc',.66],['78%','#c5e8ef',.4],['100%','#fff0dc',.8]].forEach(x=>el('stop',{offset:x[0],'stop-color':x[1],'stop-opacity':x[2]},g));
        disc.style.fill='url(#'+id+')';disc.style.fillOpacity='1';
        rim.style.stroke='#ffffff';rim.style.strokeWidth='1.1';rim.style.strokeDasharray='none';
        el('path',{d:'M10 24C12 13 23 8 34 12',fill:'none',stroke:'#ffffff','stroke-width':2,'stroke-linecap':'round',opacity:.85},svg);
      }
    }
    if(/^bozkir/.test(theme)){
      const flourish=card.querySelector('.completion-flourish path');if(flourish)flourish.setAttribute('d','M2 9H34L43 2L52 9L43 16L34 9H62L71 2L80 9L71 16L62 9H98L107 2L116 9L107 16L98 9H158');
    }
    if(theme==='clock'&&!tiny){
      const holder=card.querySelector('.completion-mark');holder.innerHTML='<svg viewBox="0 0 56 56" style="stroke:none"><path d="M34 7a21 21 0 1 0 15 31A23 23 0 0 1 34 7Z" fill="currentColor" opacity=".9"/><path d="m43 9 1.5 5 5 1.5-5 1.5-1.5 5-1.5-5-5-1.5 5-1.5Z" fill="#fff4cb"/></svg>';
    }
    if(reduced||mq.matches)return;
    const mark=card.querySelector('.completion-mark'),copy=card.querySelector('.completion-copy'),check=card.querySelector('.completion-check'),rim=card.querySelector('.completion-rim');
    if(theme==='saydam'){
      animate(card,[{opacity:0},{opacity:1,offset:.09},{opacity:1,offset:.9},{opacity:0}],duration);
      animate(check,[{strokeDashoffset:100},{strokeDashoffset:0}],420);
      animate(rim,[{strokeDashoffset:100},{strokeDashoffset:0}],560);
      return;
    }
    animate(card,[{opacity:0,transform:'translateY(12px) scale(.97)'},{opacity:1,transform:'translateY(0) scale(1)',offset:.1},{opacity:1,transform:'translateY(0) scale(1)',offset:.85},{opacity:0,transform:'translateY(-5px) scale(1)'}],duration);
    animate(mark,[{transform:'scale(.72)',opacity:0},{transform:'scale(1.08)',opacity:1,offset:.55},{transform:'scale(1)',opacity:1}],weekly?850:650);
    animate(check,[{strokeDashoffset:100},{strokeDashoffset:100,offset:.3},{strokeDashoffset:0}],850);
    animate(rim,[{strokeDashoffset:100},{strokeDashoffset:0}],weekly?1100:800);
    animate(copy,[{opacity:0,transform:'translateY(7px)'},{opacity:0,transform:'translateY(7px)',offset:.22},{opacity:1,transform:'translateY(0)'}],650);
  }

  function arrival(v,kind){
    const theme=options.state().S.ui.theme;
    if(theme==='saydam'&&phase!=='opening'){if(R.querySelector('.sy-hero .ring'))aura(kind,false);else liquidBloom(false,kind);}
    if(/^bozkir/.test(theme)||theme==='knight')weaponFlight(v,kind);
  }
  function focusTarget(v){return R.querySelector('.pkv b')||R.querySelector('.sy .sy-chips .chip')||R.querySelector('.milestone-section .pill')||R.querySelector('.dial-remaining')||R.querySelector('.sy-kum .sy-k')||R.querySelector('.rp .k')||R.querySelector('.compact .pill.ok')||R.querySelector('.pill.ok');}
  function effect(v,direction,kind,duration){
    const ui=options.state().S.ui,theme=ui.theme,signature=direction==='signature';
    if(kind!=='open')completion(v,kind,direction,duration);
    if(kind!=='near'&&direction!=='quiet'&&!reduced&&!mq.matches)arrival(v,kind==='open'?'day':kind);
    if(kind!=='open'&&kind!=='near'&&direction!=='quiet')celebrate(v,kind);
    const primary=focusTarget(v);if(primary)animate(primary,pulseFrames,kind==='near'?650:950);
    if(reduced||mq.matches)return;
    if(direction==='quiet'||kind==='near')return;
    const pocket=R.querySelector('.pocket-meter .pkbar'),ring=R.querySelector('.sy-hero .ring'),glass=R.querySelector('.sy-kum-visual svg'),dial=R.querySelector('.dial');
    if(pocket)thread(pocket,false,theme);
    else if(theme==='saydam'&&glass)liquid(glass);
    else if(theme==='saydam'&&ring&&options.state().st.sel===v.today.dow)arc(ring,kind,signature);
    else if(theme==='clock'&&dial)arc(dial,kind,signature,true);
    else if(R.querySelector('.cwk [data-v="'+v.today.dow+'"] i'))column(R.querySelector('.cwk [data-v="'+v.today.dow+'"] i'),signature);
    else if(theme==='sutunlar'&&R.querySelector('.cl[data-v="'+v.today.dow+'"] .cf'))column(R.querySelector('.cl[data-v="'+v.today.dow+'"] .cf'),signature);
    else {
      const day=Array.from(R.querySelectorAll('.tr.td .trk .sg')).pop()||R.querySelector('.tr.td .trk .sp2')||R.querySelector('.sy-day.td i');
      const bar=R.querySelector('.side .bar i')||R.querySelector('.sy-foot .bar i')||R.querySelector('.pbar i')||R.querySelector('.bar i')||R.querySelector('.cwk i');
      const target=kind==='week'?bar||day:day||bar;
      if(target)thread(target,signature,theme);
      if(signature){const marker=R.querySelector('.tr.td .time-marker');if(marker)animate(marker,[{filter:'brightness(1)'},{filter:'brightness(1.28)',offset:.5},{filter:'brightness(1)'}],1500);}
    }
  }

  function blocked(){const x=options.state(),st=x.st,S=x.S,focus=R.activeElement;return !!(focus&&focus.matches('input,textarea,select,[contenteditable="true"]'))||destroyed||document.hidden||st.code!=='ready'||!st.v||!st.v.thisWeek||st.set||st.themes||st.rev||S.ui.ask||st.view==='history';}
  function palette(){const ui=options.state().S.ui;ink=getComputedStyle(W).getPropertyValue(/^(bozkir|bozkira|knight|clock)$/.test(ui.theme)?'--gold':'--acc').trim()||'#357f65';}
  function surfaceSheen(target,kind){
    const o=overlay(target);if(!o)return;const {s,width,height}=o,id='motion-sheen-'+sequence;
    const defs=el('defs',{},s),g=el('linearGradient',{id,x1:'0%',y1:'0%',x2:'100%',y2:'70%'},defs);
    [['0%',0],['37%',0],['48%',.18],['53%',.48],['59%',.12],['75%',0],['100%',0]].forEach(x=>el('stop',{offset:x[0],'stop-color':x[0]==='59%'?'#ffe7c4':'#ffffff','stop-opacity':x[1]},g));
    const shine=el('rect',{x:-width,y:0,width:width*2,height,rx:Math.min(height/2,28),fill:'url(#'+id+')',opacity:0},s);
    animate(shine,[{opacity:0,transform:`translateX(${-width*.2}px)`},{opacity:.75,offset:.22},{opacity:.75,offset:.65},{opacity:0,transform:`translateX(${width*.75}px)`}],kind==='week'?3000:2200);
  }
  function celebrate(v,kind){
    if(reduced||mq.matches)return;
    const weekly=kind==='week',tiny=W.classList.contains('T-pocket'),theme=options.state().S.ui.theme,card=R.querySelector('.motion-completion');
    if(theme==='saydam')return;
    if(card)animate(card,[{opacity:0,transform:'translateY(5px) scale(.98)'},{opacity:1,transform:'translateY(0) scale(1)',offset:.14},{opacity:1,offset:.87},{opacity:0}],weekly?5400:4000);
    if(tiny)return;
    if(theme==='knight'||/^bozkir/.test(theme)){
      const flourish=card?.querySelector('.completion-flourish path');
      if(flourish){flourish.setAttribute('pathLength',100);flourish.style.strokeDasharray='100';animate(flourish,[{strokeDashoffset:100,opacity:0},{strokeDashoffset:0,opacity:1,offset:.55},{strokeDashoffset:0,opacity:.65}],1800);}
      const bar=Array.from(R.querySelectorAll('.tr.td .sg')).pop();if(bar)surfaceSheen(bar,kind);
    }else if(theme==='clock'){
      const dial=R.querySelector('.dial');if(dial)animate(dial,[{filter:'brightness(1)'},{filter:'brightness(1.08)',offset:.35},{filter:'brightness(1)'}],2400);
    }else{
      const progress=R.querySelector('.bar i,.pbar i,.cwk');if(progress)surfaceSheen(progress,kind);
    }
  }
  // The planned endpoint and the balancing day get different cues. Recorded bars stay still.
  function planWeapon(track, from, to, theme){
    const r=localRect(track), length=Math.min(106,r.width*.34);
    if(length<28)return;
    const n=weaponCanvas(theme==='knight'?'longsword':'arrow',length,26);
    if(!n)return;
    const end=Math.max(0,Math.min(r.width-length,to-length));
    const start=Math.max(0,Math.min(r.width-length,from-length));
    n.dataset.motionEffect='';n.dataset.planEffect=n.dataset.weapon;n.setAttribute('aria-hidden','true');
    n.style.cssText+=`;position:absolute;left:${r.left+end}px;top:${r.top+(r.height-26)/2}px;pointer-events:none;z-index:7;opacity:0;filter:drop-shadow(0 2px 2px #14191c85)`;
    W.append(n);nodes.push(n);
    animate(n,[{opacity:0,transform:`translateX(${start-end}px)`},{opacity:1,offset:.22},{opacity:1,transform:'translateX(0)',offset:.7},{opacity:0,transform:'translateX(0)'}],1150);
  }
  function planDial(pin, diff){
    const left=parseFloat(pin.style.left);
    if(!Number.isFinite(left))return;
    const x=(left-49.4)/43.3, y=(53.6-parseFloat(pin.style.top))/43.3;
    const end=Math.atan2(x,y), turns=diff/86400000*Math.PI*2;
    const frames=Array.from({length:13},(_,i)=>{
      const a=end-turns*(1-i/12);
      return {left:(49.4+Math.sin(a)*43.3)+'%',top:(53.6-Math.cos(a)*43.3)+'%'};
    });
    animate(pin,frames,920);
    const dial=pin.closest('.dial'), o=dial&&overlay(dial);
    if(o){
      o.s.dataset.planEffect='constellation';
      const {s}=o, r=localRect(dial), w=r.width, h=r.height, a=end-turns;
      const xAt=angle=>r.left-o.x+w*(.494+Math.sin(angle)*.433);
      const yAt=angle=>r.top-o.y+h*(.536-Math.cos(angle)*.433);
      const sweep=el('path',{d:`M${xAt(a)} ${yAt(a)} A${w*.433} ${h*.433} 0 ${+(Math.abs(turns)>Math.PI)} ${+(turns>0)} ${xAt(end)} ${yAt(end)}`,
        fill:'none',stroke:'var(--gold)','stroke-width':3,'stroke-linecap':'round',pathLength:100,'stroke-dasharray':'100',opacity:0},s);
      animate(sweep,[{strokeDashoffset:100,opacity:1},{strokeDashoffset:0,opacity:.88,offset:.65},{strokeDashoffset:0,opacity:0}],1250);
      const star=el('path',{d:'M0-9 2-2 9 0 2 2 0 9-2 2-9 0-2-2Z',fill:'#ffdf8d',
        transform:`translate(${xAt(end)} ${yAt(end)})`,opacity:0},s);
      animate(star,[{opacity:0},{opacity:0,offset:.45},{opacity:1,offset:.7},{opacity:0}],1360);
    }
  }
  function plan(v,before,after,span,edited,totals){
    const {S,st}=options.state(),theme=S.ui.theme;
    if(destroyed||document.hidden||S.ui.motion===false||reduced||mq.matches)return;
    const scale=100/((span[1]-span[0])*3600000);
    const moved=v.rows.filter(r=>before[r.dow]&&after[r.dow]&&Math.abs(after[r.dow]-before[r.dow])>=60000);
    if(!moved.length)return;
    palette();phase='plan';
    const token=sequence, linked=R.querySelector('.plan-jump'), glass=theme==='saydam';
    const ease='cubic-bezier(.24,.8,.28,1)';
    const shift=(node,prop,from,to,delay)=>animate(node,[{[prop]:from},{[prop]:from,offset:delay},{[prop]:to}],900);
    const pulse=(node,color)=>animate(node,[{boxShadow:`inset 0 0 0 2px ${color}`},{boxShadow:`inset 0 0 0 2px ${color}`,offset:.66},{boxShadow:'inset 0 0 0 0 transparent'}],1280);
    const headline=R.querySelector('[data-planned-exit]');
    if(headline){
      if(glass&&moved.some(r=>r.dow===st.sel))animate(headline,[{opacity:.78},{opacity:1}],240,ease);
      else if(!glass)animate(headline,[{transform:'translateY(6px)'},{transform:'translateY(-1px)',offset:.57},{transform:'none'}],370);
    }
    moved.forEach(r=>{
      const i=r.dow,old=before[i],diff=after[i]-old,delay=i===edited?0:.18;
      const day='[data-a="sel"][data-v="'+i+'"]';
      R.querySelectorAll(day).forEach(row=>{
        if(row instanceof SVGElement)return; // The water and band boundaries transition with their own geometry.
        const bar=row.querySelector('.gh,.sy-day>i>.g,.sy-day:not(.td)>i>u,.cs');
        if(bar&&bar.matches('.cs')&&!r.today){
          bar.style.transformOrigin='bottom';
          shift(bar,'transform',`scaleY(${Math.max(.08,(old-r.start)/(after[i]-r.start||1))})`,'none',delay);
        }else if(bar&&bar.style.width){
          const now=parseFloat(bar.style.width), prior=glass?100*(totals[i]-r.half)/(v.cfg.D*60000):bar.matches('.gh')?now-diff*scale:100*(old-r.start)/(v.cfg.D*60000);
          const oldWidth=Math.max(0,Math.min(100,prior));
          if(!glass)shift(bar,'width',oldWidth+'%',bar.style.width,delay);
          else if(Math.abs(oldWidth-now)>.25)animate(bar,[{width:oldWidth+'%'},{width:bar.style.width}],440,ease);
        }
        if(!glass)pulse(row,i===edited?'var(--acc)':'var(--gold)');
        const track=row.querySelector('.trk');
        if(track&&/^(knight|bozkir)/.test(theme)){
          const x=track.clientWidth*Math.min(1,Math.max(0,((after[i]-r.date)/3600000-span[0])/(span[1]-span[0])));
          assetsReady().then(()=>{
            if(sequence===token&&track.isConnected)planWeapon(track,x-diff*scale*track.clientWidth/100,x,theme);
          });
        }
      });
      if(i!==st.sel)return;
      const knob=R.querySelector('.sy-trk .knob'),pin=R.querySelector('.plan-pin');
      if(knob){
        const earlier=Math.max(0,Math.min(100,(old-r.date-span[0]*3600000)*scale));
        animate(knob,[{left:earlier+'%'},{left:knob.style.left}],440,ease);
      }
      if(pin)planDial(pin,diff);
    });
    if(linked){
      if(!glass)animate(linked,[{color:'var(--goldInk)'},{color:'var(--ink)'}],950);
      else if(moved.some(r=>r.dow===+linked.dataset.v))animate(linked.querySelector('b'),[{opacity:.72},{opacity:1}],300,ease);
    }
    pause((glass?520:1950)*(slow?1.7:1)).then(elapsed=>{if(elapsed&&sequence===token)stop();});
  }
  function preferences(p={}){reduced=!!p.reduced;slow=!!p.slow;if(reduced||mq.matches)stop();}
  async function play(kind='open',direction='flow'){
    stop();const token=sequence;loadToken++;const loading=loadToken;
    if(blocked())return false;await assetsReady();if(destroyed||token!==sequence||loading!==loadToken||blocked())return false;
    const state=options.state(),v=state.st.v;
    // Do not label a selected future/past day with today's earned milestone.
    if(kind!=='open'&&state.st.sel!=null&&state.st.sel!==v.today.dow)return false;
    palette();phase='warming';
    if(kind==='open'){
      // Opening is a reveal, never an achievement. The native numbers stay in place throughout.
      if(reduced||mq.matches){phase='idle';return true;}
      warmup(v,'day',direction);if(!await pause(420*(slow?1.7:1))||token!==sequence)return false;
      clearEffects();phase='opening';effect(options.state().st.v,direction,'open',2200);
      if(!await pause(2400*(slow?1.7:1))||token!==sequence)return false;
    }else{
      phase='earned';const duration=reduced||mq.matches?2200:kind==='week'?5400:kind==='near'?750:4000;
      effect(v,direction,kind,duration);if(!await pause(duration*(slow?1.7:1))||token!==sequence)return false;
    }
    clearEffects();phase='idle';return true;
  }
  function inspect(){return {phase,activeEffects:nodes.filter(n=>n.isConnected).length,activeAnimations:handles.filter(a=>a.playState==='running').length,assets:Object.keys(images),reduced:reduced||mq.matches};}
  function cancel(){loadToken++;stop();}
  function destroy(){destroyed=true;cancel();R.removeEventListener('pointerdown',cancel);R.removeEventListener('keydown',cancel);window.removeEventListener('resize',cancel);document.removeEventListener('visibilitychange',cancel);mq.removeEventListener('change',cancel);R.removeEventListener('scroll',cancel,true);}
  R.addEventListener('scroll',cancel,{capture:true,passive:true});
  R.addEventListener('pointerdown',cancel,{passive:true});R.addEventListener('keydown',cancel,{passive:true});window.addEventListener('resize',cancel);document.addEventListener('visibilitychange',cancel);mq.addEventListener('change',cancel);
  return {play,plan,glassReveal,stop:cancel,preferences,inspect,destroy};
};
