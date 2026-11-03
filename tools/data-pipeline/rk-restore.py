import json, glob, re, sys

RAW = json.load(open('/tmp/rk-build/raw.json', encoding='utf-8'))

SESS = {'上半年': 'H', '下半年': 'L'}

def parse_raw(r):
    yr = r.get('year_raw') or ''
    m = re.search(r'(\d{4})年(上|下)半年', yr)
    if not m:
        return None
    year, sess = int(m.group(1)), SESS[m.group(2) + '半年']
    nos = [int(x) for x in re.findall(r'（(\d{1,2})）', r.get('stem') or '')]
    marks = r.get('marks') or []
    return year, sess, nos, (marks[0] if marks else None)

index = []
for r in RAW:
    p = parse_raw(r)
    if not p:
        continue
    year, sess, nos, ans = p
    opts = r.get('options') or {}
    if not any('\\' in v for v in opts.values()):
        continue
    index.append({'year': year, 'sess': sess, 'nos': nos, 'ans': ans,
                  'opts': opts, 'stem': r.get('stem') or ''})

print(f'源数据中含反斜杠的题: {len(index)}')

files = sorted(glob.glob('src/data/areas/*.json'))
fixed = 0
report = []

for f in files:
    data = json.load(open(f, encoding='utf-8'))
    changed = False
    for q in data:
        if q.get('type') != 'single' or not q.get('year'):
            continue
        opts = q.get('options') or []
        if len(opts) != 4:
            continue
        if any('\\' in (o.get('text') or '') for o in opts):
            continue  # 已经有反斜杠，跳过

        cands = []
        for r in index:
            if r['year'] != q['year'] or r['sess'] != q.get('session'):
                continue
            if q.get('no') not in r['nos']:
                continue
            if r['ans'] and q.get('answer') and r['ans'] != q['answer']:
                continue
            cands.append(r)

        if len(cands) != 1:
            if len(cands) > 1:
                report.append((q['id'], 'AMBIGUOUS', len(cands)))
            continue

        src = cands[0]['opts']
        keys = sorted(src.keys())
        if keys != ['A', 'B', 'C', 'D']:
            report.append((q['id'], 'KEYS', keys))
            continue

        new_opts = [{'key': k, 'text': src[k]} for k in keys]
        # 只替换文本，其余字段保留
        for o, n in zip(opts, new_opts):
            o['text'] = n['text']
        changed = True
        fixed += 1
        report.append((q['id'], 'FIXED', [n['text'] for n in new_opts]))

    if changed:
        json.dump(data, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        open(f, 'a', encoding='utf-8').write('\n')

print(f'已恢复: {fixed}')
for row in report[:15]:
    print(' ', row)
print('...')
print('异常/歧义:', [r for r in report if r[1] != 'FIXED'][:10])
