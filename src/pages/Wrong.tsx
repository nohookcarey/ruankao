import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { areaMap, loadAll } from '../model/questions';
import { useApp } from '../model/StateContext';
import type { Question } from '../model/types';
import { Markdown } from '../components/Markdown';

export function Wrong() {
  const nav = useNavigate();
  const { state, removeWrong, restoreWrong, toggleFav } = useApp();
  const [all, setAll] = useState<Question[]>([]);
  const [tab, setTab] = useState<'open' | 'cleared'>('open');

  useEffect(() => {
    loadAll().then(setAll);
  }, []);

  const { open, cleared } = useMemo(() => {
    const o: Question[] = [];
    const c: Question[] = [];
    for (const q of all) {
      const w = state.wrong[q.id];
      if (!w) continue;
      if (w.cleared) c.push(q);
      else o.push(q);
    }
    return { open: o, cleared: c };
  }, [all, state.wrong]);

  const list = tab === 'open' ? open : cleared;

  return (
    <div className="page">
      <h1 className="h1">错题本</h1>
      <p className="sub">
        答错自动收录 · 连续答对 2 次转为已掌握（待复习 {open.length}，已掌握 {cleared.length}）
      </p>

      <div className="seg" style={{ marginTop: 14 }}>
        <button
          className={`seg__item${tab === 'open' ? ' is-active' : ''}`}
          onClick={() => setTab('open')}
        >
          待复习 {open.length}
        </button>
        <button
          className={`seg__item${tab === 'cleared' ? ' is-active' : ''}`}
          onClick={() => setTab('cleared')}
        >
          已掌握 {cleared.length}
        </button>
      </div>

      {list.length > 0 && tab === 'open' && (
        <button
          className="btn btn--primary btn--block"
          style={{ marginTop: 14 }}
          onClick={() => nav('/play/wrong')}
        >
          开始复习这 {list.length} 道错题
        </button>
      )}

      {list.length === 0 ? (
        <div className="empty">
          <div className="empty__title">{tab === 'open' ? '没有待复习的错题' : '还没有已掌握的题'}</div>
          <div>
            {tab === 'open'
              ? '去刷题吧，答错会自动收进来'
              : '同一道错题连续答对两次，就会移到这里'}
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 14 }}>
          {list.map((q) => (
            <div className="list-item" key={q.id}>
              <div className="list-item__stem">
                <Markdown>{q.stem}</Markdown>
              </div>
              <div className="list-item__foot">
                <span className="chip chip--primary">{areaMap[q.area]?.name ?? q.area}</span>
                <span className="chip">
                  {q.type === 'single' ? '单选' : q.type === 'fill' ? '填空' : '案例'}
                </span>
                <span style={{ flex: 1 }} />
                {tab === 'cleared' ? (
                  <button className="btn btn--ghost btn--sm" onClick={() => restoreWrong(q.id)}>
                    移回待复习
                  </button>
                ) : (
                  <>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => toggleFav(q.id)}
                    >
                      {state.fav.includes(q.id) ? '取消收藏' : '收藏'}
                    </button>
                    <button className="btn btn--ghost btn--sm" onClick={() => removeWrong(q.id)}>
                      移除
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
