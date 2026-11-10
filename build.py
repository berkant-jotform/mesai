"""Keep the install bookmark in sync with the application, without remote loading."""
from pathlib import Path
import json
import re
from urllib.parse import quote

root = Path(__file__).resolve().parent
source = (root / 'mesai.js').read_text()
bookmark = 'javascript:' + quote(source, safe="~()*!.'-_")
# Project safety budget; browser bookmark storage/sync support is checked separately.
assert len(bookmark) <= 1_500_000, f'bookmark is {len(bookmark):,} chars, over the 1,500,000 budget'
template = (root / 'page.template.html').read_text()
assert template.count('__BOOKMARK_HREF__') == 1
# Attribute escaping matters even when the source has already been URL-encoded.
bookmark = bookmark.replace('&', '&amp;').replace('"', '&quot;')
version = json.loads((root / 'version.json').read_text())['version']   # the page always shows the version it installs
(root / 'index.html').write_text(template.replace('__BOOKMARK_HREF__', bookmark).replace('__VERSION__', version))
preview = root / 'preview.html'
preview.write_text(re.sub(r'(src="(?:mesai|preview)\.js)\?v=[^"]*', lambda m: m[1] + '?v=' + version, preview.read_text()))
print('Built index.html with a self-contained bookmark.')
