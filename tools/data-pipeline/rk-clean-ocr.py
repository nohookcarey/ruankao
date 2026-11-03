#!/usr/bin/env python3
# 全库 OCR 错字清洗（针对解析、题干、选项）
import glob
import json
import re

RULES = [
    (re.compile(r'钓(?!鱼)'), '的'),
    (re.compile(r'描还'), '描述'),
    (re.compile(r'叙还'), '叙述'),
    (re.compile(r'程字'), '程序'),
    (re.compile(r'运鼻器'), '运算器'),
    (re.compile(r'兀余'), '冗余'),
    (re.compile(r'兀'), 'π'),
    (re.compile(r'(?<=[）)])\s*[前附]\s*正确'), '的正确'),
    (re.compile(r'旳'), '的'),
    (re.compile(r'责饪'), '责任'),
    (re.compile(r'不回丢失'), '不会丢失'),
]

# 只清洗解析与题干，选项是结构化文本、误伤风险高
FIELDS = ('explanation', 'stem')
stats = {}


def fix(s):
    for pat, rep in RULES:
        s2 = pat.sub(rep, s)
        if s2 != s:
            stats[pat.pattern] = stats.get(pat.pattern, 0) + 1
            s = s2
    return s


changed = 0
for f in sorted(glob.glob('src/data/areas/*.json')):
    data = json.load(open(f, encoding='utf-8'))
    dirty = False
    for q in data:
        for field in FIELDS:
            v = q.get(field)
            if not isinstance(v, str):
                continue
            nv = fix(v)
            if nv != v:
                q[field] = nv
                dirty = True
        # 案例题参考答案
        for sub in (q.get('subQuestions') or []):
            for field in ('reference',):
                v = sub.get(field)
                if isinstance(v, str):
                    nv = fix(v)
                    if nv != v:
                        sub[field] = nv
                        dirty = True
    if dirty:
        with open(f, 'w', encoding='utf-8') as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
            fh.write('\n')
        changed += 1

print('改动文件数:', changed)
for k, v in sorted(stats.items(), key=lambda x: -x[1]):
    print(f'  {k}  {v}')
