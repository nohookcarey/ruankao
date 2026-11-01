import { DAY_MS, dateKey } from './date';
import { MASTER_STREAK } from './state';
import type { AppState, Question } from './types';

/**
 * 间隔重复排期：连对次数即记忆盒等级。
 * 答错立刻回到 0（当天可再练），答对一次进一格，间隔逐格拉长，
 * 连对到 MASTER_STREAK 次后错题归档、不再排期。
 */
export const REVIEW_INTERVALS = [0, 1, 2, 4, 7];

/**
 * 答错后的冷却期：刚做完一组题，错题不会立刻又堆进「今日复习」，
 * 免得用户感觉「怎么都做不完」。想马上重练可走错题本的「全部重练」，那里不受排期限制。
 */
export const REVIEW_COOLDOWN_MS = 10 * 60 * 1000;

export function reviewIntervalDays(streak: number): number | null {
  if (streak >= MASTER_STREAK) return null;
  const i = Math.max(0, Math.min(streak, REVIEW_INTERVALS.length - 1));
  return REVIEW_INTERVALS[i];
}

/** 计算下次复习时间；已归档返回 undefined */
export function nextDueAt(streak: number, now = Date.now()): number | undefined {
  const days = reviewIntervalDays(streak);
  if (days === null) return undefined;
  if (days === 0) return now + REVIEW_COOLDOWN_MS;
  return now + days * DAY_MS;
}

export function isDue(dueAt: number | undefined, now = Date.now()): boolean {
  // 旧数据没有 dueAt，视为立即到期，保证升级后错题不会「消失」
  return (dueAt ?? 0) <= now;
}

/** 给错题本用的排期文案 */
export function dueLabel(dueAt: number | undefined, now = Date.now()): string {
  if (dueAt === undefined) return '待复习';
  const diff = dueAt - now;
  if (diff <= 0) return '已到期';
  const days = Math.ceil(diff / DAY_MS);
  return days <= 1 ? '明天复习' : `${days} 天后复习`;
}

/**
 * 今日到期的错题 id，最早到期的排前面。
 * 传入 valid（题库现存的 id）可过滤掉题库里已删除的孤儿错题，
 * 否则「到期 29 题」点进去只有 27 道，数字会对不上。
 */
export function dueWrongIds(
  state: AppState,
  now = Date.now(),
  valid?: Set<string>,
): string[] {
  return Object.entries(state.wrong)
    .filter(([id, w]) => !w.cleared && isDue(w.dueAt, now) && (!valid || valid.has(id)))
    .sort((a, b) => (a[1].dueAt ?? 0) - (b[1].dueAt ?? 0))
    .map(([id]) => id);
}

export const DAILY_SIZE = 10;

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 可复现的洗牌：同一个 seed 一定得到同一个顺序 */
export function seededShuffle<T>(list: T[], seed: number): T[] {
  const arr = [...list];
  let s = seed || 1;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 每日一练：按日期做种子选题，同一天反复进入拿到同一组题，
 * 第二天自动换题。约七成未做过的题 + 三成已做过的题（滚动巩固）。
 */
export function pickDaily(
  all: Question[],
  state: AppState,
  key: string = dateKey(),
  size = DAILY_SIZE,
): Question[] {
  const seed = hashSeed(`daily:${key}`);
  const fresh = seededShuffle(
    all.filter((q) => !state.progress[q.id]?.tries),
    seed,
  );
  const seen = seededShuffle(
    all.filter((q) => state.progress[q.id]?.tries),
    seed ^ 0x9e3779b9,
  );

  const freshQuota = Math.ceil(size * 0.7);
  const picked = fresh.slice(0, Math.min(fresh.length, freshQuota));
  const rest = [...fresh.slice(picked.length), ...seen];
  picked.push(...rest.slice(0, Math.max(0, size - picked.length)));
  return picked.slice(0, size);
}
