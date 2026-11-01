import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AppState, ExamRecord, Question, Settings } from './types';
import { createInitialState, loadState, pushLog, saveState } from './state';

interface AppApi {
  state: AppState;
  ready: boolean;
  recordAnswer: (q: Question, ok: boolean) => void;
  toggleFav: (qid: string) => void;
  removeWrong: (qid: string) => void;
  restoreWrong: (qid: string) => void;
  saveExam: (rec: ExamRecord) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setResume: (key: string, index: number) => void;
  replaceState: (next: AppState) => void;
  reset: () => void;
}

const Ctx = createContext<AppApi | null>(null);

export function StateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(createInitialState);
  const [ready, setReady] = useState(false);
  const firstSave = useRef(true);

  // 首帧后从 localStorage 装载（避免 SSR/首屏闪动）
  useEffect(() => {
    setState(loadState());
    setReady(true);
  }, []);

  // 状态变化即持久化
  useEffect(() => {
    if (!ready) return;
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    saveState(state);
  }, [state, ready]);

  // 主题与字号挂到 documentElement，CSS 变量统一接管
  useEffect(() => {
    const root = document.documentElement;
    const apply = (dark: boolean) => {
      root.dataset.theme = dark ? 'dark' : 'light';
    };
    const { theme, fontScale } = state.settings;
    root.dataset.font = String(fontScale);

    if (theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      apply(mq.matches);
      const handler = (e: MediaQueryListEvent) => apply(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    apply(theme === 'dark');
  }, [state.settings.theme, state.settings.fontScale]);

  const recordAnswer = useCallback((q: Question, ok: boolean) => {
    setState((prev) => {
      const now = Date.now();
      const p = prev.progress[q.id] ?? { tries: 0, correct: 0, streak: 0, lastAt: 0 };
      const streak = ok ? p.streak + 1 : 0;

      let wrong = prev.wrong;
      if (!ok) {
        const existed = prev.wrong[q.id];
        wrong = {
          ...prev.wrong,
          [q.id]: { firstAt: existed?.firstAt ?? now, lastAt: now, cleared: false },
        };
      } else if (prev.wrong[q.id] && streak >= 2) {
        // 连续答对两次 → 自动标记已掌握（仍可在错题本里找回）
        wrong = { ...prev.wrong, [q.id]: { ...prev.wrong[q.id], cleared: true } };
      }

      return {
        ...prev,
        progress: {
          ...prev.progress,
          [q.id]: { tries: p.tries + 1, correct: p.correct + (ok ? 1 : 0), streak, lastAt: now },
        },
        wrong,
        log: pushLog(prev.log, { at: now, qid: q.id, area: q.area, type: q.type, ok }),
      };
    });
  }, []);

  const toggleFav = useCallback((qid: string) => {
    setState((prev) => ({
      ...prev,
      fav: prev.fav.includes(qid) ? prev.fav.filter((x) => x !== qid) : [...prev.fav, qid],
    }));
  }, []);

  const removeWrong = useCallback((qid: string) => {
    setState((prev) => {
      const next = { ...prev.wrong };
      delete next[qid];
      return { ...prev, wrong: next };
    });
  }, []);

  const restoreWrong = useCallback((qid: string) => {
    setState((prev) => {
      const existed = prev.wrong[qid];
      if (!existed) return prev;
      return { ...prev, wrong: { ...prev.wrong, [qid]: { ...existed, cleared: false } } };
    });
  }, []);

  const saveExam = useCallback((rec: ExamRecord) => {
    setState((prev) => ({ ...prev, exams: [rec, ...prev.exams].slice(0, 50) }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  }, []);

  const setResume = useCallback((key: string, index: number) => {
    setState((prev) => ({ ...prev, resume: { ...prev.resume, [key]: index } }));
  }, []);

  const replaceState = useCallback((next: AppState) => {
    setState(next);
    saveState(next);
  }, []);

  const reset = useCallback(() => {
    const fresh = createInitialState();
    setState(fresh);
    saveState(fresh);
  }, []);

  const api = useMemo<AppApi>(
    () => ({
      state,
      ready,
      recordAnswer,
      toggleFav,
      removeWrong,
      restoreWrong,
      saveExam,
      updateSettings,
      setResume,
      replaceState,
      reset,
    }),
    [
      state,
      ready,
      recordAnswer,
      toggleFav,
      removeWrong,
      restoreWrong,
      saveExam,
      updateSettings,
      setResume,
      replaceState,
      reset,
    ],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useApp(): AppApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp 必须在 StateProvider 内使用');
  return ctx;
}
