// Browser stress test against a simulated portal. Each scenario injects the bundle exactly as a bookmark click would.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), assert = require('assert');
const CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../version.json'), 'utf8')).themeCatalog;
const BUNDLE = fs.readFileSync(path.join(__dirname, '../dist/mesai.min.js'), 'utf8');
// Serve the simulated portal over http (like the real https portal); file:// storage is not reliable across reloads.
const http = require('http');
const server = http.createServer((q, r) => { const f = path.join(__dirname, path.basename(q.url.split('?')[0]) || 'portal.html'); fs.readFile(f, (e, d) => { r.writeHead(e ? 404 : 200, { 'content-type': 'text/html; charset=utf-8' }); r.end(e ? '' : d); }); }).listen(0, '127.0.0.1');
const URL = () => 'http://127.0.0.1:' + server.address().port + '/portal.html';
const VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../version.json'), 'utf8')).version;
const SHOTS = path.join(__dirname, '../shots'); fs.mkdirSync(SHOTS, { recursive: true });

const wk = (date, ev, extra = {}) => ({ date, ev, ...extra });
const oct = [];
for (let d = 1; d <= 31; d++) {
  const w = new Date(Date.UTC(2026, 9, d)).getUTCDay();
  if (w === 0 || w === 6 || d === 29) continue;
  oct.push(wk(`2026-10-${String(d).padStart(2, '0')}`, [['08:30:00', 'G'], ['12:30:00', 'Ç'], ['13:15:00', 'G'], ['18:00:00', 'Ç']]));
}
const DB = {
  '1001': {
    '2026-10': oct,
    '2026-11': [wk('2026-11-02', [['08:05:29', 'G'], ['12:02:00', 'Ç'], ['12:58:39', 'G'], ['17:46:10', 'Ç']]), wk('2026-11-03', [['08:23:07', 'G']], { today: true })],
    '2026-12': [wk('2026-12-01', [['09:00:00', 'G']], { today: true })]
  },
  '1002': { '2026-11': [wk('2026-11-02', [['07:50:00', 'G'], ['16:50:00', 'Ç']]), wk('2026-11-03', [['08:00:00', 'G']], { today: true })] }
};
const NOV3 = Date.UTC(2026, 10, 3, 13, 35, 0), DEC1 = Date.UTC(2026, 11, 1, 10, 0);
const HANDOFF = { types: { '2026-11-05': 'izin' }, ooo: { '2026-11-03': { m: 60, s: 840 } } };

