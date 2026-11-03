#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""阶段一：从 docx 提取题目 → /tmp/rk-build/raw.json（含图片本地路径）

不做 OCR、不写仓库，只产出中间结果，便于反复校验。
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, "/tmp")
from importlib import util as _u

# 复用 rk-extract.py 的解析函数
spec = _u.spec_from_file_location("rkx", "/tmp/rk-extract.py")
rkx = _u.module_from_spec(spec)
spec.loader.exec_module(rkx)

MEDIA_ROOT = "/tmp/rk-media"
OUT = "/tmp/rk-build"

# 章节 → 知识域（章节首字）
CHAPTER_AREA = {
    "1": "arch", "2": "lang", "3、4": "ds", "5": "sec", "6": "db",
    "7": "oo", "8": "oo", "9": "dp", "10": "os", "11": "se",
    "12、13": "se", "14": "sec", "15": "net", "16": "ds",
}


def main():
    pairs = json.load(open("/tmp/ruankao_pairs.json", encoding="utf-8"))
    if os.path.isdir(MEDIA_ROOT):
        shutil.rmtree(MEDIA_ROOT)
    os.makedirs(MEDIA_ROOT, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)

    records = []
    for idx, r in enumerate(pairs):
        src = os.path.join(r["dir"], r["a"] if r["a"] else r["q"])
        media = os.path.join(MEDIA_ROOT, f"p{idx:03d}")
        try:
            md = rkx.to_md(src, media)
        except Exception as e:
            print(f"[跳过] {r['file']} {e}", file=sys.stderr)
            continue
        md_dir = os.path.join(media, "media")
        for sec_title, lines in rkx.split_blocks(md):
            for g in rkx.parse_section(lines):
                stem = rkx.clean_text(g["stem"])
                if not stem:
                    continue
                year = rkx.YEAR_RE.search(g["stem"])
                area = CHAPTER_AREA.get(r["chapter"])
                for s in g["subs"]:
                    records.append({
                        "area": area,
                        "chapter": r["chapter"],
                        "topic": r["title"],
                        "section": sec_title,
                        "no": s["no"],
                        "stem": stem,
                        "options": s["options"],
                        "marks": sorted(s["marks"]),
                        "qfigs": [os.path.join(md_dir, f) for f in g["images"]],
                        "efigs": [os.path.join(md_dir, f) for f in s["figs"]],
                        "year_raw": year.group(0) if year else "",
                        "file": os.path.basename(src),
                        "pidx": idx,
                    })
        if idx % 40 == 0:
            print(f"  处理 {idx}/{len(pairs)} …", file=sys.stderr)

    json.dump(records, open(os.path.join(OUT, "raw.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    ok = [r for r in records if len(r["options"]) == 4 and len(r["marks"]) == 1]
    print(f"提取 {len(records)} 条，可用 {len(ok)} 条")
    print(f"题目图 {sum(len(r['qfigs']) for r in ok)} 张，解析图 {sum(len(r['efigs']) for r in ok)} 张")


if __name__ == "__main__":
    main()
