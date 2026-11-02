import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { areaMap, loadAll } from '../model/questions';
import { useApp } from '../model/StateContext';
import { MASTER_STREAK } from '../model/state';
import { dueLabel, isDue } from '../model/review';
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

  // 只统计题库中真实存在的到期错题，和下面列表保持一致
  const dueCount = useMemo(
    () => open.filter((q) => isDue(state.wrong[q.id]?.dueAt)).length,
    [open, state.wrong],
  );

  const list = tab === 'open' ? open : cleared;

  return (
    <div className="page">
      <h1 className="h1">错题本</h1>
      <p className="sub">
        答错自动收录 · 答错后 10 分钟先重来一次，答对后按 1/2/4/7 天排期 · 连对 {MASTER_STREAK}{' '}
        次归档为已学会（待复习 {open.length} · 已学会 {cleared.length}）
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
          已学会 {cleared.length}
        </button>
      </div>

      {list.length > 0 && tab === 'open' && (
        <div className="row" style={{ marginTop: 14, gap: 10 }}>
          <button
            className="btn btn--primary"
            style={{ flex: 1 }}
            onClick={() => nav(dueCount > 0 ? '/play/review' : '/play/wrong')}
          >
            {dueCount > 0 ? `复习到期 ${dueCount} 题` : `重练这 ${list.length} 道错题`}
          </button>
          {dueCount > 0 && dueCount < list.length && (
            <button
              className="btn btn--ghost"
              style={{ flex: '0 0 auto', minWidth: 96 }}
              onClick={() => nav('/play/wrong')}
            >
              全部重练
            </button>
          )}
        </div>
      )}

      {list.length === 0 ? (
        <div className="empty">
          <div className="empty__title">{tab === 'open' ? '没有待复习的错题' : '已学会存档还是空的'}</div>
          <div>
            {tab === 'open'
              ? '去刷题吧，答错会自动收进来'
              : `同一道错题连续答对 ${MASTER_STREAK} 次，就会自动归到这里存档`}
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 14 }}>
          {list.map((q) => {
            const streak = Math.min(state.progress[q.id]?.streak ?? 0, MASTER_STREAK);
            return (
              <div className="list-item" key={q.id}>
                <div className="list-item__stem">
                  <Markdown>{q.stem}</Markdown>
                </div>
                <div className="list-item__foot">
                  <span className="list-item__chips">
                    <span className="chip chip--primary">{areaMap[q.area]?.name ?? q.area}</span>
                    <span className="chip">
                      {q.type === 'single' ? '单选' : q.type === 'fill' ? '填空' : '案例'}
                    </span>
                    {tab === 'open' ? (
                      <>
                        <span className={`chip${streak > 0 ? ' chip--ok' : ''}`}>
                          连对 {streak}/{MASTER_STREAK}
                        </span>
                        <span
                          className={`chip${isDue(state.wrong[q.id]?.dueAt) ? ' chip--bad' : ''}`}
                        >
                          {dueLabel(state.wrong[q.id]?.dueAt)}
                        </span>
                      </>
                    ) : (
                      <span className="chip chip--ok">已归档</span>
                    )}
                  </span>
                  <span className="list-item__acts">
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
                        <button
                          className="btn btn--ghost btn--sm"
                          onClick={() => {
                            // 误点一下就把错题删了，且无法撤销，必须确认
                            if (window.confirm('从错题本移除这道题？之后答错会重新收录。')) {
                              removeWrong(q.id);
                            }
                          }}
                        >
                          移除
                        </button>
                      </>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
