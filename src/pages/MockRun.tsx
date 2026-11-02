import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { areaMap, loadAll } from '../model/questions';
import { hasAnswer, judgeQuestion } from '../model/judge';
import { useApp } from '../model/StateContext';
import { formatDuration } from '../model/state';
import {
  buildPaper,
  isPassed,
  PART,
  passLine,
  passScore,
  pastPaperTitle,
  toFullScore,
  type PaperPart,
} from '../model/paper';
import type { ExamRecord, Question, ReviewItem } from '../model/types';
import { QuestionView } from '../components/QuestionView';
import { Markdown } from '../components/Markdown';
import { IconBack, IconClock } from '../components/Icons';

interface Answer {
  picked?: string | null;
  inputs?: string[];
}

interface Draft {
  ids: string[];
  answers: Record<string, Answer>;
  startedAt: number;
  /** 最后写入时间，用于判断草稿是否过期 */
  updatedAt?: number;
  index?: number;
  /** 下午卷自评进度，不存就会在刷新后退回答题页、自评全部作废 */
  marks?: Marks;
  /** 停在哪一阶段：答题中 / 自评中 */
  phase?: 'answer' | 'mark';
}

interface Result {
  score: number;
  /** 卷面题数（分母，按它折算 75 分） */
  total: number;
  /** 实际作答数 */
  answered: number;
  correct: number;
  byArea: Record<string, { correct: number; total: number; answered: number }>;
  passed: boolean;
  durationMs: number;
  review: ReviewItem[];
  /** 卷面不足真实卷量时给出提示 */
  shortPaper: boolean;
  /** 卷面题数：上午卷为题数，下午卷为案例道数 */
  paperSize: number;
}

/** qid → 小问标识 → 是否自评会做 */
type Marks = Record<string, Record<string, boolean>>;

function draftKey(part: PaperPart, key: string) {
  return `ruankao.paper.draft.v1:${part}:${key}`;
}

/**
 * 草稿存活时限：超过这个时间（或已过考试时长）的草稿视为废弃，
 * 免得几天后打开还在续一场早就该算弃考的卷子。
 */
const DRAFT_TTL_MS = 12 * 60 * 60 * 1000;

/** 试卷标识是否合法：'mock' 或形如 2023H / 2024L */
function isValidKey(key: string): boolean {
  return key === 'mock' || /^\d{4}[HL]$/.test(key);
}

