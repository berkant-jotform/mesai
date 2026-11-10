// Builds dist/mesai.js (readable bundle), dist/mesai.min.js and dist/bookmarklet.txt
const fs = require('fs'), path = require('path');
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8').replace(/^if \(typeof module.*$/m, '');
const assets=path.resolve(__dirname,'../../assets');
// Optimized copies from tools/optimize-assets.py win; base64url keeps the bookmark from growing %2B/%2F/%3D escapes.
const asset=f=>{const a=path.join(assets,'web',f.replace(/\.webp$/,'.avif'));if(fs.existsSync(a))return fs.readFileSync(a).toString('base64url');const w=path.join(assets,'web',f);return fs.readFileSync(fs.existsSync(w)?w:path.join(assets,f)).toString('base64url');};
// Every space and brace costs 3 characters in the bookmark (%20); comments and layout whitespace go. Spaces before ':' stay (descendant selectors).
const cssMin=c=>c.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\s*\n\s*/g,'').replace(/\s*([{};,>])\s*/g,'$1').replace(/:\s+/g,':').replace(/;}/g,'}');
const artFiles={bzWeave:'bz-weave.webp',bzArrow:'bz-arrow.webp',preview_cizelge_light:'theme-preview-cizelge-light.webp',preview_cizelge_dark:'theme-preview-cizelge-dark.webp',preview_knight_light:'theme-preview-knight-light.webp',preview_knight_dark:'theme-preview-knight-dark.webp',preview_sutunlar_light:'theme-preview-sutunlar-light.webp',preview_sutunlar_dark:'theme-preview-sutunlar-dark.webp',preview_clock_light:'theme-preview-clock-light.webp',preview_clock_dark:'theme-preview-clock-dark.webp',preview_saydam_light:'theme-preview-saydam-light.webp',preview_bozkir_light:'theme-preview-bozkir-light.webp',preview_bozkira_light:'theme-preview-bozkira-light.webp',bzMountedWide:'bozkir-mounted-wide.webp',bzMountedCompact:'bozkir-mounted-compact.webp',bzStandingWide:'bozkir-standing-wide.webp',bzStandingCompact:'bozkir-standing-compact.webp',bar:'manuscript-bar.webp',controlDark:'control-frame-dark.webp',controlLight:'control-frame-light.webp',compactDark:'compact-plate-dark.webp',compactLight:'compact-plate-light.webp',plateLight:'manuscript-plate-light.webp',plateDark:'manuscript-plate-dark.webp',timeMarker:'time-marker.webp',fleuron:'fleuron.webp',face:'clock-face.webp',panelDark:'clock-panel-dark.webp',panelLight:'clock-panel-light.webp',railDark:'clock-rail-dark.webp',railLight:'clock-rail-light.webp',clock:'clock-ring-web.webp',town:'town-web.webp',toggle:'celestial-toggle.webp'};
const fontFiles={'Mesai Calligraphy':'almendra-bold.woff2','Mesai Gothic':'gothic.woff2','Mesai Manuscript':'almendra.woff2','Mesai Blackletter':'blackletter.woff2','Mesai Steppe':'NovaCut.woff2','Mesai Orkhon':'orkhon.woff2'};
const root=path.resolve(__dirname,'../..');
const release=JSON.parse(fs.readFileSync(path.join(root,'version.json'),'utf8'));
const version=release.version;
const themes={saydam:['Saydam','Saydam'],cizelge:['Çizelge','Timeline'],knight:['Şövalye','Knight'],sutunlar:['Sütunlar','Columns'],clock:['Göksel saat','Celestial clock'],bozkir:['Bozkır · atlı','Steppe · rider'],bozkira:['Bozkır · okçu','Steppe · archer']};
const themeAssets={saydam:[],cizelge:[],sutunlar:[],knight:['bar','controlDark','controlLight','compactDark','compactLight','plateLight','plateDark','timeMarker','fleuron','toggle'],clock:['bar','controlDark','controlLight','face','panelDark','panelLight','railDark','railLight','clock','town','toggle'],bozkir:['bzWeave','bzArrow','controlLight','bzMountedWide','bzMountedCompact','bzStandingWide','bzStandingCompact'],bozkira:['bzWeave','bzArrow','controlLight','bzMountedWide','bzMountedCompact','bzStandingWide','bzStandingCompact']};
const themeFonts={saydam:[],cizelge:[],sutunlar:[],knight:['Mesai Calligraphy','Mesai Gothic','Mesai Manuscript','Mesai Blackletter'],clock:['Mesai Calligraphy','Mesai Gothic','Mesai Manuscript'],bozkir:['Mesai Steppe','Mesai Orkhon'],bozkira:['Mesai Steppe','Mesai Orkhon']};
const css=cssMin(['heritage.css','manuscript.css','illuminated.css','motifs.css'].map(f=>fs.readFileSync(path.join(__dirname,'src',f),'utf8')).join('\n'));
const modules=['core.js','adapter.js','ask.js','scenario.js','holidays.js','i18n.js','themes.js','history.js','ui.js'].map(src).join('\n');
fs.mkdirSync(path.join(__dirname,'dist'),{recursive:true});fs.mkdirSync(path.join(root,'bookmarks'),{recursive:true});
(async()=>{
 const {minify}=require('terser'); const variants=[];
 for(const id of ['all',...Object.keys(themes)]){
  const keys=id==='all'?Object.keys(artFiles):themeAssets[id];
  const families=id==='all'?Object.keys(fontFiles):themeFonts[id];
  const art=Object.fromEntries(keys.map(k=>[k,'data:image/webp;base64,'+asset(artFiles[k])]));
  const fonts=Object.fromEntries(families.map(k=>[k,'data:font/woff2;base64,'+asset(fontFiles[k])]));
  const config={version,theme:id,catalog:release.themeCatalog};
  const prefix='var MesaiBuild='+JSON.stringify(config)+';var MesaiArt='+JSON.stringify(art)+';var MesaiFonts='+JSON.stringify(fonts)+';var MesaiHeritageCSS='+JSON.stringify(css)+';';
  const bundle="(function(){'use strict';\n"+prefix+modules+'\n})();\n';
  const out=await minify(bundle,{compress:{passes:2},mangle:true,format:{ascii_only:false}});
  const href='javascript:'+encodeURIComponent(out.code);
  // Project safety budget, not a promise about every browser's bookmark/sync path.
  if(href.length>1500000)throw new Error(id+' bookmark exceeds1500000-character project budget');
  const output=id==='all'?'mesai.js':'bookmarks/'+id+'.js';
  fs.writeFileSync(path.join(root,output),out.code);
  if(id==='all'){
   fs.writeFileSync(path.join(__dirname,'dist/mesai.js'),bundle);
   fs.writeFileSync(path.join(__dirname,'dist/mesai.min.js'),out.code);
   fs.writeFileSync(path.join(__dirname,'dist/bookmarklet.txt'),href);
  }
  const label=id==='all'?['Tüm temalar','All themes']:themes[id];
  variants.push({id,labelTr:label[0],labelEn:label[1],path:output,bytes:Buffer.byteLength(out.code),hrefBytes:href.length,assets:keys,fonts:families});
  console.log(id+': '+href.length+' bookmark characters; '+keys.length+' images, '+families.length+' fonts');
 }
 fs.writeFileSync(path.join(root,'bookmarks/manifest.json'),JSON.stringify({version,variants},null,2)+'\n');
})().catch(e=>{console.error(e);process.exit(1)});
