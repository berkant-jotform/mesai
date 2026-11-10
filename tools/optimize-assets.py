"""Make the art and fonts that go inside the bookmark as small as they can be without visible loss.

Reads the originals in assets/ and writes optimized copies to assets/web/ (the build embeds those).
- Paintings: re-encoded WebP (quality 78, method 6) and, where the art is drawn far smaller than its
  pixel size, resized to twice its largest on-screen size.
- Fonts: subset to Latin + Turkish + the punctuation/arrows Mesai prints; variable axes kept.
Needs: pip install pillow fonttools brotli
"""
import io, os, sys
from PIL import Image
from fontTools import subset

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')
OUT = os.path.join(ROOT, 'web')
os.makedirs(OUT, exist_ok=True)

# file -> (max width, max height) at 2x of the largest on-screen size; None = keep pixel size
RESIZE = {
    'bozkir-mounted-wide.webp': (1400, 1400), 'bozkir-standing-wide.webp': (1400, 1400),          # Bozkır plates: same size as Knight's
    'bozkir-mounted-compact.webp': (680, 1000), 'bozkir-standing-compact.webp': (680, 1000),
    'celestial-toggle.webp': (132, 66),     # 66x32 toggle button
    'clock-face.webp': (440, 440),          # 56% of a 390px dial
    'fleuron.webp': (40, 40),               # 11-17px ornament
}
QUALITY = 78

# Large paintings ship as AVIF (about half the size of WebP at the same look); the loader sniffs the format.
AVIF = {'manuscript-plate-light.webp', 'manuscript-plate-dark.webp', 'compact-plate-light.webp', 'compact-plate-dark.webp',
        'clock-ring-web.webp', 'town-web.webp', 'clock-panel-light.webp', 'clock-panel-dark.webp', 'clock-rail-light.webp',
        'clock-rail-dark.webp', 'clock-face.webp',
        'bozkir-mounted-wide.webp', 'bozkir-mounted-compact.webp', 'bozkir-standing-wide.webp', 'bozkir-standing-compact.webp'}
AVIF_Q = 50

def avif(name):
    src = os.path.join(ROOT, name)
    im = Image.open(src); im.load()
    if name in RESIZE: im.thumbnail(RESIZE[name], Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'AVIF', quality=AVIF_Q)
    open(os.path.join(OUT, name[:-5] + '.avif'), 'wb').write(buf.getvalue())
    return os.path.getsize(src), len(buf.getvalue())

def webp(name):
    src = os.path.join(ROOT, name)
    im = Image.open(src); im.load()
    if name in RESIZE:
        im.thumbnail(RESIZE[name], Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=QUALITY, method=6)
    data = buf.getvalue()
    if len(data) >= os.path.getsize(src) and name not in RESIZE:   # never make a file bigger
        data = open(src, 'rb').read()
    open(os.path.join(OUT, name), 'wb').write(data)
    return os.path.getsize(src), len(data)

UNICODES = (list(range(0x20, 0x7F)) + list(range(0xA0, 0x180)) +          # Latin-1 + Latin Extended-A (Turkish)
            list(range(0x2010, 0x2028)) + list(range(0x2030, 0x203B)) +    # dashes, quotes, ellipsis, per mille
            list(range(0x2070, 0x20A0)) + [0x2190, 0x2191, 0x2192, 0x2193, 0x2212, 0x2713, 0x00B7])

def font(name):
    src = os.path.join(ROOT, name)
    opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['*']; opts.name_IDs = ['*']; opts.notdef_outline = True
    f = subset.load_font(src, opts)
    s = subset.Subsetter(opts)
    if name == 'orkhon.woff2': s.populate(text='\U00010C22\U00010C3E\U00010C00\U00010C03 ')   # Old Turkic: only the letters of the Mesai signature
    else: s.populate(unicodes=UNICODES)
    s.subset(f)
    dst = os.path.join(OUT, name); subset.save_font(f, dst, opts)
    return os.path.getsize(src), os.path.getsize(dst)

if __name__ == '__main__':
    names = sys.argv[1:] or sorted(n for n in os.listdir(ROOT) if n.endswith(('.webp', '.woff2')))
    total = [0, 0]
    for n in names:
        a, b = (font if n.endswith('.woff2') else avif if n in AVIF else webp)(n)
        total[0] += a; total[1] += b
        print(f'{a:8d} -> {b:8d}  {n}')
    print(f'{total[0]:8d} -> {total[1]:8d}  total')
