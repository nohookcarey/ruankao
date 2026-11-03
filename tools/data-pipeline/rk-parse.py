#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把「07 课后练习」的 docx 题目 + 解析，解析成结构化题目。

设计要点
- 以「解析」文件为主源：它同时含题干、选项、被 {.mark} 高亮的正确答案、以及视频解析截图。
- 题干可能含多个空（如（23）（24）），为每个空生成一道独立小题，共用同一题干。
- 图片按出现顺序挂到所属题干之后；解析图（出现在选项块之后）作为 explanationFigure。
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

HEAD_RE = re.compile(r"^#\s+(.+)$")
OPT_START_RE = re.compile(r"^（(\d+)）\s*")
OPT_SPLIT_RE = re.compile(r"(?<![A-Za-z0-9])([A-D])\.\s")
IMG_RE = re.compile(r"!\[\]\((?:[^)]*?/)?([^)/]+)\)")
YEAR_RE = re.compile(r"[（(](\d{4})年(上|下)半年[）)]\s*$")
MARK_RE = re.compile(r"\[([^\]]*)\]\{\.mark\}")


def to_md(path, media_dir):
    out = os.path.join(tempfile.mkdtemp(), "out.md")
    subprocess.run(
        [PANDOC, path, "-t", "markdown", "--wrap=none",
         "--extract-media", media_dir, "-o", out],
        check=True, capture_output=True,
    )
    with open(out, encoding="utf-8") as f:
        return f.read()


def strip_marks(s):
    """去掉 {.mark} 与 {.underline} 等 span，保留内文"""
    return re.sub(r"\[([^\]]*)\]\{\.\w+\}", r"\1", s)


def marked_text(s):
    """返回 (去标记后的文本, 被标记的片段列表)"""
    marked = [m.group(1).strip() for m in MARK_RE.finditer(s)]
    return strip_marks(s), marked


def split_options(chunk):
    """'（5） A. x B. y C. z D. w' → {'A':'x',...}，同时返回被高亮的选项字母"""
    body = OPT_START_RE.sub("", chunk.strip())
    parts = list(OPT_SPLIT_RE.finditer(body))
    opts = {}
    marks = set()
    for i, m in enumerate(parts):
        key = m.group(1)
        start = m.end()
        end = parts[i + 1].start() if i + 1 < len(parts) else len(body)
        raw = body[start:end].strip()
        text, marked = marked_text(raw)
        # 选项内若残留高亮 → 说明这是正确答案
        if marked or "[.mark]" in raw:
            marks.add(key)
        opts[key] = text.strip(" \t\n")
    # 直接检测整体标记（高亮跨行时 split 后可能丢掉）
    for m in MARK_RE.finditer(body):
        seg = m.group(1).strip()
        m2 = re.match(r"^([A-D])\.", seg)
        if m2:
            marks.add(m2.group(1))
    return opts, marks


def parse_md(md):
    """返回 [(title, group)]，group 含 stem/images/subs"""
    lines = [ln.rstrip() for ln in md.split("\n")]
    title = ""
    groups = []
    cur = None          # 当前 group
    pending = []        # 尚未归属的题干文本

    def flush_group():
        nonlocal cur, pending
        if cur is not None:
            groups.append(cur)
        cur = None
        pending = []

    for raw in lines:
        ln = raw.strip()
        if not ln:
            continue
        h = HEAD_RE.match(ln)
        if h:
            flush_group()
            title = h.group(1).strip()
            continue
        if ln.startswith("![]"):
            imgs = [m.group(1) for m in IMG_RE.finditer(ln)]
            tgt = cur["images"] if cur is not None else pending
            tgt.extend(imgs)
            continue
        if OPT_START_RE.match(ln):
            num = int(OPT_START_RE.match(ln).group(1))
            # 选项块可能跨多行：向后吞并直到遇到题干预告/标题/图片/下一个（N）
            if cur is None:
                cur = {"stem": " ".join(pending).strip(), "images": [], "subs": []}
                pending = []
            opts, marks = split_options(ln)
            cur["subs"].append({"no": num, "options": opts, "marks": marks, "tail": []})
            continue
        # 普通文本
        if cur is not None and cur["subs"]:
            # 已在选项阶段：可能是选项的续行（C. x D. y）
            last = cur["subs"][-1]
            if re.search(r"[A-D]\.\s", ln) and len(last["options"]) < 4:
                opts, marks = split_options(ln)
                last["options"].update(opts)
                last["marks"] |= marks
                continue
            # 否则视为新题干的开始
            flush_group()
            pending.append(ln)
            continue
        pending.append(ln)

    flush_group()
    return title, groups


def extract_year(stem):
    m = YEAR_RE.search(stem)
    if not m:
        return ""
    return f"{m.group(1)}年{m.group(2)}半年"


def main():
    pairs = json.load(open("/tmp/ruankao_pairs.json", encoding="utf-8"))
    stats = {"pairs": 0, "groups": 0, "subs": 0, "no_opts": 0, "no_mark": 0, "multi": 0}
    sample = []
    for r in pairs[:3]:
        src = os.path.join(r["dir"], r["a"] or r["q"])
        media = tempfile.mkdtemp()
        md = to_md(src, media)
        title, groups = parse_md(md)
        print(f"\n===== {r['prefix']}、{r['num']} {r['title']} → {len(groups)} 组 =====")
        for g in groups[:3]:
            print(f"  题干: {g['stem'][:90]}")
            print(f"  图: {g['images']}")
            for s in g["subs"]:
                print(f"    （{s['no']}） 选项{list(s['options'].keys())} 答案{sorted(s['marks'])}")
                for k in sorted(s["options"]):
                    print(f"        {k}. {s['options'][k][:60]}")
                break
    print("\n=== 统计 ===", stats)


if __name__ == "__main__":
    main()
