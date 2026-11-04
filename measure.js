/* Measuring guides echo the Reporting grid trail; they never cover controls. */
(() => {
  const canvas=document.querySelector('#measure-field'), ctx=canvas.getContext('2d'), toggle=document.querySelector('#motion-toggle');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)'), fine=matchMedia('(pointer:fine)');
  let enabled=true, raf=0, width=0,height=0, active=false, mx=0,my=0, trail=[],last=0;
  try{enabled=localStorage.getItem('mesai.motion')!=='off';}catch(_){}
  function label(){const en=document.documentElement.lang==='en';toggle.textContent=en?'Motion '+(enabled?'on':'off'):'Hareket '+(enabled?'açık':'kapalı');toggle.setAttribute('aria-pressed',String(enabled));}
  function size(){width=innerWidth;height=innerHeight;const d=Math.min(devicePixelRatio||1,2);canvas.width=width*d;canvas.height=height*d;ctx.setTransform(d,0,0,d,0,0);draw(performance.now());}
  function draw(time){raf=0;ctx.clearRect(0,0,width,height);const dark=document.documentElement.dataset.look==='dark';const col=dark?'191,177,143':'104,110,107';ctx.strokeStyle=`rgba(${col},.18)`;ctx.fillStyle=`rgba(${col},.6)`;ctx.lineWidth=1;ctx.font='8px ui-monospace,monospace';
    if(width>700){ctx.beginPath();if(scrollY<40)for(let x=48;x<width-32;x+=12){const major=(x-48)%60===0;ctx.moveTo(x+.5,0);ctx.lineTo(x+.5,major?12:5);if(major)ctx.fillText(String(x-48),x+3,21);}for(let y=48;y<height;y+=12){const major=(y-48)%60===0;ctx.moveTo(0,y+.5);ctx.lineTo(major?12:5,y+.5);if(major)ctx.fillText(String(y-48),16,y+3);}ctx.stroke();}
    if(enabled&&!reduce.matches&&fine.matches){trail=trail.filter(p=>time-p.t<550);for(const p of trail){ctx.fillStyle=`rgba(${col},${.075*(1-(time-p.t)/550)})`;ctx.fillRect(p.x,p.y,27,27);}if(active){ctx.strokeStyle=`rgba(${col},.35)`;ctx.beginPath();ctx.moveTo(mx-7,my);ctx.lineTo(mx+7,my);ctx.moveTo(mx,my-7);ctx.lineTo(mx,my+7);ctx.stroke();ctx.fillStyle=`rgba(${col},.65)`;ctx.fillText(`${Math.round(mx)} / ${Math.round(my)}`,mx+12,my-10);ctx.strokeStyle=`rgba(${col},.14)`;ctx.beginPath();ctx.moveTo(mx,0);ctx.lineTo(mx,14);ctx.moveTo(0,my);ctx.lineTo(14,my);ctx.stroke();}if(trail.length)raf=requestAnimationFrame(draw);}
  }
  function redraw(){if(!raf)raf=requestAnimationFrame(draw);}
  addEventListener('pointermove',e=>{mx=e.clientX;my=e.clientY;active=enabled&&!e.target.closest('a,button,input,select,iframe,details,.stage,.steps,.intro');if(active&&performance.now()-last>35){trail.push({x:Math.floor(mx/28)*28,y:Math.floor(my/28)*28,t:performance.now()});last=performance.now();}redraw();},{passive:true});
  document.addEventListener('pointerleave',()=>{active=false;redraw();});addEventListener('resize',size,{passive:true});addEventListener('scroll',()=>{active=false;trail=[];redraw();},{passive:true});
  toggle.addEventListener('click',()=>{enabled=!enabled;try{localStorage.setItem('mesai.motion',enabled?'on':'off');}catch(_){}active=false;trail=[];label();redraw();});
  new MutationObserver(()=>{label();redraw();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang','data-look']});reduce.addEventListener('change',()=>{active=false;trail=[];redraw();});label();size();
})();
