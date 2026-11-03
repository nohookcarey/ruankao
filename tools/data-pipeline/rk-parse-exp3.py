import re, json

RE_ANS = re.compile(r'答\s*案\s*[：:\s]*([A-D])')
RE_QNO = re.compile(r'(?<![\d])(\d{1,2})(?:\s*[-－]\s*(\d{1,2}))?\s*[、．.]\s*(?![\d])')
RE_EXP = re.compile(r'解\s*析\s*[：:]\s*')

def clean(exp):
    lines = []
    for l in exp.split('\n'):
        s = l.strip()
        if not s:
            continue
        if '软件设计师' in s:
            continue
        if re.fullmatch(r'第?\s*\d+\s*页?', s):
            continue
        lines.append(s)
    return '\n'.join(lines).strip()


def monotonic_qnos(text, start_at):
    """只在解析区内做递增过滤：试卷区和解析区各有一套 1~75 的题号，
    从「第一个答案」的位置起算，滤掉解析正文里的列表编号。"""
    all_q = [(m.start(), int(m.group(1)), int(m.group(2)) if m.group(2) else None)
             for m in RE_QNO.finditer(text)]

    prior = [q for q in all_q if q[0] < start_at]
    seq = []
    last = 0
    if prior:
        p = prior[-1]
        seq.append(p)
        last = p[2] or p[1]

    for q in all_q:
        if q[0] <= start_at:
            continue
        no, no2 = q[1], q[2]
        if no <= last:
            continue
        seq.append(q)
        last = no2 or no
    return seq


def parse(text):
    answers = [(m.start(), m.group(1)) for m in RE_ANS.finditer(text)]
    if not answers:
        return {}
    qnos = monotonic_qnos(text, answers[0][0])

    result = {}
    for i, (pos, ans) in enumerate(answers):
        prev = [q for q in qnos if q[0] < pos]
        if not prev:
            continue
        _, no, no2 = prev[-1]

        nxt = [q[0] for q in qnos if q[0] > pos]
        end = answers[i + 1][0] if i + 1 < len(answers) else len(text)
        if nxt:
            end = min(end, nxt[0])

        seg = text[pos:end]
        m = RE_EXP.search(seg)
        if not m:
            continue
        exp = clean(seg[m.end():])
        if len(exp) < 10:
            continue
        if no not in result:
            result[no] = {'answer': ans, 'exp': exp}
        if no2 and no2 not in result:
            result[no2] = {'answer': ans, 'exp': exp}
    return result


summary = {}
for tag in ('2020L', '2021H', '2021L'):
    text = open(f'/tmp/ocr3/{tag}.all.txt', encoding='utf-8').read()
    got = parse(text)
    summary[tag] = got
    print(f'{tag}: 提取 {len(got)} 条解析，题号 {min(got)}~{max(got)}' if got else f'{tag}: 0')
    for no in sorted(got)[:2]:
        print(f'   [{no}] ans={got[no]["answer"]} :: {got[no]["exp"][:70]}'.replace('\n', ' '))

json.dump({k: {str(n): v for n, v in g.items()} for k, g in summary.items()},
          open('/tmp/ocr3/all-exp.json', 'w'), ensure_ascii=False, indent=1)
print('已写出 /tmp/ocr3/all-exp.json')
