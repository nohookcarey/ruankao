#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""阶段二：清洗 + 组装 + 去重 → /tmp/rk-build/questions.json（尚未写仓库）"""
import json
import os
import re
from collections import Counter, defaultdict

RAW = "/tmp/rk-build/raw.json"
OCR_DIR = "/tmp/rk-ocr"
OUT = "/tmp/rk-build/questions.json"

BLANK_RE = re.compile(r"[（(]\s*(\d{1,2})\s*[）)]")
YEAR_RE = re.compile(r"[（(]?(\d{4})\s*年\s*(上|下)\s*半年[）)]?")
TAIL_YEAR_RE = re.compile(r"[（(]?\d{4}\s*年\s*[上下]\s*半年[）)]?\s*[。.]?\s*$")


def ocr_name(path):
    """与 ocr.swift 的命名规则保持一致：<上级目录名>_<文件名>"""
    p = path.split("/")
    return f"{p[-3]}_{os.path.splitext(p[-1])[0]}"


def clean_explanation(text):
    """去掉 OCR 的页眉页脚，按句末整理段落"""
    if not text:
        return ""
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    keep = []
    for ln in lines:
        if re.fullmatch(r"试题\s*[（(]\d+[）)]\s*分析", ln):
            continue
        if re.fullmatch(r"参考答案", ln):
            break
        if re.fullmatch(r"[（(]\d+[）)]\s*[A-D]", ln):
            break
        if re.fullmatch(r"\d{1,3}", ln):      # 页码
            continue
        keep.append(ln)
    # 按语义合并：行尾是句末标点就断段
    paras, cur = [], ""
    for ln in keep:
        cur += ln
        if re.search(r"[。！？；]$", ln):
            paras.append(cur)
            cur = ""
    if cur:
        paras.append(cur)
    text = "\n\n".join(p.strip() for p in paras if p.strip())
    # 常见 OCR 误差
    text = text.replace("新钓", "新的").replace("拈", "括")
    return text.strip()


def build_stem(stem, sub_no, total_subs):
    """题干中的（N）→ 空括号；多空题加标记，指明当前作答哪一空"""
    s = BLANK_RE.sub("（　）", stem)
    s = TAIL_YEAR_RE.sub("", s).strip()
    if total_subs > 1:
        s = f"〔本题共 {total_subs} 空，当前是第 {sub_no} 空〕\n\n{s}"
    return s


def ocr_qfig(path):
    """题目候选图的 OCR 文本（用于判断它到底是配图还是解析截图）"""
    p = path.split("/")
    f = os.path.join("/tmp/rk-qocr", f"{p[-3]}_{os.path.splitext(p[-1])[0]}.txt")
    return open(f, encoding="utf-8").read() if os.path.exists(f) else ""


QFIG_EXP_RE = re.compile(r"本题.{0,6}考查|参考答案|答案解析|试题.{0,4}分析|故选|正确答案")


def main():
    raw = json.load(open(RAW, encoding="utf-8"))
    usable = [r for r in raw if len(r["options"]) == 4 and len(r["marks"]) == 1]

    # 统计同一题干下有几个空，用于多空标记
    group_key = lambda r: (r["file"], r["section"], r["stem"], r["year_raw"])
    groups = defaultdict(list)
    for r in usable:
        groups[group_key(r)].append(r)

    items = []
    no_ocr = 0
    for g in groups.values():
        total = len(g)
        for r in g:
            expl = ""
            for f in r["efigs"]:
                p = os.path.join(OCR_DIR, ocr_name(f) + ".txt")
                if os.path.exists(p):
                    expl += "\n" + open(p, encoding="utf-8").read()
            expl = clean_explanation(expl)
            # 个别文件把知识点/解析截图排在选项之前，会被误当题图。
            # 判据：带「本题考查/参考答案」关键词，或文字量明显超出示意图（>250 字），
            # 或本题挂了 3 张以上且张张都有成段文字（典型的幻灯片截图）。
            texts = [ocr_qfig(f) for f in r["qfigs"]]
            as_exp = []
            if len(r["qfigs"]) >= 3 and all(len(t) > 50 for t in texts):
                as_exp = list(range(len(texts)))
            else:
                for i, t in enumerate(texts):
                    if len(t) > 250 or (len(t) > 50 and QFIG_EXP_RE.search(t)):
                        as_exp.append(i)
            keep_figs = []
            for i, f in enumerate(r["qfigs"]):
                if i in as_exp:
                    expl = (expl + "\n\n" + clean_explanation(texts[i])).strip()
                else:
                    keep_figs.append(f)
            r["qfigs"] = keep_figs
            if not expl:
                no_ocr += 1
            items.append({
                "area": r["area"],
                "chapter": r["chapter"],
                "topic": r["topic"],
                "section": r["section"],
                "subNo": r["no"],
                "stem": build_stem(r["stem"], r["no"], total),
                "options": [{"key": k, "text": r["options"][k]} for k in "ABCD"],
                "answer": r["marks"][0],
                "explanation": expl,
                "qfigs": r["qfigs"],
                "year_raw": r["year_raw"],
                "file": r["file"],
            })

    # 真题定位
    for it in items:
        m = YEAR_RE.search(it["year_raw"]) or YEAR_RE.search(it["stem"])
        if m:
            it["year"] = int(m.group(1))
            it["session"] = "H" if m.group(2) == "上" else "L"
            it["no"] = it["subNo"]

    past = [it for it in items if "year" in it]
    # 同卷同号冲突
    byslot = defaultdict(list)
    for it in past:
        byslot[(it["year"], it["session"], it["no"])].append(it)
    conflicts = {k: v for k, v in byslot.items() if len(v) > 1}
    same = 0
    diff = 0
    for k, v in conflicts.items():
        stems = {x["stem"] for x in v}
        if len(stems) == 1:
            same += len(v) - 1
        else:
            diff += 1
            print(f"  [冲突] {k[0]}{k[1]}-{k[2]} 有 {len(v)} 个不同题干")

    print(f"组装 {len(items)} 题；真题定位 {len(past)}；无解析 {no_ocr}")
    print(f"同卷同号重复 {sum(len(v)-1 for v in conflicts.values())} 条（同题干 {same}）")
    print(f"真题套数: {len({f'{i[0]}{i[1]}' for i in byslot})}")
    json.dump(items, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    # 抽样
    for it in items[:3]:
        print("\n——", it["area"], "|", it["topic"], "|", it.get("year", "-"), it.get("session", ""), it.get("no", ""))
        print("   ", it["stem"][:100].replace("\n", " "))
        print("    ", [o["text"][:20] for o in it["options"]], "答案", it["answer"])
        print("   解析:", it["explanation"][:90].replace("\n", " "))


if __name__ == "__main__":
    main()
