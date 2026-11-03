#!/usr/bin/env python3
# 把题干里残留的 LaTeX 公式片段替换成可直接阅读的写法
import glob
import json
import re

# (题目id, 正则, 替换文本, 说明)
RULES = [
    # ---------- 递推式 T(n) ----------
    ('2010L-62',
     re.compile(r'T\(n\)\{\s*begin\{array\}\{r\}\s*O（\s*　?\s*）\s*2T\(n/2\)\s*\+\s*nlgn\s*end\{array\}\s*binom\{n = 1\}\{n > 1\}\s*\.'),
     'T(n) = 2T(n/2) + n·lg n（n > 1），T(1) = O(1)'),
    ('2011H-64',
     re.compile(r'T\(n\)=\{\s*begin\{array\}\{r\}\s*O（\s*　?\s*）\s*6T\(\s*n/5\s*\)\s*\+\s*n\s*end\{array\}\s*binom\{n = 1\}\{n > 1\}\s*\.'),
     'T(n) = 6T(n/5) + n（n > 1），T(1) = O(1)'),
]

# KMP next 函数定义（三套卷共用同一段乱码）
KMP_DEF = ('next[j] = 0（j = 1）；'
           'next[j] = max{ k | 1 < k < j，且 p₁p₂…pₖ₋₁ = p_{j−k+1}p_{j−k+2}…p_{j−1} }；'
           'next[j] = 1（其他情况）')
RE_KMP = re.compile(r'next\[\s*j\]\s*=\s*\{\s*begin\{array\}\{r\}.*?end\{matrix\}', re.S)

# 矩阵连乘递推式（2016下 与 2019上 两套共用）
MAT_DEF = ('m[i,j] = 0（i ≥ j）；'
           'm[i,j] = min_{i ≤ k < j}{ m[i,k] + m[k+1,j] + pᵢ₋₁×pₖ×pⱼ }（i < j）')
RE_MAT16 = re.compile(r'm\[\s*i,j\s*\]\{.*?end\{matrix\}\s*end\{array\}\s*begin\{matrix\}.*?end\{matrix\}\s*\.', re.S)


def apply(text, qid, report):
    for rid, pat, rep in RULES:
        if rid == qid and pat.search(text):
            text = pat.sub(rep, text, count=1)
            report.append((qid, '递推式'))
    if qid in ('2011L-57', '2012H-58', '2014L-60') and RE_KMP.search(text):
        text = RE_KMP.sub(KMP_DEF, text, count=1)
        report.append((qid, 'next函数'))
    if qid in ('2016L-64', '2016L-65') and RE_MAT16.search(text):
        text = RE_MAT16.sub(MAT_DEF, text, count=1)
        report.append((qid, '矩阵连乘递推式'))
    return text


def main():
    report = []
    for f in sorted(glob.glob('src/data/areas/*.json')):
        data = json.load(open(f, encoding='utf-8'))
        dirty = False
        for q in data:
            s = q.get('stem') or ''
            ns = apply(s, q['id'], report)
            if ns != s:
                q['stem'] = ns
                dirty = True
        if dirty:
            with open(f, 'w', encoding='utf-8') as fh:
                json.dump(data, fh, ensure_ascii=False, indent=2)
                fh.write('\n')
    print('替换条数:', len(report))
    for r in report:
        print('  ', r)


if __name__ == '__main__':
    main()
