import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadAll } from '../model/questions';
import { useApp } from '../model/StateContext';
import { computeStreak, dateKey, daysUntil, formatDateKey } from '../model/date';
import { DAILY_SIZE, dueWrongIds } from '../model/review';
import { computeTopics, weakestTopics } from '../model/topics';
import type { Question } from '../model/types';

export function Today() {
  const nav = useNavigate();
  const { state } = useApp();
  const [all, setAll] = useState<Question[]>([]);

  useEffect(() => {
    loadAll().then(setAll);
  }, []);

  const today = dateKey();
  const goal = state.settings.dailyGoal || 20;

  const view = useMemo(() => {
    const todayLog = state.log.filter((e) => dateKey(e.at) === today);
    const daily = state.daily[today];
    // 题库还没加载完时不过滤，避免一进页面先闪一下「0 题」
    const valid = all.length ? new Set(all.map((q) => q.id)) : undefined;
    const due = dueWrongIds(state, Date.now(), valid);
    const streak = computeStreak(state.checkins);
    const examDate = state.settings.examDate;
    const left = examDate ? daysUntil(examDate, today) : null;
    const weak = weakestTopics(computeTopics(all, state), 2);
    const done = all.filter((q) => state.progress[q.id]?.tries).length;
    return {
      answeredToday: todayLog.length,
      todayCorrect: todayLog.filter((e) => e.ok).length,
      daily,
      due,
      streak,
      examDate,
      left,
      weak,
      done,
      total: all.length,
    };
  }, [state, all, today]);

  const pct = Math.min(100, Math.round((view.answeredToday / goal) * 100));
  const goalReached = view.answeredToday >= goal;
  const countdown =
    view.left === null
      ? null
      : view.left > 0
        ? `距 ${formatDateKey(view.examDate!)}考试还有 ${view.left} 天`
        : view.left === 0
          ? '今天就是考试日，稳住心态'
          : `考试日已过 ${-view.left} 天`;

  return (
    <div className="page">
      <h1 className="h1">今日</h1>
      <p className="sub">
        {countdown ?? '在设置里填考试日期，这里会显示倒计时与每日任务量'}
      </p>

      <div className="hero">
        <div className="hero__label">连续打卡</div>
        <div className="hero__num">
          {view.streak}
          <small>天</small>
          <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.85, marginLeft: 12 }}>
            今日已练 {view.answeredToday} 题
          </span>
        </div>
        <div className="progress" style={{ background: 'rgba(255,255,255,.25)', marginBottom: 14 }}>
          <div className="progress__bar" style={{ width: `${pct}%`, background: '#fff' }} />
        </div>
        <div
          style={{
            fontSize: 12,
            opacity: 0.9,
            marginBottom: 12,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>每日目标 {goal} 题</span>
          <span>
            {goalReached
              ? `已达标 · 今日正确 ${view.todayCorrect} 题`
              : `还差 ${goal - view.answeredToday} 题`}
          </span>
        </div>
        <div className="hero__actions">
          <button className="hero__btn hero__btn--solid" onClick={() => nav('/play/daily')}>
            {view.daily ? '重做每日一练' : `每日一练 ${DAILY_SIZE} 题`}
          </button>
          <button
            className="hero__btn"
            onClick={() => nav(view.due.length ? '/play/review' : '/play/random')}
          >
            {view.due.length ? `复习到期 ${view.due.length} 题` : '随机 30 题'}
          </button>
        </div>
      </div>

      <div className="section-title">
        <span>今日任务</span>
        <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>
          全库 {view.done}/{view.total}
        </span>
      </div>
      <div className="card">
        <button className="area-row" onClick={() => nav('/play/daily')}>
          <span className="area-row__idx" style={{ background: 'var(--primary-weak)', color: 'var(--primary)' }}>
            练
          </span>
          <span className="area-row__main">
            <span className="area-row__name">
              每日一练
              {view.daily && <span className="chip chip--ok" style={{ marginLeft: 2 }}>已完成</span>}
            </span>
            <span className="area-row__desc">
              {view.daily
                ? `今日答对 ${view.daily.ok}/${view.daily.done} 题 · 每天固定一组，次日自动换题`
                : `${DAILY_SIZE} 题 · 按日期固定选题，同一天反复进入题目不变`}
            </span>
          </span>
          <span className="chevron">›</span>
        </button>

        <button className="area-row" onClick={() => nav('/play/review')}>
          <span
            className="area-row__idx"
            style={
              view.due.length
                ? { background: 'var(--bad-weak)', color: 'var(--bad)' }
                : undefined
            }
          >
            复
          </span>
          <span className="area-row__main">
            <span className="area-row__name">
              今日复习
              {view.due.length > 0 && (
                <span className="chip chip--bad" style={{ marginLeft: 2 }}>
                  {view.due.length}
                </span>
              )}
            </span>
            <span className="area-row__desc">
              {view.due.length
                ? '按记忆曲线到期：答错 10 分钟后重来，答对后间隔逐次拉长'
                : '暂无到期错题，答错的题会先隔 10 分钟、再按 1/2/4/7 天排期'}
            </span>
          </span>
          <span className="chevron">›</span>
        </button>

        <button className="area-row" onClick={() => nav('/topics')}>
          <span className="area-row__idx">点</span>
          <span className="area-row__main">
            <span className="area-row__name">考点诊断</span>
            <span className="area-row__desc">
              {view.weak.length
                ? `最该补：${view.weak.map((t) => t.tag).join('、')}`
                : '按考点拆开看掌握度，定位到具体知识点'}
            </span>
          </span>
          <span className="chevron">›</span>
        </button>
      </div>

      <div className="section-title">快捷</div>
      <div className="grid2">
        <button className="quick" onClick={() => nav('/play/memorize')}>
          <span className="quick__title">背题速览</span>
          <span className="quick__desc">直接看题与解析</span>
        </button>
        <button className="quick" onClick={() => nav('/mock')}>
          <span className="quick__title">模拟真题</span>
          <span className="quick__desc">上午卷 / 下午卷</span>
        </button>
        <button className="quick" onClick={() => nav('/play/random')}>
          <span className="quick__title">随机 30 题</span>
          <span className="quick__desc">打散知识域</span>
        </button>
        <button className="quick" onClick={() => nav('/wrong')}>
          <span className="quick__title">错题本</span>
          <span className="quick__desc">待复习与已学会</span>
        </button>
      </div>
    </div>
  );
}
