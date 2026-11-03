#!/usr/bin/env python3
# 解析官方《试题分析与解答》OCR 文本，抽取每题的解析正文与参考答案
import glob
import json
import os
import re
import sys

BOOKS = {'b0916': '/tmp/books/b0916/txt', 'b1318': '/tmp/books/b1318/txt', 'b1719': '/tmp/books/b1719/txt'}

# ---- 章节标题：第N章 2009上半年软件设计师上午试题分析与解答
RE_CHAP = re.compile(
    r'第\s*\d{1,2}\s*章\s*(20\d{2})\s*[年]?\s*(上|下)半年\s*软件设计师\s*(上午|下午)\s*试题分析与解答')
RE_ANALYSIS = re.compile(
    r'试\s*题\s*((?:[（(]\s*\d{1,3}\s*[)）]\s*(?:[、,，~～\-－—至和及]\s*)*)+)\s*分\s*析')
RE_NUM = re.compile(r'\d{1,3}')
RE_SEP = re.compile(r'[、,，~～\-－—至和及]+')
RE_SUB = re.compile(r'试\s*题\s*[（(]\s*(\d{1,3})\s*[)）]\s*的正确答案\s*[是为：:]\s*([A-D])')
RE_ANSWER_HDR = re.compile(r'参\s*考\s*答\s*案')
RE_ANS_ITEM = re.compile(r'[（(]\s*(\d{1,3})\s*[)）]\s*([A-D])(?![A-Za-z])')
RE_ANS_INLINE = re.compile(r'正确答案\s*[是为：:]\s*([A-D])(?![A-Za-z])')

# 页眉/页脚噪声
NOISE = [
    re.compile(r'^第\s*\d{1,2}\s*章.*$', re.M),
    re.compile(r'^软件设计师\s*20\d{2}\s*(至|全)\s*20\d{2}\s*年试题分析与解答\s*$', re.M),
    re.compile(r'^\s*\d{1,3}\s*$', re.M),          # 独立页码
    re.compile(r'^\s*[IVXLC]{1,6}\s*$', re.M),      # 罗马页码
]

CHAP_FIX = [(re.compile(r'钓(?!鱼)'), '的'), (re.compile(r'旳'), '的'), (re.compile(r'运鼻器'), '运算器')]


def read_book(tag):
    files = sorted(glob.glob(os.path.join(BOOKS[tag], '*.txt')))
    pages = []
    for f in files:
        base = os.path.basename(f)
        m = re.search(r'-(\d{3,4})\.txt$', base)
        pages.append((int(m.group(1)) if m else 0, open(f, encoding='utf-8', errors='ignore').read()))
    pages.sort()
    return pages


def normalize(text):
    for pat in NOISE:
        text = pat.sub('', text)
    return text


RE_CHAP2 = re.compile(r'第\s*\d{1,2}\s*章\s*软件设计师\s*(上午|下午)\s*试题分析与解答')
RE_YEAR = re.compile(r'(20\d{2})\s*[年]?\s*(上|下)\s*半年\s*试题分析与解答')
RE_AMPM = re.compile(r'第\s*\d{1,2}\s*章\s*软件设计师\s*(上午|下午)\s*试题分析与解答')


def build_chapters_fallback(pages):
    """页眉只有「第N章 软件设计师上午试题分析与解答」，年份在页脚的「2017 上半年试题分析与解答」"""
    chapters = []
    cur_key = None
    cur = None
    year = sess = ampm = None
    for _, raw in pages:
        ym = RE_YEAR.search(raw)
        if ym:
            year, sess = int(ym.group(1)), ym.group(2)
        am = RE_AMPM.search(raw)
        if am:
            ampm = am.group(1)
        if year is None or ampm is None:
            continue
        key = (year, sess, ampm)
        if key != cur_key:
            cur = [key, []]
            chapters.append(cur)
            cur_key = key
        cur[1].append(normalize(raw))
    return [(k[0], k[1], k[2], '\n'.join(v)) for k, v in chapters]


def build_chapters(pages):
    """按页扫描原始文本切章（先去噪会把章标题当页眉删掉）。返回 [(year, sess, ampm, text)]"""
    chapters = []
    cur = None
    for _, raw in pages:
        hits = list(RE_CHAP.finditer(raw))
        if not hits:
            if cur:
                cur[1].append(normalize(raw))
            continue
        for i, m in enumerate(hits):
            key = (int(m.group(1)), m.group(2), m.group(3))
            start = m.start()
            end = hits[i + 1].start() if i + 1 < len(hits) else len(raw)
            if cur is None or cur[0] != key:
                cur = [key, []]
                chapters.append(cur)
            cur[1].append(normalize(raw[start:end]))
    if len(chapters) < 2:
        return build_chapters_fallback(pages)
    return [(k[0], k[1], k[2], '\n'.join(v)) for k, v in chapters]


