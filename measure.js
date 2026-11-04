/* Quiet drafting guides. The native cursor remains unchanged. */
(() => {
  const canvas=document.querySelector('#measure-field'),ctx=canvas.getContext('2d'),toggle=document.querySelector('#motion-toggle');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(pointer:fine)');
  let enabled=!reduce.matches,raf=0,width=0,height=0,active=false,mx=0,my=0,overControl=false;
  try{const saved=localStorage.getItem('mesai.motion');if(saved)enabled=saved!=='off';}catch(_){}
  function label(){const en=document.documentElement.lang==='en',on=enabled&&!reduce.matches&&fine.matches;toggle.textContent=en?'Cursor effect: '+(on?'on':'off'):'İmleç efekti: '+(on?'açık':'kapalı');toggle.setAttribute('aria-pressed',String(on));toggle.disabled=reduce.matches||!fine.matches;toggle.title=reduce.matches?(en?'Off because reduced motion is enabled':'Hareket azaltma tercihin nedeniyle kapalı'):!fine.matches?(en?'Available with a mouse':'Fare ile kullanılabilir'):(en?'Toggle the cursor effect':'İmleç efektini aç veya kapat');}
  function draw(){raf=0;ctx.clearRect(0,0,width,height);const dark=document.documentElement.dataset.look==='dark',col=dark?'207,183,126':'54,86,118';ctx.lineWidth=1;ctx.font='8px ui-monospace,monospace';
    if(width>760){ctx.strokeStyle=`rgba(${col},.14)`;ctx.fillStyle=`rgba(${col},.34)`;ctx.beginPath();if(scrollY<35)for(let x=60;x<width-40;x+=12){const major=(x-60)%60===0;ctx.moveTo(x+.5,0);ctx.lineTo(x+.5,major?9:4);if(major)ctx.fillText(String(x-60),x+3,18);}for(let y=60;y<height;y+=12){const major=(y-60)%60===0;ctx.moveTo(0,y+.5);ctx.lineTo(major?9:4,y+.5);if(major)ctx.fillText(String(Math.round(scrollY+y-60)),13,y+3);}ctx.stroke();}
    if(active&&enabled&&!reduce.matches&&fine.matches){ctx.strokeStyle=`rgba(${col},${overControl ? .24 : .4})`;ctx.beginPath();ctx.arc(mx,my,overControl?16:11,0,Math.PI*2);ctx.stroke();if(!overControl){ctx.fillStyle=`rgba(${col},.5)`;ctx.beginPath();ctx.arc(mx,my,1.5,0,Math.PI*2);ctx.fill();}if(width>760){ctx.strokeStyle=`rgba(${col},.6)`;ctx.beginPath();ctx.moveTo(mx+.5,0);ctx.lineTo(mx+.5,11);ctx.moveTo(0,my+.5);ctx.lineTo(11,my+.5);ctx.stroke();}}
  }
  function redraw(){if(!raf)raf=requestAnimationFrame(draw);}
  function size(){width=innerWidth;height=innerHeight;const d=Math.min(devicePixelRatio||1,2);canvas.width=width*d;canvas.height=height*d;ctx.setTransform(d,0,0,d,0,0);redraw();}
  addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;mx=e.clientX;my=e.clientY;active=!e.target.closest('iframe,.stage');overControl=!!e.target.closest('a,button,input,select,summary');redraw();},{passive:true});
  document.addEventListener('pointerleave',()=>{active=false;redraw();});addEventListener('blur',()=>{active=false;redraw();});addEventListener('resize',size,{passive:true});addEventListener('scroll',()=>{active=false;redraw();},{passive:true});
  toggle.addEventListener('click',()=>{enabled=!(enabled&&!reduce.matches);try{localStorage.setItem('mesai.motion',enabled?'on':'off');}catch(_){}active=false;label();redraw();});
  new MutationObserver(()=>{label();redraw();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang','data-look']});reduce.addEventListener('change',()=>{active=false;label();redraw();});fine.addEventListener('change',()=>{active=false;label();redraw();});label();size();
})();
