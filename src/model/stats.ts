import { areaMap, areas } from './questions';
import type { AppState, Question } from './types';

export interface AreaStat {
  areaId: string;
  name: string;
  short: string;
  total: number;
  answered: number;
  tries: number;
  correct: number;
  /** 0-1，无作答时为 null */
  accuracy: number | null;
}

export interface DayStat {
  date: string;
  label: string;
  count: number;
  correct: number;
}

export interface StatsSummary {
  totalQuestions: number;
  answered: number;
  objectiveTries: number;
  objectiveCorrect: number;
  objectiveAccuracy: number | null;
  caseKnown: number;
  caseTotal: number;
  areaStats: AreaStat[];
  week: DayStat[];
  wrongOpen: number;
  wrongCleared: number;
  favCount: number;
  examScores: { label: string; score: number; total: number; at: number }[];
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export function computeStats(state: AppState, all: Question[]): StatsSummary {
  const totalByArea: Record<string, number> = {};
  const answeredByArea: Record<string, number> = {};
  for (const q of all) {
    totalByArea[q.area] = (totalByArea[q.area] ?? 0) + 1;
    if (state.progress[q.id]?.tries) answeredByArea[q.area] = (answeredByArea[q.area] ?? 0) + 1;
  }

  const triesByArea: Record<string, number> = {};
  const correctByArea: Record<string, number> = {};

  let objectiveTries = 0;
  let objectiveCorrect = 0;
  let caseKnown = 0;
  let caseTotal = 0;

  for (const entry of state.log) {
    if (entry.type === 'case') {
      caseTotal += 1;
      if (entry.ok) caseKnown += 1;
      continue;
    }
    objectiveTries += 1;
    if (entry.ok) objectiveCorrect += 1;
    triesByArea[entry.area] = (triesByArea[entry.area] ?? 0) + 1;
    if (entry.ok) correctByArea[entry.area] = (correctByArea[entry.area] ?? 0) + 1;
  }

  const areaStats: AreaStat[] = areas.map((a) => {
    const tries = triesByArea[a.id] ?? 0;
    const correct = correctByArea[a.id] ?? 0;
    return {
      areaId: a.id,
      name: a.name,
      short: a.short,
      total: totalByArea[a.id] ?? 0,
      answered: answeredByArea[a.id] ?? 0,
      tries,
      correct,
      accuracy: tries > 0 ? correct / tries : null,
    };
  });

  // 最近 7 天
  const week: DayStat[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    week.push({
      date: dayKey(d.getTime()),
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      count: 0,
      correct: 0,
    });
  }
  const weekMap = Object.fromEntries(week.map((w) => [w.date, w]));
  for (const entry of state.log) {
    const bucket = weekMap[dayKey(entry.at)];
    if (bucket) {
      bucket.count += 1;
      if (entry.ok) bucket.correct += 1;
    }
  }

  let wrongOpen = 0;
  let wrongCleared = 0;
  for (const w of Object.values(state.wrong)) {
    if (w.cleared) wrongCleared += 1;
    else wrongOpen += 1;
  }

  const examScores = state.exams
    .slice(0, 10)
    .reverse()
    .map((e) => {
      const d = new Date(e.submittedAt);
      return {
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        score: e.correct,
        total: e.total,
        at: e.submittedAt,
      };
    });

  return {
    totalQuestions: all.length,
    answered: Object.values(state.progress).filter((p) => p.tries > 0).length,
    objectiveTries,
    objectiveCorrect,
    objectiveAccuracy: objectiveTries > 0 ? objectiveCorrect / objectiveTries : null,
    caseKnown,
    caseTotal,
    areaStats,
    week,
    wrongOpen,
    wrongCleared,
    favCount: state.fav.length,
    examScores,
  };
}

export function areaName(areaId: string): string {
  return areaMap[areaId]?.name ?? areaId;
}

export function pct(x: number | null): string {
  if (x === null) return '—';
  return `${Math.round(x * 100)}%`;
}
