import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { areas, loadAll } from '../model/questions';
import { useApp } from '../model/StateContext';
import type { Question } from '../model/types';

export function Home() {
  const nav = useNavigate();
  const { state } = useApp();
  const [all, setAll] = useState<Question[]>([]);

  useEffect(() => {
    loadAll().then(setAll);
  }, []);

  const stats = useMemo(() => {
    const total = all.length;
    const answered = all.filter((q) => state.progress[q.id]?.tries).length;
    return { total, answered, pct: total ? (answered / total) * 100 : 0 };
  }, [all, state.progress]);

  const areaProgress = useMemo(() => {
    const map: Record<string, { total: number; done: number }> = {};
    for (const a of areas) map[a.id] = { total: 0, done: 0 };
    for (const q of all) {
      if (!map[q.area]) map[q.area] = { total: 0, done: 0 };
      map[q.area].total += 1;
      if (state.progress[q.id]?.tries) map[q.area].done += 1;
    }
    return map;
  }, [all, state.progress]);

  const wrongCount = Object.values(state.wrong).filter((w) => !w.cleared).length;

  // 最近的续做位置
  const resumeTarget = useMemo(() => {
    const entries = Object.entries(state.resume);
    if (!entries.length) return null;
    return entries[entries.length - 1][0];
  }, [state.resume]);

  return (
    <div className="page">
      <h1 className="h1">软考 · 软件设计师</h1>
      <p className="sub">中级 · 章节练习与模考</p>

      <div className="hero">
        <div className="hero__label">已刷题</div>
        <div className="hero__num">
          {stats.answered}
          <small>/ {stats.total}</small>
        </div>
        <div className="progress" style={{ background: 'rgba(255,255,255,.25)', marginBottom: 14 }}>
          <div className="progress__bar" style={{ width: `${stats.pct}%`, background: '#fff' }} />
        </div>
        <div className="hero__actions">
          <button
            className="hero__btn hero__btn--solid"
            onClick={() => nav(resumeTarget ? `/play/${resumeTarget}` : '/play/all')}
          >
            {resumeTarget ? '继续上次练习' : '顺序刷题'}
          </button>
          <button className="hero__btn" onClick={() => nav('/play/random')}>
            随机 30 题
          </button>
        </div>
      </div>

      <div className="section-title">考试</div>
      <button
        className="card"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 16,
          textAlign: 'left',
        }}
        onClick={() => nav('/mock')}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'var(--primary-weak)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            flex: 'none',
            fontSize: 14,
          }}
        >
          真题
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>模拟真题考试</div>
          <div className="area-row__desc">
            上午卷 75 单选 / 下午卷 5 案例 · 各 150 分钟 · 交卷后逐题回顾
          </div>
        </div>
        <span className="chevron">›</span>
      </button>

      <button
        className="card"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 16,
          marginTop: 10,
          textAlign: 'left',
        }}
        onClick={() => nav('/exam')}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'var(--primary-weak)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            flex: 'none',
            fontSize: 14,
          }}
        >
          随机
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>随机组卷 · 150 分钟</div>
          <div className="area-row__desc">从当前题库抽题，交卷后出分项报告</div>
        </div>
        <span className="chevron">›</span>
      </button>

      <div className="section-title">
        <span>章节目录</span>
        <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>{areas.length} 个知识域</span>
      </div>
      <div className="card">
        {areas.map((a, i) => {
          const p = areaProgress[a.id] ?? { total: 0, done: 0 };
          return (
            <button key={a.id} className="area-row" onClick={() => nav(`/play/chapter/${a.id}`)}>
              <span className="area-row__idx">{i + 1}</span>
              <span className="area-row__main">
                <span className="area-row__name">{a.name}</span>
                <span className="area-row__desc">{a.desc ?? ''}</span>
                <span className="progress">
                  <span
                    className="progress__bar"
                    style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%` }}
                  />
                </span>
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-3)', flex: 'none' }}>
                {p.done}/{p.total}
              </span>
              <span className="chevron">›</span>
            </button>
          );
        })}
      </div>

      <div className="section-title">我的</div>
      <div className="card">
        <button className="area-row" onClick={() => nav('/wrong')}>
          <span className="area-row__idx">错</span>
          <span className="area-row__main">
            <span className="area-row__name">
              错题本
              {wrongCount > 0 && (
                <span className="chip chip--bad" style={{ marginLeft: 2 }}>
                  {wrongCount}
                </span>
              )}
            </span>
            <span className="area-row__desc">答错自动收录，连续答对 5 次归档为已学会</span>
          </span>
          <span className="chevron">›</span>
        </button>
        <button className="area-row" onClick={() => nav('/play/fav')}>
          <span className="area-row__idx">藏</span>
          <span className="area-row__main">
            <span className="area-row__name">
              收藏夹
              {state.fav.length > 0 && (
                <span className="chip" style={{ marginLeft: 2 }}>
                  {state.fav.length}
                </span>
              )}
            </span>
            <span className="area-row__desc">手动标记的重点题</span>
          </span>
          <span className="chevron">›</span>
        </button>
      </div>
    </div>
  );
}
