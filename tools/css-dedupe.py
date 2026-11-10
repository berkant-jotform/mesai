"""Remove dead CSS declarations: an earlier `selector { prop: … }` overridden later by the *same* selector setting the
*same* property with equal or higher importance can never win, so deleting it changes nothing on screen.
Files are treated in bundle order (heritage → manuscript → illuminated → motifs), each @media block separately.
python3 tools/css-dedupe.py          → report only
python3 tools/css-dedupe.py --write  → rewrite the files
"""
import re, sys, os
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'source', 'mesai', 'src')
FILES = ['heritage.css', 'manuscript.css', 'illuminated.css', 'motifs.css']
RULE = re.compile(r'([^{}]+)\{([^{}]*)\}')

def norm_sel(s): return ','.join(sorted(re.sub(r'\s+', ' ', x).strip() for x in s.split(',')))
def decls(body):
    out, depth, cur = [], 0, ''
    for ch in body:                     # split on ; outside parentheses (url(), calc(), etc.)
        if ch == '(': depth += 1
        if ch == ')': depth -= 1
        if ch == ';' and depth == 0: out.append(cur); cur = ''
        else: cur += ch
    if cur.strip(): out.append(cur)
    return [d for d in out if d.strip()]

def scan():
    items = []   # (file, ctx, start, end, selector, [decl...])
    for f in FILES:
        text = open(os.path.join(SRC, f)).read()
        # top level only; @media blocks get their own context
        pos, ctx = 0, f + ':top'
        for m in re.finditer(r'@media[^{]*\{((?:[^{}]*\{[^{}]*\})*)\s*\}', text):
            for r in RULE.finditer(m.group(1)):
                items.append((f, f + ':' + m.group(0)[:60], m.start(1) + r.start(), m.start(1) + r.end(), r.group(1), decls(r.group(2))))
        stripped = re.sub(r'@media[^{]*\{((?:[^{}]*\{[^{}]*\})*)\s*\}', lambda m: ' ' * len(m.group(0)), text)
        for r in RULE.finditer(stripped):
            sel = r.group(1)
            if sel.strip().startswith('@') or '/*' in sel and '*/' not in sel: continue
            items.append((f, 'top', r.start(), r.end(), re.sub(r'/\*.*?\*/', '', sel, flags=re.S), decls(r.group(2))))
    return items

def main(write):
    items = scan(); last = {}; dead = []
    order = sorted(range(len(items)), key=lambda i: (FILES.index(items[i][0]), items[i][2]))
    seen = {}
    for i in reversed(order):           # walk backwards: the first time we meet (ctx, sel, prop) is the winner
        f, ctx, a, b, sel, ds = items[i]
        key0 = (ctx if ctx != 'top' else 'top', norm_sel(sel))
        for d in ds:
            if ':' not in d: continue
            prop, val = d.split(':', 1); prop = prop.strip().lower(); imp = '!important' in val
            k = key0 + (prop,)
            if k in seen and (seen[k] or not imp): dead.append((i, d))
            elif k not in seen or imp and not seen[k]: seen.setdefault(k, imp)
    print(len(dead), 'dead declarations')
    if not write: return
    by_rule = {}
    for i, d in dead: by_rule.setdefault((items[i][0], items[i][2], items[i][3]), []).append(d)
    for f in FILES:
        rules = sorted([(a, b, ds) for (ff, a, b), ds in by_rule.items() if ff == f], key=lambda x: -x[0])
        if not rules: continue
        p = os.path.join(SRC, f); text = open(p).read()
        for a, b, ds in rules:          # each rule rewritten once, last-first, so positions stay valid
            head, body = text[a:b].split('{', 1); parts = [x for x in decls(body[:-1]) if x not in ds]
            text = text[:a] + ((head + '{' + ';'.join(parts) + '}') if parts else '') + text[b:]
        open(p, 'w').write(re.sub(r'\n{3,}', '\n\n', text))

if __name__ == '__main__':
    w = '--write' in sys.argv
    if w:
        main(True)
    main(False)
