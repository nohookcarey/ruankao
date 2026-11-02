import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { areaMap, loadAll, shuffle } from '../model/questions';
import { hasAnswer, judgeQuestion } from '../model/judge';
import { useApp } from '../model/StateContext';
import { formatDuration } from '../model/state';
import type { ExamRecord, Question } from '../model/types';
import { QuestionView } from '../components/QuestionView';
import { IconBack, IconClock } from '../components/Icons';

const DURATION_MIN = 150;
const DRAFT_KEY = 'ruankao.exam.draft.v1';
/** 草稿超过这个时间视为废弃，避免几天后续上一场早该算弃考的卷子 */
const DRAFT_TTL_MS = 12 * 60 * 60 * 1000;

interface Answer {
  picked?: string | null;
  inputs?: string[];
}

interface Draft {
  ids: string[];
  answers: Record<string, Answer>;
  startedAt: number;
  updatedAt?: number;
  index?: number;
}

interface Result {
  correct: number;
  /** 参与判分的客观题数 */
  total: number;
  /** 实际作答数 */
  answered: number;
  byArea: Record<string, { correct: number; total: number; answered: number }>;
  caseCount: number;
  durationMs: number;
}

export function Exam() {
  const nav = useNavigate();
  const { saveExam, recordAnswer } = useApp();

  const [items, setItems] = useState<Question[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [index, setIndex] = useState(0);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<Result | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(false);
  /** 上次的草稿已超出考试时长，被丢弃重新组卷 */
  const [expiredNotice, setExpiredNotice] = useState(false);
  /** 是否因时间耗尽而自动交卷，用于在成绩页说明原因 */
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const submitted = useRef(false);
  const timeUp = useRef(false);

  // 组卷或恢复草稿
  useEffect(() => {
    let alive = true;
    loadAll().then((all) => {
      if (!alive) return;
      // 随机卷只取客观题：案例题要自评，混进来既判不了分，
      // 又会让「已答 x / 总题数」的分母对不上
      const pool = all.filter((q) => q.type !== 'case');
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        try {
          const d = JSON.parse(raw) as Draft;
          const stamp = d.updatedAt ?? d.startedAt ?? 0;
          const stale = Date.now() - stamp > DRAFT_TTL_MS;
          const startedTs = d.startedAt || Date.now();
          // 超过 150 分钟就作废：否则一打开页面就被自动交卷，直接吃一张 0 分成绩单
          const overtime = Date.now() - startedTs > DURATION_MIN * 60 * 1000;
          const byId = new Map(all.map((q) => [q.id, q]));
          const restored = d.ids.map((id) => byId.get(id)).filter(Boolean) as Question[];
          if (!stale && !overtime && restored.length > 0) {
            setItems(restored);
            setAnswers(d.answers ?? {});
            setStartedAt(startedTs);
            setIndex(Math.min(d.index ?? 0, restored.length - 1));
            setRestoredDraft(true);
            return;
          }
          if (overtime && !stale) setExpiredNotice(true);
          localStorage.removeItem(DRAFT_KEY);
        } catch {
          /* 草稿损坏则重新组卷 */
        }
      }
      const list = shuffle(pool).slice(0, Math.min(75, pool.length));
      setItems(list);
      setStartedAt(Date.now());
    }).catch(() => {
      if (alive) setLoadError(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // 计时
  useEffect(() => {
    if (result) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [result]);

  // 草稿持久化（防刷新/关页丢失）
  useEffect(() => {
    if (!items || result) return;
    const draft: Draft = {
      ids: items.map((q) => q.id),
      answers,
      startedAt,
      updatedAt: Date.now(),
      index,
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* 存储不可用时由全局提示接管 */
    }
  }, [items, answers, startedAt, result, index]);

  const elapsed = now - startedAt;
  const remain = Math.max(0, DURATION_MIN * 60 * 1000 - elapsed);

  const submit = useCallback(() => {
    if (!items || submitted.current) return;
    submitted.current = true;

    const byArea: Record<string, { correct: number; total: number; answered: number }> = {};
    let correct = 0;
    let total = 0;
    let answered = 0;
    let caseCount = 0;

    for (const q of items) {
      const a = answers[q.id];
      if (q.type === 'case') {
        caseCount += 1;
        continue;
      }
      total += 1;
      const bucket = byArea[q.area] ?? { correct: 0, total: 0, answered: 0 };
      bucket.total += 1;
      byArea[q.area] = bucket;

      // 缺考题不判分、不写统计，避免把「没做」当成「做错」
      if (!hasAnswer(q, a)) continue;

      answered += 1;
      bucket.answered += 1;
      const ok = judgeQuestion(q, { picked: a?.picked ?? null, inputs: a?.inputs ?? [] });
      if (ok) {
        correct += 1;
        bucket.correct += 1;
      }
      recordAnswer(q, Boolean(ok));
    }

    const rec: ExamRecord = {
      id: `exam-${Date.now()}`,
      title: `随机组卷 · ${items.length} 题`,
      startedAt,
      submittedAt: Date.now(),
      total,
      answered,
      correct,
      byArea,
      caseSelf: { known: 0, unknown: 0 },
      durationMs: Date.now() - startedAt,
      kind: 'random',
    };
    saveExam(rec);
    localStorage.removeItem(DRAFT_KEY);
    setResult({ correct, total, answered, byArea, caseCount, durationMs: rec.durationMs });
  }, [items, answers, startedAt, saveExam, recordAnswer]);

  // 时间到自动交卷
  useEffect(() => {
    if (!items || result) return;
    if (remain <= 0 && !timeUp.current) {
      timeUp.current = true;
      setAutoSubmitted(true);
      submit();
    }
  }, [remain, items, result, submit]);

  const q = items?.[index];

  const answeredCount = useMemo(() => {
    if (!items) return 0;
    // 案例题不进客观题作答统计（交卷时单独计数）
    return items.filter((it) => it.type !== 'case' && hasAnswer(it, answers[it.id])).length;
  }, [items, answers]);

  const objectiveCount = useMemo(
    () => (items ?? []).filter((it) => it.type !== 'case').length,
    [items],
  );

  const confirmSubmit = useCallback(() => {
    if (!items) return;
    if (answeredCount < objectiveCount) {
      const ok = window.confirm(
        `还有 ${objectiveCount - answeredCount} 题未作答，确定交卷吗？未作答的题按缺考处理，不计入已刷题、不进错题本。`,
      );
      if (!ok) return;
    }
    submit();
  }, [items, answeredCount, objectiveCount, submit]);

  if (!items) {
    return (
      <div className="page page--full">
        <div className="topbar">
          <button className="icon-btn" onClick={() => nav('/')} aria-label="返回">
            <IconBack />
          </button>
          <span className="topbar__title">模考</span>
        </div>
        <div className="empty">
          {loadError ? (
            <>
              <div className="empty__title">题库加载失败</div>
              <div>可能是网络中断，重新加载即可</div>
            </>
          ) : (
            '正在组卷…'
          )}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="page page--full">
        <div className="topbar">
          <button className="icon-btn" onClick={() => nav('/')} aria-label="返回">
            <IconBack />
          </button>
          <span className="topbar__title">模考</span>
        </div>
        <div className="empty">
          <div className="empty__title">题库为空</div>
          <div>导入题目后才能组卷</div>
        </div>
      </div>
    );
  }

  /* ---------- 交卷后：成绩报告 ---------- */
  if (result) {
    const score = result.answered ? Math.round((result.correct / result.answered) * 100) : 0;
    const skipped = result.total - result.answered;
    const areaRows = Object.entries(result.byArea).sort(
      (a, b) => b[1].total - a[1].total,
    );
    return (
      <div className="page page--full">
        <div className="topbar">
          <button className="icon-btn" onClick={() => nav('/')} aria-label="返回">
            <IconBack />
          </button>
          <span className="topbar__title">成绩报告</span>
        </div>

        <div className="result-hero">
          <div
            className="result-score"
            style={{ color: score >= 60 ? 'var(--ok)' : 'var(--bad)' }}
          >
            {score}
            <small>%</small>
          </div>
          <div className="result-sub">
            已答 {result.answered}/{result.total} 题 · 答对 {result.correct} 题 · 用时{' '}
            {formatDuration(result.durationMs)}
          </div>
          <div className="result-sub" style={{ marginTop: 2 }}>
            软考上午卷满分 75 分、45 分合格，可按本正确率自估
          </div>
        </div>

        {autoSubmitted && (
          <div className="banner banner--info">
            考试时间（{DURATION_MIN} 分钟）已用完，系统自动交卷。未作答的题按缺考处理。
          </div>
        )}

        {skipped > 0 && (
          <div className="banner banner--info">
            有 {skipped} 题未作答，按缺考处理：不计入已刷题数，也不进错题本。
          </div>
        )}

        {result.caseCount > 0 && (
          <div className="banner banner--info">
            本次含案例题 {result.caseCount} 道，未计入分数，请对照参考答案自行核对
          </div>
        )}

        <div className="section-title">分知识域</div>
        <div className="card" style={{ padding: '4px 14px 14px' }}>
          {areaRows.map(([areaId, v]) => {
            const at = v.answered ?? v.total;
            const p = at ? Math.round((v.correct / at) * 100) : 0;
            return (
              <div className="bar-item" key={areaId}>
                <div className="bar-item__head">
                  <span>{areaMap[areaId]?.name ?? areaId}</span>
                  <span style={{ color: 'var(--text-2)' }}>
                    {at === 0 ? '未作答' : `${v.correct}/${at} · ${p}%`}
                  </span>
                </div>
                <div className="bar-item__track">
                  <div
                    className="bar-item__fill"
                    style={{
                      width: `${p}%`,
                      background: p >= 60 ? 'var(--ok)' : 'var(--bad)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="actionbar">
          <div className="actionbar__inner">
            <button
              className="btn btn--ghost"
              style={{ flex: 1 }}
              onClick={() => {
                localStorage.removeItem(DRAFT_KEY);
                submitted.current = false;
                timeUp.current = false;
                setAutoSubmitted(false);
                setResult(null);
                setAnswers({});
                setIndex(0);
                setRestoredDraft(false);
                loadAll().then((all) => {
                  const pool = all.filter((x) => x.type !== 'case');
                  const list = shuffle(pool).slice(0, Math.min(75, pool.length));
                  setItems(list);
                  setStartedAt(Date.now());
                });
              }}
            >
              再考一次
            </button>
            <button className="btn btn--primary" style={{ flex: 1 }} onClick={() => nav('/stats')}>
              查看统计
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- 答题中 ---------- */
  const urgent = remain < 5 * 60 * 1000;

  return (
    <div className="page page--full">
      <div className="topbar">
        <button className="icon-btn" onClick={() => nav('/')} aria-label="返回">
          <IconBack />
        </button>
        <span className="topbar__title">
          模考 {index + 1}/{items.length}
        </span>
        <span
          className="chip"
          style={{
            color: urgent ? 'var(--bad)' : 'var(--text-2)',
            background: urgent ? 'var(--bad-weak)' : 'var(--bg-sub)',
            gap: 4,
          }}
        >
          <IconClock size={15} />
          {formatDuration(remain)}
        </span>
        <button className="icon-btn" onClick={() => setSheetOpen((v) => !v)} aria-label="答题卡">
          <span style={{ fontSize: 12, fontWeight: 700 }}>
            {answeredCount}/{items.length}
          </span>
        </button>
      </div>
      <div className="progress-line">
        <div
          className="progress-line__bar"
          style={{ width: `${(answeredCount / items.length) * 100}%` }}
        />
      </div>

      {expiredNotice && (
        <div className="banner banner--info fade-in" style={{ marginTop: 10 }}>
          上次的作答已超过考试时长（{DURATION_MIN} 分钟），无法继续续考，已为你重新组卷。
        </div>
      )}

      {restoredDraft && (
        <div className="banner banner--info fade-in" style={{ marginTop: 10 }}>
          已恢复上次的作答进度（第 {index + 1} 题，已答 {answeredCount}/{items.length}）。
          <button
            className="btn btn--ghost btn--sm"
            style={{ marginLeft: 8 }}
            onClick={() => {
              localStorage.removeItem(DRAFT_KEY);
              submitted.current = false;
              setAnswers({});
              setIndex(0);
              setStartedAt(Date.now());
              setRestoredDraft(false);
            }}
          >
            重新开始
          </button>
        </div>
      )}

      {sheetOpen && (
        <div className="card fade-in" style={{ padding: 14, marginTop: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>答题卡</span>
            <span className="sub">已答 {answeredCount} / {items.length}</span>
          </div>
          <div className="sheet">
            {items.map((it, i) => {
              const done = hasAnswer(it, answers[it.id]);
              return (
                <button
                  key={it.id}
                  className={`sheet__cell${done ? ' is-done' : ''}${i === index ? ' is-current' : ''}`}
                  onClick={() => {
                    setIndex(i);
                    setSheetOpen(false);
                  }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <button
            className="btn btn--ghost btn--block"
            style={{ marginTop: 12 }}
            onClick={() => {
              setSheetOpen(false);
              confirmSubmit();
            }}
          >
            交卷（已答 {answeredCount}/{items.length}）
          </button>
        </div>
      )}

      {q && (
        <QuestionView
          q={q}
          picked={answers[q.id]?.picked ?? null}
          inputs={answers[q.id]?.inputs ?? []}
          reveal={false}
          correct={null}
          showExplanation={false}
          onPick={(key) => setAnswers((prev) => ({ ...prev, [q.id]: { ...prev[q.id], picked: key } }))}
          onInput={(i, v) =>
            setAnswers((prev) => {
              const inputs = [...(prev[q.id]?.inputs ?? [])];
              inputs[i] = v;
              return { ...prev, [q.id]: { ...prev[q.id], inputs } };
            })
          }
        />
      )}

      <div className="actionbar">
        <div className="actionbar__inner">
          <button
            className="btn btn--ghost"
            style={{ flex: '0 0 auto', minWidth: 84 }}
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            上一题
          </button>
          {index < items.length - 1 && (
            <button
              className="btn btn--primary"
              style={{ flex: 1 }}
              onClick={() => setIndex((i) => i + 1)}
            >
              下一题
            </button>
          )}
          <button
            className={`btn ${index >= items.length - 1 ? 'btn--primary' : 'btn--ghost'}`}
            style={{ flex: index >= items.length - 1 ? 1 : '0 0 auto', minWidth: 84 }}
            onClick={confirmSubmit}
          >
            交卷
          </button>
        </div>
      </div>
    </div>
  );
}
