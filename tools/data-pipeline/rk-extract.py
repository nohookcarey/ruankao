#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从「07 课后练习」docx 提取软考上午题，输出结构化 JSON + 异常报告。

用法：
  python3 rk-extract.py            # 全量提取
  python3 rk-extract.py --sample 5 # 只跑前 5 对，打印详情
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
OUT_DIR = "/tmp/rk-out"

HEAD_RE = re.compile(r"^#\s+(.+)$")
SUBNO_RE = re.compile(r"^[（(](\d+)[）)]\s*")
IMG_RE = re.compile(r"!\[[^\]]*\]\(([^)]*)\)")
YEAR_RE = re.compile(r"[（(](\d{4})[年]?\s*[上下]\s*半年[）)]")
OPT_LETTER_RE = re.compile(r"(?<![A-Za-z0-9])([A-D])\.(?=\s|$|«)")
CONT_LINE_RE = re.compile(r"^(?:«M»)?\s*[A-D][.、．]\s*")

# 章节首字 → 知识域
CHAPTER_AREA = {
    "一": "arch", "二": "lang", "三": "ds", "四": "sec", "五": "db",
    "六": "oo", "七": "oo", "八": "dp", "九": "se", "十": "os",
    "十一": "se", "十二": "sec", "十三": "net", "十四": "ds",
}


# ---------- pandoc ----------

def to_md(path, media_dir):
    out = os.path.join(tempfile.mkdtemp(), "out.md")
    subprocess.run(
        [PANDOC, path, "-t", "markdown", "--wrap=none",
         "--extract-media", media_dir, "-o", out],
        check=True, capture_output=True,
    )
    with open(out, encoding="utf-8") as f:
        return f.read()


# ---------- 文本清理 ----------

LATEX_MAP = [
    (r"\\times", "×"), (r"\\div", "÷"), (r"\\pm", "±"), (r"\\leq", "≤"),
    (r"\\geq", "≥"), (r"\\neq", "≠"), (r"\\approx", "≈"),
    (r"\\rightarrow", "→"), (r"\\leftarrow", "←"), (r"\\Rightarrow", "⇒"),
    (r"\\sim", "～"), (r"\\cdot", "·"), (r"\\cdots", "…"),
    (r"\\%", "%"), (r"\\_", "_"),
]


def clean_text(s):
    """LaTeX / 上下标 / 多余空白 → 纯文本"""
    # 先丢掉 {.mark} 高亮段：题干里的高亮基本是讲师批注（"这题太偏了"之类），不属于题目
    s = re.sub(r"«M».*?«/M»", " ", s)
    s = s.replace("«M»", "").replace("«/M»", "")
    s = s.replace("\\ ", " ").replace("\\{", "{").replace("\\}", "}")
    # 由内向外反复消解嵌套花括号命令
    for _ in range(5):
        before = s
        s = re.sub(r"\\(?:text|mathrm|mathbf|mathit|mathbb)\{([^{}]*)\}", r"\1", s)
        s = re.sub(r"\^\{([^{}]*)\}", lambda m: "^" + (m.group(1) if len(m.group(1)) == 1 else "(" + m.group(1) + ")"), s)
        s = re.sub(r"_\{([^{}]*)\}", r"_\1", s)
        if s == before:
            break
    for pat, rep in LATEX_MAP:
        s = re.sub(pat, rep, s)
    # 单符号公式：$-$、$=$ 之类
    s = re.sub(r"\$([^$\s]{1,4})\$", r"\1", s)
    # pandoc 上下标：H~2~O、x^2^
    s = re.sub(r"~([^~]{1,20})~", r"\1", s)
    s = re.sub(r"\^([^^]{1,20})\^", r"\1", s)
    # 残留 span
    s = re.sub(r"\[([^\]]*)\]\{\.\w+\}", r"\1", s)
    s = s.replace("$", "")
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()


