#!/usr/bin/env python3
# 把题干/选项/解析里的 LaTeX 式下标与残迹转成可直接阅读的 Unicode 记号
import glob
import json
import re

SUB = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    'i': 'ᵢ', 'j': 'ⱼ', 'm': 'ₘ', 'n': 'ₙ', 'k': 'ₖ',
}

GREEK = 'πσραβθλμ'

RE_MATRIX = re.compile(r'([A-Z])_([a-z])\s*[*×]\s*([a-z])(?![A-Za-z0-9])')
RE_SUB = re.compile(r'([A-Za-z%s])_\{?([0-9ijkmn])\}?(?![0-9])' % GREEK)

RE_LATEX = [
    (re.compile(r'\{\}'), ''),
    (re.compile(r'\^\{?(\d|n)\}?'), lambda m: {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','n':'ⁿ'}[m.group(1)]),
    (re.compile(r'\s*lceil\s*'), '⌈'),
    (re.compile(r'\s*rfloor'), '⌉'),
    (re.compile(r'\\lceil\s*'), '⌈'),
    (re.compile(r'\\rfloor'), '⌉'),
    (re.compile(r'(?<=[\w₀-₉]) ?\* ?(?=[\w₀-₉])'), '×'),
    (re.compile(r'\\times'), '×'),
    (re.compile(r'\\le\b'), '≤'),
    (re.compile(r'\\ge\b'), '≥'),
]


def fix(s):
    # A_m*n -> A(m×n)
    s = RE_MATRIX.sub(lambda m: f'{m.group(1)}({m.group(2)}×{m.group(3)})', s)
    s = RE_SUB.sub(lambda m: m.group(1) + SUB[m.group(2)], s)
    for pat, rep in RE_LATEX:
        s = pat.sub(rep, s)
    return s


def main():
    n = 0
    for f in sorted(glob.glob('src/data/areas/*.json')):
        data = json.load(open(f, encoding='utf-8'))
        dirty = False
        for q in data:
            for field in ('stem', 'explanation'):
                v = q.get(field)
                if isinstance(v, str) and v:
                    nv = fix(v)
                    if nv != v:
                        q[field] = nv
                        dirty = True
                        n += 1
            for o in (q.get('options') or []):
                t = o.get('text')
                if isinstance(t, str) and t:
                    nt = fix(t)
                    if nt != t:
                        o['text'] = nt
                        dirty = True
                        n += 1
        if dirty:
            with open(f, 'w', encoding='utf-8') as fh:
                json.dump(data, fh, ensure_ascii=False, indent=2)
                fh.write('\n')
    print('改动字段数:', n)


if __name__ == '__main__':
    main()
