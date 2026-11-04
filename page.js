(() => {
  'use strict';
  const frame = document.querySelector('#preview');
  const bookmark = document.querySelector('#bookmark');
  const themes = ['cizelge', 'sutunlar', 'sor', 'bilet'];
  const state = {lang:'tr', look:'light', theme:'cizelge', size:'full'};
  const questions = {
    tr:{friday:'cuma kaçta çıkarım?',early:'cuma 14te çıkmak için her gün kaç saat',total:'bu hafta kaç saat yaptım'},
    en:{friday:'when do I leave Friday?',early:'leave Friday at 14:00, how many hours per day?',total:'how many hours have I worked this week?'}
  };
  try {
    const saved = JSON.parse(localStorage.getItem('mesai.page') || '{}');
    if (['tr','en'].includes(saved.lang)) state.lang = saved.lang;
    if (['light','dark'].includes(saved.look)) state.look = saved.look;
  } catch (_) {}
  function paint() {
    document.documentElement.lang = state.lang;
    document.documentElement.dataset.look = state.look;
    frame.style.height = {full:720,compact:440,pocket:180}[state.size] + 'px';
    for (const key of ['lang','look','theme','size']) {
      document.querySelectorAll(`[data-${key}]`).forEach(button => {
        if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button.dataset[key] === state[key]));
      });
    }
    try { localStorage.setItem('mesai.page', JSON.stringify({lang:state.lang, look:state.look})); } catch (_) {}
  }
  function send() { frame.contentWindow.postMessage({type:'mesai-preview', ...state}, location.origin); }
  document.querySelectorAll('button[data-lang],button[data-look],button[data-theme],button[data-size]').forEach(button => {
    button.addEventListener('click', () => {
      for (const key of ['lang','look','theme','size']) if (button.dataset[key]) state[key] = button.dataset[key];
      if (button.dataset.theme) state.size = 'full';
      paint(); send();
    });
  });
  window.addEventListener('message', event => {
    if (event.source !== frame.contentWindow || event.origin !== location.origin || event.data?.type !== 'mesai-preview-state') return;
    const data = event.data;
    if (data.ready) {
      document.querySelectorAll('[data-question]').forEach(button => { button.disabled = false; });
      send(); return;
    }
    if (themes.includes(data.theme)) state.theme = data.theme;
    if (['tr','en'].includes(data.lang)) state.lang = data.lang;
    if (['light','dark'].includes(data.look)) state.look = data.look;
    if (['full','compact','pocket'].includes(data.size)) state.size = data.size;
    paint();
  });
  document.querySelector('#reset').addEventListener('click', () => {
    state.size = 'full'; paint();
    document.querySelectorAll('[data-question]').forEach(button => { button.disabled = true; });
    frame.src = 'preview.html?v=310-page2&reset=' + Date.now();
  });
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
    if (event.code === 'KeyK') {
      state.size = state.size === 'full' ? 'compact' : 'full';
      paint(); send();
    } else {
      state.size = 'full'; paint();
      frame.contentWindow.postMessage({type:'mesai-preview', ...state, openAsk:true}, location.origin);
    }
  });
  bookmark.addEventListener('click', event => {
    event.preventDefault();
    const hint = document.querySelector('#install-hint');
    hint.hidden = false;
    hint.textContent = state.lang === 'tr' ? 'Bunu tıklamak yerine yer işaretleri çubuğuna sürükle. Sonra ARGE’de aç.' : 'Drag this to your bookmarks bar, then open it on ARGE.';
  });
  document.querySelector('#copy').addEventListener('click', async () => {
    const status = document.querySelector('#copy-status');
    status.hidden = false;
    try {
      await navigator.clipboard.writeText(bookmark.getAttribute('href'));
      status.textContent = state.lang === 'tr' ? 'Kopyalandı. Yeni bir yer işareti oluşturup URL alanına yapıştır.' : 'Copied. Create a bookmark and paste this into its URL field.';
    } catch (_) {
      status.textContent = state.lang === 'tr' ? 'Kopyalanamadı. Üstteki Mesai düğmesini çubuğa sürükleyebilirsin.' : 'Could not copy. Drag the Mesai button above to the bookmarks bar.';
    }
  });
  paint();
})();
