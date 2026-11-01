/** 日期工具：打卡、倒计时、复习排期都基于本地自然日 */

export const DAY_MS = 86400000;

/** 本地自然日的 YYYY-MM-DD（不要用 toISOString，那是 UTC，东八区会错一天） */
export function dateKey(ts: number = Date.now()): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/** 当天 00:00 的时间戳 */
export function startOfDay(ts: number = Date.now()): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function parseDateKey(key: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

export function formatDateKey(key: string): string {
  const ts = parseDateKey(key);
  if (ts === null) return key;
  const d = new Date(ts);
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

/**
 * 连续打卡天数。
 * 今天还没做题时从昨天开始数——否则每天零点一过，打卡数就「假性归零」。
 */
export function computeStreak(checkins: string[], today = dateKey()): number {
  const set = new Set(checkins);
  const t = parseDateKey(today);
  if (t === null) return 0;
  let cursor = set.has(today) ? t : t - DAY_MS;
  let n = 0;
  while (set.has(dateKey(cursor))) {
    n += 1;
    cursor -= DAY_MS;
  }
  return n;
}

/** 目标日期距今还有几天；负数表示已过 */
export function daysUntil(targetKey: string, today = dateKey()): number | null {
  const t = parseDateKey(targetKey);
  const n = parseDateKey(today);
  if (t === null || n === null) return null;
  return Math.round((t - n) / DAY_MS);
}
