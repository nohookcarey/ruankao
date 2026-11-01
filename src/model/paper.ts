import { areas, shuffle } from './questions';
import type { Question } from './types';

/** 软考中级·软件设计师：上午卷为 75 道单选，下午卷为 5 道案例，各 150 分钟、满分 75 */
export type PaperPart = 'am' | 'pm';

export const PART: Record<
  PaperPart,
  { label: string; minutes: number; size: number; fullScore: number; desc: string }
> = {
  am: {
    label: '上午卷',
    minutes: 150,
    size: 75,
    fullScore: 75,
    desc: '基础知识 · 75 道单选 · 150 分钟',
  },
  pm: {
    label: '下午卷',
    minutes: 150,
    size: 5,
    fullScore: 75,
    desc: '应用技术 · 5 道案例 · 150 分钟',
  },
};

/** 合格线 45/75，即 60% */
export const PASS_RATE = 0.6;

/**
 * 上午卷知识域配比（合计 100，按 75 题折算）。
 * 依据历年真题的大致分布设定：软件工程与面向对象占比最高，
 * 数据结构次之，组成原理/操作系统/网络各占 5%~8%。
 */
const AM_WEIGHTS: Record<string, number> = {
  arch: 7,
  os: 5,
  db: 8,
  net: 6,
  ds: 12,
  lang: 8,
  se: 21,
  oo: 13,
  dp: 10,
  sec: 10,
};

export type PaperKind = 'mock' | 'past';

export interface PaperEntry {
  part: PaperPart;
  /** 'mock' 或真题卷标识，如 '2023H' */
  key: string;
  kind: PaperKind;
  title: string;
  /** 题库中可用的题量 */
  available: number;
  /** 真实卷题量 */
  size: number;
  /** 是否达到真实卷题量 */
  complete: boolean;
  note?: string;
}

/** 真题卷标识：年份 + 上下半年，如 2023H / 2024L */
export function pastKeyOf(q: Question): string | null {
  if (q.source !== 'past-exam' || !q.year || !q.session) return null;
  return `${q.year}${q.session}`;
}

export function pastPaperTitle(key: string): string {
  const m = /^(\d{4})([HL])$/.exec(key);
  if (!m) return key;
  return `${m[1]} 年${m[2] === 'H' ? '上半' : '下半'}年`;
}

/** 某卷型可用的题池：上午卷只收单选，下午卷只收案例 */
export function partPool(all: Question[], part: PaperPart): Question[] {
  return all.filter((q) => (part === 'am' ? q.type === 'single' : q.type === 'case'));
}

/** 列出所有可选卷：真题卷（按年份倒序）+ 一份模拟卷 */
export function listPapers(all: Question[], part: PaperPart): PaperEntry[] {
  const size = PART[part].size;
  const entries: PaperEntry[] = [];

  const groups = new Map<string, Question[]>();
  for (const q of partPool(all, part)) {
    const key = pastKeyOf(q);
    if (!key) continue;
    const arr = groups.get(key) ?? [];
    arr.push(q);
    groups.set(key, arr);
  }

  for (const [key, qs] of [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
    entries.push({
      part,
      key,
      kind: 'past',
      title: `${pastPaperTitle(key)} · ${PART[part].label}`,
      available: qs.length,
      size,
      complete: qs.length >= size,
      note:
        qs.length >= size
          ? undefined
          : `真题尚缺 ${size - qs.length} 题，先按现有 ${qs.length} 题成卷`,
    });
  }

  const pool = partPool(all, part).length;
  entries.push({
    part,
    key: 'mock',
    kind: 'mock',
    title: `模拟${PART[part].label}`,
    available: pool,
    size,
    complete: pool >= size,
    note: pool >= size ? '按知识域配比从题库抽题' : `题库不足 ${size} 题，按现有 ${pool} 题成卷`,
  });

  return entries;
}

/** 按卷型 + 卷标识组卷，返回固定顺序的题目数组 */
export function buildPaper(all: Question[], part: PaperPart, key: string): Question[] {
  if (key !== 'mock') {
    const list = partPool(all, part).filter((q) => pastKeyOf(q) === key);
    return list.slice().sort((a, b) => (a.no ?? 0) - (b.no ?? 0));
  }
  return part === 'am' ? buildMockAm(all) : buildMockPm(all);
}

/**
 * 模拟上午卷：按知识域配比抽题，知识域顺序排列（真题卷也是按域排的）。
 * 某个域不够时从其他域补足，总量封顶 75。
 */
function buildMockAm(all: Question[]): Question[] {
  const pool = all.filter((q) => q.type === 'single');
  const byArea = new Map<string, Question[]>();
  for (const q of pool) {
    const arr = byArea.get(q.area) ?? [];
    arr.push(q);
    byArea.set(q.area, arr);
  }

  const picked: Question[] = [];
  for (const a of areas) {
    const avail = shuffle(byArea.get(a.id) ?? []);
    if (!avail.length) continue;
    const target = Math.round((PART.am.size * (AM_WEIGHTS[a.id] ?? 0)) / 100);
    picked.push(...avail.slice(0, Math.min(target, avail.length)));
  }

  if (picked.length < PART.am.size) {
    const used = new Set(picked.map((q) => q.id));
    const rest = shuffle(pool.filter((q) => !used.has(q.id)));
    picked.push(...rest.slice(0, PART.am.size - picked.length));
  }

  return picked.slice(0, PART.am.size);
}

/** 模拟下午卷：案例题数量本身有限，随机取满为止 */
function buildMockPm(all: Question[]): Question[] {
  return shuffle(all.filter((q) => q.type === 'case')).slice(0, PART.pm.size);
}

/** 折算到 75 分制 */
export function toFullScore(correct: number, total: number, fullScore = 75): number {
  if (!total) return 0;
  return Math.round((correct / total) * fullScore);
}

/** 是否达到合格线（60%） */
export function isPassed(correct: number, total: number): boolean {
  return total > 0 && correct / total >= PASS_RATE;
}

/** 合格所需题数，用于结果页提示 */
export function passLine(total: number): number {
  return Math.ceil(total * PASS_RATE);
}
