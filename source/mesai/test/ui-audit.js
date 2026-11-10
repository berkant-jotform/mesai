// UI/UX audit: every released theme × size × colour mode × open panel, checked in a real browser.
// Finds what screenshots miss: covered controls (a click lands on something else), clipped text, overlapping controls,
// controls outside the panel/window, tiny targets, unlabeled buttons, page errors.
// node source/mesai/test/ui-audit.js   → prints findings grouped by problem; exit 1 if any are found.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../version.json'), 'utf8')).themeCatalog;
const BUNDLE = fs.readFileSync(path.join(__dirname, '../dist/mesai.min.js'), 'utf8');
const THEMES = require('../src/themes.js').ORDER.filter(t => !process.env.THEME || t === process.env.THEME);
const server = http.createServer((q, r) => fs.readFile(path.join(__dirname, 'portal.html'), (e, d) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(d); })).listen(0);
const wk = (date, ev, x = {}) => ({ date, ev, ...x });
const DB = { '1001': { '2026-10': [], '2026-11': [wk('2026-11-02', [['08:05:29', 'G'], ['12:02:00', 'Ç'], ['12:58:39', 'G'], ['17:46:10', 'Ç']]), wk('2026-11-03', [['08:23:07', 'G']], { today: true })] } };
const NOW = Date.UTC(2026, 10, 3, 13, 35), STORE = { types: { '2026-11-05': 'izin' }, ooo: { '2026-11-03': { m: 60, s: 840 } } };
const SIZES = { full: {}, compact: { cmp: true }, pocket: { w: 220 } };
const STATES = { full: ['default', 'editor', 'ask', 'look', 'settings', 'history', 'reverse'], compact: ['default', 'look'], pocket: ['default'] };   // compact asks inline
const OPEN = { editor: '[data-a="sel"][data-v="3"]', ask: '.hd [data-a="askOpen"], .sy [data-a="askOpen"]', look: '[data-a="themes"]', settings: '.hd [data-a="set"], .sy [data-a="set"]', history: '.hd [data-a="hist"], .sy [data-a="hist"]', reverse: '[data-a="rev"]', kum: '.sy [data-a="syv"][data-v="kum"]' };
const EXTRA = { saydam: { full: ['kum'] } };   // theme-only states

function probe() {
  const R = document.getElementById('mesai-host').shadowRoot, W = R.querySelector('.w'), wr = W.getBoundingClientRect(), out = [];
  const vis = e => { const s = getComputedStyle(e), r = e.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 && r.width > 0 && r.height > 0; };
  const name = e => (e.getAttribute('aria-label') || e.title || e.textContent || e.value || e.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const tag = e => e.tagName.toLowerCase() + (e.dataset.a ? '[data-a=' + e.dataset.a + ']' : e.dataset.e ? '[data-e=' + e.dataset.e + ']' : e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '');
  // an open menu/dialog (positioned panel with its own header) is meant to sit over the content below it
  const overlay = e => { for (let p = e; p && p !== W; p = p.parentElement) { const s = getComputedStyle(p); if ((s.position === 'absolute' || s.position === 'fixed') && p.querySelector(':scope > .panel-head, :scope .panel-head')) return p; } return null; };
  const anyOverlay = [...R.querySelectorAll('.panel-head')].some(h => overlay(h));
  const ctl = [...R.querySelectorAll('button,input,select,a,[role=button]')].filter(vis);
  // scrollable ancestors: a control scrolled out of view is fine
  const clippedBy = e => { for (let p = e.parentElement; p && p !== W; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowY + s.overflowX)) return p; } return null; };
  for (const e of ctl) {
    const r = e.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const sc = clippedBy(e); if (sc) { const pr = sc.getBoundingClientRect(); if (cy < pr.top || cy > pr.bottom) continue; }
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) { out.push(['off-window', tag(e), name(e)]); continue; }
    if (cx < wr.left || cx > wr.right || cy < wr.top || cy > wr.bottom) out.push(['outside-panel', tag(e), name(e)]);
    const hit = R.elementFromPoint(cx, cy);
    if (hit && (overlay(hit) || hit.closest('.revp')) && !overlay(e) && !e.closest('.revp')) continue;
    if (hit && sc && sc.contains(hit) && hit.closest('.panel-head')) continue;   // scrolled under the panel's sticky header: out of view, not covered
    if (hit && hit !== e && !e.contains(hit) && !(e.tagName === 'LABEL' && e.control === hit) && !(hit.tagName === 'LABEL' && hit.contains(e))) out.push(['covered', tag(e), name(e) + ' ← under ' + tag(hit)]);
    if ((r.width < 20 || r.height < 18) && e.tagName !== 'A') out.push(['tiny-target', tag(e), name(e) + ' ' + Math.round(r.width) + '×' + Math.round(r.height)]);
    if (e.tagName === 'BUTTON' && !name(e)) out.push(['no-label', tag(e), '']);
  }
  // scrolled out of view inside a scroll box: reachable by scrolling, not a layout fault
  const hidden = e => { const sc = clippedBy(e); if (!sc) return false; const r = e.getBoundingClientRect(), pr = sc.getBoundingClientRect(), cy = r.top + r.height / 2; return cy < pr.top || cy > pr.bottom; };
  for (let i = 0; i < ctl.length; i++) for (let j = i + 1; j < ctl.length; j++) {
    const a = ctl[i], b = ctl[j]; if (hidden(a) || hidden(b)) continue; if (a.contains(b) || b.contains(a)) continue;
    const r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect();
    const ox = Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left), oy = Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top);
    if (!!overlay(a) !== !!overlay(b) || a.closest('.revp') || b.closest('.revp')) continue;
    const under = (h, x) => h.closest('.panel-head') && !x.closest('.panel-head') && clippedBy(x) && clippedBy(x).contains(h); if (under(a, b) || under(b, a)) continue;   // scrolling under a sticky header   // Ters hesap is a floating panel over the week
    if (ox > 3 && oy > 3) out.push(['overlap', tag(a) + ' × ' + tag(b), name(a) + ' × ' + name(b)]);
  }
  // clipped text: a text element whose content is wider/taller than its box, without an intended ellipsis
  for (const e of R.querySelectorAll('.w *')) {
    if (!vis(e) || hidden(e) || !e.childNodes.length || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const s = getComputedStyle(e); if (s.textOverflow === 'ellipsis') continue;
    if (e.scrollWidth > e.clientWidth + 2 && s.overflowX !== 'visible' || e.scrollHeight > e.clientHeight + 3 && s.overflowY === 'hidden' && e.clientHeight > 0) out.push(['clipped-text', tag(e), name(e)]);
    const r = e.getBoundingClientRect();
    if (!clippedBy(e) && (r.right > wr.right + 1 || r.bottom > wr.bottom + 1)) out.push(['text-outside-panel', tag(e), name(e)]);
  }
  if (wr.bottom > innerHeight + 1 && W.scrollHeight <= W.clientHeight + 1 && !R.querySelector('.main') ?.scrollHeight) out.push(['panel-below-window', '.w', Math.round(wr.bottom) + 'px']);
  return out;
}

