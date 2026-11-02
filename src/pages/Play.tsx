import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { areaMap, loadAll, shuffle } from '../model/questions';
import { judgeFill, judgeQuestion } from '../model/judge';
import { useApp } from '../model/StateContext';
import { MASTER_STREAK } from '../model/state';
import { dateKey } from '../model/date';
import { dueWrongIds, pickDaily } from '../model/review';
import type { Question } from '../model/types';
import { QuestionView } from '../components/QuestionView';
import { IconBack, IconStar } from '../components/Icons';

const titles: Record<string, string> = {
  all: '顺序刷题',
  random: '随机练习',
  chapter: '章节练习',
  wrong: '错题重练',
  fav: '收藏练习',
  daily: '每日一练',
  review: '今日复习',
  tag: '考点练习',
  memorize: '背题速览',
};

export function Play() {
  const params = useParams();
  const areaId = params.areaId;
  const tagParam = params.tag;
  // 路由形态：/play/chapter/:areaId、/play/tag/:tag、/play/:kind
  const kind = areaId ? 'chapter' : tagParam ? 'tag' : params.kind ?? 'all';
  const memorize = kind === 'memorize';
  const nav = useNavigate();
  const { state, recordAnswer, toggleFav, setResume, saveDaily } = useApp();

  const [items, setItems] = useState<Question[] | null>(null);
  /** 全量题库，用于判断章节/考点是否存在（空态时 items 是空的，判断不了） */
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [inputs, setInputs] = useState<string[]>([]);
  const [reveal, setReveal] = useState(false);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [fillFlags, setFillFlags] = useState<boolean[]>([]);
  const [showExp, setShowExp] = useState(false);
  const [selfMark, setSelfMark] = useState<'known' | 'unknown' | null>(null);
  const [session, setSession] = useState({ done: 0, ok: 0 });

  // 续做 key 直接用可路由的路径片段，首页据此拼出 /play/xxx
  const setKey = areaId ? `chapter/${areaId}` : tagParam ? `tag/${tagParam}` : kind;
  const snapshot = useRef(state);
  snapshot.current = state;
  const dailySaved = useRef(false);
  /**
   * 判定锁：同一帧内连点选项时，state 里的 reveal 还没更新，
   * 光靠 reveal 判断会重复判分（一次连点能刷满连对进度）。用 ref 立刻上锁。
   */
  const judging = useRef(false);

  // 组卷：只在挂载时快照一次，避免答题过程中列表变动导致错位
  useEffect(() => {
    let alive = true;
    loadAll().then((all) => {
      if (!alive) return;
      setAllQuestions(all);
      let list: Question[];
      switch (kind) {
        case 'chapter':
          list = all.filter((q) => q.area === areaId);
          break;
        case 'tag':
          list = all.filter((q) => q.tags.includes(tagParam ?? ''));
          break;
        case 'wrong':
          list = all.filter((q) => {
            const w = snapshot.current.wrong[q.id];
            return w && !w.cleared;
          });
          break;
        case 'review': {
          // 按到期时间先后排，最早该复习的放前面
          const byId = new Map(all.map((q) => [q.id, q]));
          list = dueWrongIds(snapshot.current)
            .map((id) => byId.get(id))
            .filter((q): q is Question => Boolean(q));
          break;
        }
        case 'fav':
          list = all.filter((q) => snapshot.current.fav.includes(q.id));
          break;
        case 'daily':
          list = pickDaily(all, snapshot.current, dateKey());
          break;
        case 'random':
          list = shuffle(all).slice(0, 30);
          break;
        default:
          list = all;
      }
      setItems(list);
      // 每日一练与到期复习是「当天任务」，每次进入从头开始，不续做
      const saved = kind === 'daily' || kind === 'review' ? 0 : snapshot.current.resume[setKey] ?? 0;
      const start = saved > 0 && saved < list.length ? saved : 0;
      setIndex(start);
    });
    return () => {
      alive = false;
    };
  }, [kind, areaId, tagParam, setKey]);

  const q = items?.[index];
  // 只有固定顺序的题集才值得续做；每日一练/复习/随机每次都是新的一组
  const persistResume = kind === 'all' || kind === 'chapter' || kind === 'tag';

  // 换题时清空作答态；背题模式直接展开答案
  useEffect(() => {
    judging.current = false;
    setPicked(null);
    setInputs([]);
    setReveal(memorize);
    setCorrect(null);
    setFillFlags([]);
    setShowExp(memorize);
    setSelfMark(null);
    if (persistResume && items && index < items.length) setResume(setKey, index);
  }, [index, items, setKey, setResume, memorize, persistResume]);

  const total = items?.length ?? 0;
  const isLast = index >= total - 1;

  const allTags = useMemo(
    () => new Set(allQuestions.flatMap((item) => item.tags)),
    [allQuestions],
  );

  // 每日一练做完 → 记一次完成状态，供「今日」页展示
  useEffect(() => {
    if (kind !== 'daily' || total === 0 || index < total || dailySaved.current) return;
    dailySaved.current = true;
    saveDaily(dateKey(), { done: session.done, ok: session.ok, total });
  }, [kind, total, index, session, saveDaily]);

  const judgeAndRecord = useCallback(
    (ok: boolean) => {
      if (!q || judging.current) return;
      judging.current = true;
      setReveal(true);
      setShowExp(true);
      setCorrect(ok);
      recordAnswer(q, ok);
      setSession((s) => ({ done: s.done + 1, ok: s.ok + (ok ? 1 : 0) }));
    },
    [q, recordAnswer],
  );

  const handlePick = (key: string) => {
    if (!q || reveal || judging.current) return;
    setPicked(key);
    if (state.settings.immediateJudge) {
      judgeAndRecord(key === (q.type === 'single' ? q.answer : ''));
    }
  };

  const submitOrNext = () => {
    if (!q) return;
    if (reveal) {
      if (isLast) setIndex(total);
      else setIndex((i) => i + 1);
      return;
    }
    if (q.type === 'single') {
      if (state.settings.immediateJudge) {
        // 即时判定模式下按钮是“跳过”，不计对错
        if (isLast) setIndex(total);
        else setIndex((i) => i + 1);
        return;
      }
      if (!picked) return;
      judgeAndRecord(picked === q.answer);
      return;
    }
    if (q.type === 'fill') {
      const ok = judgeQuestion(q, { inputs });
      setFillFlags(judgeFill(q, inputs));
      judgeAndRecord(Boolean(ok));
      return;
    }
    // 案例题：展开参考答案
    setReveal(true);
    setShowExp(true);
    setSession((s) => ({ ...s, done: s.done + 1 }));
  };

  const handleSelf = (known: boolean) => {
    if (!q) return;
    setSelfMark(known ? 'known' : 'unknown');
    recordAnswer(q, known);
    setSession((s) => ({ ...s, ok: s.ok + (known ? 1 : 0) }));
  };

  const primaryLabel = useMemo(() => {
    if (!q) return '';
    if (memorize) return isLast ? '完成本轮' : '下一题';
    if (reveal) return isLast ? '完成本轮' : '下一题';
    if (q.type === 'fill') return '提交答案';
    if (q.type === 'case') return '查看参考答案';
    return state.settings.immediateJudge ? '跳过' : '确认答案';
  }, [q, reveal, isLast, state.settings.immediateJudge, memorize]);

  const primaryDisabled = useMemo(() => {
    if (!q || reveal || memorize) return false;
    if (q.type === 'fill') return inputs.every((x) => !x?.trim());
    if (q.type === 'single') return !state.settings.immediateJudge && !picked;
    return false;
  }, [q, reveal, inputs, picked, state.settings.immediateJudge, memorize]);

  // 桌面端键盘操作：1-4 / A-D 选项，←→ 翻页，Enter 主按钮
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setIndex((i) => Math.min(total, i + 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!primaryDisabled) submitOrNext();
      return;
    }
    const map: Record<string, string> = {
      '1': 'A',
      '2': 'B',
      '3': 'C',
      '4': 'D',
      a: 'A',
      b: 'B',
      c: 'C',
      d: 'D',
    };
    const opt = map[e.key.toLowerCase()];
    if (opt && q && q.type === 'single' && !reveal) handlePick(opt);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const title =
    kind === 'chapter'
      ? areaMap[areaId ?? '']?.name ?? '章节练习'
      : kind === 'tag'
        ? tagParam ?? '考点练习'
        : titles[kind] ?? '练习';

  if (!items) {
    return (
      <div className="page page--full">
        <div className="topbar">
          <button className="icon-btn" onClick={() => nav(-1)} aria-label="返回">
            <IconBack />
          </button>
          <span className="topbar__title">{title}</span>
        </div>
        <div className="empty">加载题库…</div>
      </div>
    );
  }

  if (total === 0) {
    // 区分「范围不存在」和「范围存在但没题」，别把路由写错说成题库为空
    const badChapter = kind === 'chapter' && !areaMap[areaId ?? ''];
    const badTag =
      kind === 'tag' && tagParam && allQuestions.length > 0
        ? !allTags.has(tagParam)
        : false;
    const badRoute = badChapter || badTag;

    const emptyText = badChapter
      ? `没有叫「${areaId}」的知识域，请从章节列表进入`
      : badTag
        ? `题库里没有「${tagParam}」这个考点，换个考点试试`
        : kind === 'wrong'
          ? '答错过的题会自动出现在这里'
          : kind === 'fav'
            ? '在答题页点右上角星标即可收藏'
            : kind === 'review'
              ? '今天没有到期该复习的错题，明天再来'
              : kind === 'daily'
                ? '今天这组题还没生成出来，刷新页面试试'
                : '题库为空，请先导入题目';

    return (
      <div className="page page--full">
        <div className="topbar">
          <button className="icon-btn" onClick={() => nav(-1)} aria-label="返回">
            <IconBack />
          </button>
          <span className="topbar__title">{title}</span>
        </div>
        <div className="empty">
          <div className="empty__title">{badRoute ? '这个页面不存在' : '这里还没有题目'}</div>
          <div>{emptyText}</div>
        </div>
        <div className="actionbar">
          <div className="actionbar__inner">
            <button className="btn btn--primary btn--block" onClick={() => nav('/')}>
              返回今日
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 本轮结束
  if (index >= total) {
    const rate = session.done ? Math.round((session.ok / session.done) * 100) : 0;
    return (
      <div className="page page--full">
        <div className="topbar">
          <button className="icon-btn" onClick={() => nav('/')} aria-label="关闭">
            <IconBack />
          </button>
          <span className="topbar__title">{title}</span>
        </div>
        {memorize ? (
          <div className="result-hero">
            <div className="result-score">
              {total}
              <small> 题</small>
            </div>
            <div className="result-sub">本轮速览完毕 · 背题模式只读，不计入作答统计</div>
          </div>
        ) : (
          <div className="result-hero">
            <div className="result-score">
              {rate}
              <small>%</small>
            </div>
            <div className="result-sub">
              本轮作答 {session.done} 题，答对 {session.ok} 题
            </div>
          </div>
        )}
        <div className="card" style={{ padding: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="sub">
              {kind === 'tag'
                ? '该考点共'
                : kind === 'daily'
                  ? '本次共'
                  : kind === 'review'
                    ? '本轮共'
                    : '题库中该范围共'}{' '}
              {total} 题
            </span>
            <span className="chip chip--primary">{title}</span>
          </div>
          {kind === 'review' && (
            <>
              <div className="divider" />
              <div className="sub">
                答对的题已按 1/2/4/7 天顺延下次复习；连对 {MASTER_STREAK} 次会归档到「已学会」。
              </div>
            </>
          )}
          <div className="divider" />
          <div className="row" style={{ gap: 10 }}>
            <button
              className="btn btn--ghost"
              style={{ flex: 1 }}
              onClick={() => {
                // 重做每日一练时放开写入，重新记一次完成状态
                dailySaved.current = false;
                setIndex(0);
                setSession({ done: 0, ok: 0 });
              }}
            >
              重新开始
            </button>
            <button className="btn btn--primary" style={{ flex: 1 }} onClick={() => nav('/')}>
              返回今日
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--full">
      <div className="topbar">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="返回">
          <IconBack />
        </button>
        <span className="topbar__title">
          {title} · {index + 1}/{total}
        </span>
        {q && (
          <button
            className={`icon-btn${state.fav.includes(q.id) ? ' is-active' : ''}`}
            onClick={() => toggleFav(q.id)}
            aria-label="收藏"
          >
            <IconStar filled={state.fav.includes(q.id)} />
          </button>
        )}
      </div>
      <div className="progress-line">
        <div className="progress-line__bar" style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>

      {memorize && (
        <div className="memorize-tip">背题模式：直接给出答案与解析，只读不判分</div>
      )}

      {q && (
        <QuestionView
          q={q}
          picked={picked}
          inputs={inputs}
          reveal={reveal}
          correct={correct}
          fillFlags={fillFlags}
          showExplanation={showExp}
          answerOnly={memorize}
          onPick={handlePick}
          onInput={(i, v) => {
            const next = [...inputs];
            next[i] = v;
            setInputs(next);
          }}
          faved={state.fav.includes(q.id)}
          onToggleFav={() => toggleFav(q.id)}
          selfMark={selfMark}
          onSelf={memorize ? undefined : handleSelf}
        />
      )}

      {reveal && q?.type === 'case' && !selfMark && !memorize && (
        <div className="banner banner--info">对照参考答案，给自己的作答打个分</div>
      )}

      {reveal && !memorize && q && state.wrong[q.id] && (
        <div
          className={`banner ${state.wrong[q.id].cleared ? 'banner--ok' : 'banner--info'}`}
        >
          {state.wrong[q.id].cleared
            ? `这道错题已连对 ${MASTER_STREAK} 次，已归档到「已学会」`
            : `错题连对进度 ${Math.min(
                state.progress[q.id]?.streak ?? 0,
                MASTER_STREAK,
              )}/${MASTER_STREAK}，答错一次即清零重计`}
        </div>
      )}

      <div className="actionbar">
        <div className="actionbar__inner">
          <button
            className="btn btn--ghost"
            style={{ flex: '0 0 auto', minWidth: 96 }}
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            上一题
          </button>
          <button
            className="btn btn--primary"
            disabled={primaryDisabled}
            onClick={submitOrNext}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
