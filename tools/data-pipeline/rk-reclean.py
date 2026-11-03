import json, glob, re

CUT_RES = [
    re.compile(r'\d{1,2}\s*[-－]\s*\d{1,2}\s*题?\s*[、.]'),
    re.compile(r'\n\s*\d{1,2}\s*[、．.]\s*(?=[^\n]{0,40}[（(]\s*[)）])'),
]
OCR_FIX = [
    (re.compile(r'钓(?!鱼)'), '的'),
    (re.compile(r'旳'), '的'),
    (re.compile(r'叙还'), '叙述'),
    (re.compile(r'运鼻器'), '运算器'),
    (re.compile(r'不回丢失'), '不会丢失'),
    (re.compile(r'责饪'), '责任'),
]

def clean(s):
    orig = s
    for pat in CUT_RES:
        m = pat.search(s)
        if m and m.start() >= 8:
            cut = s[:m.start()].strip()
            if len(cut) >= 12:
                s = cut
    for pat, rep in OCR_FIX:
        s = pat.sub(rep, s)
    s = re.sub(r'(?<=[\u4e00-\u9fa5，。、；：）])\n(?=[\u4e00-\u9fa5])', '', s)
    return s.strip() or orig

targets = {(2020, 'L'), (2021, 'H'), (2021, 'L')}
changed = 0
for f in sorted(glob.glob('src/data/areas/*.json')):
    data = json.load(open(f, encoding='utf-8'))
    dirty = False
    for q in data:
        if (q.get('year'), q.get('session')) not in targets:
            continue
        e = (q.get('explanation') or '').strip()
        if not e:
            continue
        ne = clean(e)
        if ne != e:
            q['explanation'] = ne
            dirty = True
            changed += 1
    if dirty:
        with open(f, 'w', encoding='utf-8') as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
            fh.write('\n')
print('重新清洗:', changed, '条')
