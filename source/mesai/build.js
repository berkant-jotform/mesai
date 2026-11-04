// Builds dist/mesai.js (readable bundle), dist/mesai.min.js and dist/bookmarklet.txt
const fs = require('fs'), path = require('path');
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8').replace(/^if \(typeof module.*$/m, '');
const assets=path.resolve(__dirname,'../../assets');
const art={};
for(const [key,file] of Object.entries({panelDark:'clock-panel-dark.webp',panelLight:'clock-panel-light.webp',railDark:'clock-rail-dark.webp',railLight:'clock-rail-light.webp',initial:'manuscript-initial.webp',knight:'knight-manuscript-web.webp',clock:'clock-ring-web.webp',flourish:'flourish-web.webp',town:'town-web.webp',toggle:'celestial-toggle.webp'})) art[key]='data:image/webp;base64,'+fs.readFileSync(path.join(assets,file)).toString('base64');
const fonts={};
for(const [family,file] of Object.entries({'Mesai Manuscript':'manuscript.woff2','Mesai Blackletter':'blackletter.woff2'})) fonts[family]='data:font/woff2;base64,'+fs.readFileSync(path.join(assets,file)).toString('base64');
const artCode='var MesaiArt='+JSON.stringify(art)+';var MesaiFonts='+JSON.stringify(fonts)+';var MesaiHeritageCSS='+JSON.stringify(fs.readFileSync(path.join(__dirname,'src/heritage.css'),'utf8'))+';';
const bundle = "(function(){'use strict';\n" + artCode + ['core.js', 'adapter.js', 'ask.js', 'scenario.js', 'holidays.js', 'i18n.js', 'themes.js', 'ui.js'].map(src).join('\n') + '\n})();\n';
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist/mesai.js'), bundle);
(async () => {
  const { minify } = require('terser');
  const out = await minify(bundle, { compress: { passes: 2 }, mangle: true, format: { ascii_only: false } });
  fs.writeFileSync(path.join(__dirname, 'dist/mesai.min.js'), out.code);
  const href = 'javascript:' + encodeURIComponent(out.code);
  fs.writeFileSync(path.join(__dirname, 'dist/bookmarklet.txt'), href);
  console.log('bundle', bundle.length, 'min', out.code.length, 'href', href.length);
})();
