// Verify the files colleagues install, independently of build-time accounting.
// Run after npm run build; this test never executes app/DOM code or uses a browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const acorn = require('acorn');
const root = path.resolve(__dirname, '../../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const version = json('version.json').version;
const manifest = json('bookmarks/manifest.json');
const expectedIds = ['all','saydam','cizelge','knight','sutunlar','clock','bozkir','bozkira'];
const budget = 1500000;
let assertions = 0;
const check = (condition, message) => { assertions++; assert.ok(condition, message); };
const same = (actual, expected, message) => { assertions++; assert.deepEqual(actual, expected, message); };
const inspect = code => {
  new vm.Script(code); // grammar only; no execution of the application
  const ast = acorn.parse(code, {ecmaVersion:'latest'});
  const stack = [ast], images = {}, fonts = {}, identities = [], unsafe = [];
  while (stack.length) {
    const node = stack.pop();
    if (node.type === 'ObjectExpression') {
      const literals = Object.fromEntries(node.properties.filter(p => p.type === 'Property' && !p.computed && p.value.type === 'Literal').map(p => [p.key.name || p.key.value,p.value.value]));
      if (typeof literals.version === 'string' && typeof literals.theme === 'string') identities.push(literals);
      for (const [key,value] of Object.entries(literals)) {
        if (typeof value !== 'string') continue;
        if (/^data:image\//.test(value)) images[key] = value;
        if (/^data:font\//.test(value)) fonts[key] = value;
      }
    }
    if (node.type === 'ImportExpression') unsafe.push('dynamic import');
    if ((node.type === 'CallExpression' || node.type === 'NewExpression') && node.callee.type === 'Identifier' && ['eval','Function'].includes(node.callee.name)) unsafe.push(node.callee.name);
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && !node.callee.computed && node.callee.property.name === 'createElement' && node.arguments[0]?.value === 'script') unsafe.push('script element loader');
    for (const [key,value] of Object.entries(node)) {
      if (key === 'start' || key === 'end') continue;
      if (Array.isArray(value)) {
        for (const item of value) if (item && typeof item.type === 'string') stack.push(item);
      } else if (value && typeof value.type === 'string') stack.push(value);
    }
  }
  return {images,fonts,identities,unsafe};
};
const sorted = values => [...values].sort();
const bytesOf = uri => Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64url');
check(/^\d+\.\d+\.\d+$/.test(version), 'Release version is semver');
same(manifest.version,version,'Manifest agrees with version.json');
same(json('package.json').version,version,'Package agrees with release');
const lock = json('package-lock.json');
same(lock.version,version,'Lockfile agrees with release');
same(lock.packages[''].version,version,'Lockfile root package agrees with release');
check(Array.isArray(manifest.variants),'Manifest lists variants');
same(sorted(manifest.variants.map(v => v.id)),sorted(expectedIds),'All advertised variants exist exactly once');
const built = new Map();
for (const variant of manifest.variants) {
  const {id} = variant;
  same(variant.path,id === 'all' ? 'mesai.js' : `bookmarks/${id}.js`,`${id}: bounded advertised path`);
  check(typeof variant.labelTr === 'string' && variant.labelTr.trim().length > 0,`${id}: Turkish label`);
  check(typeof variant.labelEn === 'string' && variant.labelEn.trim().length > 0,`${id}: English label`);
  const code = read(variant.path), href = 'javascript:' + encodeURIComponent(code);
  built.set(id,{code,href,variant});
  same(Buffer.byteLength(code),variant.bytes,`${id}: actual app bytes match manifest`);
  same(Buffer.byteLength(href),variant.hrefBytes,`${id}: actual encoded URL bytes match manifest`);
  same(href.length,Buffer.byteLength(href),`${id}: encoded URL is ASCII`);
  check(href.length <= budget,`${id}: actual final URL fits project budget`);
  same(decodeURIComponent(href.slice(11)),code,`${id}: encoded URL round trips`);
  const result = inspect(code);
  check(result.identities.some(v => v.version === version && v.theme === id),`${id}: built application carries correct distribution identity`);
  same(result.unsafe,[],`${id}: no eval/import/script injection bootstrap`);
  check(Array.isArray(variant.assets) && new Set(variant.assets).size === variant.assets.length,`${id}: unique asset names`);
  check(Array.isArray(variant.fonts) && new Set(variant.fonts).size === variant.fonts.length,`${id}: unique font names`);
  same(sorted(Object.keys(result.images)),sorted(variant.assets),`${id}: embedded images match advertised resources`);
  same(sorted(Object.keys(result.fonts)),sorted(variant.fonts),`${id}: embedded fonts match advertised resources`);
  for (const [name,uri] of Object.entries(result.images)) {
    const b = bytesOf(uri);
    const avif = b.subarray(4,8).toString() === 'ftyp' && ['avif','avis'].includes(b.subarray(8,12).toString());
    const webp = b.subarray(0,4).toString() === 'RIFF' && b.subarray(8,12).toString() === 'WEBP';
    check(avif || webp,`${id}/${name}: valid embedded container signature`);
  }
  for (const [name,uri] of Object.entries(result.fonts)) same(bytesOf(uri).subarray(0,4).toString(),'wOF2',`${id}/${name}: WOFF2 signature`);
  if (['saydam','cizelge','sutunlar'].includes(id)) {
    same(Object.keys(result.images),[],`${id}: no other theme's artwork shipped`);
    same(Object.keys(result.fonts),[],`${id}: no other theme's fonts shipped`);
  }
  if (id === 'bozkir' || id === 'bozkira') {
    same(sorted(Object.keys(result.images)),['bzMountedCompact','bzMountedWide','bzStandingCompact','bzStandingWide'],`${id}: both switchable views in wide/compact`);
    same(sorted(Object.keys(result.fonts)),['Mesai Orkhon','Mesai Steppe'],`${id}: only its display/signature fonts`);
  }
  if (id !== 'all') {
    check(!variant.assets.some(k => k.startsWith('preview_')),`${id}: no unused picker thumbnails shipped`);
    check(!variant.assets.some(k => /^bz/.test(k) && !['bozkir','bozkira'].includes(id)),`${id}: no Bozkır artwork in unrelated variants`);
  }
  console.log(`${id}: ${href.length.toLocaleString('en-US')} encoded URL bytes; ${variant.assets.length} images, ${variant.fonts.length} fonts`);
}
const all = built.get('all');
same(read('source/mesai/dist/mesai.min.js'),all.code,'Full minified build equals published mesai.js');
same(read('source/mesai/dist/bookmarklet.txt'),all.href,'Full dist bookmark equals encoded published app');
// Extract only the install link attribute; never log the multi-megabyte URL.
const html = read('index.html');
const tag = html.match(/<a\b[^>]*\bid=["']bookmark["'][^>]*>/);
check(tag,'Installation page contains the bookmark anchor');
const attr = tag[0].match(/\bhref="([^"]*)"/);
check(attr,'Bookmark anchor has a double-quoted href');
const href = attr[1].replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&');
same(href,all.href,'Primary installer always contains the full package');
const latest = html.match(/class="latest"[\s\S]*?<b>([^<]+)<\/b>/);
same(latest?.[1],version,'Visible latest-version label matches installed release');
check(!/__VERSION__|__BOOKMARK_HREF__/.test(html),'No unexpanded template tokens remain');
console.log(`${assertions} distribution assertions passed`);