let browser, pass = 0, errors = [];
async function page(now = NOV3, opts = {}) {
  const ctx = opts.ctx || await browser.newContext({ viewport: opts.vp || { width: 1440, height: 900 }, colorScheme: opts.scheme || 'light' });
  // The widget asks the install site for the latest version; answer locally (the sandbox has no route there).
  await ctx.route('https://berkant-jotform.github.io/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: opts.latest || VERSION }) }));
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.addInitScript(([n, seed]) => {
    window.__MESAI_NOW = () => window.__nowOverride || n;
    if (seed && !localStorage.getItem('mesai.v3')) localStorage.setItem('mesai.v3', JSON.stringify(seed));
  }, [now, opts.seed || (opts.fresh ? null : { ui: { theme: 'cizelge', themeCatalog: CATALOG } })]);   // most checks read Çizelge markup; new users get Saydam
  await p.goto(URL());
  await p.evaluate(([db, d]) => { portal.setDB(db); portal.setDelay(d); }, [DB, opts.delay || 250]);
  p.ctx = ctx; return p;
}
const seedFor = (store, ui) => ({ ui: Object.assign({ theme: 'cizelge', lang: 'tr', themeCatalog: CATALOG }, ui || {}), ppl: { '1001': store || {} } });
const click = p => p.evaluate(BUNDLE);
const H = '#mesai-host >> ';
const sh = (p, sel) => p.evaluate(s => { const e = document.getElementById('mesai-host')?.shadowRoot.querySelector(s); return e ? e.textContent : null; }, sel);
const st = p => p.evaluate(() => { const s = window.__mesai && window.__mesai.state().st; return s && { code: s.code, person: s.person, period: s.period, count: s.count, job: s.job }; });
const view = p => p.evaluate(() => { const v = window.__mesai.state().st.v; return v && { W: v.W, done: v.done, rows: v.rows.map(r => ({ key: r.key, end: r.end, plan: r.plan, type: r.type })), fri: v.rows[4].end }; });
async function until(p, fn, ms = 8000, label = '') {
  const t0 = Date.now();
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timeout: ' + label + ' ' + JSON.stringify(await st(p))); await p.waitForTimeout(100); }
}
const ready = (p, label) => until(p, async () => (await st(p))?.code === 'ready' && ((await sh(p, '.strip')) != null || (await sh(p, '.sy')) != null), 10000, label);
const clk = ms => { const d = new Date(Math.ceil(ms / 60000) * 60000); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };
async function test(name, fn) { if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  const e0 = errors.length;
  try { await fn(); if (errors.length > e0) throw new Error('page errors: ' + errors.slice(e0).join(' | ')); pass++; console.log('✓', name); }
  catch (e) { console.log('✗', name, '\n   ', e.message.split('\n')[0]); process.exitCode = 1; }
}

(async () => {
  browser = await chromium.launch();

  await test('empty dönem + personel filled; handoff numbers on screen', async () => {
    const p = await page(NOV3, { seed: seedFor(HANDOFF) }); await p.evaluate(() => portal.open()); await click(p); await ready(p);
    const s = await st(p); assert.equal(s.person, '1001'); assert.equal(s.period, '2026-11');
    const side = await sh(p, '.side');
    assert.match(side, /9 saat tamamlanır17:24/); assert.match(side, /Cum 18:19/); assert.match(side, /31 sa 08 dk/); assert.match(side, /14 sa 52 dk \/ 46 sa/);
    assert.match(side, /En erken çıkış 16:00/);
    assert.match(await sh(p, '.strip'), /45 \+ OOO 1:00 = 46 sa/);
    await p.ctx.close();
  });

  await test('1 Dec: Monday 30 Nov loaded from November, portal returns to December', async () => {
    const db = JSON.parse(JSON.stringify(DB)); db['1001']['2026-11'].push(wk('2026-11-30', [['08:00:00', 'G'], ['18:30:00', 'Ç']]));
    const p = await page(DEC1); await p.evaluate(d => portal.setDB(d), db); await p.evaluate(() => portal.open()); await click(p);
    await until(p, async () => { const s = await st(p); return s.code === 'ready' && s.period === '2026-12' && !s.job && /10:30/.test(await sh(p, '.tl') || ''); }, 15000, 'nov autoload');
    await p.ctx.close();
  });

  await test('no card open: waits, attaches without a second click', async () => {
    const p = await page(); await click(p);
    await until(p, async () => (await st(p))?.code === 'nocard', 3000, 'nocard');
    assert.match(await sh(p, '.empty'), /PDKS/);
    await p.evaluate(() => portal.open()); await ready(p, 'after open');
    await p.ctx.close();
  });

  await test('two PDKS cards with duplicate ids: follows the front card', async () => {
    const p = await page();
    await p.evaluate(() => { window.w1 = portal.open({ persons: [['1001', 'Berkant Gül']], period: '2026-11', person: '1001' }); });
    await p.waitForTimeout(700);
    await p.evaluate(() => { window.w2 = portal.open({ persons: [['1002', 'Ayşe Yılmaz']], period: '2026-11', person: '1002' }); });
    await click(p);
    await until(p, async () => (await st(p))?.person === '1002' && (await st(p)).code === 'ready', 8000, 'front=1002');
    assert.match(await sh(p, '.side'), /17:00/);
    await p.evaluate(() => portal.focus(w1));
    await until(p, async () => (await st(p))?.person === '1001' && /17:24/.test(await sh(p, '.side')), 8000, 'front=1001');
    await p.evaluate(() => portal.close(w1));
    await until(p, async () => (await st(p))?.person === '1002', 8000, 'w1 closed');
    await p.ctx.close();
  });

  await test('several persons: asks, continues after selection', async () => {
    const p = await page(); await p.evaluate(() => portal.open({ persons: [['1001', 'Berkant Gül'], ['1002', 'Ayşe Yılmaz']] })); await click(p);
    await until(p, async () => (await st(p))?.code === 'person', 6000, 'person');
    await p.evaluate(() => { const s = document.querySelector('#Personel_Id'); s.value = '1002'; s.dispatchEvent(new Event('change')); });
    await until(p, async () => (await st(p))?.person === '1002' && (await st(p)).code === 'ready', 8000, 'picked');
    await p.ctx.close();
  });

  await test('slow portal (2.5 s) never shows a false zero', async () => {
    const p = await page(NOV3, { delay: 2500 }); await p.evaluate(() => portal.open()); await click(p);
    const seen = [], t0 = Date.now();
    while (Date.now() - t0 < 9000) { const v = await p.evaluate(() => { const v = window.__mesai.state().st.v; return v ? v.done : null; }); if (v != null) seen.push(v); if ((await st(p)).code === 'ready' && v) break; await p.waitForTimeout(120); }
    assert.ok(seen.length && seen.every(x => x > 14 * 3600000), 'saw ' + [...new Set(seen)].join(','));
    await p.ctx.close();
  });

  await test('repeated bookmark clicks keep one panel', async () => {
    const p = await page(); await p.evaluate(() => portal.open()); await click(p); await ready(p);
    for (let i = 0; i < 5; i++) await click(p);
    assert.equal(await p.evaluate(() => document.querySelectorAll('#mesai-host').length), 1);
    await p.ctx.close();
  });

  await test('today: Giriş is editable with or without an ARGE entry', async () => {
    const today = p => p.evaluate(() => { const r = window.__mesai.state().st.v.rows[1]; return { first: r.first, inside: r.inside, manual: !!r.manual }; });
    let p = await page(NOV3, { seed: seedFor(HANDOFF) }); await p.evaluate(() => portal.open()); await click(p); await ready(p);
    await p.click(H + '.tr[data-v="1"]');
    assert.equal(await p.isDisabled(H + '.ed [data-e="s"]'), false, 'entry field open even though ARGE has 08:23');
    await p.fill(H + '.ed [data-e="s"]', '08:10'); await p.press(H + '.ed [data-e="s"]', 'Enter');
    await until(p, async () => clk((await today(p)).first) === '08:10', 3000, 'typed 08:10 wins');
    assert.match(await sh(p, '.ed'), /ARGE 08:2[34]/); assert.match(await sh(p, '.ed .edh'), /elle giriş/);
    await p.ctx.close();
    // ARGE has nothing for today yet: 08:30 typed at 13:35 counts from 08:30, not from "now"
    p = await page(NOV3, { seed: seedFor({}) }); const db = JSON.parse(JSON.stringify(DB)); db['1001']['2026-11'] = db['1001']['2026-11'].filter(d => d.date !== '2026-11-03');
    await p.evaluate(d => { portal.setDB(d); portal.open(); }, db); await click(p); await ready(p);
    await p.click(H + '.tr[data-v="1"]');
    await p.fill(H + '.ed [data-e="s"]', '08:30'); await p.press(H + '.ed [data-e="s"]', 'Enter');
    await until(p, async () => { const t = await today(p); return clk(t.first) === '08:30' && t.inside; }, 3000, 'typed entry counts live');
    assert.match(await sh(p, '.ed'), /ARGE’de henüz yok/);
    await p.ctx.close();
  });
  await test('Friday: the headline is when 45 h complete; the forecast slot says when you may leave', async () => {
    const full = d => wk(d, [['08:30:00', 'G'], ['18:40:00', 'Ç']]);
    const db = { '1001': { '2026-10': [], '2026-11': [full('2026-11-02'), full('2026-11-03'), full('2026-11-04'), full('2026-11-05'), wk('2026-11-06', [['08:30:00', 'G']], { today: true })] } };
    for (const th of ['cizelge', 'knight', 'sutunlar', 'clock']) {
      const p = await page(Date.UTC(2026, 10, 6, 11, 0), { seed: seedFor({}, { theme: th }) });
      await p.evaluate(d => { portal.setDB(d); portal.open(); }, db); await click(p); await ready(p);
      const txt = await sh(p, '.w');
      assert.match(txt, /45 saat tamamlanır/, th); assert.match(txt, /12:50/, th); assert.match(txt, /Bugün çıkış/, th); assert.ok(!/9 saat tamamlanır/.test(txt), th);
      await p.ctx.close();
    }
  });
  await test('habits: suggests the usual arrival, applies only on click, can be hidden', async () => {
    const events = {}, months = { '2026-10': NOV3, '2026-11': NOV3 };
    for (let d = 5; d <= 30; d++) { const t0 = Date.UTC(2026, 9, d), w = (new Date(t0).getUTCDay() + 6) % 7; if (w > 4) continue;
      const k = new Date(t0).toISOString().slice(0, 10); events[k] = [{ t: t0 + 8 * 3600e3 + 25 * 60e3, k: 'G' }, { t: t0 + 18 * 3600e3, k: 'C' }]; }
    const p = await page(NOV3, { seed: seedFor({ events, months }) }); await p.evaluate(() => portal.open()); await click(p); await ready(p);
    await p.click(H + '.tr[data-v="2"]');
    assert.match(await sh(p, '.ed'), /Genelde Çarşamba günleri giriş: 08:25/);
    assert.equal(clk((await view(p)).rows[2].end), '18:00', 'nothing applied by itself');
    await p.click(H + '.ed [data-a="habit"]');
    await until(p, async () => clk((await view(p)).rows[2].end) === '17:25', 3000, 'applied on click');
    assert.ok(!/Genelde Çarşamba/.test(await sh(p, '.ed')), 'suggestion gone once used');
    await p.click(H + '.tr[data-v="3"]'); await p.click(H + '.ed [data-a="habitAll"]');
    await until(p, async () => clk((await view(p)).rows[3].end) === '17:25', 3000, 'rest of week');
    await p.click(H + '.hd [data-a="set"]'); assert.match(await sh(p, '.set'), /genelde giriş 08:25, çıkış 18:00/);
    await p.click(H + '.set [data-a="habitDef"]');
    assert.equal(await p.evaluate(() => window.__mesai.state().S.cfg.start), '08:25');
    await p.ctx.close();
  });
  await test('Sor follow-ups: chips build on the last answer; Turkish time suffixes', async () => {
    const p = await page(NOV3, { seed: seedFor(HANDOFF, { theme: 'cizelge', ask: true }) }); await p.evaluate(() => portal.open()); await click(p); await ready(p);
    await p.fill(H + '.askr [data-e="ask"]', 'cuma kaçta çıkarım'); await p.press(H + '.askr [data-e="ask"]', 'Enter');
    await until(p, async () => /Devam et/.test(await sh(p, '.ans') || ''), 3000, 'follow-up chips');
    const chips = await p.evaluate(() => [...document.getElementById('mesai-host').shadowRoot.querySelectorAll('.fup button')].map(b => b.textContent));
    assert.ok(chips.some(c => /^ya 0?\d:\d\d’(da|de|ta|te) gelirsem$/.test(c)), chips.join(' | '));
    assert.ok(chips.includes('ya 1 saat OOO alırsam'));
    await p.click(H + '.fup button:has-text("ya 1 saat OOO alırsam")');
    await until(p, async () => /önceki soruya göre/.test(await sh(p, '.ans') || ''), 3000, 'follow-up tag');
    // "Zorunlu saat ... 16:00’dan" (on altı), not 16:00’den
    await p.click(H + '[data-a="askClear"]').catch(() => 0);
    await p.click(H + '.tr[data-v="2"]'); await p.fill(H + '.ed [data-e="e"]', '15:00'); await p.press(H + '.ed [data-e="e"]', 'Enter');
    await until(p, async () => /16:00’dan önce bitemez/.test(await sh(p, '.ed') || ''), 3000, 'suffix');
    await p.ctx.close();
  });
  await test('warnings: forgotten exit and past-midnight work show a pill and a guidance note; portal lag hint', async () => {
    const db = { '1001': { '2026-10': [], '2026-11': [wk('2026-11-02', [['18:00:00', 'G']]), wk('2026-11-03', [['02:00:00', 'Ç'], ['09:00:00', 'G'], ['17:00:00', 'Ç']]), wk('2026-11-04', [['08:30:00', 'G']])] } };
    const p = await page(Date.UTC(2026, 10, 5, 11, 0), { seed: seedFor({}) }); await p.evaluate(d => { portal.setDB(d); portal.open(); }, db); await click(p); await ready(p);
    const n = await sh(p, '.notes'); assert.match(n, /Pzt 2 · gece yarısı/); assert.match(n, /Çar 4 · çıkış yok/);
    await p.click(H + '.notes [data-a="sel"][data-v="2"]');
    assert.match(await sh(p, '.ed'), /yöneticine veya ARGE birimine bildir/);
    await p.click(H + '.notes [data-a="sel"][data-v="0"]');
    assert.match(await sh(p, '.ed'), /Gece yarısını geçen çalışma/);
    await p.click(H + '.tr[data-v="3"]');
    assert.match(await sh(p, '.ed'), /10:00 ve 22:00’de günceller/, 'today, no entry yet after usual start');
    await p.ctx.close();
  });
  await test('day editor: Wednesday until 19:00 brings Friday to 17:19; type, OOO, reset', async () => {
    const p = await page(NOV3, { seed: seedFor(HANDOFF) }); await p.evaluate(() => portal.open()); await click(p); await ready(p);
    await p.click(H + '.tr[data-v="2"]');
    assert.match(await sh(p, '.ed .edh'), /Çarşamba/);
    await p.fill(H + '.ed [data-e="e"]', '19:00'); await p.press(H + '.ed [data-e="e"]', 'Enter');
    await until(p, async () => clk((await view(p)).fri) === '17:19', 3000, 'fri 17:19');
    await p.fill(H + '.ed [data-e="m"]', '9,5'); await p.press(H + '.ed [data-e="m"]', 'Enter');
    await until(p, async () => clk((await view(p)).rows[2].end) === '18:30', 3000, 'wed 18:30');
    await p.click(H + '.ed [data-a="nud"][data-v="15"]');
    await until(p, async () => clk((await view(p)).rows[2].end) === '18:45', 3000, 'nudge');
    await p.click(H + '.ed [data-a="type"][data-v="tatil"]');
    await until(p, async () => (await view(p)).rows[2].type === 'tatil', 3000, 'tatil');
    await p.click(H + '.ed [data-a="ooo"][data-v="30"]');
    await until(p, async () => (await view(p)).W === 46.5 * 3600000, 3000, 'ooo');
    await p.click(H + '.ed [data-a="dreset"]');
    await until(p, async () => (await view(p)).rows[2].type === 'ofis' && (await view(p)).W === 46 * 3600000, 3000, 'reset day');
    await p.click(H + '[data-a="undo"]');
    await until(p, async () => (await view(p)).rows[2].type === 'tatil', 3000, 'undo');
    await p.fill(H + '.ed [data-e="e"]', 'abc').catch(() => {});
    await p.ctx.close();
  });

  await test('a half-typed time survives the live refresh', async () => {
    const p = await page(NOV3, { seed: seedFor(HANDOFF) }); await p.evaluate(() => portal.open()); await click(p); await ready(p);
    await p.click(H + '.tr[data-v="2"]');
    await p.click(H + '.ed [data-e="e"]'); await p.keyboard.press('Control+A'); await p.keyboard.type('19');
    await p.evaluate(() => { window.__nowOverride = Date.UTC(2026, 10, 3, 13, 36, 30); });
    await p.waitForTimeout(2500);
    assert.equal(await p.evaluate(() => document.getElementById('mesai-host').shadowRoot.querySelector('.ed [data-e="e"]').value), '19');
    await p.ctx.close();
  });

  await test('Sor: "cuma 16:00’da çıkmak istiyorum" → Wednesday later; apply + undo', async () => {
    const p = await page(NOV3, { seed: seedFor(HANDOFF, { theme: 'sutunlar' }) }); await p.evaluate(() => portal.open()); await click(p); await ready(p);
    await p.click(H + '.hd [data-a="askOpen"]');
    await p.click(H + '.askp .sugs [data-v="2"]');
    const ans = await sh(p, '.ans');
    assert.match(ans, /Cuma 16:00 çıkış için/); assert.match(ans, /Çar 20:19/); assert.match(ans, /Cum 18:19 → Çar 20:19|→/);
    await p.click(H + '[data-a="askApply"]');
    await until(p, async () => clk((await view(p)).rows[4].end) === '16:00', 3000, 'applied');
    assert.match(await sh(p, '.toast'), /Uygulandı/);
    await p.click(H + '.toast [data-a="undo"]');
    await until(p, async () => clk((await view(p)).rows[4].end) === '18:19', 3000, 'undone');
    await p.ctx.close();
  });

  await test('Sor typed: "perşembe ofis, cuma izin" style questions', async () => {
    const p = await page(NOV3, { seed: seedFor(HANDOFF, { theme: 'cizelge', ask: true }) }); await p.evaluate(() => portal.open()); await click(p); await ready(p);
    await p.fill(H + '[data-e="ask"]', 'cuma izin alsam?'); await p.press(H + '[data-e="ask"]', 'Enter');
    assert.match(await sh(p, '.ans'), /Cuma İzin/);
    assert.match(await sh(p, '.ans'), /Çar 18:19/);
    await p.fill(H + '[data-e="ask"]', 'şimdi çıksam?'); await p.press(H + '[data-e="ask"]', 'Enter');
    assert.match(await sh(p, '.ans'), /En erken çıkış 16:00/);
    await p.fill(H + '[data-e="ask"]', 'blabla'); await p.press(H + '[data-e="ask"]', 'Enter');
    assert.match(await sh(p, '.ans'), /anlayamadım/);
    await p.ctx.close();
  });

  await test('reverse calc: Friday 17:00 → stay Wednesday until 19:19', async () => {
    const p = await page(NOV3, { seed: seedFor(HANDOFF) }); await p.evaluate(() => portal.open()); await click(p); await ready(p);
    await p.click(H + '.strip [data-a="rev"]');
    await until(p, async () => /Çarşamba 19:19’a kadar kal/.test(await sh(p, '.revp') || ''), 3000, 'rev');
    await p.click(H + '[data-a="revApply"]');
    await until(p, async () => clk((await view(p)).rows[4].end) === '17:00' && clk((await view(p)).rows[2].end) === '19:19', 3000, 'rev applied');
    await p.ctx.close();
  });

  await test('themes switch; EN + dark persist after reload', async () => {
    const p = await page(NOV3, { seed: seedFor(HANDOFF) }); await p.evaluate(() => portal.open()); await click(p); await ready(p);
    const isTheme = th => until(p, async () => (await p.evaluate(() => document.getElementById('mesai-host').shadowRoot.querySelector('.w').className)).includes('TH-' + th), 3000, th);
    // 3.3: theme, language and light/dark all live in the Görünüm menu (same in every theme)
    const look = async () => { if (!(await p.evaluate(() => !!document.getElementById('mesai-host').shadowRoot.querySelector('.theme-panel')))) await p.click(H + '.hd [data-a="themes"]'); };
    for (const th of ['sutunlar', 'knight', 'clock', 'cizelge']) { await look(); await p.click(H + `.theme-panel [data-a="theme"][data-v="${th}"]`); await isTheme(th); }
    await look();
    assert.equal(await p.evaluate(() => document.getElementById('mesai-host').shadowRoot.querySelectorAll('.theme-panel .theme-choice').length), 7, 'seven released themes (drafts hidden)');
    assert.equal(await p.evaluate(() => document.getElementById('mesai-host').shadowRoot.querySelectorAll('.hd .seg, .hd .sws').length), 0, 'language/theme live in Görünüm'); assert.equal(await p.evaluate(() => document.getElementById('mesai-host').shadowRoot.querySelectorAll('.hd [data-a="dark"]').length), 1, 'one light/dark button');
    await p.click(H + '.theme-panel [data-a="lang"][data-v="en"]'); await look(); await p.click(H + '.theme-panel [data-a="look"][data-v="dark"]');
    assert.match(await sh(p, '.side'), /9-hour target reached at/);
    await p.reload(); await p.evaluate(([db]) => { portal.setDB(db); portal.setDelay(200); portal.open(); }, [DB]); await click(p); await ready(p);
    const side = await sh(p, '.side'); assert.match(side, /Week done · 46 h/, JSON.stringify(side));
    assert.equal(await p.evaluate(() => window.__mesai.state().S.ui.look), 'dark');
    await p.ctx.close();
  });

  await test('Sor: "bugün 18:20 de çıkarsam kaç saat olur" answers the day length', async () => {
    const p = await page(NOV3, { seed: seedFor(HANDOFF) }); await p.evaluate(() => portal.open()); await click(p); await ready(p);
    await p.click(H + '.hd [data-a="askOpen"]'); await p.fill(H + '[data-e="ask"]', 'bugün 18:20 de çıkarsam kaç saat olur'); await p.press(H + '[data-e="ask"]', 'Enter');
    await until(p, async () => /9:56/.test(await sh(p, '.askp') || ''), 3000, 'answer 9:56 (08:23:07 → 18:20, seconds floored): ' + await sh(p, '.askp'));
    await p.ctx.close();
  });

  await test('a new user starts in Saydam', async () => {
    const p = await page(NOV3, { fresh: true }); await p.evaluate(() => portal.open()); await click(p); await ready(p);
    assert.equal(await p.evaluate(() => window.__mesai.state().S.ui.theme), 'saydam');
    await p.ctx.close();
  });

  await test('Saydam: sidebar days, exit on the day line, start/OOO steppers, hourglass, popovers, light only', async () => {
    const p = await page(NOV3, { seed: seedFor(HANDOFF, { theme: 'saydam', look: 'dark' }) }); await p.evaluate(() => portal.open()); await click(p); await ready(p);
    const q = s => p.evaluate(x => !!document.getElementById('mesai-host').shadowRoot.querySelector(x), s);
    assert.ok(await q('.w.TH-saydam.L-saydam .sy .sy-sb'), 'saydam window');
    assert.equal(await p.evaluate(() => document.getElementById('mesai-host').shadowRoot.querySelector('.w').dataset.dark), 'false', 'light only, even with dark chosen');
    assert.match(await sh(p, '.sy .lt'), /Salı 3 Kas/);
    // day line: a click at 19:00 sets Tuesday's exit
    const box = await p.evaluate(() => { const t = document.getElementById('mesai-host').shadowRoot.querySelector('.sy-trk[data-a="syt"]'), r = t.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, lo: +t.dataset.lo, span: +t.dataset.span }; });
    await p.mouse.click(box.x + (19 - box.lo) / box.span * box.w, box.y + box.h / 2);
    await until(p, async () => clk((await view(p)).rows[1].end) === '19:00', 3000, 'track 19:00');
    await p.focus(H + '.sy-trk[data-a="syt"]'); await p.keyboard.press('ArrowRight');
    await until(p, async () => clk((await view(p)).rows[1].end) === '19:05', 3000, 'arrow +5');
    // sidebar → Wednesday; Giriş stepper moves the planned start, Çıkış input sets the exit
    await p.click(H + '.sy-day[data-v="2"]'); assert.match(await sh(p, '.sy .lt'), /Çarşamba/);
    await p.fill(H + '.sy-bar [data-e="e"]', '19:00'); await p.press(H + '.sy-bar [data-e="e"]', 'Enter');
    await until(p, async () => clk((await view(p)).rows[2].end) === '19:00', 3000, 'wed 19:00');
    await p.click(H + '.sy-bar [data-a="nuds"][data-v="15"]');
    await until(p, async () => clk((await view(p)).rows[2].end) === '19:15', 3000, 'start +15 keeps the length');
    await p.click(H + '.sy-bar [data-a="ooo"][data-v="30"]');
    await until(p, async () => (await view(p)).W === 46.5 * 3600000, 3000, 'ooo');
    await p.click(H + '.sy-tl [data-a="dreset"]');
    await until(p, async () => (await view(p)).W === 46 * 3600000 && (await view(p)).rows[2].end !== null && clk((await view(p)).rows[2].end) !== '19:15', 3000, 'reset day');
    await p.click(H + '.sy-bar [data-a="type"][data-v="izin"]');
    await until(p, async () => (await view(p)).rows[2].type === 'izin', 3000, 'izin');
    assert.ok(await p.evaluate(() => document.getElementById('mesai-host').shadowRoot.querySelector('.sy-bar [data-e="s"]').disabled), 'leave day: times locked');
    await p.click(H + '.sy-foot [data-a="wreset"]');
    await until(p, async () => (await view(p)).rows[2].type === 'ofis', 3000, 'week reset');
    // hourglass: bands select days
    await p.click(H + '.sy-tb [data-a="syv"][data-v="kum"]'); assert.ok(await q('.sy-kum svg .band'), 'hourglass bands');
    await p.click(H + '.sy-kum .band[data-v="0"]'); assert.equal(await p.evaluate(() => window.__mesai.state().st.sel), 0);
    assert.equal(await p.evaluate(() => window.__mesai.state().S.ui.syv), 'kum', 'view remembered');
    // popovers open from their buttons and Escape closes them
    for (const [btn, sel] of [['hist', '.sy .hist'], ['themes', '.sy .theme-panel'], ['set', '.sy .set'], ['rev', '.sy .revp'], ['askOpen', '.sy-askpop']]) {
      await p.click(H + `.sy [data-a="${btn}"]`); assert.ok(await q(sel), btn + ' opens');
      await p.keyboard.press('Escape'); await until(p, async () => !(await q(sel)), 2000, btn + ' closes');
    }
    await p.click(H + '.sy [data-a="themes"]'); assert.match(await sh(p, '.theme-panel'), /yalnız açık/);
    await p.keyboard.press('Escape');
    await p.click(H + '.sy [data-a="askOpen"]'); await p.fill(H + '.sy-askpop [data-e="ask"]', 'cuma 16:00’da çıkmak istiyorum'); await p.press(H + '.sy-askpop [data-e="ask"]', 'Enter');
    await until(p, () => q('.sy-askpop [data-a="askApply"]'), 3000, 'ask answer');
    // traffic lights: compact and pocket keep the glass skin
    await p.keyboard.press('Escape');
    await p.click(H + '.sy .lights [data-a="cmp"]'); await until(p, () => q('.w.TH-saydam.T-compact .sy .sy-mini'), 3000, 'compact keeps Gün/Kum saati');
    await p.click(H + '[data-a="cmpx"]'); await until(p, () => q('.sy'), 3000, 'back to full');
    await p.click(H + '.sy .lights [data-a="min"]'); await until(p, () => q('.w.TH-saydam.T-pocket .pk'), 3000, 'pocket');
    await p.screenshot({ path: path.join(SHOTS, 'saydam.png') });
    await p.ctx.close();
  });

  await test('history lists saved weeks and opens one', async () => {
    const p = await page(NOV3, { seed: seedFor({ types: { '2026-10-29': 'tatil' } }) });
    await p.evaluate(() => portal.open({ keepPerson: true })); await click(p); await ready(p);
    await p.evaluate(() => { const s = document.querySelector('#Donem_Id'); s.value = '2026-10'; s.dispatchEvent(new Event('change')); });
    await until(p, async () => (await st(p)).period === '2026-10' && (await st(p)).code === 'ready', 8000, 'oct');
    await p.click(H + '.hd [data-a="hist"]');
    const h = await sh(p, '.hist');
    assert.match(h, /26 Eki – 30 Eki/); assert.match(h, /47:00 \/ 45/);
    await p.click(H + '.hrow');
    await until(p, async () => !(await sh(p, '.hist')), 3000, 'opened week');
    await p.ctx.close();
  });

  await test('settings: 09–16 preset and a 40 h week', async () => {
    const p = await page(NOV3, { seed: seedFor(HANDOFF) }); await p.evaluate(() => portal.open()); await click(p); await ready(p);
    await p.click(H + '.hd [data-a="set"]');
    await p.click(H + '.set [data-a="core"][data-s="09:00"]');
    await p.fill(H + '.set [data-c="W"]', '40'); await p.press(H + '.set [data-c="W"]', 'Enter');
    await until(p, async () => /40 \+ OOO 1:00 = 41 sa/.test(await sh(p, '.strip')), 3000, 'W 40');
    assert.match(await sh(p, '.strip'), /09:00–16:00/);
    await p.ctx.close();
  });

  await test('portal styles do not leak; narrow window stays on screen', async () => {
    const p = await page(NOV3, { vp: { width: 820, height: 640 } }); await p.evaluate(() => portal.open()); await click(p); await ready(p);
    const r = await p.evaluate(() => { const b = document.getElementById('mesai-host').shadowRoot.querySelector('.w').getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom, innerWidth]; });
    assert.ok(r[0] >= 0 && r[2] <= r[4], JSON.stringify(r));
    const f = await p.evaluate(() => getComputedStyle(document.getElementById('mesai-host').shadowRoot.querySelector('.big')).fontFamily);
    assert.ok(!/Tahoma/.test(f), f);
    await p.ctx.close();
  });

  await test('day rollover while open; collapse, expand, close', async () => {
    const p = await page(); await p.evaluate(() => portal.open()); await click(p); await ready(p);
    await p.evaluate(() => { window.__nowOverride = Date.UTC(2026, 10, 4, 8, 5); window.__mesai.poke(); });
    await until(p, async () => (await p.evaluate(() => window.__mesai.state().st.v.today.key)) === '2026-11-04', 4000, 'rollover');
    // minimize = Cep (pocket) in every theme; expand restores the previous size
    const w0 = await p.evaluate(() => document.getElementById('mesai-host').shadowRoot.querySelector('.w').getBoundingClientRect().width);
    await p.click(H + '.hd [data-a="min"]');
    await until(p, async () => (await p.evaluate(() => document.getElementById('mesai-host').shadowRoot.querySelector('.w').className)).includes('T-pocket'), 2000, 'pocket');
    assert.match(await sh(p, '.pk'), /Mesai/);
    await p.click(H + '.pk [data-a="cmpx"]');
    await until(p, async () => Math.round(await p.evaluate(() => document.getElementById('mesai-host').shadowRoot.querySelector('.w').getBoundingClientRect().width)) === Math.round(w0), 2000, 'restored');
    await p.click(H + '.hd [data-a="close"]');
    assert.equal(await p.evaluate(() => !!document.getElementById('mesai-host') || !!window.__mesai), false);
    await p.ctx.close();
  });

  const ask = async (p, q) => { await p.fill(H + '[data-e="ask"]', q); await p.press(H + '[data-e="ask"]', 'Enter'); await p.waitForTimeout(150); };
  const cls = p => p.evaluate(() => document.getElementById('mesai-host').shadowRoot.querySelector('.w').className);
  const box = p => p.evaluate(() => { const r = document.getElementById('mesai-host').shadowRoot.querySelector('.w').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; });

  await test('Sor v2: "her gün 10 saat yapsam cuma 8 de geldiğimde kaçta çıkarım" → 16:00 (core) + apply', async () => {
    const p = await page(NOV3, { seed: seedFor(HANDOFF, { theme: 'cizelge', ask: true }) }); await p.evaluate(() => portal.open()); await click(p); await ready(p);
    await ask(p, 'her gün 10 saat yapsam cuma 8 de geldiğimde kaçta çıkarım');
    const a = await sh(p, '.ans');
    assert.match(a, /Cuma 08:00 gelirsen/); assert.match(a, /16:00/); assert.match(a, /Zorunlu saat/); assert.match(a, /Anladığım/);
    assert.match(a, /Sal · 10 sa 00 dk/); assert.match(a, /Çar · 10 sa 00 dk/); assert.match(a, /Cum · 08:00 giriş/);
    await p.click(H + '[data-a="askApply"]');
    await until(p, async () => { const v = await view(p); return clk(v.rows[2].end) === '19:00'; }, 3000, 'applied 10h Wed');
    await ask(p, 'cuma 14te çıkmak için her gün kaç saat kalmalıyım');
    assert.match(await sh(p, '.ans'), /2 sa 00 dk OOO gerekir/); assert.match(await sh(p, '.ans'), /46 → 48 sa/);
    assert.equal(await sh(p, '[data-a="askApply"]'), null);
    await p.click(H + '[data-a="oooYes"]');
    assert.match(await sh(p, '.ans'), /günde/i); assert.match(await sh(p, '.ans'), /OOO 2 sa 00 dk \(onaylı\)/); assert.match(await sh(p, '.ans'), /Önizleme/);
    await ask(p, 'bu hafta kaç saat yaptım'); assert.match(await sh(p, '.ans'), /Bu hafta çalışılan/);
    await ask(p, 'kaç saat fazlam var'); assert.match(await sh(p, '.ans'), /\+0:41/);
    await ask(p, 'perşembe 15te çıkmak istiyorum kaçta gelmeliyim'); assert.match(await sh(p, '.ans'), /OOO gerekir/);
    await ask(p, 'if I work 10 hours every day and come in at 8 on Friday when can I leave');
    assert.match(await sh(p, '.ans'), /16:00/);
    await p.ctx.close();
  });

  await test('portal row ends at the first exit (real 3 Kas case): list counted, warning + choice shown', async () => {
    const DB2 = { '1001': { '2026-11': [wk('2026-11-02', [['08:05:29', 'G'], ['12:02:00', 'Ç'], ['12:58:39', 'G'], ['17:46:10', 'Ç']]),
      wk('2026-11-03', [['08:23:07', 'G'], ['11:56:54', 'Ç'], ['13:22:37', 'G'], ['17:38:02', 'Ç']], { officialLast: '11:56:54' }), wk('2026-11-04', [['07:09:16', 'G']], { today: true })] } };
    const p = await page(Date.UTC(2026, 10, 4, 10, 0)); await p.evaluate(db => { portal.setDB(db); portal.open(); }, DB2); await click(p); await ready(p);
    const v = await view(p); assert.equal(Math.floor(v.rows[1].plan / 60000), 554);
    assert.match(await sh(p, '.notes'), /Sal 3: portal 3:3\d · liste 9:14/);
    await p.click(H + '.notes [data-a="sel"][data-v="1"]');
    assert.match(await sh(p, '.ed'), /portal 3:3\d sayıyor \(08:23–11:56\), giriş-çıkış listesi 9:14 \(08:23–17:38\)/);
    assert.match(await sh(p, '.ed'), /Portal günü 11:56’da kapatmış, 13:22’deki tekrar girişten sonrasını saymamış/);
    assert.match(await sh(p, '.ed'), /ARGE’den Salı 3 Kas için düzeltme iste/);
    const b = await box(p); await p.screenshot({ path: path.join(SHOTS, 'v31-mismatch.png'), clip: { x: b.x - 12, y: b.y - 12, width: b.w + 24, height: Math.min(b.h, 880 - b.y) + 24 } });
    await p.click(H + '.ed [data-a="pick"][data-v="portal"]');
    await until(p, async () => Math.floor((await view(p)).rows[1].plan / 60000) >= 213 && Math.floor((await view(p)).rows[1].plan / 60000) <= 214, 2000, 'portal figure');
    await p.ctx.close();
  });

  await test('saved "Soru odaklı" and "Bilet" settings move to Çizelge (Sor panel kept open for Soru odaklı)', async () => {
    for (const [old, ask] of [['sor', true], ['bilet', false]]) {
      const p = await page(NOV3, { seed: seedFor(HANDOFF, { theme: old }) }); await p.evaluate(() => portal.open()); await click(p); await ready(p);
      const ui = await p.evaluate(() => window.__mesai.state().S.ui);
      assert.equal(ui.theme, 'cizelge', old); assert.equal(!!ui.ask, ask, old + ' ask');
      assert.ok((await cls(p)).includes('L-cizelge'));
      await p.ctx.close();
    }
  });

  await test('compact: one click in, one click out; questions still work', async () => {
    const p = await page(NOV3, { seed: seedFor(HANDOFF) }); await p.evaluate(() => portal.open()); await click(p); await ready(p);
    const b0 = await box(p);
    await p.click(H + '.hd [data-a="cmp"]');
    await until(p, async () => (await cls(p)).includes('T-compact'), 2000, 'compact');
    await p.waitForTimeout(250);
    const b1 = await box(p); assert.equal(Math.round(b1.w), 340); assert.ok(Math.abs(b1.r - b0.r) < 2, 'right edge kept');
    assert.match(await sh(p, '.cpt'), /9 saat tamamlanır/); assert.match(await sh(p, '.cpt'), /17:24/);
    await p.screenshot({ path: path.join(SHOTS, 'v31-compact.png'), clip: { x: b1.x - 14, y: b1.y - 14, width: b1.w + 28, height: b1.h + 28 } });
    await ask(p, 'yarın izinliyim cuma kaçta çıkarım');
    assert.match(await sh(p, '.cpt'), /Cuma çıkış/);
    await p.screenshot({ path: path.join(SHOTS, 'v31-compact-ask.png'), clip: await p.evaluate(() => { const r = document.getElementById('mesai-host').shadowRoot.querySelector('.w').getBoundingClientRect(); return { x: r.x - 14, y: r.y - 14, width: r.width + 28, height: r.height + 28 }; }) });
    await p.click(H + '[data-a="askClear"]');
    await p.click(H + '.hd [data-a="cmpx"]');
    await until(p, async () => (await cls(p)).includes('T-wide'), 2000, 'wide again');
    await p.waitForTimeout(250);
    assert.equal(Math.round((await box(p)).w), Math.round(b0.w));
    // persists
    await p.click(H + '.hd [data-a="cmp"]'); await until(p, async () => (await cls(p)).includes('T-compact'), 2000, 'compact again'); await p.reload(); await p.evaluate(([db]) => { portal.setDB(db); portal.setDelay(200); portal.open(); }, [DB]); await click(p); await ready(p).catch(() => 0);
    await until(p, async () => (await cls(p).catch(() => '')).includes('T-compact'), 4000, 'compact after reload ' + await p.evaluate(() => localStorage.getItem('mesai.v3').slice(0, 300)));
    await p.ctx.close();
  });

  await test('resize snaps to Geniş / Kompakt / Cep only; old free sizes migrate', async () => {
    let p = await page(NOV3, { seed: seedFor(HANDOFF) }); await p.evaluate(() => portal.open()); await click(p); await ready(p);
    const b0 = await box(p);
    const hp = await p.evaluate(() => { const r = document.getElementById('mesai-host').shadowRoot.querySelector('.rz-l').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await p.mouse.move(hp.x, hp.y); await p.mouse.down();
    const widths = new Set();
    for (let dx = 0; dx <= b0.w - 200; dx += 40) { await p.mouse.move(hp.x + dx, hp.y); widths.add(Math.round((await box(p)).w)); }
    assert.deepEqual([...widths].sort((a, b) => a - b), [220, 340, Math.round(b0.w)], 'only three widths while dragging: ' + [...widths]);
    assert.match(await sh(p, '.rzl'), /^Cep$/);
    await p.mouse.up();
    await until(p, async () => (await cls(p)).includes('T-pocket'), 2000, 'pocket');
    const b1 = await box(p); assert.equal(Math.round(b1.w), 220); assert.ok(Math.abs(b1.r - b0.r) < 2);
    assert.match(await sh(p, '.pk'), /17:24/);
    { const tx = await sh(p, '.w'); assert.ok(!/Mesai v.*Mesai v/s.test(tx), 'version shown once in the pocket: ' + tx); }
    await p.screenshot({ path: path.join(SHOTS, 'v31-pocket.png'), clip: { x: b1.x - 14, y: b1.y - 14, width: b1.w + 28, height: b1.h + 28 } });
    // keyboard on the corner handle steps between sizes; double-click goes back to Geniş
    await p.click(H + '[data-a="cmpx"]'); await until(p, async () => (await cls(p)).includes('T-wide'), 2000, 'wide');
    await p.focus(H + '.rz-br'); await p.keyboard.press('ArrowLeft');
    await until(p, async () => (await cls(p)).includes('T-compact'), 2000, 'arrow → compact');
    assert.match(await sh(p, '.cwk'), /9:41/, 'compact day boxes show hours');
    await p.dblclick(H + '.rz-br');
    await until(p, async () => (await cls(p)).includes('T-wide') && !(await cls(p)).includes('fixh'), 2000, 'reset');
    await p.ctx.close();
    // a width saved by 3.2 (free resizing) lands on the nearest size, never a squeezed layout
    for (const [w, want] of [[600, 'T-compact'], [900, 'T-wide'], [250, 'T-pocket']]) {
      p = await page(NOV3, { seed: seedFor(HANDOFF, { w, h: 500 }) }); await p.evaluate(() => portal.open()); await click(p); await until(p, async () => (await st(p))?.code === 'ready', 10000, 'ready ' + w);
      assert.ok((await cls(p)).includes(want), w + ' → ' + want + ' got ' + await cls(p));
      await p.ctx.close();
    }
  });

  await test('holidays: 28–29 Ekim count as 9 h; can be switched off', async () => {
    const OCT27 = Date.UTC(2026, 9, 27, 10, 0);
    const p = await page(OCT27); await p.evaluate(() => portal.open()); await click(p); await ready(p);
    await until(p, async () => (await view(p)).rows[3].type === 'tatil', 4000, 'holiday');
    const v = await view(p); assert.equal(v.rows[2].type, 'tatil'); assert.equal(v.rows[3].type, 'tatil');
    assert.match(await sh(p, '.tl'), /Cumhuriyet Bayramı/);
    await p.click(H + '.hd [data-a="set"]'); await p.click(H + '.set [data-a="holT"][data-v="0"]');
    await until(p, async () => (await view(p)).rows[3].type === 'ofis', 2000, 'off');
    await p.click(H + '.set [data-a="holT"][data-v="1"]');
    // a holiday you actually work: mark as office
    await p.click(H + '.tr[data-v="3"]').catch(() => 0);
    await p.ctx.close();
  });

  await test('Google Calendar .ics: leave + OOO picked up locally after confirmation', async () => {
    const p = await page(NOV3, { seed: seedFor({}) }); await p.evaluate(() => portal.open()); await click(p); await ready(p);
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261105', 'DTEND;VALUE=DATE:20261106', 'SUMMARY:Yıllık izin', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART:20261106T110000Z', 'DTEND:20261106T130000Z', 'SUMMARY:Out of office', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART:20261104T070000Z', 'DTEND:20261104T073000Z', 'SUMMARY:Team sync', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    await p.click(H + '.hd [data-a="set"]');
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click(H + '.set [data-a="ics"]')]);
    await fc.setFiles({ name: 'takvim.ics', mimeType: 'text/calendar', buffer: Buffer.from(ics) });
    await until(p, async () => /Takvimden bulunanlar/.test(await sh(p, '.imp') || ''), 3000, 'preview');
    const t = await sh(p, '.imp'); assert.match(t, /İzin/); assert.match(t, /OOO 14:00–16:00/); assert.ok(!/Team sync/.test(t));
    await p.click(H + '[data-a="impApply"]');
    await until(p, async () => (await view(p)).rows[3].type === 'izin', 2000, 'applied');
    assert.equal((await p.evaluate(() => window.__mesai.state().S.ppl['1001'].ooo['2026-11-06'])).m, 120);
    await p.ctx.close();
  });

  if (!process.env.ONLY) for (const [name, th, scheme] of [['cizelge', 'cizelge', 'light'], ['cizelge-dark', 'cizelge', 'dark'], ['sutunlar', 'sutunlar', 'light'], ['sutunlar-ask', 'sutunlar', 'dark', true], ['knight', 'knight', 'light'], ['knight-dark', 'knight', 'dark'], ['clock', 'clock', 'dark'], ['clock-light', 'clock', 'light']]) {
    const askOn = name === 'sutunlar-ask';
    const p = await page(NOV3, { scheme, seed: seedFor(HANDOFF, { theme: th, ask: askOn }) }); await p.evaluate(() => portal.open()); await click(p); await ready(p);
    await p.waitForTimeout(400);
    const box = await p.evaluate(() => { const r = document.getElementById('mesai-host').shadowRoot.querySelector('.w').getBoundingClientRect(); return { x: r.x - 14, y: r.y - 14, width: r.width + 28, height: r.height + 28 }; });
    await p.screenshot({ path: path.join(SHOTS, 'final-' + name + '.png'), clip: box });
    await p.ctx.close();
  }
  await browser.close();
  server.close();
  console.log(`\n${pass} browser checks passed${errors.length ? ', page errors: ' + errors.length : ''}`);
})();
