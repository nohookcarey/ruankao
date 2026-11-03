#!/usr/bin/env python3
# 第二批：逐题修正题干中的公式残迹
import glob
import json
import re

# 通用（安全）文本替换：出现在题干/选项里的固定乱码片段
GLOBAL = [
    ('A₁A₂·s Aₙ', 'A₁A₂…Aₙ'),
    ('A₁A₂{·s A}_k', 'A₁A₂…Aₖ'),
    ('Aₖ + 1Aₖ + 2·s Aₙ', 'Aₖ₊₁Aₖ₊₂…Aₙ'),
    ('AᵢAᵢ + 1·s Aⱼ', 'AᵢAᵢ₊₁…Aⱼ'),
    ('pᵢ - 1×pᵢ', 'pᵢ₋₁×pᵢ'),
    ('pᵢ-1×pᵢ', 'pᵢ₋₁×pᵢ'),
    ('( pᵢ-1 )*pᵢ', 'pᵢ₋₁×pᵢ'),
    ('Mᵢ,M_(i+1), …, Mⱼ', 'Mᵢ, Mᵢ₊₁, …, Mⱼ'),
    ('M_(i+1)', 'Mᵢ₊₁'),
    ('(A×B)*C', '(A×B)×C'),
    ('A*(B×C)', 'A×(B×C)'),
    ('⌈n/ . . 2⌉', '⌈n/2⌉'),
    ('(p₀p₁…… p₅)', '(p₀, p₁, …, p₅)'),
    ('A={a₁, a₂,..., aₙ和整数x', 'A={a₁, a₂, …, aₙ} 和整数 x'),
    ('bᵢ/2 + 1, bᵢ/2 + 2, ·s, bₙ, ', ''),
]

# 逐题替换（题干整段）
STEM = {
    '2011L-65': [
        ('T(n) { begin{array}{r} O（　）  7T(n/2) + n² end{array} binom{n = 1}{n > 1} .',
         'T(n) = 7T(n/2) + n²（n > 1），T(1) = O(1)'),
        ('T(n) { begin{array}{r} O（　）  aT(n/4) + n² end{array} binom{n = 1}{n > 1} .',
         'T(n) = aT(n/4) + n²（n > 1），T(1) = O(1)'),
    ],
    '2017H-53': [
        ('这题的52空，我觉得应该选A的，应为官方的书上定义写的很明确了。', ''),
    ],
}

# 2020L-65 选项重建（原题：n⁴, lg n, 2ⁿ, 1000n, n^(2/3), n! 从低到高排序）
OPTIONS = {
    '2020L-65': {
        'A': 'lg n, 1000n, n^(2/3), n⁴, n!, 2ⁿ',
        'B': 'n^(2/3), 1000n, lg n, n⁴, n!, 2ⁿ',
        'C': 'lg n, 1000n, n^(2/3), 2ⁿ, n⁴, n!',
        'D': 'lg n, n^(2/3), 1000n, n⁴, 2ⁿ, n!',
    },
}

hits = []
for f in sorted(glob.glob('src/data/areas/*.json')):
    data = json.load(open(f, encoding='utf-8'))
    dirty = False
    for q in data:
        qid = q['id']
        s = q.get('stem') or ''
        orig = s
        for a, b in GLOBAL:
            if a in s:
                s = s.replace(a, b)
                hits.append((qid, a[:18]))
        for a, b in STEM.get(qid, []):
            if a in s:
                s = s.replace(a, b)
                hits.append((qid, '题干段'))
        s = re.sub(r'[ \t]{2,}', ' ', s).strip()
        if s != orig:
            q['stem'] = s
            dirty = True
        if qid in OPTIONS:
            for o in (q.get('options') or []):
                nv = OPTIONS[qid].get(o['key'])
                if nv and nv != o.get('text'):
                    o['text'] = nv
                    dirty = True
                    hits.append((qid, '选项' + o['key']))
    if dirty:
        with open(f, 'w', encoding='utf-8') as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
            fh.write('\n')

print('替换', len(hits), '处')
for h in hits[:40]:
    print('  ', h)
