(() => {
  'use strict';
  let root;
  const allowed = {theme:['cizelge','sutunlar','sor','sutunsor','bilet'],lang:['tr','en'],look:['light','dark']};
  function report(ready = false) {
    if (!window.__mesai || !root) return;
    const ui = window.__mesai.state().S.ui;
    const panel = root.querySelector('.w');
    parent.postMessage({type:'mesai-preview-state',ready,theme:ui.theme,lang:ui.lang,look:ui.look,height:Math.ceil(panel.getBoundingClientRect().height)+24},location.origin);
    document.documentElement.lang = ui.lang;
    document.documentElement.style.colorScheme = ui.look;
    document.documentElement.style.background = ui.look === 'dark' ? '#131613' : '#eceee8';
  }
  const boot = setInterval(() => {
    root = document.querySelector('#mesai-host')?.shadowRoot;
    if (!root || !window.__mesai) return;
    clearInterval(boot);
    const style = document.createElement('style');
    style.textContent = ':host{display:block!important}.w{position:relative!important;left:0!important;top:0!important;width:100%!important;box-shadow:none!important}.hd [data-a="close"],.hd [data-a="min"]{display:none!important}.hd{cursor:default!important}';
    root.appendChild(style);
    new ResizeObserver(() => report()).observe(root.querySelector('.w'));
    root.addEventListener('click', () => setTimeout(() => report(),0));
    report(true);
  },50);
  window.addEventListener('message', event => {
    if (event.source !== parent || event.origin !== location.origin || event.data?.type !== 'mesai-preview' || !root) return;
    const ui = window.__mesai.state().S.ui;
    for (const key of Object.keys(allowed)) {
      const value = event.data[key];
      if (allowed[key].includes(value)) ui[key] = value;
    }
    window.__mesai.poke();
    report();
  });
})();
