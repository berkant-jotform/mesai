// Dev screenshots of Mesai states: node tools/shot-saydam.js <outdir> [width] [height]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.join(__dirname, '..'), TEST = path.join(ROOT, 'source/mesai/test');
const BUNDLE = fs.readFileSync(path.join(ROOT, 'source/mesai/dist/mesai.min.js'), 'utf8');
const OUT = process.argv[2], VW = +(process.argv[3] || 1440), VH = +(process.argv[4] || 900);
const wk = (date, ev, x = {}) => ({ date, ev, ...x });
const DB = { '1001': { '2026-10': [], '2026-11': [wk('2026-11-02', [['08:05:29', 'G'], ['12:02:00', 'Ç'], ['12:58:39', 'G'], ['17:46:10', 'Ç']]), wk('2026-11-03', [['09:01:00', 'G'], ['18:31:00', 'Ç']]), wk('2026-11-04', [['08:23:07', 'G']], { today: true })] } };
if (process.env.SYDB) Object.assign(DB, JSON.parse(process.env.SYDB));
const NOW = Date.UTC(2026, 10, 4, 11, 35), STORE = { types: { '2026-11-06': 'izin' }, ooo: { '2026-11-04': { m: 60, s: 840 } } };
const STATES = JSON.parse(process.argv[5] || 'null') || [
  ['day', {}, ''], ['kum', { syv: 'kum' }, ''], ['past', {}, `q('[data-a="sel"][data-v="0"]').click()`], ['future', {}, `q('[data-a="sel"][data-v="3"]').click()`],
  ['leave', {}, `q('[data-a="sel"][data-v="4"]').click()`], ['settings', {}, `q('[data-a="set"]').click()`], ['themes', {}, `q('[data-a="themes"]').click()`],
  ['history', {}, `q('[data-a="hist"]').click()`], ['rev', {}, `q('[data-a="rev"]').click()`], ['ask', {}, `q('[data-a="askOpen"]').click()`],
  ['askans', {}, `q('[data-a="askOpen"]').click(); setTimeout(()=>q('[data-a="sug"][data-v="0"]').click(),200)`],
  ['compact', { cmp: true }, ''], ['pocket', { w: 220 }, '']];
const server = http.createServer((q, r) => fs.readFile(path.join(TEST, 'portal.html'), (e, d) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(d); })).listen(0);
(async () => {
  const b = await chromium.launch(); fs.mkdirSync(OUT, { recursive: true });
  for (const [name, ui, act] of STATES) {
    const ctx = await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
    await ctx.route('https://berkant-jotform.github.io/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(([n, seed]) => { window.__MESAI_NOW = () => n; localStorage.setItem('mesai.v3', JSON.stringify(seed)); }, [NOW, { ui: Object.assign({ lang: 'tr', theme: 'saydam' }, ui), ppl: { '1001': STORE } }]);
    await p.goto('http://127.0.0.1:' + server.address().port + '/portal.html');
    await p.evaluate(d => { portal.setDB(d); portal.setDelay(50); portal.open({ persons: [['1001', 'Örnek Kişi']] }); }, DB);
    await p.evaluate(BUNDLE); await p.waitForFunction(() => { const r = document.getElementById('mesai-host'); return r && r.shadowRoot.querySelector('.sy,.cpt,.pk'); }, null, { timeout: 15000 }).catch(() => console.log(name, 'not ready')); await p.waitForTimeout(500);
    if (act) { await p.evaluate(`(()=>{const q=s=>document.getElementById('mesai-host').shadowRoot.querySelector(s);${act}})()`); await p.waitForTimeout(700); }
    await p.screenshot({ path: path.join(OUT, name + '.png') });
    if (errs.length) console.log(name, 'ERR', errs);
    await ctx.close();
  }
  await b.close(); server.close(); console.log('done');
})();
