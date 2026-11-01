import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { areaMap, loadAll, shuffle } from '../model/questions';
import { judgeQuestion } from '../model/judge';
import { useApp } from '../model/StateContext';
import { formatDuration } from '../model/state';
import type { ExamRecord, Question } from '../model/types';
import { QuestionView } from '../components/QuestionView';
import { IconBack, IconClock } from '../components/Icons';

const DURATION_MIN = 150;
const DRAFT_KEY = 'ruankao.exam.draft.v1';

interface Answer {
  picked?: string | null;
  inputs?: string[];
}

interface Draft {
  ids: string[];
  answers: Record<string, Answer>;
  startedAt: number;
}

interface Result {
  correct: number;
  total: number;
  byArea: Record<string, { correct: number; total: number }>;
  caseCount: number;
  durationMs: number;
}

export function Exam() {
  const nav = useNavigate();
  const { saveExam, recordAnswer } = useApp();

  const [items, setItems] = useState<Question[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [index, setIndex] = useState(0);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<Result | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const submitted = useRef(false);

  // 组卷或恢复草稿
  useEffect(() => {
    let alive = true;
    loadAll().then((all) => {
      if (!alive) return;
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        try {
          const d = JSON.parse(raw) as Draft;
          const byId = new Map(all.map((q) => [q.id, q]));
          const restored = d.ids.map((id) => byId.get(id)).filter(Boolean) as Question[];
          if (restored.length > 0) {
            setItems(restored);
            setAnswers(d.answers ?? {});
            setStartedAt(d.startedAt || Date.now());
            return;
          }
        } catch {
          /* 草稿损坏则重新组卷 */
        }
      }
      const list = shuffle(all).slice(0, Math.min(75, all.length));
      setItems(list);
      setStartedAt(Date.now());
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

  // 草稿持久化（防刷新丢失）
  useEffect(() => {
    if (!items || result) return;
    const draft: Draft = { ids: items.map((q) => q.id), answers, startedAt };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [items, answers, startedAt, result]);

  const elapsed = now - startedAt;
  const remain = Math.max(0, DURATION_MIN * 60 * 1000 - elapsed);

  const submit = useCallback(() => {
    if (!items || submitted.current) return;
    submitted.current = true;

    const byArea: Record<string, { correct: number; total: number }> = {};
    let correct = 0;
    let total = 0;
    let caseCount = 0;

    for (const q of items) {
      const a = answers[q.id] ?? {};
      const ok = judgeQuestion(q, { picked: a.picked ?? null, inputs: a.inputs ?? [] });
      if (ok === null) {
        caseCount += 1;
        continue;
      }
      total += 1;
      if (ok) correct += 1;
      const bucket = byArea[q.area] ?? { correct: 0, total: 0 };
      bucket.total += 1;
      if (ok) bucket.correct += 1;
      byArea[q.area] = bucket;
      recordAnswer(q, ok);
    }

    const rec: ExamRecord = {
      id: `exam-${Date.now()}`,
      title: `随机组卷 · ${items.length} 题`,
      startedAt,
      submittedAt: Date.now(),
      total,
      correct,
      byArea,
      caseSelf: { known: 0, unknown: 0 },
      durationMs: Date.now() - startedAt,
    };
    saveExam(rec);
    sessionStorage.removeItem(DRAFT_KEY);
    setResult({ correct, total, byArea, caseCount, durationMs: rec.durationMs });
  }, [items, answers, startedAt, saveExam, recordAnswer]);

  // 时间到自动交卷
  useEffect(() => {
    if (!items || result) return;
    if (remain <= 0) submit();
  }, [remain, items, result, submit]);

  const q = items?.[index];

  const answeredCount = useMemo(() => {
    if (!items) return 0;
    return items.filter((it) => {
      const a = answers[it.id];
      if (!a) return false;
      if (it.type === 'single') return Boolean(a.picked);
      if (it.type === 'fill') return (a.inputs ?? []).some((x) => x?.trim());
      return false;
    }).length;
  }, [items, answers]);

  if (!items) {
    return (
      <div className="page page--full">
        <div className="topbar">
          <button className="icon-btn" onClick={() => nav('/')} aria-label="返回">
            <IconBack />
          </button>
          <span className="topbar__title">模考</span>
        </div>
        <div className="empty">正在组卷…</div>
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
    const score = result.total ? Math.round((result.correct / result.total) * 100) : 0;
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
            <small>分</small>
          </div>
          <div className="result-sub">
            客观题 {result.correct}/{result.total} 题正确 · 用时 {formatDuration(result.durationMs)}
          </div>
          <div className="result-sub" style={{ marginTop: 2 }}>
            软考上午卷满分 75 分、45 分合格，可对照本比例自估
          </div>
        </div>

        {result.caseCount > 0 && (
          <div className="banner banner--info">
            本次含案例题 {result.caseCount} 道，未计入分数，请对照参考答案自行核对
          </div>
        )}

        <div className="section-title">分知识域</div>
        <div className="card" style={{ padding: '4px 14px 14px' }}>
          {areaRows.map(([areaId, v]) => {
            const p = Math.round((v.correct / v.total) * 100);
            return (
              <div className="bar-item" key={areaId}>
                <div className="bar-item__head">
                  <span>{areaMap[areaId]?.name ?? areaId}</span>
                  <span style={{ color: 'var(--text-2)' }}>
                    {v.correct}/{v.total} · {p}%
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
                sessionStorage.removeItem(DRAFT_KEY);
                submitted.current = false;
                setResult(null);
                setAnswers({});
                setIndex(0);
                loadAll().then((all) => {
                  const list = shuffle(all).slice(0, Math.min(75, all.length));
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

      {sheetOpen && (
        <div className="card fade-in" style={{ padding: 14, marginTop: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>答题卡</span>
            <span className="sub">已答 {answeredCount} / {items.length}</span>
          </div>
          <div className="sheet">
            {items.map((it, i) => {
              const a = answers[it.id];
              const done =
                it.type === 'single'
                  ? Boolean(a?.picked)
                  : (a?.inputs ?? []).some((x) => x?.trim());
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
            style={{ flex: '0 0 76px' }}
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            上一题
          </button>
          {index < items.length - 1 ? (
            <button className="btn btn--primary" onClick={() => setIndex((i) => i + 1)}>
              下一题
            </button>
          ) : (
            <button
              className="btn btn--primary"
              onClick={() => {
                if (answeredCount < items.length) {
                  const ok = window.confirm(
                    `还有 ${items.length - answeredCount} 题未作答，确定交卷吗？`,
                  );
                  if (!ok) return;
                }
                submit();
              }}
            >
              交卷
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
