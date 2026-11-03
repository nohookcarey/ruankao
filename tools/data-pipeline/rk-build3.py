#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""阶段三：分配 id、复制配图、按知识域输出 JSON 到 /tmp/rk-build/areas/

不直接改仓库，先产出到 staging，确认无误再拷过去。
"""
import hashlib
import json
import os
import re
import shutil
from collections import defaultdict

SRC = "/tmp/rk-build/questions.json"
STAGE = "/tmp/rk-build/areas"
FIG_OUT = "/tmp/rk-build/figures"

AREA_ORDER = ["arch", "os", "db", "net", "ds", "lang", "se", "oo", "dp", "sec"]


def main():
    items = json.load(open(SRC, encoding="utf-8"))
    # 选项本身就是图片的题（抽掉图后选项为空）无法作答，直接丢弃
    before = len(items)
    items = [it for it in items if all(o["text"].strip() for o in it["options"])]
    # 题干里混进了上一题的选项文本（解析失败所致），同样丢弃
    leak = re.compile(r"(?<![A-Za-z0-9])[A-D]\.\s")
    items = [it for it in items if not leak.search(it["stem"])]
    dropped = before - len(items)
    if dropped:
        print(f"丢弃选项为图片的题：{dropped}")
    if os.path.isdir(STAGE):
        shutil.rmtree(STAGE)
    os.makedirs(STAGE)
    os.makedirs(FIG_OUT, exist_ok=True)

    # 1) 解决同卷同号冲突：先到的保留真题身份，其余降级
    seen = set()
    for it in items:
        if "year" not in it:
            continue
        slot = (it["year"], it["session"], it["no"])
        if slot in seen:
            it.pop("year"), it.pop("session"), it.pop("no")
            it["demoted"] = True
        else:
            seen.add(slot)

    # 2) 分配 id
    counters = defaultdict(int)
    for it in items:
        if "year" in it:
            it["id"] = f"{it['year']}{it['session']}-{it['no']:02d}"
        else:
            counters[it["area"]] += 1
            it["id"] = f"{it['area']}-x{counters[it['area']]:03d}"

    # 3) 配图：内容寻址命名，多个小题共用同一张图时只存一份
    fig_map = {}
    for it in items:
        figs = []
        for f in it.get("qfigs") or []:
            if not os.path.exists(f):
                continue
            h = hashlib.md5(open(f, "rb").read()).hexdigest()[:10]
            name = f"fig-{h}.png"
            dst = os.path.join(FIG_OUT, name)
            if not os.path.exists(dst):
                shutil.copy2(f, dst)
            figs.append(name)
            fig_map[f] = name
        it["_figs"] = figs

    # 4) 输出
    by_area = defaultdict(list)
    for it in items:
        by_area[it["area"]].append(it)

    total = 0
    for area in AREA_ORDER:
        lst = by_area.get(area, [])
        # 真题优先按年份、题号排，其余按章节顺序
        lst.sort(key=lambda q: (q.get("year", 9999), q.get("session", ""), q.get("no", 0), q["id"]))
        out = []
        for q in lst:
            stem = q["stem"]
            for n, fig in enumerate(q["_figs"]):
                stem += f"\n\n![题图](figures/{fig})"
            entry = {
                "id": q["id"],
                "type": "single",
                "area": q["area"],
                "difficulty": 2,
                "source": "past-exam" if "year" in q else "other",
                "tags": [t for t in dict.fromkeys([q["topic"], q["section"]]) if t],
                "stem": stem,
                "options": q["options"],
                "answer": q["answer"],
                "explanation": q["explanation"] or "",
            }
            if "year" in q:
                entry["year"] = q["year"]
                entry["session"] = q["session"]
                entry["no"] = q["no"]
            out.append(entry)
        with open(os.path.join(STAGE, f"{area}.json"), "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=1)
        total += len(out)
        kb = os.path.getsize(os.path.join(STAGE, f"{area}.json")) / 1024
        print(f"  {area:5s} {len(out):4d} 题  {kb:7.0f} KB")

    fig_total = len(os.listdir(FIG_OUT))
    fig_size = sum(os.path.getsize(os.path.join(FIG_OUT, f)) for f in os.listdir(FIG_OUT)) / 1024 / 1024
    print(f"合计 {total} 题；配图 {fig_total} 张 / {fig_size:.1f} MB")
    print(f"真题 {sum(1 for it in items if 'year' in it)}；降级 {sum(1 for it in items if it.get('demoted'))}")
    print(f"有解析 {sum(1 for it in items if it['explanation'])}；有配图 {sum(1 for it in items if it['_figs'])}")


if __name__ == "__main__":
    main()
