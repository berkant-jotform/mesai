(() => {
  'use strict';
  let root;
  const allowed = {theme:['cizelge','knight','sutunlar','sor','bilet','clock'],lang:['tr','en'],look:['light','dark']};
  function size() {
    const panel = root.querySelector('.w');
    return panel.classList.contains('T-pocket') ? 'pocket' : panel.classList.contains('T-compact') ? 'compact' : 'full';
  }
  function report(ready = false) {
    if (!window.__mesai || !root) return;
    const ui = window.__mesai.state().S.ui;
    parent.postMessage({type:'mesai-preview-state',ready,theme:ui.theme,lang:ui.lang,look:ui.look,size:size()},location.origin);
    document.documentElement.lang = ui.lang;
    document.documentElement.style.colorScheme = ui.look;
    document.documentElement.style.background = ui.look === 'dark' ? '#0c1520' : '#e9e8e2';
    root.host.dataset.demoLook = ui.look;
    const grip = root.querySelector('.rz-br');
    grip.title = ui.lang === 'en' ? 'Drag to resize; double-click to reset' : 'Boyutlandırmak için sürükle; sıfırlamak için çift tıkla';
    grip.setAttribute('aria-label', grip.title);
  }
  const boot = setInterval(() => {
    root = document.querySelector('#mesai-host')?.shadowRoot;
    if (!root || !window.__mesai || window.__mesai.state().st.code !== 'ready') return;
    clearInterval(boot);
    const style = document.createElement('style');
    style.textContent = ':host{display:block!important}:host([data-demo-look="dark"]){color-scheme:dark}:host([data-demo-look="light"]){color-scheme:light}.rz-br{opacity:.65!important}';
    root.appendChild(style);
    new ResizeObserver(() => report()).observe(root.querySelector('.w'));
    root.addEventListener('click', () => setTimeout(() => {if(!window.__mesai){parent.postMessage({type:'mesai-preview-closed'},location.origin);return;}report();},0));
    root.addEventListener('dblclick', () => setTimeout(() => report(),0));
    report(true);
  },50);
  window.addEventListener('message', event => {
    if (event.source !== parent || event.origin !== location.origin || event.data?.type !== 'mesai-preview' || !root) return;
    if(!window.__mesai){parent.postMessage({type:'mesai-preview-closed'},location.origin);return;}
    const ui = window.__mesai.state().S.ui;
    for (const key of Object.keys(allowed)) {
      const value = event.data[key];
      if (allowed[key].includes(value)) ui[key] = value;
    }
    const requestedSize = event.data.size;
    let resized = false;
    if (['full','compact','pocket'].includes(requestedSize) && requestedSize !== size()) {
      ui.cmp = requestedSize === 'compact';
      ui.w = requestedSize === 'pocket' ? 220 : null;
      ui.h = null; ui.pre = null; ui.pos = [16,16];
      resized = true;
    }
    if (event.data.openAsk === true || typeof event.data.question === 'string' && event.data.question.length <= 300) {
      ui.ask = true;
    }
    window.__mesai.poke();
    if (resized) window.dispatchEvent(new Event('resize'));
    if (event.data.openAsk === true) root.querySelector('[data-e="ask"]')?.focus();
    if (typeof event.data.question === 'string' && event.data.question.length <= 300) {
      const input = root.querySelector('[data-e="ask"]');
      if (input) {
        input.value = event.data.question;
        input.dispatchEvent(new Event('input',{bubbles:true,composed:true}));
        input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,composed:true}));
      }
    }
    report();
  });
})();
