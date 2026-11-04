// Builds dist/mesai.js (readable bundle), dist/mesai.min.js and dist/bookmarklet.txt
const fs = require('fs'), path = require('path');
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8').replace(/^if \(typeof module.*$/m, '');
const assets=path.resolve(__dirname,'../../assets');
const art={};
for(const [key,file] of Object.entries({bar:'manuscript-bar.webp',controlDark:'control-frame-dark.webp',controlLight:'control-frame-light.webp',compactDark:'compact-plate-dark.webp',compactLight:'compact-plate-light.webp',plateLight:'manuscript-plate-light.webp',plateDark:'manuscript-plate-dark.webp',timeMarker:'time-marker.webp',fleuron:'fleuron.webp',face:'clock-face.webp',panelDark:'clock-panel-dark.webp',panelLight:'clock-panel-light.webp',railDark:'clock-rail-dark.webp',railLight:'clock-rail-light.webp',clock:'clock-ring-web.webp',flourish:'flourish-web.webp',town:'town-web.webp',toggle:'celestial-toggle.webp'})) art[key]='data:image/webp;base64,'+fs.readFileSync(path.join(assets,file)).toString('base64');
const fonts={};
for(const [family,file] of Object.entries({'Mesai Calligraphy':'almendra-bold.woff2','Mesai Gothic':'gothic.woff2','Mesai Manuscript':'almendra.woff2','Mesai Blackletter':'blackletter.woff2'})) fonts[family]='data:font/woff2;base64,'+fs.readFileSync(path.join(assets,file)).toString('base64');
const artCode='var MesaiArt='+JSON.stringify(art)+';var MesaiFonts='+JSON.stringify(fonts)+';var MesaiHeritageCSS='+JSON.stringify(fs.readFileSync(path.join(__dirname,'src/heritage.css'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'src/manuscript.css'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'src/illuminated.css'),'utf8'))+';';
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
