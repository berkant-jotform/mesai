(() => {
  'use strict';
  const frame = document.querySelector('#preview');
  const mainBookmark = document.querySelector('#bookmark');
  const bookmark = document.querySelector('#variant-bookmark');
  const themes = ['saydam', 'knight', 'bozkir', 'bozkira', 'cizelge', 'sutunlar', 'clock'];
  let resetting = false, previewClosed = false;
  const state = {lang:'tr', look:'light', theme:'saydam', size:'full'};
  const pageVersion = document.querySelector('meta[name="mesai-version"]')?.content || '';
  const installStatus = document.querySelector('#install-status');
  const retryInstall = document.querySelector('#install-retry');
  const copyButton = document.querySelector('#copy');
  const installState = {phase:'loading', id:null, variant:null, href:null, fullBytes:0};
  let manifestPromise = null, sourceController = null, installSerial = 0;
  const sourceCache = new Map();
  const requestedVariant = new URLSearchParams(location.search).get('theme');
  if (themes.includes(requestedVariant)) state.theme = requestedVariant;
  const themeLabels = {saydam:['Saydam','Liquid glass'],knight:['Şövalye','Knight'],bozkir:['Bozkır · Atlı','Steppe · Rider'],bozkira:['Bozkır · Ayakta','Steppe · Standing'],cizelge:['Çizelge','Timeline'],sutunlar:['Sütunlar','Columns'],clock:['Göksel saat','Celestial clock']};
  function installLabel() { return themeLabels[state.theme][state.lang === 'tr' ? 0 : 1]; }
  function paintInstaller() {
    const ready = installState.phase === 'ready';
    bookmark.setAttribute('aria-disabled', String(!ready));
    bookmark.draggable = ready;
    bookmark.tabIndex = ready ? 0 : -1;
    copyButton.disabled = !ready;
    retryInstall.hidden = installState.phase !== 'error';
    const label = installLabel();
    bookmark.textContent = 'Mesai · ' + label;
    document.querySelector('#bozkir-install-note').hidden = !['bozkir','bozkira'].includes(state.theme);
    bookmark.title = 'Mesai · ' + label;
    bookmark.setAttribute('aria-label', state.lang === 'tr' ? 'Mesai · ' + label + ' — yer işaretleri çubuğuna sürükle' : 'Mesai · ' + label + ' — drag to bookmarks bar');
    if (ready) {
      const saving = Math.max(0, Math.round((1 - installState.variant.hrefBytes / installState.fullBytes) * 100));
      installStatus.textContent = (state.lang === 'tr' ? 'Hazır · Tam paketten %' + saving + ' daha küçük' : 'Ready · ' + saving + '% smaller than the full package');
    }
    else if (installState.phase === 'error') installStatus.textContent = location.protocol === 'file:'
      ? (state.lang === 'tr' ? 'Bu dosyadan hazırlanamadı. Mesai’nin kurulum sayfasını açıp yeniden dene.' : 'Could not prepare it from this file. Open Mesai’s hosted setup page and try again.')
      : (state.lang === 'tr' ? 'Yer işareti hazırlanamadı. Bağlantını kontrol edip yeniden dene.' : 'Could not prepare the bookmark. Check your connection and try again.');
    else installStatus.textContent = (state.lang === 'tr' ? 'Hazırlanıyor · ' : 'Preparing · ') + label;
  }
  async function loadManifest() {
    if (!manifestPromise) manifestPromise = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch('bookmarks/manifest.json?v=' + encodeURIComponent(pageVersion), {cache:'no-cache', credentials:'omit', signal:controller.signal});
        if (!response.ok) throw new Error('Manifest unavailable');
        const manifest = await response.json();
        if (!/^\d+\.\d+\.\d+$/.test(pageVersion) || manifest.version !== pageVersion || !Array.isArray(manifest.variants)) throw new Error('Setup version mismatch');
        return manifest;
      } finally { clearTimeout(timer); }
    })().catch(error => { manifestPromise = null; throw error; });
    return manifestPromise;
  }
  async function prepareBookmark(force = false) {
    const serial = ++installSerial;
    const id = state.theme;
    if (sourceController) sourceController.abort();
    sourceController = null;
    installState.phase = 'loading'; installState.id = id; installState.variant = null; installState.href = null;
    bookmark.removeAttribute('href');
    document.querySelector('#copy-status').hidden = true;
    document.querySelector('#install-hint').hidden = true;
    if (force) { manifestPromise = null; sourceCache.delete(id); }
    paintInstaller();
    try {
      const manifest = await loadManifest();
      if (serial !== installSerial) return;
      installState.fullBytes = manifest.variants.find(item => item.id === 'all')?.hrefBytes || 0;
      if (!installState.fullBytes) throw new Error('Missing full package');
      const matches = manifest.variants.filter(item => item.id === id);
      const variant = matches[0];
      const expectedPath = id === 'all' ? 'mesai.js' : 'bookmarks/' + id + '.js';
      if (matches.length !== 1 || variant.path !== expectedPath || ![...themes, 'all'].includes(id) || !Number.isSafeInteger(variant.bytes) || variant.bytes <= 0 || !Number.isSafeInteger(variant.hrefBytes) || variant.hrefBytes <= 11) throw new Error('Invalid variant');
      let code = sourceCache.get(id);
      if (code == null) {
        const controller = new AbortController(); sourceController = controller;
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
          const response = await fetch(variant.path + '?v=' + encodeURIComponent(manifest.version), {cache:'no-cache', credentials:'omit', signal:controller.signal});
          if (!response.ok) throw new Error('Bookmark unavailable');
          code = await response.text();
        } finally { clearTimeout(timer); }
      }
      if (serial !== installSerial || state.theme !== id) return;
      if (!code.trim() || /^\s*</.test(code) || new TextEncoder().encode(code).byteLength !== variant.bytes) throw new Error('Incomplete bookmark');
      const href = 'javascript:' + encodeURIComponent(code);
      if (new TextEncoder().encode(href).byteLength !== variant.hrefBytes) throw new Error('Bookmark size mismatch');
      sourceCache.set(id, code);
      installState.phase = 'ready'; installState.variant = variant; installState.href = href;
      bookmark.setAttribute('href', href);
    } catch (_) {
      if (serial !== installSerial) return;
      installState.phase = 'error'; installState.href = null; installState.variant = null;
      bookmark.removeAttribute('href');
    } finally {
      if (serial === installSerial) { sourceController = null; paintInstaller(); }
    }
  }
  retryInstall.addEventListener('click', () => { prepareBookmark(true); });
  const questions = {
    tr:{now:'Şimdi çıksam?',friday:'cuma kaçta çıkarım?',early:'cuma 14te çıkmak için her gün kaç saat',total:'bu hafta kaç saat yaptım'},
    en:{now:'what if I leave now?',friday:'when do I leave Friday?',early:'leave Friday at 14:00, how many hours per day?',total:'how many hours have I worked this week?'}
  };
  try {
    const saved = JSON.parse(localStorage.getItem('mesai.page') || '{}');
    if (['tr','en'].includes(saved.lang)) state.lang = saved.lang;
    if (['light','dark'].includes(saved.look)) state.look = saved.look;
  } catch (_) {}
  const installed=new URLSearchParams(location.search).get('from');
  let installMode=installed && /^\d+\.\d+\.\d+$/.test(installed)?'update':'new';
  function installPaint(){
    document.querySelector('#setup-new').hidden=installMode!=='new';
    document.querySelector('#setup-update').hidden=installMode!=='update';
    document.querySelectorAll('[data-install]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.install===installMode)));
  }
  document.querySelectorAll('[data-install]').forEach(b=>b.addEventListener('click',()=>{installMode=b.dataset.install;installPaint();}));
  installPaint();
  function paint() {
    if(installed && /^\d+\.\d+\.\d+$/.test(installed)) document.querySelector('#version-status').textContent=installed===pageVersion?(state.lang==='tr'?'· Sürümün güncel':'· You are up to date'):(state.lang==='tr'?'· Sende v'+installed:'· You have v'+installed);
    document.documentElement.lang = state.lang;
    document.documentElement.dataset.look = state.look;
    document.documentElement.dataset.theme = state.theme;
    frame.style.height = {full:['knight','clock','bozkir','bozkira'].includes(state.theme)?950:800,compact:['saydam','bozkir','bozkira'].includes(state.theme)?760:520,pocket:180}[state.size] + 'px';
    for (const key of ['lang','look','theme','size']) {
      document.querySelectorAll(`[data-${key}]`).forEach(button => {
        if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button.dataset[key] === state[key]));
      });
    }
    try { localStorage.setItem('mesai.page', JSON.stringify({lang:state.lang, look:state.look})); } catch (_) {}
    const activeBozkir = ['bozkir','bozkira'].includes(state.theme);
    const groupLabel = document.querySelector('[data-bozkir-label]');
    groupLabel.setAttribute('aria-pressed', String(activeBozkir));
    if (activeBozkir) groupLabel.dataset.theme = state.theme;
    document.querySelectorAll('.variant-icon').forEach(b => {
      b.title = b.dataset[state.lang === 'tr' ? 'labelTr' : 'labelEn']; b.setAttribute('aria-label', b.title);
    });
    mainBookmark.setAttribute('aria-label', state.lang === 'tr' ? 'Mesai · tüm temalar — yer işaretleri çubuğuna sürükle' : 'Mesai · all themes — drag to bookmarks bar');
    if (installState.id !== state.theme) prepareBookmark();
    else paintInstaller();
  }
  function send() { frame.contentWindow.postMessage({type:'mesai-preview', ...state}, location.origin); }
  document.querySelectorAll('button[data-lang],button[data-look],button[data-theme],button[data-size]').forEach(button => {
    button.addEventListener('click', () => {
      for (const key of ['lang','look','theme','size']) if (button.dataset[key]) state[key] = button.dataset[key];
      if (button.dataset.theme) state.size = 'full';
      if(previewClosed){resetExample(true);return;}
      paint(); send();
    });
  });
  window.addEventListener('message', event => {
    if (event.source !== frame.contentWindow || event.origin !== location.origin) return;
    if(event.data?.type==='mesai-preview-closed'){previewClosed=true;document.querySelectorAll('[data-question]').forEach(b=>b.disabled=true);document.querySelector('.frame-wrap').hidden=true;document.querySelector('#preview-empty').hidden=false;return;}
    if(event.data?.type!=='mesai-preview-state')return;
    const data = event.data;
    if (resetting && !data.ready) return;
    if (data.ready) {
      resetting = false;
      document.querySelectorAll('[data-question]').forEach(button => { button.disabled = false; });
      send(); return;
    }
    if (themes.includes(data.theme)) state.theme = data.theme;
    if (['tr','en'].includes(data.lang)) state.lang = data.lang;
    if (['light','dark'].includes(data.look)) state.look = data.look;
    if (['full','compact','pocket'].includes(data.size)) state.size = data.size;
    paint();
  });
  function resetExample(keepSize=false){
    resetting=true;previewClosed=false;document.querySelector('.frame-wrap').hidden=false;document.querySelector('#preview-empty').hidden=true;
    if(!keepSize)state.size='full';paint();
    document.querySelectorAll('[data-question]').forEach(button=>{button.disabled=true;});
    frame.src='preview.html?v='+encodeURIComponent(pageVersion)+'&reset='+Date.now();
  }
  document.querySelector('#reset').addEventListener('click',()=>resetExample());
  document.querySelector('#reopen').addEventListener('click',()=>resetExample());
  document.querySelectorAll('[data-question]').forEach(button => {
    button.addEventListener('click', () => {
      state.size = 'full'; paint();
      frame.contentWindow.postMessage({type:'mesai-preview', ...state, question:questions[state.lang][button.dataset.question]}, location.origin);
      frame.scrollIntoView({block:'center',behavior:'smooth'});
    });
  });
  window.addEventListener('keydown', event => {
    if (!event.altKey || !['KeyK','KeyM'].includes(event.code)) return;
    event.preventDefault();
    if(previewClosed){resetExample();return;}
    if (event.code === 'KeyK') {
      state.size = state.size === 'full' ? 'compact' : 'full';
      paint(); send();
    } else {
      state.size = 'full'; paint();
      frame.contentWindow.postMessage({type:'mesai-preview', ...state, openAsk:true}, location.origin);
    }
  });
  function linkArgeHint(element) {
    const text = element.textContent;
    element.replaceChildren();
    text.split(/(ARGE(?: Portal)?)/g).forEach(part => {
      if (/^ARGE(?: Portal)?$/.test(part)) {
        const a = document.createElement('a'); a.textContent = part;
        a.href = 'https://argeportal.hacettepeteknokent.com.tr/'; a.target = '_blank'; a.rel = 'noopener';
        element.append(a);
      } else element.append(document.createTextNode(part));
    });
  }
  mainBookmark.addEventListener('click', event => {
    event.preventDefault();
    const hint = document.querySelector('#main-install-hint'); hint.hidden = false;
    hint.textContent = state.lang === 'tr' ? 'Bu düğmeyi yer işaretleri çubuğuna sürükle. Sonra ARGE’de aç.' : 'Drag this button to your bookmarks bar, then open it on ARGE.';
    linkArgeHint(hint);
  });
  bookmark.addEventListener('click', event => {
    event.preventDefault();
    if (installState.phase !== 'ready') return;
    const hint = document.querySelector('#install-hint');
    hint.hidden = false;
    hint.textContent = state.lang === 'tr' ? 'Mesai’yi basılı tutup üstteki yer işaretleri çubuğuna sürükle. Sonra ARGE’de çubuktaki Mesai’ye tıkla.' : 'Hold Mesai and drag it to the bookmarks bar above. Then click that bookmark on ARGE.';
    linkArgeHint(hint);
  });
  bookmark.addEventListener('dragstart', event => {
    if (installState.phase !== 'ready' || !installState.href || state.theme !== installState.id) event.preventDefault();
  });
  copyButton.addEventListener('click', async () => {
    if (installState.phase !== 'ready' || !installState.href) return;
    const status = document.querySelector('#copy-status');
    const serial = installSerial, href = installState.href;
    status.hidden = false;
    try {
      await navigator.clipboard.writeText(href);
      if (serial !== installSerial) return;
      status.textContent = state.lang === 'tr' ? 'Kopyalandı. Yeni bir yer işareti oluşturup URL alanına yapıştır.' : 'Copied. Create a bookmark and paste this into its URL field.';
    } catch (_) {
      if (serial !== installSerial) return;
      status.textContent = state.lang === 'tr' ? 'Kopyalanamadı. Hazır Mesai düğmesini çubuğa sürükleyebilirsin.' : 'Could not copy. Drag the ready Mesai button to the bookmarks bar.';
    }
  });
  paint();
})();
