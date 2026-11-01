import type { AreaMeta, Question } from './types';
import metaJson from '../data/meta.json';

export const areas = ((metaJson.areas as unknown) as AreaMeta[])
  .slice()
  .sort((a, b) => a.order - b.order);

export const areaMap: Record<string, AreaMeta> = Object.fromEntries(
  areas.map((a) => [a.id, a]),
);

/**
 * 题库按知识域分片：Vite 会把每个 JSON 打成独立 chunk，
 * 首屏只加载首页需要的元信息，进章节时才拉对应分片。
 */
const modules = import.meta.glob<{ default: Question[] }>('../data/areas/*.json');

function loaderFor(areaId: string) {
  const key = `../data/areas/${areaId}.json`;
  return modules[key];
}

const cache = new Map<string, Question[]>();

export async function loadArea(areaId: string): Promise<Question[]> {
  if (cache.has(areaId)) return cache.get(areaId)!;
  const loader = loaderFor(areaId);
  if (!loader) return [];
  const mod = (await loader()) as unknown as { default?: Question[] } | Question[];
  // Vite 对 JSON 动态导入会包一层 default，这里两种形态都兼容
  const list = Array.isArray(mod) ? mod : (mod.default ?? []);
  cache.set(areaId, list);
  return list;
}

let allPromise: Promise<Question[]> | null = null;

export function loadAll(): Promise<Question[]> {
  if (!allPromise) {
    allPromise = Promise.all(areas.map((a) => loadArea(a.id))).then((groups) =>
      groups.flat(),
    );
  }
  return allPromise;
}

/** 按难度加权抽样：难度低的更容易被抽到，避免一开始就劝退 */
export function shuffle<T>(list: T[]): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function countByType(list: Question[]) {
  return {
    single: list.filter((q) => q.type === 'single').length,
    fill: list.filter((q) => q.type === 'fill').length,
    case: list.filter((q) => q.type === 'case').length,
  };
}

export function shortId(q: Question): string {
  if (q.year && q.no) return `${q.year}${q.session === 'L' ? '下' : '上'}-${q.no}`;
  return q.tags[0] ?? q.id;
}