def normalize_spans(s):
    """把 {.mark} 高亮转成哨兵，便于后续判定制答案；其余 span 直接拆掉"""
    s = re.sub(r"\[([^\]]*)\]\{\.mark\}", r"«M»\1«/M»", s)
    s = re.sub(r"\[([^\]]*)\]\{\.\w+\}", r"\1", s)
    return s


# ---------- 选项解析 ----------

def parse_options(block):
    """block 形如 '（5） A. x B. y C. z D. w'（可跨多行，已合并）
    返回 (options dict, marked set)
    """
    body = normalize_spans(SUBNO_RE.sub("", block.strip()))
    hits = list(OPT_LETTER_RE.finditer(body))
    opts, ranges = {}, []
    for i, m in enumerate(hits):
        letter = m.group(1)
        start = m.end()
        end = hits[i + 1].start() if i + 1 < len(hits) else len(body)
        seg = body[start:end]
        ranges.append((letter, start, end))
        opts[letter] = clean_text(seg.replace("«M»", "").replace("«/M»", ""))

    marks = set()
    # 规则一：高亮紧贴在选项字母前，如 «M»D. xxx
    for m in re.finditer(r"«M»\s*([A-D])\.", body):
        marks.add(m.group(1))
    # 规则二：高亮包住整段选项文本，如 B. «M»xxx«/M»
    for letter, start, end in ranges:
        seg = body[start:end]
        if re.match(r"^\s*«M»", seg):
            marks.add(letter)
    return opts, marks


# ---------- 主解析 ----------

def split_blocks(md):
    """按标题切段，段内再按「题干 +（N）选项块」拆题"""
    sections = []
    title = ""
    buf = []

    def flush():
        nonlocal buf
        if buf:
            sections.append((title, buf))
        buf = []

    for raw in md.split("\n"):
        ln = normalize_spans(raw.strip())
        # 去掉引用块标记：部分文档把选项写进了 > 引用
        ln = re.sub(r"^(?:>\s*)+", "", ln).strip()
        if not ln:
            continue
        h = HEAD_RE.match(ln)
        if h:
            flush()
            title = h.group(1).strip()
            continue
        buf.append(ln)
    flush()
    return sections


def parse_section(lines):
    """→ [{'stem':..,'images':[..],'subs':[{'no','options','marks','figs'}]}]

    状态机：pending 累积题干 → 遇到（N）开选项块 → 遇到非选项文本则结算本题
    """
    groups = []
    cur = None            # 当前题干组
    pending = []          # 题干文本（未归属）
    pending_imgs = []     # 题干前的图
    opt_buf = []          # 当前选项块
    opt_figs = []         # 选项块之后的图（解析截图）

    def finalize_sub():
        nonlocal opt_buf, opt_figs
        if opt_buf and cur is not None:
            opts, marks = parse_options(" ".join(opt_buf))
            no = int(SUBNO_RE.match(opt_buf[0]).group(1))
            cur["subs"].append({"no": no, "options": opts, "marks": marks, "figs": opt_figs})
        opt_buf, opt_figs = [], []

    def close_group():
        nonlocal cur, pending, pending_imgs
        finalize_sub()
        if cur is not None:
            groups.append(cur)
        cur, pending, pending_imgs = None, [], []

    for ln in lines:
        # 行内图片（可能夹在题干或选项中间）先抽出来归位，避免残留在文本里
        inline = [os.path.basename(m.group(1)) for m in IMG_RE.finditer(ln)]
        if inline:
            ln = re.sub(r"\{[^}]*width[^}]*\}", "", IMG_RE.sub("", ln)).strip()
            if opt_buf:
                opt_figs.extend(inline)
            elif cur is not None:
                cur["images"].extend(inline)
            else:
                pending_imgs.extend(inline)
            if not ln:
                continue

        if ln.startswith("![]"):
            figs = [os.path.basename(m.group(1)) for m in IMG_RE.finditer(ln)]
            if opt_buf:
                opt_figs.extend(figs)
            elif cur is not None:
                cur["images"].extend(figs)
            else:
                pending_imgs.extend(figs)
            continue

        if SUBNO_RE.match(ln) and OPT_LETTER_RE.search(ln):
            if opt_buf:
                finalize_sub()
            if cur is None:
                cur = {"stem": " ".join(pending), "images": list(pending_imgs), "subs": []}
                pending, pending_imgs = [], []
            opt_buf.append(ln)
            continue

        if opt_buf and CONT_LINE_RE.match(ln):
            opt_buf.append(ln)
            continue

        # 选项文本被拆成两段高亮（跨段续接），如 [B. 前半]{.mark} 换段 [后半]{.mark}
        if opt_buf and ln.startswith("«M»") and not SUBNO_RE.match(ln):
            opt_buf.append(ln)
            continue

        # 普通文本：结束当前题组，开启新题干
        if opt_buf or cur is not None:
            close_group()
        pending.append(ln)

    close_group()
    return groups


