import glob, json, re

RE_HEAD = re.compile(r'^\s*试\s*题\s*[（(][\d\s）()、,，~～\-－至]*[)）]?\s*分\s*析\s*')

stripped = 0
copied = None
for f in sorted(glob.glob('src/data/areas/*.json')):
    data = json.load(open(f, encoding='utf-8'))
    dirty = False
    for q in data:
        e = q.get('explanation')
        if isinstance(e, str) and e:
            ne = RE_HEAD.sub('', e).strip()
            if ne != e:
                q['explanation'] = ne
                dirty = True
                stripped += 1
    if dirty:
        with open(f, 'w', encoding='utf-8') as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
            fh.write('\n')

print('去掉重复标题:', stripped)

# 用同题组的解析补齐 2011H-55，给 ds-x001 写解析
EXPL_DSX001 = ('函数调用时，系统用栈保存返回地址、实参、局部变量等信息。'
               '嵌套调用（含递归）时，每进入一层就把当前现场压栈，返回时按后进先出的顺序弹出，'
               '因此能准确回到调用点的下一条指令继续执行。队列、优先队列、散列表都不具备这种后进先出的特性。')

for f in sorted(glob.glob('src/data/areas/*.json')):
    data = json.load(open(f, encoding='utf-8'))
    ids = {q['id']: q for q in data}
    dirty = False
    if '2011H-55' in ids and not (ids['2011H-55'].get('explanation') or '').strip():
        src = ids.get('2011H-56', {}).get('explanation') or ''
        if src:
            ids['2011H-55']['explanation'] = src
            dirty = True
            copied = '2011H-55 <- 2011H-56'
    if 'ds-x001' in ids and not (ids['ds-x001'].get('explanation') or '').strip():
        ids['ds-x001']['explanation'] = EXPL_DSX001
        dirty = True
        copied = (copied or '') + ' | ds-x001 手写'
    if dirty:
        with open(f, 'w', encoding='utf-8') as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
            fh.write('\n')
print('补齐:', copied)
