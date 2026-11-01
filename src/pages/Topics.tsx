import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadAll } from '../model/questions';
import { useApp } from '../model/StateContext';
import { computeTopics, groupTopics, weakestTopics, WEAK_RATE, type TopicFilter } from '../model/topics';
import type { Question } from '../model/types';

export function topicPath(tag: string): string {
  return `/play/tag/${encodeURIComponent(tag)}`;
}

export function Topics() {
  const nav = useNavigate();
  const { state } = useApp();
  const [all, setAll] = useState<Question[]>([]);
  const [filter, setFilter] = useState<TopicFilter>('practiced');

  useEffect(() => {
    loadAll().then(setAll);
  }, []);

  const topics = useMemo(() => computeTopics(all, state), [all, state]);
  const groups = useMemo(() => groupTopics(topics, filter), [topics, filter]);
  const weak = useMemo(() => weakestTopics(topics, 5), [topics]);
  const untouched = topics.filter((t) => t.answered === 0).length;
  const practiced = topics.length - untouched;
  const weakCount = topics.filter((t) => t.accuracy !== null && t.accuracy < WEAK_RATE).length;

  return (
    <div className="page">
      <h1 className="h1">考点诊断</h1>
      <p className="sub">
        按题目自带的考点标签聚合，比 10 个知识域更能指出具体薄弱点（共 {topics.length} 个考点）
      </p>

      <div className="seg" style={{ marginTop: 14 }}>
        <button
          className={`seg__item${filter === 'practiced' ? ' is-active' : ''}`}
          onClick={() => setFilter('practiced')}
        >
          已练 {practiced}
        </button>
        <button
          className={`seg__item${filter === 'weak' ? ' is-active' : ''}`}
          onClick={() => setFilter('weak')}
        >
          薄弱 {weakCount}
        </button>
        <button
          className={`seg__item${filter === 'untouched' ? ' is-active' : ''}`}
          onClick={() => setFilter('untouched')}
        >
          未练 {untouched}
        </button>
      </div>

      {weak.length > 0 && filter === 'practiced' && (
        <>
          <div className="section-title">
            <span>优先补这几处</span>
            <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>正确率低于 60%</span>
          </div>
          <div className="card">
            {weak.map((t) => (
              <button className="area-row" key={t.tag} onClick={() => nav(topicPath(t.tag))}>
                <span
                  className="area-row__idx"
                  style={{
                    background: 'var(--bad-weak)',
                    color: 'var(--bad)',
                    width: 34,
                    fontSize: 10.5,
                    fontWeight: 700,
                  }}
                >
                  {Math.round((t.accuracy ?? 0) * 100)}%
                </span>
                <span className="area-row__main">
                  <span className="area-row__name">{t.tag}</span>
                  <span className="area-row__desc">
                    {t.areaName} · 作答 {t.tries} 次，对 {t.correct} 次
                  </span>
                </span>
                <span className="chip chip--bad">去练</span>
              </button>
            ))}
          </div>
        </>
      )}

      {groups.length === 0 ? (
        <div className="empty">
          <div className="empty__title">
            {filter === 'weak'
              ? '还没有薄弱考点'
              : filter === 'untouched'
                ? '所有考点都练过了'
                : '还没有练过的考点'}
          </div>
          <div>
            {filter === 'weak'
              ? '继续做题，正确率低于 60% 的考点会自动出现在这里'
              : filter === 'untouched'
                ? '回到「今日」或「刷题」继续练，错题会自动归类到考点'
                : '每道题都带考点标签，做过一题这里就会亮起来'}
          </div>
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.areaId}>
            <div className="section-title">
              <span>{g.areaName}</span>
              <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>{g.topics.length} 个考点</span>
            </div>
            <div className="card">
              {g.topics.map((t) => (
                <button className="area-row" key={t.tag} onClick={() => nav(topicPath(t.tag))}>
                  <span className="area-row__main">
                    <span className="area-row__name">
                      {t.tag}
                      {t.dueCount > 0 && (
                        <span className="chip chip--bad" style={{ marginLeft: 6 }}>
                          到期 {t.dueCount}
                        </span>
                      )}
                    </span>
                    <span className="progress" style={{ marginTop: 6 }}>
                      <span
                        className="progress__bar"
                        style={{
                          width: `${t.accuracy === null ? 0 : Math.round(t.accuracy * 100)}%`,
                          background:
                            t.accuracy === null
                              ? 'var(--line)'
                              : t.accuracy >= WEAK_RATE
                                ? 'var(--ok)'
                                : 'var(--bad)',
                        }}
                      />
                    </span>
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)', flex: 'none', textAlign: 'right' }}>
                    {t.accuracy === null ? '未练' : `${Math.round(t.accuracy * 100)}%`}
                    <br />
                    {t.total} 题
                  </span>
                  <span className="chevron">›</span>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