def build_questions(pairs, sample=0, verbose=False):
    out = []
    anomalies = []
    for idx, r in enumerate(pairs):
        src_name = r["a"] if r["a"] else r["q"]
        src = os.path.join(r["dir"], src_name)
        media = tempfile.mkdtemp()
        try:
            md = to_md(src, media)
        except subprocess.CalledProcessError as e:
            anomalies.append({"file": src_name, "why": "pandoc 失败", "err": str(e)[:120]})
            continue
        sections = split_blocks(md)
        for sec_title, lines in sections:
            groups = parse_section(lines)
            for g in groups:
                stem = clean_text(g["stem"])
                if not stem:
                    continue
                year = YEAR_RE.search(g["stem"])
                for s in g["subs"]:
                    q = {
                        "chapter": r["chapter"],
                        "topic": r["title"],
                        "section": sec_title,
                        "no": s["no"],
                        "stem": stem,
                        "options": s["options"],
                        "marks": sorted(s["marks"]),
                        "images": g["images"],
                        "figs": s["figs"],
                        "year": year.group(0).strip("（）()") if year else "",
                        "file": src_name,
                    }
                    out.append(q)
                    keys = sorted(s["options"])
                    if keys != ["A", "B", "C", "D"]:
                        anomalies.append({"no": s["no"], "file": src_name,
                                          "why": f"选项数 {len(keys)}: {keys}",
                                          "stem": stem[:60]})
                    elif not s["marks"]:
                        anomalies.append({"no": s["no"], "file": src_name,
                                          "why": "无高亮答案", "stem": stem[:60]})
                    elif len(s["marks"]) > 1:
                        anomalies.append({"no": s["no"], "file": src_name,
                                          "why": f"多个高亮 {s['marks']}", "stem": stem[:60]})
        if sample and idx >= sample:
            break
    return out, anomalies


def main():
    pairs = json.load(open("/tmp/ruankao_pairs.json", encoding="utf-8"))
    sample = int(sys.argv[sys.argv.index("--sample") + 1]) if "--sample" in sys.argv else 0
    qs, anomalies = build_questions(pairs, sample=sample, verbose="--verbose" in sys.argv)
    os.makedirs(OUT_DIR, exist_ok=True)
    json.dump(qs, open(os.path.join(OUT_DIR, "questions_raw.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    json.dump(anomalies, open(os.path.join(OUT_DIR, "anomalies.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    print(f"提取到小题：{len(qs)}")
    by_area = {}
    by_year = {}
    for q in qs:
        by_area[q["chapter"]] = by_area.get(q["chapter"], 0) + 1
        if q["year"]:
            by_year[q["year"]] = by_year.get(q["year"], 0) + 1
    print("按章节：", json.dumps(by_area, ensure_ascii=False))
    print(f"带年份：{sum(by_year.values())} / {len(qs)}")
    print(f"异常项：{len(anomalies)}")
    from collections import Counter
    for why, n in Counter(a["why"].split(":")[0] for a in anomalies).most_common():
        print(f"  {why}: {n}")


if __name__ == "__main__":
    main()
