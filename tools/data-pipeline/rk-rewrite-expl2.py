#!/usr/bin/env python3
# 收尾：关系代数符号统一 + 关键解析重写
import glob
import json
import re

EXPL = {
    '2016L-54': (
        '本题考查关系代数运算。自然连接是一种特殊的等值连接：要求两个关系中比较的分量是相同的属性组，'
        '并在结果集中去掉重复的属性列。\n\n'
        'R(A,B,C,D) 与 S(A,C,E,F) 的公共属性是 A、C，自然连接后只保留一份，'
        '结果属性列依次为 R.A、R.B、R.C、R.D、S.E、S.F，共 6 个。\n\n'
        '所以第 54 空答案为 6。'
    ),
    '2016L-55': (
        '接上一空。自然连接 R⋈S 的属性列依次编号为：R.A(1)、R.B(2)、R.C(3)、R.D(4)、S.E(5)、S.F(6)。'
        'σ_R.B>S.E 表示选取 R.B 大于 S.E 的元组，即第 2 列大于第 5 列。\n\n'
        '若改写为在笛卡儿积 R×S 上运算，其列顺序是 R.A(1)、R.B(2)、R.C(3)、R.D(4)、S.A(5)、S.C(6)、S.E(7)、S.F(8)，'
        '此时需要先按 R.A=S.A 且 R.C=S.C 做等值选择（第 1 列等于第 5 列、第 3 列等于第 6 列），'
        '再选出第 2 列大于第 7 列，最后投影出第 1、2、3、4、7、8 列，'
        '即 π₁,₂,₃,₄,₇,₈( σ_{1=5 ∧ 3=6 ∧ 2>7}(R×S) )。\n\n'
        '这与选项 B 的形式一致，选 B。'
    ),
    '2018H-52': (
        '本题考查关系代数与 SQL 的对应关系。R(A,B,C,D,E) 与 S(B,C,F,G) 的公共属性为 B、C，'
        '自然连接去掉重复的 S.B、S.C 后，属性列依次为：R.A(1)、R.B(2)、R.C(3)、R.D(4)、R.E(5)、S.F(6)、S.G(7)。\n\n'
        'π₂,₄,₆,₇ 表示取第 2、4、6、7 列，也就是 R.B、R.D、S.F、S.G，正好对应 SELECT 子句要输出的列。\n\n'
        '因此第 52 空选 A。'
    ),
    '2018H-53': (
        '接上一空。σ₂<₇ 表示选取第 2 列小于第 7 列的元组，即 R.B < S.G。\n\n'
        '由于自然连接没有直接写在 FROM 中，需要用 R、S 的笛卡儿积配合等值条件实现：'
        '先要求 R.B=S.B 且 R.C=S.C 完成连接，再要求 R.B<S.G 完成选择。\n\n'
        '所以 WHERE 子句为 R.B=S.B AND R.C=S.C AND R.B<S.G，第 53 空选 C。'
    ),
}

RE_BOWTIE = re.compile(r'\s*bowtie\s*', re.I)
# 状态机转移 0->1、q0->q1 这类，转成 →（不影响 C 代码里的 p->next）
RE_ARROW = re.compile(r'(?<=[\d])\s*->\s*(?=[\dqQ])')
RE_ARROW2 = re.compile(r'(?<=[qQ]\d)\s*->\s*(?=[\dqQ])')

done = []
for f in sorted(glob.glob('src/data/areas/*.json')):
    data = json.load(open(f, encoding='utf-8'))
    dirty = False
    for q in data:
        qid = q['id']
        if qid in EXPL:
            q['explanation'] = EXPL[qid]
            dirty = True
            done.append(qid)
        for field in ('stem', 'explanation'):
            v = q.get(field)
            if not isinstance(v, str) or not v:
                continue
            nv = RE_BOWTIE.sub('⋈', v)
            nv = RE_ARROW.sub('→', nv)
            nv = RE_ARROW2.sub('→', nv)
            if nv != v:
                q[field] = nv
                dirty = True
    if dirty:
        with open(f, 'w', encoding='utf-8') as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
            fh.write('\n')

print('重写解析', len(done), '道:', done)
