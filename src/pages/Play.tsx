import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { areaMap, loadAll, shuffle } from '../model/questions';
import { judgeFill, judgeQuestion } from '../model/judge';
import { useApp } from '../model/StateContext';
import type { Question } from '../model/types';
import { QuestionView } from '../components/QuestionView';
import { IconBack, IconStar } from '../components/Icons';

const titles: Record<string, string> = {
  all: '顺序刷题',
  random: '随机练习',
  chapter: '章节练习',
  wrong: '错题重练',
  fav: '收藏练习',
};

export function Play() {
  const params = useParams();
  const areaId = params.areaId;
  // /play/chapter/:areaId 这条路由没有 :kind 参数，用 areaId 反推
  const kind = areaId ? 'chapter' : params.kind ?? 'all';
  const nav = useNavigate();
  const { state, recordAnswer, toggleFav, setResume } = useApp();

  const [items, setItems] = useState<Question[] | null>(null);
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
  const setKey = areaId ? `chapter/${areaId}` : kind;
  const snapshot = useRef(state);
  snapshot.current = state;

  // 组卷：只在挂载时快照一次，避免答题过程中列表变动导致错位
  useEffect(() => {
    let alive = true;
    loadAll().then((all) => {
      if (!alive) return;
      let list: Question[];
      switch (kind) {
        case 'chapter':
          list = all.filter((q) => q.area === areaId);
          break;
        case 'wrong':
          list = all.filter((q) => {
            const w = snapshot.current.wrong[q.id];
            return w && !w.cleared;
          });
          break;
        case 'fav':
          list = all.filter((q) => snapshot.current.fav.includes(q.id));
          break;
        case 'random':
          list = shuffle(all).slice(0, 30);
          break;
        default:
          list = all;
      }
      setItems(list);
      const saved = snapshot.current.resume[setKey] ?? 0;
      const start = saved > 0 && saved < list.length ? saved : 0;
      setIndex(start);
    });
    return () => {
      alive = false;
    };
  }, [kind, areaId, setKey]);

  const q = items?.[index];

  // 换题时清空作答态
  useEffect(() => {
    setPicked(null);
    setInputs([]);
    setReveal(false);
    setCorrect(null);
    setFillFlags([]);
    setShowExp(false);
    setSelfMark(null);
    if (items && index < items.length) setResume(setKey, index);
  }, [index, items, setKey, setResume]);

  const total = items?.length ?? 0;
  const isLast = index >= total - 1;

  const judgeAndRecord = useCallback(
    (ok: boolean) => {
      if (!q) return;
      setReveal(true);
      setShowExp(true);
      setCorrect(ok);
      recordAnswer(q, ok);
      setSession((s) => ({ done: s.done + 1, ok: s.ok + (ok ? 1 : 0) }));
    },
    [q, recordAnswer],
  );

  const handlePick = (key: string) => {
    if (!q || reveal) return;
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
    if (reveal) return isLast ? '完成本轮' : '下一题';
    if (q.type === 'fill') return '提交答案';
    if (q.type === 'case') return '查看参考答案';
    return state.settings.immediateJudge ? '跳过' : '确认答案';
  }, [q, reveal, isLast, state.settings.immediateJudge]);

  const primaryDisabled = useMemo(() => {
    if (!q || reveal) return false;
    if (q.type === 'fill') return inputs.every((x) => !x?.trim());
    if (q.type === 'single') return !state.settings.immediateJudge && !picked;
    return false;
  }, [q, reveal, inputs, picked, state.settings.immediateJudge]);

  const title = kind === 'chapter' ? (areaMap[areaId ?? '']?.name ?? '章节练习') : titles[kind] ?? '练习';

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
    return (
      <div className="page page--full">
        <div className="topbar">
          <button className="icon-btn" onClick={() => nav(-1)} aria-label="返回">
            <IconBack />
          </button>
          <span className="topbar__title">{title}</span>
        </div>
        <div className="empty">
          <div className="empty__title">这里还没有题目</div>
          <div>
            {kind === 'wrong'
              ? '答错过的题会自动出现在这里'
              : kind === 'fav'
                ? '在答题页点右上角星标即可收藏'
                : '题库为空，请先导入题目'}
          </div>
        </div>
        <div className="actionbar">
          <div className="actionbar__inner">
            <button className="btn btn--primary btn--block" onClick={() => nav('/')}>
              返回首页
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
        <div className="result-hero">
          <div className="result-score">
            {rate}
            <small>%</small>
          </div>
          <div className="result-sub">
            本轮作答 {session.done} 题，答对 {session.ok} 题
          </div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="sub">题库中该范围共 {total} 题</span>
            <span className="chip chip--primary">{title}</span>
          </div>
          <div className="divider" />
          <div className="row" style={{ gap: 10 }}>
            <button
              className="btn btn--ghost"
              style={{ flex: 1 }}
              onClick={() => {
                setIndex(0);
                setSession({ done: 0, ok: 0 });
              }}
            >
              重新开始
            </button>
            <button className="btn btn--primary" style={{ flex: 1 }} onClick={() => nav('/')}>
              返回首页
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

      {q && (
        <QuestionView
          q={q}
          picked={picked}
          inputs={inputs}
          reveal={reveal}
          correct={correct}
          fillFlags={fillFlags}
          showExplanation={showExp}
          onPick={handlePick}
          onInput={(i, v) => {
            const next = [...inputs];
            next[i] = v;
            setInputs(next);
          }}
          faved={state.fav.includes(q.id)}
          onToggleFav={() => toggleFav(q.id)}
          selfMark={selfMark}
          onSelf={handleSelf}
        />
      )}

      {reveal && q?.type === 'case' && !selfMark && (
        <div className="banner banner--info">对照参考答案，给自己的作答打个分</div>
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