export function MockRun() {
  const nav = useNavigate();
  const params = useParams();
  const part: PaperPart = params.part === 'pm' ? 'pm' : 'am';
  const key = params.key ?? 'mock';
  const meta = PART[part];
  const { saveExam, recordAnswer } = useApp();

  const [items, setItems] = useState<Question[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [marks, setMarks] = useState<Marks>({});
  const [index, setIndex] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [phase, setPhase] = useState<'answer' | 'mark' | 'done'>('answer');
  const [result, setResult] = useState<Result | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [openReview, setOpenReview] = useState<Record<string, boolean>>({});
  const [restoredDraft, setRestoredDraft] = useState(false);
  /** 上次的草稿已超出考试时长，被丢弃重新组卷 */
  const [expiredNotice, setExpiredNotice] = useState(false);
  /** 是否因时间耗尽而自动交卷，用于在成绩页 / 自评页说明原因 */
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const submitted = useRef(false);
  const timeUp = useRef(false);

  const keyOk = isValidKey(key);
  // 卷型写错（/mock/xx/mock）时不能静默当成上午卷，否则用户以为在考下午卷
  const partOk = params.part === 'am' || params.part === 'pm';
  const paperOk = keyOk && partOk;
  const title = !paperOk
    ? '未知试卷'
    : key === 'mock'
      ? `模拟${meta.label}`
      : `${pastPaperTitle(key)} · ${meta.label}`;

  // 组卷 / 恢复草稿（草稿放 localStorage，关标签页、换标签页都能接着做）
  useEffect(() => {
    let alive = true;
    loadAll().then((all) => {
      if (!alive) return;
      const raw = localStorage.getItem(draftKey(part, key));
      if (raw) {
        try {
          const d = JSON.parse(raw) as Draft;
          const stamp = d.updatedAt ?? d.startedAt ?? 0;
          const stale = Date.now() - stamp > DRAFT_TTL_MS;
          const startedTs = d.startedAt || Date.now();
          // 考试时长已经用完了：这份草稿不能恢复。
          // 以前只校验 12 小时 TTL，3 小时前进场、150 分钟的卷子一打开就直接静默交卷，
          // 用户没见过题目就先吃到一张 0 分的成绩单。
          const overtime = Date.now() - startedTs > meta.minutes * 60 * 1000;
          const byId = new Map(all.map((q) => [q.id, q]));
          const restored = d.ids.map((id) => byId.get(id)).filter(Boolean) as Question[];
          if (!stale && !overtime && restored.length > 0) {
            setItems(restored);
            setAnswers(d.answers ?? {});
            setMarks(d.marks ?? {});
            setStartedAt(startedTs);
            setIndex(Math.min(d.index ?? 0, restored.length - 1));
            // 自评中途离开的，回到自评页而不是答题页
            if (d.phase === 'mark') {
              submitted.current = true;
              setPhase('mark');
            }
            setRestoredDraft(true);
            return;
          }
          if (overtime && !stale) setExpiredNotice(true);
          localStorage.removeItem(draftKey(part, key));
        } catch {
          /* 草稿损坏则重新组卷 */
        }
      }
      setItems(buildPaper(all, part, key));
      setStartedAt(Date.now());
    }).catch(() => {
      if (alive) setLoadError(true);
    });
    return () => {
      alive = false;
    };
  }, [part, key, meta.minutes]);

  // 计时
  useEffect(() => {
    if (phase === 'done') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // 答题 / 自评过程中存草稿，防止刷新、关页丢失
  useEffect(() => {
    if (!items || phase === 'done') return;
    const draft: Draft = {
      ids: items.map((q) => q.id),
      answers,
      startedAt,
      updatedAt: Date.now(),
      index,
      marks,
      phase: phase === 'mark' ? 'mark' : 'answer',
    };
    try {
      localStorage.setItem(draftKey(part, key), JSON.stringify(draft));
    } catch {
      /* 存储不可用时由全局提示接管，不阻塞答题 */
    }
  }, [items, answers, startedAt, phase, part, key, index, marks]);

  const elapsed = now - startedAt;
  const remain = Math.max(0, meta.minutes * 60 * 1000 - elapsed);
  const q = items?.[index];
  const total = items?.length ?? 0;

  /** 上午卷：交卷即判分。缺考的题不算对也不算错，绝不写进统计与错题本 */
  const submitAm = useCallback(() => {
    if (!items || submitted.current) return;
    submitted.current = true;

    const byArea: Record<string, { correct: number; total: number; answered: number }> = {};
    const review: ReviewItem[] = [];
    let correct = 0;
    let answered = 0;

    for (const it of items) {
      const a = answers[it.id];
      const bucket = byArea[it.area] ?? { correct: 0, total: 0, answered: 0 };
      bucket.total += 1;
      byArea[it.area] = bucket;

      // 未作答：只记「跳过」，不计分、不记录、不进错题本
      if (!hasAnswer(it, a)) {
        review.push({ id: it.id, picked: null, ok: null, skipped: true });
        continue;
      }

      answered += 1;
      bucket.answered += 1;
      const ok = judgeQuestion(it, { picked: a?.picked ?? null, inputs: a?.inputs ?? [] });
      if (ok) {
        correct += 1;
        bucket.correct += 1;
      }
      review.push({ id: it.id, picked: a?.picked ?? null, ok: Boolean(ok) });
      recordAnswer(it, Boolean(ok));
    }

    const durationMs = Date.now() - startedAt;
    const rec: ExamRecord = {
      id: `paper-${Date.now()}`,
      title,
      startedAt,
      submittedAt: Date.now(),
      total,
      answered,
      correct,
      byArea,
      caseSelf: { known: 0, unknown: 0 },
      durationMs,
      kind: 'am',
      score: toFullScore(correct, total),
      maxScore: meta.fullScore,
      passed: isPassed(correct, total),
      review,
    };
    saveExam(rec);
    localStorage.removeItem(draftKey(part, key));
    setResult({
      score: rec.score!,
      total,
      answered,
      correct,
      byArea: byArea as Result['byArea'],
      passed: Boolean(rec.passed),
      durationMs,
      review,
      shortPaper: part === 'am' && total < PART.am.size,
      paperSize: total,
    });
    setPhase('done');
  }, [items, answers, startedAt, total, title, meta.fullScore, saveExam, recordAnswer, part, key]);

  const submitPm = useCallback(() => {
    if (!items || submitted.current) return;
    submitted.current = true;
    setPhase('mark');
    setSheetOpen(false);
  }, [items]);

  const submit = useCallback(() => {
    if (part === 'am') submitAm();
    else submitPm();
  }, [part, submitAm, submitPm]);

  // 时间到自动交卷（下午卷仍要进入自评）
  useEffect(() => {
    if (!items || phase !== 'answer') return;
    if (remain <= 0 && !timeUp.current) {
      timeUp.current = true;
      setAutoSubmitted(true);
      submit();
    }
  }, [remain, items, phase, submit]);

  /** 下午卷自评汇总 */
  const pmSummary = useMemo(() => {
    const byArea: Record<string, { correct: number; total: number }> = {};
    let totalSubs = 0;
    let knownSubs = 0;
    for (const it of items ?? []) {
      if (it.type !== 'case') continue;
      const m = marks[it.id] ?? {};
      let k = 0;
      it.subQuestions.forEach((s, i) => {
        if (m[s.no || String(i + 1)]) k += 1;
      });
      totalSubs += it.subQuestions.length;
      knownSubs += k;
      const b = byArea[it.area] ?? { correct: 0, total: 0 };
      b.total += it.subQuestions.length;
      b.correct += k;
      byArea[it.area] = b;
    }
    return { totalSubs, knownSubs, byArea };
  }, [items, marks]);

  const markedCount = useMemo(() => {
    let n = 0;
    let all = 0;
    for (const it of items ?? []) {
      if (it.type !== 'case') continue;
      const m = marks[it.id] ?? {};
      it.subQuestions.forEach((s, i) => {
        all += 1;
        if (m[s.no || String(i + 1)] !== undefined) n += 1;
      });
    }
    return { n, all };
  }, [items, marks]);

  /** 下午卷：自评完成后保存成绩 */
  const finishPm = useCallback(() => {
    if (!items) return;
    const { totalSubs, knownSubs, byArea } = pmSummary;
    const durationMs = Date.now() - startedAt;

    for (const it of items) {
      if (it.type !== 'case') continue;
      const m = marks[it.id] ?? {};
      const allKnown = it.subQuestions.every((s, i) => m[s.no || String(i + 1)]);
      recordAnswer(it, allKnown);
    }

    const rec: ExamRecord = {
      id: `paper-${Date.now()}`,
      title,
      startedAt,
      submittedAt: Date.now(),
      total: totalSubs,
      answered: totalSubs,
      correct: knownSubs,
      byArea,
      caseSelf: { known: knownSubs, unknown: totalSubs - knownSubs },
      durationMs,
      kind: 'pm',
      score: toFullScore(knownSubs, totalSubs),
      maxScore: meta.fullScore,
      passed: isPassed(knownSubs, totalSubs),
      review: items.map((it) => ({ id: it.id, picked: null, ok: null })),
    };
    saveExam(rec);
    localStorage.removeItem(draftKey(part, key));
    setResult({
      score: rec.score!,
      total: totalSubs,
      answered: totalSubs,
      correct: knownSubs,
      byArea: Object.fromEntries(
        Object.entries(byArea).map(([k, v]) => [k, { ...v, answered: v.total }]),
      ),
      passed: Boolean(rec.passed),
      durationMs,
      review: rec.review ?? [],
      // 下午卷的 total 是小问数，判断缺题要看案例道数
      shortPaper: items.length < PART.pm.size,
      paperSize: items.length,
    });
    setPhase('done');
  }, [items, pmSummary, marks, startedAt, title, meta.fullScore, saveExam, recordAnswer, part, key]);

  const setSubMark = (qid: string, subKey: string, known: boolean) => {
    setMarks((prev) => ({ ...prev, [qid]: { ...prev[qid], [subKey]: known } }));
  };

  const answeredCount = useMemo(() => {
    if (!items) return 0;
    return items.filter((it) => hasAnswer(it, answers[it.id])).length;
  }, [items, answers]);

  /** 交卷统一入口：未答满时二次确认，并说明未作答不会计错 */
  const confirmSubmit = useCallback(() => {
    if (part === 'am' && answeredCount < total) {
      const ok = window.confirm(
        `还有 ${total - answeredCount} 题未作答，确定交卷吗？未作答的题按缺考处理，不计入已刷题、不进错题本。`,
      );
      if (!ok) return;
    }
    submit();
  }, [part, answeredCount, total, submit]);

  const back = () => nav('/mock');

  /* ---------- 路由不合法：不能把错链接当成上午卷来考 ---------- */
  if (!paperOk) {
    return (
      <div className="page page--full">
        <div className="topbar">
          <button className="icon-btn" onClick={back} aria-label="返回">
            <IconBack />
          </button>
          <span className="topbar__title">试卷不存在</span>
        </div>
        <div className="empty">
          <div className="empty__title">这套卷子不存在</div>
          <div>链接里的试卷编号或卷型不正确，请从模考列表重新选择</div>
        </div>
        <div className="actionbar">
          <div className="actionbar__inner">
            <button className="btn btn--primary btn--block" onClick={back}>
              返回模考列表
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- 加载 / 空态 ---------- */
  if (!items) {
    return (
      <div className="page page--full">
        <div className="topbar">
          <button className="icon-btn" onClick={back} aria-label="返回">
            <IconBack />
          </button>
          <span className="topbar__title">{title}</span>
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

  if (total === 0) {
    return (
      <div className="page page--full">
        <div className="topbar">
          <button className="icon-btn" onClick={back} aria-label="返回">
            <IconBack />
          </button>
          <span className="topbar__title">{title}</span>
        </div>
        <div className="empty">
          <div className="empty__title">
            {paperOk ? '这套卷子还没有题目' : '这套卷子不存在'}
          </div>
          <div>
            {paperOk
              ? '题库中缺少该卷型的题目，请先补充题库'
              : '链接里的试卷编号或卷型不正确，请从模考列表重新选择'}
          </div>
        </div>
        <div className="actionbar">
          <div className="actionbar__inner">
            <button className="btn btn--primary btn--block" onClick={back}>
              返回模考列表
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- 交卷后：成绩 ---------- */
  if (phase === 'done' && result) {
    const rate = result.answered ? Math.round((result.correct / result.answered) * 100) : 0;
    const areaRows = Object.entries(result.byArea).sort((a, b) => b[1].total - a[1].total);
    const skipped = result.total - result.answered;
    const pass = passScore(meta.fullScore);

    return (
      <div className="page page--full">
        <div className="topbar">
          <button className="icon-btn" onClick={back} aria-label="返回">
            <IconBack />
          </button>
          <span className="topbar__title">成绩报告</span>
        </div>

        <div className="result-hero">
          <div className="result-score" style={{ color: result.passed ? 'var(--ok)' : 'var(--bad)' }}>
            {result.score}
            <small> / {meta.fullScore}</small>
          </div>
          <div className="result-sub">
            {result.passed ? '达到合格线' : `距合格线还差 ${Math.max(0, pass - result.score)} 分`}
            {' · '}用时 {formatDuration(result.durationMs)}
          </div>
          <div className="result-sub" style={{ marginTop: 2 }}>
            {part === 'am'
              ? `已答 ${result.answered}/${result.total} 题 · 答对 ${result.correct} 题（正确率 ${rate}%）`
              : `案例小问自评 ${result.correct}/${result.total}（${rate}%）· 按比例折算 ${meta.fullScore} 分`}
          </div>
        </div>

        {autoSubmitted && (
          <div className="banner banner--info">
            考试时间（{meta.minutes} 分钟）已用完，系统自动交卷。未作答的题按缺考处理。
          </div>
        )}

        {part === 'am' && skipped > 0 && (
          <div className="banner banner--info">
            有 {skipped} 题未作答，按缺考处理：不计入已刷题、不进错题本，但本卷得分按整卷 {result.total} 题折算，
            这 {skipped} 题拿不到分。
          </div>
        )}

        {result.shortPaper && (
          <div className="banner banner--info">
            {part === 'am'
              ? `题库中这套卷子只有 ${result.paperSize} 题（真实卷面 ${PART.am.size} 题），分数已按现有题数折算，只作趋势参考，补题后会自动按完整卷面成卷。`
              : `题库中这套下午卷只有 ${result.paperSize} 道案例（真实卷面 ${PART.pm.size} 道），得分按现有小问比例折算，只作趋势参考。`}
          </div>
        )}

        {!result.passed && part === 'am' && (
          <div className="banner banner--info">
            合格需答对 {passLine(result.total)} 题（{pass} 分）。答错的题已收进错题本，连对 5 次才会归档。
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
                    {at < v.total && at > 0 ? `（卷面 ${v.total} 题）` : ''}
                  </span>
                </div>
                <div className="bar-item__track">
                  <div
                    className="bar-item__fill"
                    style={{ width: `${p}%`, background: p >= 60 ? 'var(--ok)' : 'var(--bad)' }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {part === 'am' ? (
          <>
            <div className="section-title">
              <span>逐题回顾</span>
              <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>
                答错 {result.answered - result.correct} 题
                {result.total - result.answered > 0 && ` · 未答 ${result.total - result.answered} 题`}
              </span>
            </div>
            <div className="card">
              {items.map((it, i) => {
                const r = result.review.find((x) => x.id === it.id);
                const ok = r?.ok === true;
                const missed = r?.skipped === true;
                const open = openReview[it.id];
                return (
                  <div className="list-item" key={it.id}>
                    <button
                      className="row"
                      style={{ width: '100%', justifyContent: 'space-between', gap: 10 }}
                      onClick={() => setOpenReview((prev) => ({ ...prev, [it.id]: !prev[it.id] }))}
                    >
                      <span style={{ fontSize: 14, fontWeight: 500 }}>
                        {i + 1}. {areaMap[it.area]?.name ?? it.area}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {missed ? (
                          <span className="chip">未答</span>
                        ) : ok ? (
                          <span className="chip chip--ok">对</span>
                        ) : (
                          <span className="chip chip--bad">错</span>
                        )}
                        <span className="chevron">{open ? '⌄' : '›'}</span>
                      </span>
                    </button>
                    {open && (
                      <div style={{ marginTop: 8 }}>
                        <QuestionView
                          q={it}
                          picked={r?.picked ?? null}
                          reveal
                          correct={ok}
                          showExplanation
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="section-title">参考答案与自评</div>
            <div className="card" style={{ padding: '4px 14px 14px' }}>
              {items.map((it, i) => (
                <div key={it.id} className="list-item">
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    第 {i + 1} 题 · {areaMap[it.area]?.name ?? it.area}
                  </div>
                  <div className="q-stem" style={{ fontSize: 14 }}>
                    <Markdown>{it.stem}</Markdown>
                  </div>
                  {it.type === 'case' &&
                    it.subQuestions.map((sub, si) => {
                      const subKey = sub.no || String(si + 1);
                      const known = marks[it.id]?.[subKey];
                      return (
                        <div key={subKey} className="case-sub">
                          <div className="case-sub__no">问题 {subKey}</div>
                          <div className="explain">
                            <div className="explain__title">参考答案</div>
                            <Markdown>{sub.reference}</Markdown>
                            {sub.keyPoints.length > 0 && (
                              <>
                                <div className="explain__title" style={{ marginTop: 10 }}>
                                  采分要点
                                </div>
                                <ul className="kp">
                                  {sub.keyPoints.map((k) => (
                                    <li key={k}>{k}</li>
                                  ))}
                                </ul>
                              </>
                            )}
                          </div>
                          <div className="self-row">
                            <button
                              className={`self-btn${known === true ? ' is-ok' : ''}`}
                              onClick={() => setSubMark(it.id, subKey, true)}
                            >
                              我答到了
                            </button>
                            <button
                              className={`self-btn${known === false ? ' is-bad' : ''}`}
                              onClick={() => setSubMark(it.id, subKey, false)}
                            >
                              没答到
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="actionbar">
          <div className="actionbar__inner">
            <button className="btn btn--ghost" style={{ flex: 1 }} onClick={back}>
              返回模考
            </button>
            <button
              className="btn btn--primary"
              style={{ flex: 1 }}
              onClick={() => {
                localStorage.removeItem(draftKey(part, key));
                loadAll().then((all) => {
                  submitted.current = false;
                  timeUp.current = false;
                  setAutoSubmitted(false);
                  setItems(buildPaper(all, part, key));
                  setAnswers({});
                  setMarks({});
                  setIndex(0);
                  setStartedAt(Date.now());
                  setResult(null);
                  setPhase('answer');
                  setOpenReview({});
                  setRestoredDraft(false);
                });
              }}
            >
              再考一次
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- 下午卷：交卷后逐小问自评 ---------- */
  if (phase === 'mark') {
    return (
      <div className="page page--full">
        <div className="topbar">
          <button className="icon-btn" onClick={back} aria-label="返回">
            <IconBack />
          </button>
          <span className="topbar__title">对照答案自评</span>
          <span className="chip">已评 {markedCount.n}/{markedCount.all}</span>
        </div>

        {restoredDraft && (
          <div className="banner banner--ok fade-in" style={{ marginTop: 10 }}>
            已恢复上次的自评进度（已评 {markedCount.n}/{markedCount.all}），接着评完即可保存成绩。
          </div>
        )}

        {autoSubmitted && (
          <div className="banner banner--info" style={{ marginTop: 10 }}>
            考试时间（{meta.minutes} 分钟）已用完，系统自动交卷，请继续完成自评后保存成绩。
          </div>
        )}

        <div className="banner banner--info" style={{ marginTop: 12 }}>
          下午卷为主观题，请逐个小问对照参考答案与采分要点，如实选择「我答到了 / 没答到」。
          得分按小问比例折算，不诚实只会骗到自己的分数。
        </div>

        {remain > 0 ? (
          <button
            className="btn btn--ghost btn--sm"
            style={{ marginTop: 10 }}
            onClick={() => {
              // 误点交卷的退路：回答题页继续检查，重新交卷后才会再进自评
              submitted.current = false;
              setRestoredDraft(false);
              setPhase('answer');
            }}
          >
            ← 返回继续检查答案（还剩 {formatDuration(remain)}）
          </button>
        ) : (
          <div className="sub" style={{ marginTop: 10 }}>
            考试时间已用完，只能完成自评后保存成绩。
          </div>
        )}

        <div className="card" style={{ padding: '4px 14px 14px' }}>
          {items.map((it, i) => (
            <div key={it.id} className="list-item">
              <div className="q-stem" style={{ fontSize: 14 }}>
                <strong>
                  第 {i + 1} 题 · {areaMap[it.area]?.name ?? it.area}
                </strong>
                <Markdown>{it.stem}</Markdown>
              </div>
              {it.type === 'case' &&
                it.subQuestions.map((sub, si) => {
                  const subKey = sub.no || String(si + 1);
                  const known = marks[it.id]?.[subKey];
                  return (
                    <div key={subKey} className="case-sub">
                      <div className="case-sub__no">问题 {subKey}</div>
                      <Markdown>{sub.stem}</Markdown>
                      <div className="explain" style={{ marginTop: 10 }}>
                        <div className="explain__title">参考答案</div>
                        <Markdown>{sub.reference}</Markdown>
                        {sub.keyPoints.length > 0 && (
                          <>
                            <div className="explain__title" style={{ marginTop: 10 }}>
                              采分要点
                            </div>
                            <ul className="kp">
                              {sub.keyPoints.map((k) => (
                                <li key={k}>{k}</li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                      <div className="self-row">
                        <button
                          className={`self-btn${known === true ? ' is-ok' : ''}`}
                          onClick={() => setSubMark(it.id, subKey, true)}
                        >
                          我答到了
                        </button>
                        <button
                          className={`self-btn${known === false ? ' is-bad' : ''}`}
                          onClick={() => setSubMark(it.id, subKey, false)}
                        >
                          没答到
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          ))}
        </div>

        <div className="actionbar">
          <div className="actionbar__inner">
            <span className="sub" style={{ flex: 'none' }}>
              {markedCount.n < markedCount.all
                ? `还有 ${markedCount.all - markedCount.n} 个小问未评`
                : `预计 ${toFullScore(pmSummary.knownSubs, pmSummary.totalSubs)}/${meta.fullScore} 分`}
            </span>
            <button
              className="btn btn--primary"
              style={{ flex: 1 }}
              disabled={markedCount.n < markedCount.all}
              onClick={finishPm}
            >
              保存成绩
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- 答题中 ---------- */
  const urgent = remain < 5 * 60 * 1000;
  const isLast = index >= total - 1;

  return (
    <div className="page page--full">
      <div className="topbar">
        <button className="icon-btn" onClick={back} aria-label="返回">
          <IconBack />
        </button>
        <span className="topbar__title">
          {meta.label} {index + 1}/{total}
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
        {part === 'am' ? (
          <button className="icon-btn" onClick={() => setSheetOpen((v) => !v)} aria-label="答题卡">
            <span style={{ fontSize: 12, fontWeight: 700 }}>
              {answeredCount}/{total}
            </span>
          </button>
        ) : (
          <span className="chip">共 {total} 题</span>
        )}
      </div>
      <div className="progress-line">
        <div
          className="progress-line__bar"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      {expiredNotice && (
        <div className="banner banner--info fade-in" style={{ marginTop: 10 }}>
          上次的作答已超过考试时长（{meta.minutes} 分钟），无法继续续考，已为你重新组卷。
          答题中途关掉页面超过 {meta.minutes} 分钟也会是这个结果。
        </div>
      )}

      {restoredDraft && (
        <div className="banner banner--info fade-in" style={{ marginTop: 10 }}>
          {part === 'pm'
            ? `已恢复上次的作答进度（第 ${index + 1} 题 / 共 ${total} 题），自评进度也一并保留。`
            : `已恢复上次的作答进度（第 ${index + 1} 题，已答 ${answeredCount}/${total}）。
          进度保存在本机浏览器，关掉页面也不会丢。`}
          <button
            className="btn btn--ghost btn--sm"
            style={{ marginLeft: 8 }}
            onClick={() => {
              localStorage.removeItem(draftKey(part, key));
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

      {sheetOpen && part === 'am' && (
        <div className="card fade-in" style={{ padding: 14, marginTop: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>答题卡</span>
            <span className="sub">
              已答 {answeredCount} / {total}
            </span>
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
            交卷（已答 {answeredCount}/{total}）
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
          onPick={(key2) =>
            setAnswers((prev) => ({ ...prev, [q.id]: { ...prev[q.id], picked: key2 } }))
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
          {!isLast && (
            <button className="btn btn--primary" style={{ flex: 1 }} onClick={() => setIndex((i) => i + 1)}>
              下一题
            </button>
          )}
          <button
            className={`btn ${isLast ? 'btn--primary' : 'btn--ghost'}`}
            style={{ flex: isLast ? 1 : '0 0 auto', minWidth: 84 }}
            onClick={confirmSubmit}
          >
            交卷
          </button>
        </div>
      </div>
    </div>
  );
}
