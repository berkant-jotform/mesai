/* A drafting field tied to the edge rulers; no replacement cursor. */
(() => {
  const canvas=document.querySelector('#measure-field'),ctx=canvas.getContext('2d'),toggle=document.querySelector('#motion-toggle');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(pointer:fine)');
  let enabled=!reduce.matches,raf=0,width=0,height=0,active=false,mx=0,my=0,overControl=false,trail=[];
  try{const saved=localStorage.getItem('mesai.motion');if(saved)enabled=saved!=='off';}catch(_){}
  const allowed=()=>enabled&&!reduce.matches&&fine.matches;
  function label(){const en=document.documentElement.lang==='en',on=allowed();toggle.textContent=en?'Cursor effect: '+(on?'on':'off'):'İmleç efekti: '+(on?'açık':'kapalı');toggle.setAttribute('aria-pressed',String(on));toggle.disabled=reduce.matches||!fine.matches;toggle.title=reduce.matches?(en?'Off because reduced motion is enabled':'Hareket azaltma tercihin nedeniyle kapalı'):!fine.matches?(en?'Available with a mouse':'Fare ile kullanılabilir'):(en?'Toggle the drafting guides':'Ölçü çizgilerini aç veya kapat');}
  function draw(now){raf=0;ctx.clearRect(0,0,width,height);const dark=document.documentElement.dataset.look==='dark',col=dark?'207,183,126':'54,86,118';ctx.lineWidth=1;ctx.font='9px ui-monospace,monospace';
    if(width>760){ctx.strokeStyle=`rgba(${col},.16)`;ctx.fillStyle=`rgba(${col},.4)`;ctx.beginPath();if(scrollY<35)for(let x=60;x<width-40;x+=12){const major=(x-60)%60===0;ctx.moveTo(x+.5,0);ctx.lineTo(x+.5,major?10:4);if(major)ctx.fillText(String(x-60),x+3,20);}for(let y=60;y<height;y+=12){const major=(y-60)%60===0;ctx.moveTo(0,y+.5);ctx.lineTo(major?10:4,y+.5);if(major)ctx.fillText(String(Math.round(scrollY+y-60)),14,y+3);}ctx.stroke();}
    trail=allowed()?trail.filter(p=>now-p.t<520):[];
    if(active&&allowed()){
      if(!overControl){const radius=104,step=26;ctx.save();ctx.beginPath();ctx.arc(mx,my,radius,0,Math.PI*2);ctx.clip();
        for(let x=Math.floor((mx-radius)/step)*step;x<mx+radius;x+=step){const a=.16*(1-Math.abs(x-mx)/radius);ctx.strokeStyle=`rgba(${col},${Math.max(0,a)})`;ctx.beginPath();ctx.moveTo(x+.5,my-radius);ctx.lineTo(x+.5,my+radius);ctx.stroke();}
        for(let y=Math.floor((my-radius)/step)*step;y<my+radius;y+=step){const a=.16*(1-Math.abs(y-my)/radius);ctx.strokeStyle=`rgba(${col},${Math.max(0,a)})`;ctx.beginPath();ctx.moveTo(mx-radius,y+.5);ctx.lineTo(mx+radius,y+.5);ctx.stroke();}ctx.restore();
        ctx.strokeStyle=`rgba(${col},.2)`;ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(mx+.5,24);ctx.lineTo(mx+.5,my-17);ctx.moveTo(28,my+.5);ctx.lineTo(mx-17,my+.5);ctx.stroke();ctx.setLineDash([]);
        ctx.strokeStyle=`rgba(${col},.65)`;ctx.beginPath();for(const [sx,sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){ctx.moveTo(mx+sx*5,my+sy*11);ctx.lineTo(mx+sx*11,my+sy*11);ctx.lineTo(mx+sx*11,my+sy*5);}ctx.stroke();
      }
      if(width>760){ctx.fillStyle=`rgba(${col},.85)`;ctx.strokeStyle=`rgba(${col},.8)`;ctx.beginPath();ctx.moveTo(mx+.5,0);ctx.lineTo(mx+.5,15);ctx.moveTo(0,my+.5);ctx.lineTo(15,my+.5);ctx.stroke();ctx.fillText(String(Math.round(mx)),Math.min(width-35,mx+5),31);ctx.save();ctx.translate(29,my-5);ctx.rotate(-Math.PI/2);ctx.fillText(String(Math.round(scrollY+my)),0,0);ctx.restore();}
    }
    if(allowed()&&trail.length>1){for(let i=1;i<trail.length;i++){const p=trail[i],fade=1-(now-p.t)/520;ctx.strokeStyle=`rgba(${col},${fade*.28})`;ctx.beginPath();ctx.moveTo(trail[i-1].x,trail[i-1].y);ctx.lineTo(p.x,p.y);ctx.stroke();if(i%3===0){ctx.beginPath();ctx.moveTo(p.x-2,p.y-2);ctx.lineTo(p.x+2,p.y+2);ctx.stroke();}}raf=requestAnimationFrame(draw);}
  }
  function redraw(){if(!raf)raf=requestAnimationFrame(draw);}
  function clear(){active=false;trail=[];redraw();}
  function size(){width=innerWidth;height=innerHeight;const d=Math.min(devicePixelRatio||1,2);canvas.width=width*d;canvas.height=height*d;ctx.setTransform(d,0,0,d,0,0);clear();}
  addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;mx=e.clientX;my=e.clientY;active=!e.target.closest('iframe,.stage');overControl=!!e.target.closest('a,button,input,select,summary');if(active&&!overControl&&allowed()){const p=trail[trail.length-1];if(!p||Math.hypot(mx-p.x,my-p.y)>8)trail.push({x:mx,y:my,t:performance.now()});trail=trail.slice(-22);}redraw();},{passive:true});
  document.addEventListener('pointerover',e=>{if(e.target.closest('iframe,.stage'))clear();},{passive:true});document.addEventListener('pointerleave',clear);addEventListener('blur',clear);addEventListener('resize',size,{passive:true});addEventListener('scroll',clear,{passive:true});
  toggle.addEventListener('click',()=>{enabled=!allowed();try{localStorage.setItem('mesai.motion',enabled?'on':'off');}catch(_){}clear();label();});
  new MutationObserver(()=>{label();redraw();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang','data-look']});reduce.addEventListener('change',()=>{clear();label();});fine.addEventListener('change',()=>{clear();label();});label();size();
})();