(async () => {
  const b = await chromium.launch(), found = {};
  const add = (k, ctx, v) => { (found[k] = found[k] || {}); const key = v.join(' · '); (found[k][key] = found[k][key] || []).push(ctx); };
  for (const theme of THEMES) for (const [size, ui0] of Object.entries(SIZES)) for (const mode of theme === 'saydam' ? ['light'] : ['light', 'dark']) for (const state of STATES[size].concat((EXTRA[theme] || {})[size] || [])) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: mode });
    await ctx.route('https://berkant-jotform.github.io/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    const p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(([n, seed]) => { window.__MESAI_NOW = () => n; localStorage.setItem('mesai.v3', JSON.stringify(seed)); }, [NOW, { ui: Object.assign({ lang: 'tr', theme, look: mode, themeCatalog: CATALOG }, ui0), ppl: { '1001': STORE } }]);
    await p.goto('http://127.0.0.1:' + server.address().port + '/portal.html');
    await p.evaluate(d => { portal.setDB(d); portal.setDelay(30); portal.open({ persons: [['1001', 'Örnek Kişi']] }); }, DB);
    await p.evaluate(BUNDLE); await p.waitForFunction(() => window.__mesai && window.__mesai.state().st.code === 'ready', null, { timeout: 10000 }); await p.waitForTimeout(500);
    const where = theme + ' ' + size + ' ' + mode + ' ' + state;
    if (state !== 'default') {
      const el = p.locator('#mesai-host ' + OPEN[state]).first();
      if (!(await el.count())) { add('cannot-open', where, [state, OPEN[state]]); await ctx.close(); continue; }
      try { await el.click({ timeout: 2500 }); } catch (e) { add('cannot-open', where, [state, 'click blocked: ' + e.message.split('\n')[0].slice(0, 80)]); await ctx.close(); continue; }
      await p.waitForTimeout(500);
    }
    for (const f of await p.evaluate(probe)) add(f[0], where, f.slice(1));
    errs.forEach(e => add('page-error', where, [e.slice(0, 120)]));
    await ctx.close();
  }
  await b.close(); server.close();
  let n = 0;
  for (const [k, items] of Object.entries(found)) { console.log('\n## ' + k); for (const [v, where] of Object.entries(items)) { n++; console.log('- ' + v + '  [' + where.length + '×: ' + [...new Set(where)].slice(0, 4).join(' | ') + (where.length > 4 ? ' …' : '') + ']'); } }
  console.log('\n' + n + ' distinct findings');
  process.exit(n ? 1 : 0);
})();
