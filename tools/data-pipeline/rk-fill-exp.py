import json, glob, re

exp = json.load(open('/tmp/ocr3/all-exp.json', encoding='utf-8'))
TAG = {'2020L': (2020, 'L'), '2021H': (2021, 'H'), '2021L': (2021, 'L')}

# 下一题开始的标记：出现在解析里说明串题了，从这里截断
CUT_RES = [
    re.compile(r'\d{1,2}\s*[-－]\s*\d{1,2}\s*题?\s*[、.]'),
    re.compile(r'\n?\s*\d{1,2}\s*[、．.]\s*(?=[^\n]{0,40}[（(]\s*[)）])'),
]

# 高频 OCR 错字，只做不会改变语义的替换
OCR_FIX = [
    (re.compile(r'钓(?!鱼)'), '的'),
    (re.compile(r'旳'), '的'),
    (re.compile(r'叙还'), '叙述'),
    (re.compile(r'运鼻器'), '运算器'),
    (re.compile(r'不回丢失'), '不会丢失'),
    (re.compile(r'责饪'), '责任'),
]


def clean_exp(s: str) -> str:
    s = s.replace('\u3000', ' ')
    for pat in CUT_RES:
        m = pat.search(s)
        if m and m.start() > 20:
            s = s[:m.start()]
    for pat, rep in OCR_FIX:
        s = pat.sub(rep, s)
    # 合并被 OCR 拆断的行，但保留空行分段
    lines = [l.strip() for l in s.split('\n')]
    out = []
    for l in lines:
        if not l:
            if out and out[-1] != '':
                out.append('')
            continue
        out.append(l)
    s = '\n'.join(out).strip()
    # 中文断行直接拼接，英文/公式行保留换行
    s = re.sub(r'(?<=[\u4e00-\u9fa5，。、；：）])\n(?=[\u4e00-\u9fa5])', '', s)
    return s.strip()


stats = {}
filled = 0
for f in sorted(glob.glob('/Users/careynohook/WorkBuddy/2026-11-01-21-08-19/ruankao/src/data/areas/*.json')):
    data = json.load(open(f, encoding='utf-8'))
    dirty = False
    for q in data:
        if not q.get('year') or not q.get('no'):
            continue
        tag = None
        for t, (y, s) in TAG.items():
            if q['year'] == y and q.get('session') == s:
                tag = t
                break
        if not tag:
            continue
        if (q.get('explanation') or '').strip():
            continue
        item = exp[tag].get(str(q['no']))
        if not item:
            continue
        text = clean_exp(item['exp'])
        if len(text) < 10:
            continue
        q['explanation'] = text
        dirty = True
        filled += 1
        stats[tag] = stats.get(tag, 0) + 1

    if dirty:
        with open(f, 'w', encoding='utf-8') as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
            fh.write('\n')

print('补入解析:', filled, stats)
