#!/usr/bin/env python3
# 把官方《试题分析与解答》的解析写入题库（只填空白，不覆盖已有解析）
import glob
import importlib.util
import json
import os
import re
import sys

spec = importlib.util.spec_from_file_location('pb', '/tmp/rk-parse-book.py')
pb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pb)

MAX_LEN = 700

# 常见 OCR 错字（仅出现在解析语料里的高频错误）
OCR_FIX = [
    (re.compile(r'钓(?!鱼)'), '的'),
    (re.compile(r'旳'), '的'),
    (re.compile(r'程字'), '程序'),
    (re.compile(r'运鼻器'), '运算器'),
    (re.compile(r'叙还'), '叙述'),
    (re.compile(r'不回丢失'), '不会丢失'),
    (re.compile(r'责饪'), '责任'),
]


def tidy(s):
    for pat, rep in OCR_FIX:
        s = pat.sub(rep, s)
    s = re.sub(r'\s+', ' ', s)
    s = re.sub(r'(?<=[\u4e00-\u9fa5，。；：、）])\s(?=[\u4e00-\u9fa5])', '', s)
    s = re.sub(r'[·•]{2,}', '', s)
    return s.strip()


def main():
    parsed = {}
    used_books = []
    for tag in ('b0916', 'b1318', 'b1719'):
        if not os.path.isdir(pb.BOOKS[tag]):
            continue
        n_this = 0
        for year, sess, ampm, text in pb.build_chapters(pb.read_book(tag)):
            if ampm != '上午' or len(text) < 800:
                continue
            key = f'{year}{"H" if sess == "上" else "L"}'
            got = pb.parse_chapter(text)
            bucket = parsed.setdefault(key, {})
            for no, v in got.items():
                if no not in bucket or len(v['exp']) > len(bucket[no]['exp']):
                    bucket[no] = v
                    n_this += 1
        used_books.append((tag, n_this))
    print('语料:', used_books, ' 覆盖卷数:', len(parsed))

    filled = 0
    skip_short = 0
    mismatches = []
    per_file = {}

    for f in sorted(glob.glob('src/data/areas/*.json')):
        data = json.load(open(f, encoding='utf-8'))
        dirty = False
        for q in data:
            if (q.get('explanation') or '').strip():
                continue
            if not q.get('year') or not q.get('no'):
                continue
            key = f"{q['year']}{q.get('session')}"
            v = parsed.get(key, {}).get(q['no'])
            if not v:
                continue
            exp = tidy(v['exp'])
            if len(exp) < 12:
                skip_short += 1
                continue
            if len(exp) > MAX_LEN:
                exp = exp[:MAX_LEN].rstrip() + '…'
            q['explanation'] = exp
            dirty = True
            filled += 1
            per_file[os.path.basename(f)] = per_file.get(os.path.basename(f), 0) + 1

            book_ans = v.get('ans')
            bank_ans = (q.get('answer') or '').strip()
            if book_ans and bank_ans and book_ans != bank_ans:
                mismatches.append((q['id'], bank_ans, book_ans))

        if dirty:
            with open(f, 'w', encoding='utf-8') as fh:
                json.dump(data, fh, ensure_ascii=False, indent=2)
                fh.write('\n')

    print(f'补入解析: {filled}  过短跳过: {skip_short}')
    print('按文件:', dict(sorted(per_file.items(), key=lambda x: -x[1])))
    print(f'答案与官方不一致: {len(mismatches)}')
    for m in mismatches[:40]:
        print('   ', m)
    json.dump(mismatches, open('/tmp/books/mismatch.json', 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
