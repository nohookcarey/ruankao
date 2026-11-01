import { areaMap, areas } from './questions';
import { isDue } from './review';
import type { AppState, Question } from './types';

/**
 * 考点（题目 tags）维度的掌握度。
 * 知识域只有 10 个，粒度太粗，定位不到「到底哪个知识点不会」；
 * tags 是每题自带的细粒度考点，按它聚合才能指出具体薄弱环节。
 */
export interface TopicStat {
  tag: string;
  areaId: string;
  areaName: string;
  /** 该考点题量 */
  total: number;
  /** 已作答过的题数 */
  answered: number;
  tries: number;
  correct: number;
  /** 0-1；未作答为 null */
  accuracy: number | null;
  /** 待复习错题数 */
  dueCount: number;
}

export interface TopicGroup {
  areaId: string;
  areaName: string;
  topics: TopicStat[];
}

export type TopicFilter = 'practiced' | 'weak' | 'untouched';

/** 正确率低于 60% 且有作答 → 薄弱 */
export const WEAK_RATE = 0.6;

export function computeTopics(all: Question[], state: AppState, now = Date.now()): TopicStat[] {
  const tagOfQid = new Map<string, string[]>();
  const meta = new Map<string, { areaId: string; total: number; answered: number; due: number }>();

  for (const q of all) {
    tagOfQid.set(q.id, q.tags);
    const tried = Boolean(state.progress[q.id]?.tries);
    const w = state.wrong[q.id];
    const due = Boolean(w && !w.cleared && isDue(w.dueAt, now));
    for (const tag of q.tags) {
      const cur = meta.get(tag) ?? { areaId: q.area, total: 0, answered: 0, due: 0 };
      cur.total += 1;
      if (tried) cur.answered += 1;
      if (due) cur.due += 1;
      meta.set(tag, cur);
    }
  }

  const acc = new Map<string, { tries: number; correct: number }>();
  for (const e of state.log) {
    // 案例题自评不算客观正确率，避免污染考点掌握度
    if (e.type === 'case') continue;
    for (const tag of tagOfQid.get(e.qid) ?? []) {
      const cur = acc.get(tag) ?? { tries: 0, correct: 0 };
      cur.tries += 1;
      if (e.ok) cur.correct += 1;
      acc.set(tag, cur);
    }
  }

  const out: TopicStat[] = [];
  for (const [tag, m] of meta) {
    const a = acc.get(tag);
    out.push({
      tag,
      areaId: m.areaId,
      areaName: areaMap[m.areaId]?.name ?? m.areaId,
      total: m.total,
      answered: m.answered,
      tries: a?.tries ?? 0,
      correct: a?.correct ?? 0,
      accuracy: a && a.tries > 0 ? a.correct / a.tries : null,
      dueCount: m.due,
    });
  }
  return out;
}

/** 按知识域分组，组内按「未练 → 正确率低 → 题量多」排，最该看的排在前面 */
export function groupTopics(topics: TopicStat[], filter: TopicFilter): TopicGroup[] {
  const keep = (t: TopicStat) => {
    if (filter === 'weak') return t.accuracy !== null && t.accuracy < WEAK_RATE;
    if (filter === 'untouched') return t.answered === 0;
    return t.answered > 0;
  };
  const groups: TopicGroup[] = [];
  for (const a of areas) {
    const list = topics
      .filter((t) => t.areaId === a.id && keep(t))
      .sort((x, y) => {
        const ax = x.accuracy === null ? -1 : x.accuracy;
        const ay = y.accuracy === null ? -1 : y.accuracy;
        if (ax !== ay) return ax - ay;
        return y.total - x.total;
      });
    if (list.length) groups.push({ areaId: a.id, areaName: a.name, topics: list });
  }
  return groups;
}

/** 最该补的考点：已作答、正确率低、题量大的优先 */
export function weakestTopics(topics: TopicStat[], limit = 5): TopicStat[] {
  return topics
    .filter((t) => t.tries > 0 && t.accuracy !== null && t.accuracy < WEAK_RATE)
    .sort((a, b) => {
      const d = (a.accuracy ?? 0) - (b.accuracy ?? 0);
      if (Math.abs(d) > 0.001) return d;
      return b.tries - a.tries;
    })
    .slice(0, limit);
}
