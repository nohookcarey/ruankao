import { useEffect, useMemo, useState } from 'react';
import { loadAll } from '../model/questions';
import { useApp } from '../model/StateContext';
import { computeStats, pct } from '../model/stats';
import { formatDuration } from '../model/state';
import type { Question } from '../model/types';

export function Stats() {
  const { state } = useApp();
  const [all, setAll] = useState<Question[]>([]);

  useEffect(() => {
    loadAll().then(setAll);
  }, []);

  const s = useMemo(() => computeStats(state, all), [state, all]);
  const maxWeek = Math.max(1, ...s.week.map((w) => w.count));

  const bestExam = useMemo(() => {
    if (!state.exams.length) return null;
    return state.exams.reduce((best, e) => {
      const a = e.total ? e.correct / e.total : 0;
      const b = best.total ? best.correct / best.total : 0;
      return a > b ? e : best;
    });
  }, [state.exams]);

  return (
    <div className="page">
      <h1 className="h1">学习统计</h1>
      <p className="sub">数据存在本机浏览器，换设备请到设置里导出</p>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat__num">
            {s.answered}
            <small>/ {s.totalQuestions}</small>
          </div>
          <div className="stat__label">已刷题数</div>
        </div>
        <div className="stat">
          <div className="stat__num">{pct(s.objectiveAccuracy)}</div>
          <div className="stat__label">客观题正确率（{s.objectiveTries} 次作答）</div>
        </div>
        <div className="stat">
          <div className="stat__num">{s.wrongOpen}</div>
          <div className="stat__label">待复习错题 · 已学会 {s.wrongCleared}</div>
        </div>
        <div className="stat">
          <div className="stat__num">{bestExam ? pct(bestExam.total ? bestExam.correct / bestExam.total : 0) : '—'}</div>
          <div className="stat__label">
            {bestExam ? `最佳模考 · ${bestExam.correct}/${bestExam.total}` : '尚未参加模考'}
          </div>
        </div>
      </div>

      {s.caseTotal > 0 && (
        <div className="card" style={{ padding: 14, marginTop: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14 }}>案例题自评</span>
            <span className="sub">
              会做 {s.caseKnown} / {s.caseTotal} 次（不计入客观题正确率）
            </span>
          </div>
        </div>
      )}

      <div className="section-title">
        <span>最近 7 天</span>
        <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>
          共 {s.week.reduce((a, b) => a + b.count, 0)} 次作答
        </span>
      </div>
      <div className="card" style={{ padding: '6px 14px 12px' }}>
        <div className="week">
          {s.week.map((d) => (
            <div className="week__col" key={d.date}>
              <span className="week__num">{d.count || ''}</span>
              <div
                className="week__bar"
                style={{
                  height: `${Math.max(3, (d.count / maxWeek) * 62)}px`,
                  opacity: d.count ? 1 : 0.25,
                }}
              />
              <span className="week__label">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="section-title">各知识域掌握度</div>
      <div className="card" style={{ padding: '4px 14px 14px' }}>
        {s.areaStats.map((a) => {
          const p = a.accuracy === null ? 0 : Math.round(a.accuracy * 100);
          return (
            <div className="bar-item" key={a.areaId}>
              <div className="bar-item__head">
                <span>
                  {a.name}
                  <span style={{ color: 'var(--text-3)', marginLeft: 6, fontSize: 12 }}>
                    {a.answered}/{a.total}
                  </span>
                </span>
                <span style={{ color: 'var(--text-2)' }}>
                  {a.accuracy === null ? '未练' : `${p}%`}
                </span>
              </div>
              <div className="bar-item__track">
                <div
                  className="bar-item__fill"
                  style={{
                    width: `${p}%`,
                    background:
                      a.accuracy === null
                        ? 'var(--line)'
                        : p >= 60
                          ? 'var(--ok)'
                          : 'var(--primary)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="section-title">
        <span>模考记录</span>
        <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>{state.exams.length} 次</span>
      </div>
      {state.exams.length === 0 ? (
        <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
          还没有模考记录
        </div>
      ) : (
        <div className="card">
          {state.exams.slice(0, 10).map((e) => {
            const p = e.total ? Math.round((e.correct / e.total) * 100) : 0;
            const hasScore = typeof e.score === 'number';
            const passed = e.passed ?? p >= 60;
            const kindLabel = e.kind === 'am' ? '上午卷' : e.kind === 'pm' ? '下午卷' : '随机卷';
            const d = new Date(e.submittedAt);
            return (
              <div className="list-item" key={e.id}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>
                    {d.getMonth() + 1} 月 {d.getDate()} 日 · {e.title}
                  </span>
                  <span
                    className="chip"
                    style={{
                      color: passed ? 'var(--ok)' : 'var(--bad)',
                      background: passed ? 'var(--ok-weak)' : 'var(--bad-weak)',
                    }}
                  >
                    {hasScore ? `${e.score}/${e.maxScore ?? 75}` : `${p}%`}
                  </span>
                </div>
                <div className="list-item__foot" style={{ marginTop: 6 }}>
                  <span className="chip chip--primary">{kindLabel}</span>
                  <span className="chip">
                    {e.kind === 'pm' ? '小问' : '客观题'} {e.correct}/{e.total}
                  </span>
                  <span className="chip">用时 {formatDuration(e.durationMs)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
