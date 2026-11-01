import LZString from 'lz-string';
import type { AnswerLogEntry, AppState, ExamRecord, Settings } from './types';

export const STORAGE_KEY = 'ruankao.state.v1';
/** 只保留最近 2000 条作答记录，避免 localStorage 膨胀 */
const LOG_LIMIT = 2000;

/**
 * 错题归档门槛：同一道错题「连续答对」5 次才移入已学会存档。
 * 中途答错一次即清零重计——避免蒙对两三次就归档。
 */
export const MASTER_STREAK = 5;

export const defaultSettings: Settings = {
  theme: 'auto',
  fontScale: 0,
  immediateJudge: true,
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
  };
}

/** 容错读取：字段缺失/损坏时回落到默认值，不抛异常 */
export function loadState(): AppState {
  const base = createInitialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...base,
      progress: parsed.progress ?? {},
      wrong: parsed.wrong ?? {},
      fav: Array.isArray(parsed.fav) ? parsed.fav : [],
      exams: Array.isArray(parsed.exams) ? parsed.exams : [],
      settings: { ...defaultSettings, ...(parsed.settings ?? {}) },
      log: Array.isArray(parsed.log) ? parsed.log : [],
      resume: parsed.resume ?? {},
    };
  } catch {
    return base;
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // localStorage 满了（极少见）：裁剪日志后重试一次
    try {
      const slim: AppState = { ...state, log: state.log.slice(-200) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
    } catch {
      console.warn('保存失败：本地存储不可用', e);
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
  const base = createInitialState();
  return {
    ...base,
    progress: parsed.progress ?? {},
    wrong: parsed.wrong ?? {},
    fav: Array.isArray(parsed.fav) ? parsed.fav : [],
    exams: Array.isArray(parsed.exams) ? parsed.exams : [],
    settings: { ...defaultSettings, ...(parsed.settings ?? {}) },
    log: Array.isArray(parsed.log) ? parsed.log : [],
    resume: parsed.resume ?? {},
  };
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
