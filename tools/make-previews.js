// Theme chooser thumbnails from real Mesai renders (sample data, neutral name), so previews never drift from the themes.
// Run after `npm run build`:  node tools/make-previews.js   → assets/theme-preview-<theme>-<light|dark>.webp
// Then: python3 tools/optimize-assets.py theme-preview-*.webp  and  npm run build  (the bookmark embeds them).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), TEST = path.join(ROOT, 'source/mesai/test'), ASSETS = path.join(ROOT, 'assets');
const BUNDLE = fs.readFileSync(path.join(ROOT, 'source/mesai/dist/mesai.min.js'), 'utf8');
const ONLY = process.argv[2];   // optional: one theme
const TH = require(path.join(ROOT, 'source/mesai/src/themes.js'));
const THEMES = TH.ORDER.filter(t => !ONLY || t === ONLY);
const wk = (date, ev, x = {}) => ({ date, ev, ...x });
const DB = { '1001': { '2026-10': [], '2026-11': [wk('2026-11-02', [['08:05:29', 'G'], ['12:02:00', 'Ç'], ['12:58:39', 'G'], ['17:46:10', 'Ç']]), wk('2026-11-03', [['08:23:07', 'G']], { today: true })] } };
const NOW = Date.UTC(2026, 10, 3, 13, 35), STORE = { types: { '2026-11-05': 'izin' }, ooo: { '2026-11-03': { m: 60, s: 840 } } };
const W = 320, H = 200;   // 16:10, drawn at about this size in the Görünüm panel

const server = http.createServer((q, r) => fs.readFile(path.join(TEST, 'portal.html'), (e, d) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(d); })).listen(0);
(async () => {
  const b = await chromium.launch(), tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'mesai-prev-'));
  for (const theme of THEMES) for (const scheme of TH.T[theme].lightOnly ? ['light'] : ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: scheme, deviceScaleFactor: 1 });
    await ctx.route('https://berkant-jotform.github.io/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    const p = await ctx.newPage();
    await p.addInitScript(([n, seed]) => { window.__MESAI_NOW = () => n; localStorage.setItem('mesai.v3', JSON.stringify(seed)); },
      [NOW, { ui: { lang: 'tr', theme, look: scheme }, ppl: { '1001': STORE } }]);
    await p.goto('http://127.0.0.1:' + server.address().port + '/portal.html');
    await p.evaluate(d => { portal.setDB(d); portal.setDelay(50); portal.open({ persons: [['1001', 'Örnek Kişi']] }); }, DB);
    await p.evaluate(BUNDLE); await p.waitForTimeout(2500);
    const r = await p.evaluate(() => { const e = document.getElementById('mesai-host').shadowRoot.querySelector('.w').getBoundingClientRect(); return { x: e.x, y: e.y, w: e.width, h: e.height }; });
    const h = Math.min(r.h, Math.round(r.w * H / W)), png = path.join(tmp, theme + '-' + scheme + '.png');
    await p.screenshot({ path: png, clip: { x: r.x, y: r.y, width: r.w, height: h } });
    await ctx.close();
    const out = path.join(ASSETS, 'theme-preview-' + theme + '-' + scheme + '.webp');
    execFileSync('python3', ['-c', `from PIL import Image\nim=Image.open(${JSON.stringify(png)}).convert('RGB')\nbg=Image.new('RGB',(${W},${H}),im.getpixel((2,2)))\nim.thumbnail((${W},${H}),Image.LANCZOS)\nbg.paste(im,((${W}-im.width)//2,0))\nbg.save(${JSON.stringify(out)},'WEBP',quality=82,method=6)`]);
    console.log('wrote', path.relative(ROOT, out));
  }
  await b.close(); server.close();
})();
