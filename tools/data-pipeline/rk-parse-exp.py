import re, json

def load(tag):
    return open(f'/tmp/ocr3/{tag}.all.txt', encoding='utf-8').read()

# 题号行：1、  4-5、  10、
RE_Q = re.compile(r'^\s*(\d{1,2})(?:\s*[-－]\s*(\d{1,2}))?\s*[、．.]\s*')

def split_questions(text):
    lines = text.split('\n')
    blocks = []
    cur = None
    for ln in lines:
        m = RE_Q.match(ln)
        if m:
            if cur:
                blocks.append(cur)
            nums = [int(m.group(1))]
            if m.group(2):
                nums.append(int(m.group(2)))
            cur = {'nos': nums, 'lines': [ln]}
        elif cur is not None:
            cur['lines'].append(ln)
    if cur:
        blocks.append(cur)
    return blocks

def extract(blocks):
    out = {}
    for b in blocks:
        body = '\n'.join(b['lines'])
        # 解析：后面到块尾
        m = re.search(r'解\s*析\s*[：:]\s*(.*)', body, re.S)
        if not m:
            continue
        exp = m.group(1).strip()
        # 去掉页眉页脚干扰行
        exp = '\n'.join(
            l for l in exp.split('\n')
            if l.strip() and not re.fullmatch(r'[\s\W]*', l)
            and '软件设计师' not in l
            and not re.fullmatch(r'第?\s*\d+\s*页?', l.strip())
        )
        exp = exp.strip()
        if len(exp) < 8:
            continue
        for no in b['nos']:
            out.setdefault(no, exp)
    return out

for tag in ('2020L', '2021H', '2021L'):
    blocks = split_questions(load(tag))
    got = extract(blocks)
    print(f'{tag}: 切出题目块 {len(blocks)}  提取到解析 {len(got)}')
    ns = sorted(got)
    print('   题号范围:', ns[0] if ns else '-', '~', ns[-1] if ns else '-')
    for no in ns[:2]:
        print(f'   [{no}] {got[no][:90]}...'.replace('\n', ' '))
    json.dump(got, open(f'/tmp/ocr3/{tag}.exp.json', 'w'), ensure_ascii=False, indent=1)
