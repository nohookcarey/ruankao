#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""盘点「07 课后练习」的题目/解析文件配对情况，统计图片与题量。

不写入任何项目文件，只输出报告 JSON 到 /tmp。
"""
import json
import os
import re
import subprocess
import sys
import tempfile

BASE = os.path.expanduser(
    "~/Downloads/中级软件设计师/25年软件设计师全套文档资料/07 课后练习（章节题目、解析）"
)
PANDOC = "/opt/anaconda3/bin/pandoc"

# 章节前缀 → 知识域
CHAPTER_AREA = {
    "一": "arch",   # 计算机系统
    "二": "lang",   # 程序设计语言
    "三": "ds",     # 数据结构（上、下）
    "四": "sec",    # 知识产权 → 安全法规
    "五": "db",     # 数据库
    "六": "oo",     # 面向对象
    "七": "oo",     # UML → 面向对象与 UML
    "八": "dp",     # 设计模式
    "九": "se",     # 结构化开发
    "十": "os",     # 操作系统
    "十一": "se",   # 软件工程
    "十二": "sec",  # 信息安全
    "十三": "net",  # 计算机网络
    "十四": "ds",   # 算法 → 数据结构与算法
}

NAME_RE = re.compile(r"^([一二三四五六七八九十]+)、(\d+)\s+(.+?)\.docx$")


def to_md(path, media_dir):
    """docx → markdown，图片抽取到 media_dir"""
    out = os.path.join(tempfile.mkdtemp(), "out.md")
    subprocess.run(
        [PANDOC, path, "-t", "markdown", "--wrap=none",
         "--extract-media", media_dir, "-o", out],
        check=True, capture_output=True,
    )
    with open(out, encoding="utf-8") as f:
        return f.read()


def scan_pairs():
    rows = []
    for d in sorted(os.listdir(BASE)):
        full = os.path.join(BASE, d)
        if not os.path.isdir(full) or not d.startswith("上午题"):
            continue
        files = os.listdir(full)
        # 只配对顶层：X、N 主题.docx  ↔  X、N 解析.docx
        stems = {}
        solves = {}
        for fn in files:
            if not fn.endswith(".docx"):
                continue
            if "总和" in fn or "知识点" in fn or "大纲" in fn:
                continue
            m = NAME_RE.match(fn)
            if not m:
                continue
            prefix, num, title = m.group(1), m.group(2), m.group(3)
            if title.strip() == "解析":
                solves[(prefix, num)] = fn
            else:
                stems[(prefix, num)] = (title.strip(), fn)
        for key in sorted(stems, key=lambda k: int(k[1])):
            title, qfn = stems[key]
            afn = solves.get(key)
            rows.append({
                "chapter": d.split(" ")[1].lstrip("#"),
                "prefix": key[0],
                "num": int(key[1]),
                "title": title,
                "q": qfn,
                "a": afn,
                "dir": full,
            })
        # 统计只有解析、没有题目的
        orphan = [k for k in solves if k not in stems]
        if orphan:
            print(f"  [警告] {d} 有 {len(orphan)} 个解析没有对应题目文件", file=sys.stderr)
    return rows


def main():
    rows = scan_pairs()
    print(f"配对总数: {len(rows)}，其中有解析: {sum(1 for r in rows if r['a'])}")
    no_a = [r for r in rows if not r["a"]]
    if no_a:
        print(f"缺解析 {len(no_a)} 个:")
        for r in no_a[:20]:
            print(f"  {r['prefix']}、{r['num']} {r['title']}")
    with open("/tmp/ruankao_pairs.json", "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=1)
    print("明细写入 /tmp/ruankao_pairs.json")


if __name__ == "__main__":
    main()