def clean_exp(s):
    s = '\n'.join(l.strip() for l in s.split('\n') if l.strip())
    for pat, rep in CHAP_FIX:
        s = pat.sub(rep, s)
    # 去掉 OCR 断续换行（中文行末/行首都是中文时合并）
    s = re.sub(r'(?<=[\u4e00-\u9fa5，。、；：）】”]) *\n *(?=[\u4e00-\u9fa5])', '', s)
    return s.strip()


def parse_group(raw):
    """把「（17）、（18）」或「（38）～（40）」展开成题号列表"""
    nums = [int(x) for x in RE_NUM.findall(raw)]
    if not nums:
        return []
    seps = RE_SEP.findall(raw)
    out = [nums[0]]
    for i in range(1, len(nums)):
        sep = seps[i - 1] if i - 1 < len(seps) else ''
        prev, cur = out[-1], nums[i]
        if re.search(r'[~～\-－—至]', sep) and 1 < cur - prev <= 5:
            out.extend(range(prev + 1, cur + 1))
        else:
            out.append(cur)
    return out


def parse_chapter(text):
    """返回 {no: {'exp':..., 'ans':...}}"""
    out = {}

    def put(no, exp, ans):
        if len(exp) < 6:
            return
        old = out.get(no)
        if old is None or len(exp) > len(old['exp']):
            out[no] = {'exp': exp, 'ans': ans or (old['ans'] if old else None)}

    marks = list(RE_ANALYSIS.finditer(text))
    for i, m in enumerate(marks):
        nums = parse_group(m.group(1))
        if not nums:
            continue
        end = marks[i + 1].start() if i + 1 < len(marks) else len(text)
        seg = text[m.end():end]

        ans_hdr = RE_ANSWER_HDR.search(seg)
        body = seg[:ans_hdr.start()] if ans_hdr else seg
        tail = seg[ans_hdr.end():] if ans_hdr else ''

        ansmap = {}
        for am in RE_ANS_ITEM.finditer(tail):
            ansmap.setdefault(int(am.group(1)), am.group(2))
        subs = list(RE_SUB.finditer(body))
        for sm in subs:
            ansmap.setdefault(int(sm.group(1)), sm.group(2))

        if len(nums) == 1:
            put(nums[0], clean_exp(body), ansmap.get(nums[0]))
            continue

        # 组内多题：能按「试题（N）的正确答案是X」切开就分别给，否则共享整段分析
        if len(subs) >= 2:
            intro = body[:subs[0].start()]
            covered = set()
            for k, sm in enumerate(subs):
                n = int(sm.group(1))
                if n not in nums:
                    continue
                s1 = subs[k + 1].start() if k + 1 < len(subs) else len(body)
                put(n, clean_exp(intro + '\n' + body[sm.end():s1]), ansmap.get(n))
                covered.add(n)
            rest = [n for n in nums if n not in covered]
            if rest:
                shared = clean_exp(body)
                for n in rest:
                    put(n, shared, ansmap.get(n))
        else:
            shared = clean_exp(body)
            for n in nums:
                put(n, shared, ansmap.get(n))
    return out


def main():
    result = {}
    for tag in BOOKS:
        if not os.path.isdir(BOOKS[tag]):
            continue
        pages = read_book(tag)
        chaps = build_chapters(pages)
        stats = []
        for year, sess, ampm, text in chaps:
            if ampm != '上午' or len(text) < 800:
                continue
            got = parse_chapter(text)
            key = f'{year}{"H" if sess == "上" else "L"}'
            stats.append((key, len(got)))
            bucket = result.setdefault(key, {})
            for no, v in got.items():
                old = bucket.get(no)
                if old is None or len(v['exp']) > len(old['exp']):
                    bucket[no] = v
        print(f'[{tag}] 页 {len(pages)}  章节 {len(chaps)}')
        for k, n in stats:
            print(f'    {k}: {n} 题')
    json.dump({k: {str(n): v for n, v in vv.items()} for k, vv in result.items()},
              open('/tmp/books/parsed.json', 'w'), ensure_ascii=False, indent=1)
    print('\n合并后卷数:', len(result))
    print('总题数:', sum(len(v) for v in result.values()))


if __name__ == '__main__':
    main()
