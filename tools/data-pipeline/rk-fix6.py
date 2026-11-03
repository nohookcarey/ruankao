import json, glob

# 逐题人工核对过的正确选项（源自 raw.json，去掉多余的转义层，保留单个反斜杠）
FIX = {
    # 2011 下半年 24 题：全文件名（答案 C）
    '2011L-24': {
        'A': 'f1.java',
        'B': r'\Document\Java-prog\f1.java',
        'C': r'D:\Program\Java-prog\f1.java',
        'D': r'\Program\Java-prog\f1.java',
    },
    # 2011 下半年 25 题：相对路径（答案 A）
    '2011L-25': {
        'A': r'Java-prog\\',
        'B': r'\Java-prog\\',
        'C': r'Program\Java-prog',
        'D': r'\Program\Java-prog\\',
    },
    # 2013 上半年 28 题：原选项 B 与 C 重复，按四种组合补齐（答案 D）
    '2013H-28': {
        'A': '无上邻空闲区，也无下邻空闲区',
        'B': '无上邻空闲区，但有下邻空闲区',
        'C': '有上邻空闲区，但无下邻空闲区',
        'D': '有上邻空闲区，也有下邻空闲区',
    },
    # 2014 上半年 27 题：全文件名（答案 D）
    '2014H-27': {
        'A': 'fault.swf',
        'B': r'flash\fault.swf',
        'C': r'swshare\flash\fault.swf',
        'D': r'\swshare\flash\fault.swf',
    },
    # 2014 上半年 28 题：相对路径和绝对路径（答案 B）
    '2014H-28': {
        'A': r'swshare\flash\和\flash\\',
        'B': r'flash\和\swshare\flash\\',
        'C': r'\swshare\flash\和flash\\',
        'D': r'\flash\和\swshare\flash\\',
    },
    # 2019 上半年 26 题：绝对路径和相对路径（答案 C）
    '2019H-26': {
        'A': r'MyDrivers\user2\和\user2\\',
        'B': r'\MyDrivers\user2\和\user2\\',
        'C': r'\MyDrivers\user2\和user2\\',
        'D': r'MyDrivers\user2\和user2\\',
    },
}

# 题干里 pandoc 留下的 {=html} / <!-- --> 噪音
import re
NOISE_RES = [
    (re.compile(r'`?<!--\s*-->`?\{=html\}'), ''),
    (re.compile(r'`?<!--\s*-->`?'), ''),
    (re.compile(r'\{=html\}'), ''),
    (re.compile(r'\{=[a-z]+\}'), ''),
]

changed_files = set()
applied = []
noise_fixed = []

for f in sorted(glob.glob('src/data/areas/*.json')):
    data = json.load(open(f, encoding='utf-8'))
    dirty = False

    for q in data:
        qid = q.get('id')

        if qid in FIX:
            target = FIX[qid]
            for o in q.get('options') or []:
                if o.get('key') in target:
                    o['text'] = target[o['key']]
            dirty = True
            applied.append(qid)

        # 清理题干与解析里的噪音
        for field in ('stem', 'explanation'):
            s = q.get(field)
            if not isinstance(s, str):
                continue
            orig = s
            for pat, rep in NOISE_RES:
                s = pat.sub(rep, s)
            if s != orig:
                q[field] = s
                dirty = True
                if field == 'stem':
                    noise_fixed.append(qid)

    if dirty:
        with open(f, 'w', encoding='utf-8') as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
            fh.write('\n')
        changed_files.add(f)

print('修复选项的题:', applied)
print('清理噪音的题:', sorted(set(noise_fixed)))
print('改动文件:', sorted(changed_files))
