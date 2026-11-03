"""Keep the install bookmark in sync with the application, without remote loading."""
from pathlib import Path
from urllib.parse import quote

root = Path(__file__).resolve().parent
source = (root / 'mesai.js').read_text()
bookmark = 'javascript:' + quote(source, safe="~()*!.'-_")
template = (root / 'page.template.html').read_text()
assert template.count('__BOOKMARK_HREF__') == 1
# Attribute escaping matters even when the source has already been URL-encoded.
bookmark = bookmark.replace('&', '&amp;').replace('"', '&quot;')
(root / 'index.html').write_text(template.replace('__BOOKMARK_HREF__', bookmark))
print('Built index.html with a self-contained bookmark.')
