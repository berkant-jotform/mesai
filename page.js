(() => {
  'use strict';
  const frame = document.querySelector('#preview');
  const bookmark = document.querySelector('#bookmark');
  const themes = ['cizelge', 'sutunlar', 'sor', 'sutunsor', 'bilet'];
  const state = {lang:'tr', look:'light', theme:'cizelge'};
  try {
    const saved = JSON.parse(localStorage.getItem('mesai.page') || '{}');
    if (['tr','en'].includes(saved.lang)) state.lang = saved.lang;
    if (['light','dark'].includes(saved.look)) state.look = saved.look;
  } catch (_) {}
  function paint() {
    document.documentElement.lang = state.lang;
    document.documentElement.dataset.look = state.look;
    for (const key of ['lang','look','theme']) {
      document.querySelectorAll(`[data-${key}]`).forEach(button => {
        if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button.dataset[key] === state[key]));
      });
    }
    try { localStorage.setItem('mesai.page', JSON.stringify({lang:state.lang, look:state.look})); } catch (_) {}
  }
  function send() { frame.contentWindow.postMessage({type:'mesai-preview', ...state}, location.origin); }
  document.querySelectorAll('button[data-lang],button[data-look],button[data-theme]').forEach(button => {
    button.addEventListener('click', () => {
      for (const key of ['lang','look','theme']) if (button.dataset[key]) state[key] = button.dataset[key];
      paint(); send();
    });
  });
  window.addEventListener('message', event => {
    if (event.source !== frame.contentWindow || event.origin !== location.origin || event.data?.type !== 'mesai-preview-state') return;
    const data = event.data;
    if (data.ready) { send(); return; }
    if (themes.includes(data.theme)) state.theme = data.theme;
    if (['tr','en'].includes(data.lang)) state.lang = data.lang;
    if (['light','dark'].includes(data.look)) state.look = data.look;
    if (Number.isFinite(data.height)) frame.style.height = Math.min(1400, Math.max(340, data.height)) + 'px';
    paint();
  });
  document.querySelector('#reset').addEventListener('click', () => { frame.src = 'preview.html?reset=' + Date.now(); });
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
