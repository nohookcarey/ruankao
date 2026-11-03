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
        if re.fullmatch(r'[A-D]\s*[、.].{0,3}', s):   # 残留下的选项行
            continue
        lines.append(s)
    return '\n'.join(lines).strip()

def parse(text):
    answers = [(m.start(), m.group(1)) for m in RE_ANS.finditer(text)]
    qnos = [(m.start(), int(m.group(1)), int(m.group(2)) if m.group(2) else None)
            for m in RE_QNO.finditer(text)]

    result = {}
    for i, (pos, ans) in enumerate(answers):
        prev = [q for q in qnos if q[0] < pos]
        if not prev:
            continue
        _, no, no2 = prev[-1]
        # 下一个题号 / 下一个答案，取较早者作为解析终点
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
        result.setdefault(no, {'answer': ans, 'exp': exp})
        if no2:
            result.setdefault(no2, {'answer': ans, 'exp': exp})
    return result

summary = {}
for tag in ('2020L', '2021H', '2021L'):
    text = open(f'/tmp/ocr3/{tag}.all.txt', encoding='utf-8').read()
    got = parse(text)
    summary[tag] = got
    print(f'{tag}: 提取 {len(got)} 条解析')
    for no in sorted(got)[:2]:
        print(f'   [{no}] ans={got[no]["answer"]} :: {got[no]["exp"][:80]}'.replace('\n', ' '))
    # 检查是否还有下一题内容混入
    bad = [n for n, v in got.items() if re.search(r'\d{1,2}\s*、', v['exp'][:60]) and '答案' in v['exp'][:120]]
    print('   可疑（混入下一题）:', bad[:5])

json.dump({k: {str(n): v for n, v in g.items()} for k, g in summary.items()},
          open('/tmp/ocr3/all-exp.json', 'w'), ensure_ascii=False, indent=1)
