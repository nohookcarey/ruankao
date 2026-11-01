/** 题目类型：单选 / 填空 / 案例（主观自评） */
export type QuestionType = 'single' | 'fill' | 'case';

export type AreaId =
  | 'arch'
  | 'os'
  | 'db'
  | 'net'
  | 'ds'
  | 'lang'
  | 'se'
  | 'oo'
  | 'dp'
  | 'sec';

export interface AreaMeta {
  id: AreaId;
  name: string;
  short: string;
  order: number;
  desc?: string;
}

export interface BaseQuestion {
  /** 全局唯一，如 arch-001 / 2023H-42 */
  id: string;
  type: QuestionType;
  area: AreaId;
  /** 题干，Markdown */
  stem: string;
  /** 解析，Markdown */
  explanation: string;
  tags: string[];
  /** 1 易 2 中 3 难 */
  difficulty: 1 | 2 | 3;
  source: 'seed' | 'past-exam' | 'other';
  /** 真题定位（可选） */
  year?: number;
  session?: 'H' | 'L';
  no?: number;
}

export interface Option {
  key: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface SingleQuestion extends BaseQuestion {
  type: 'single';
  options: Option[];
  answer: 'A' | 'B' | 'C' | 'D';
}

export interface FillBlank {
  id: string;
  /** 可接受答案列表（已归一化前原文），命中任一即算对 */
  answers: string[];
  /** 提示，如“填中文术语” */
  hint?: string;
  /** 预估输入宽度，用于输入框宽度 */
  size?: 'sm' | 'md' | 'lg';
}

export interface FillQuestion extends BaseQuestion {
  type: 'fill';
  blanks: FillBlank[];
}

export interface CaseSubQuestion {
  no: string;
  stem: string;
  /** 参考答案，Markdown */
  reference: string;
  /** 采分要点 */
  keyPoints: string[];
}

export interface CaseQuestion extends BaseQuestion {
  type: 'case';
  subQuestions: CaseSubQuestion[];
}

export type Question = SingleQuestion | FillQuestion | CaseQuestion;

/** 一次作答记录 → 用于统计趋势 */
export interface AnswerLogEntry {
  at: number;
  qid: string;
  area: AreaId;
  type: QuestionType;
  ok: boolean;
}

export interface ProgressEntry {
  tries: number;
  correct: number;
  /** 连续答对次数，>= MASTER_STREAK（5）时错题归档为已学会 */
  streak: number;
  lastAt: number;
}

export interface WrongEntry {
  firstAt: number;
  lastAt: number;
  /** 连续答对 MASTER_STREAK 次后置 true，即移入「已学会」存档 */
  cleared: boolean;
  /**
   * 下次复习到期时间（毫秒）。答错 → 立即到期；答对 → 按记忆盒间隔顺延。
   * 归档后不再排期。旧数据缺省视为立即到期。
   */
  dueAt?: number;
}

/** 每日一练的完成记录，key 为 YYYY-MM-DD */
export interface DailyRecord {
  done: number;
  ok: number;
  total: number;
  at: number;
}

/** 模考类型：random 随机卷（旧）/ am 上午卷 / pm 下午卷 */
export type ExamKind = 'random' | 'am' | 'pm';

/** 交卷后的逐题回顾：只存最小信息，避免 localStorage 膨胀 */
export interface ReviewItem {
  id: string;
  /** 单选所选项 / 填空作答拼接；案例为 null */
  picked?: string | null;
  /** 对错；案例题自评为 null（走 caseKnown） */
  ok: boolean | null;
}

export interface ExamRecord {
  id: string;
  title: string;
  startedAt: number;
  submittedAt: number;
  /** 满分题目数（客观题）。下午卷为小问总数 */
  total: number;
  correct: number;
  /** 按知识域：正确数 / 总数 */
  byArea: Record<string, { correct: number; total: number }>;
  /** 案例自评：会 / 不会 */
  caseSelf: { known: number; unknown: number };
  durationMs: number;
  /** 卷型，旧记录无此字段视作 random */
  kind?: ExamKind;
  /** 折算到 75 分制的得分 */
  score?: number;
  maxScore?: number;
  passed?: boolean;
  review?: ReviewItem[];
}

export interface Settings {
  theme: 'light' | 'dark' | 'auto';
  /** 0 标准 1 大 2 特大 */
  fontScale: 0 | 1 | 2;
  /** 练习模式是否即时判定 */
  immediateJudge: boolean;
  /** 考试日期 YYYY-MM-DD，用于倒计时与每日任务量 */
  examDate?: string;
  /** 每日目标题数 */
  dailyGoal: number;
}

export interface AppState {
  version: 1;
  progress: Record<string, ProgressEntry>;
  wrong: Record<string, WrongEntry>;
  fav: string[];
  exams: ExamRecord[];
  settings: Settings;
  log: AnswerLogEntry[];
  /** 各题集的续做位置 */
  resume: Record<string, number>;
  /** 有作答的日期（YYYY-MM-DD），用于连续打卡统计 */
  checkins: string[];
  /** 每日一练完成记录，只保留最近 30 天 */
  daily: Record<string, DailyRecord>;
}

export interface QuestionSet {
  key: string;
  title: string;
  subtitle?: string;
  items: Question[];
}
