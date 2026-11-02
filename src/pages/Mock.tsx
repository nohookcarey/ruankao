import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadAll } from '../model/questions';
import { useApp } from '../model/StateContext';
import { listPapers, PART, type PaperPart } from '../model/paper';
import type { Question } from '../model/types';
import { IconBack } from '../components/Icons';

export function Mock() {
  const nav = useNavigate();
  const { state } = useApp();
  const [all, setAll] = useState<Question[]>([]);
  const [part, setPart] = useState<PaperPart>('am');

  useEffect(() => {
    loadAll().then(setAll);
  }, []);

  const entries = useMemo(() => listPapers(all, part), [all, part]);
  const past = entries.filter((e) => e.kind === 'past');
  const mock = entries.filter((e) => e.kind === 'mock');
  const done = state.exams.filter((e) => e.kind === part);

  return (
    <div className="page">
      <div className="topbar">
        <button className="icon-btn" onClick={() => nav('/')} aria-label="返回">
          <IconBack />
        </button>
        <span className="topbar__title">模拟真题考试</span>
      </div>

      <p className="sub" style={{ marginTop: 10 }}>
        按真实卷面组卷：上午卷 75 道单选、下午卷案例分析，各 150 分钟，满分 75 分、45 分合格。
        交卷后才统一判分，中途不给对错提示。未作答的题按缺考处理，不计入刷题统计。
      </p>

      <div className="seg" style={{ marginTop: 14 }}>
        <button
          className={`seg__item${part === 'am' ? ' is-active' : ''}`}
          onClick={() => setPart('am')}
        >
          上午卷 · 单选
        </button>
        <button
          className={`seg__item${part === 'pm' ? ' is-active' : ''}`}
          onClick={() => setPart('pm')}
        >
          下午卷 · 案例
        </button>
      </div>

      <div className="banner banner--info" style={{ marginTop: 12 }}>
        {PART[part].desc} · 合格线 {Math.round(PART[part].fullScore * 0.6)} 分
        {done.length > 0 && ` · 已考 ${done.length} 次`}
      </div>

      <div className="section-title">
        <span>真题卷</span>
        <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>{past.length} 套</span>
      </div>

      {past.length === 0 ? (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>题库里还没有录入真题</div>
          <div className="sub" style={{ marginTop: 6, lineHeight: 1.7 }}>
            录入真题后这里会自动出现按年份分好的整卷。题目需带上{' '}
            <code>source: "past-exam"</code>、<code>year</code>、<code>session</code>（H 上半年 /
            L 下半年）、<code>no</code>（题号）四个字段，同一年的卷子会按题号排序成卷。
          </div>
        </div>
      ) : (
        <div className="card">
          {past.map((e) => (
            <button
              key={e.key}
              className="area-row"
              onClick={() => nav(`/mock/${e.part}/${e.key}`)}
            >
              <span className="area-row__idx">真</span>
              <span className="area-row__main">
                <span className="area-row__name">{e.title}</span>
                <span className="area-row__desc">
                  {e.complete
                    ? `${e.available} 题 · 完整卷面`
                    : `现有 ${e.available} 题 · 缺 ${e.size - e.available} 题`}
                </span>
              </span>
              {!e.complete && <span className="chip chip--bad">缺题</span>}
              <span className="chevron">›</span>
            </button>
          ))}
        </div>
      )}

      <div className="section-title">模拟卷</div>
      <div className="card">
        {mock.map((e) => (
          <button
            key={e.key}
            className="area-row"
            onClick={() => nav(`/mock/${e.part}/${e.key}`)}
          >
            <span className="area-row__idx">模</span>
            <span className="area-row__main">
              <span className="area-row__name">{e.title}</span>
              <span className="area-row__desc">
                {e.complete
                  ? `${e.available} 题 · 按知识域配比抽题`
                  : `题库现有 ${e.available} 题 · 按现有题量成卷`}
              </span>
            </span>
            <span className="chevron">›</span>
          </button>
        ))}
      </div>

      {!mock[0]?.complete && (
        <div className="banner banner--info" style={{ marginTop: 12 }}>
          题库题量还不足以拼出完整真实卷面，当前按现有题量成卷、按比例折算 75 分制，
          分数只作趋势参考，不代表真实考试水平。补题后无需改代码，卷面会自动填满。
        </div>
      )}

      {done.length > 0 && (
        <>
          <div className="section-title">本卷型记录</div>
          <div className="card">
            {done.slice(0, 5).map((e) => (
              <div className="list-item" key={e.id}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14 }}>{e.title}</span>
                  <span
                    className="chip"
                    style={{
                      color: e.passed ? 'var(--ok)' : 'var(--bad)',
                      background: e.passed ? 'var(--ok-weak)' : 'var(--bad-weak)',
                    }}
                  >
                    {e.score ?? '—'}/{e.maxScore ?? 75}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
