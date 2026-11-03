#!/usr/bin/env python3
# 公式类 OCR 残损的机械修复（保守规则，避免误伤代码与普通文本）
import glob
import json
import re

RULES = [
    # 箭头：OCR 把 → 读成「→>」「➝>」这类，箭头后面多出一个 >
    (re.compile(r'[→➝➔⇒⟶]\s*>'), '→'),
    # 集合/逻辑运算符
    (re.compile(r'[✕✖]'), '×'),
    (re.compile(r'¢'), '∉'),
    (re.compile(r'(?<=\d)F\s*\+'), 'F⁺'),
    (re.compile(r'F\s*\+\s*(?=[（(，,、。是的有])'), 'F⁺'),
    (re.compile(r'(U\d?)\s*[I1l]n\s*(U\d?)'), r'\1∩\2'),
    (re.compile(r'(U\d?)\s*[Uu]\s*(U\d?)'), r'\1∪\2'),
    (re.compile(r'(F\d?)\s*[Uu]\s*(F\d?)'), r'\1∪\2'),
    (re.compile(r'兀'), 'π'),
    # 全角花括号统一成半角，避免与正文混排
    (re.compile(r'｛'), '{'),
    (re.compile(r'｝'), '}'),
]

stats = {}


def fix(s):
    for pat, rep in RULES:
        s2 = pat.sub(rep, s)
        if s2 != s:
            stats[pat.pattern] = stats.get(pat.pattern, 0) + 1
            s = s2
    return s


n = 0
for f in sorted(glob.glob('src/data/areas/*.json')):
    data = json.load(open(f, encoding='utf-8'))
    dirty = False
    for q in data:
        for field in ('explanation', 'stem'):
            v = q.get(field)
            if isinstance(v, str) and v:
                nv = fix(v)
                if nv != v:
                    q[field] = nv
                    dirty = True
                    n += 1
    if dirty:
        with open(f, 'w', encoding='utf-8') as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
            fh.write('\n')

print('改动字段数:', n)
for k, v in sorted(stats.items(), key=lambda x: -x[1]):
    print(f'  {k}  {v}')
