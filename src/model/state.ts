import LZString from 'lz-string';
import type { AnswerLogEntry, AppState, DailyRecord, ExamRecord, Settings } from './types';

export const STORAGE_KEY = 'ruankao.state.v1';
/** 只保留最近 2000 条作答记录，避免 localStorage 膨胀 */
const LOG_LIMIT = 2000;
/** 每日一练记录只留最近 30 天 */
const DAILY_KEEP = 30;

/**
 * 错题归档门槛：同一道错题「连续答对」5 次才移入已学会存档。
 * 中途答错一次即清零重计——避免蒙对两三次就归档。
 */
export const MASTER_STREAK = 5;

export const defaultSettings: Settings = {
  theme: 'auto',
  fontScale: 0,
  immediateJudge: true,
  dailyGoal: 20,
};

export function createInitialState(): AppState {
  return {
    version: 1,
    progress: {},
    wrong: {},
    fav: [],
    exams: [],
    settings: { ...defaultSettings },
    log: [],
    resume: {},
    checkins: [],
    daily: {},
  };
}

/**
 * 把任意来源（localStorage / 导入文件 / 同步码）的数据补成完整状态。
 * 旧版本没有 checkins、daily、examDate，这里统一兜底，避免读到 undefined 就崩。
 */
function hydrate(parsed: Partial<AppState> | null | undefined): AppState {
  const base = createInitialState();
  if (!parsed || typeof parsed !== 'object') return base;

  const daily: Record<string, DailyRecord> = {};
  if (parsed.daily && typeof parsed.daily === 'object') {
    for (const [k, v] of Object.entries(parsed.daily)) {
      if (v && typeof v === 'object') daily[k] = v as DailyRecord;
    }
  }

  return {
    ...base,
    progress: parsed.progress ?? {},
    wrong: parsed.wrong ?? {},
    fav: Array.isArray(parsed.fav) ? parsed.fav : [],
    exams: Array.isArray(parsed.exams) ? parsed.exams : [],
    settings: { ...defaultSettings, ...(parsed.settings ?? {}) },
    log: Array.isArray(parsed.log) ? parsed.log : [],
    resume: parsed.resume ?? {},
    // 早于本版本的用户没有打卡记录，从作答日志反推，避免一升级就显示「0 天」
    checkins: Array.isArray(parsed.checkins)
      ? parsed.checkins.filter((x): x is string => typeof x === 'string')
      : Array.isArray(parsed.log)
        ? [...new Set(parsed.log.map((e) => dayKeyOf(e.at)))].filter(Boolean)
        : [],
    daily,
  };
}

function dayKeyOf(ts: number): string {
  if (!Number.isFinite(ts)) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/** 容错读取：字段缺失/损坏时回落到默认值，不抛异常 */
export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    return hydrate(JSON.parse(raw) as Partial<AppState>);
  } catch {
    return createInitialState();
  }
}

/** 存储写入失败时广播的事件名，UI 层据此提示用户「这次没存上」 */
export const STORAGE_ERROR_EVENT = 'ruankao:storage-error';

/** 失败提示的节流，避免连续作答时刷屏 */
let lastStorageWarnAt = 0;

/**
 * 保存状态。返回是否真的写进去了 ——
 * 隐私模式 / 配额写满时 setItem 会抛错，绝不能静默吞掉，
 * 否则用户以为答完了，刷新后全部消失。
 */
export function saveState(state: AppState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    // localStorage 满了（极少见）：裁剪日志后重试一次
    try {
      const slim: AppState = { ...state, log: state.log.slice(-200) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
      return true;
    } catch {
      console.warn('保存失败：本地存储不可用', e);
      if (Date.now() - lastStorageWarnAt > 8000) {
        lastStorageWarnAt = Date.now();
        try {
          window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT));
        } catch {
          /* 非浏览器环境忽略 */
        }
      }
      return false;
    }
  }
}

export function pushLog(log: AnswerLogEntry[], entry: AnswerLogEntry): AnswerLogEntry[] {
  const next = [...log, entry];
  return next.length > LOG_LIMIT ? next.slice(next.length - LOG_LIMIT) : next;
}

/** 导出为格式化 JSON 字符串 */
export function exportJSON(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

/** 导入：校验形态后合并，返回新状态；失败抛错 */
export function parseImport(text: string): AppState {
  const parsed = JSON.parse(text) as Partial<AppState>;
  if (!parsed || typeof parsed !== 'object' || !parsed.progress) {
    throw new Error('文件格式不正确：缺少 progress 字段');
  }
  return hydrate(parsed);
}

/** 生成同步码：压缩 + Base64，方便微信/备忘录搬运 */
export function encodeSyncCode(state: AppState): string {
  return LZString.compressToBase64(JSON.stringify(state));
}

export function decodeSyncCode(code: string): AppState {
  const json = LZString.decompressFromBase64(code.trim());
  if (!json) throw new Error('同步码无法解析，请确认内容完整');
  return parseImport(json);
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export type { ExamRecord };
