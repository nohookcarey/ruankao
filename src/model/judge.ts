import type { FillQuestion, Question, SingleQuestion } from './types';

/**
 * 归一化：只做机械、无争议的处理，不做语义猜测。
 * - 全角字符 → 半角（含全角括号、全角字母数字）
 * - 全角空格 → 半角空格
 * - 中文标点 → 英文标点
 * - 去掉所有空白
 * - 转小写
 */
export function normalize(input: string): string {
  if (!input) return '';
  return input
    // 全角 ASCII（！-～）→ 半角
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    // 全角空格
    .replace(/\u3000/g, ' ')
    // 中文标点统一
    .replace(/[，、]/g, ',')
    .replace(/[。]/g, '.')
    .replace(/[；]/g, ';')
    .replace(/[：]/g, ':')
    .replace(/[？]/g, '?')
    .replace(/[！]/g, '!')
    .replace(/[“”「」]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[－—–]/g, '-')
    .replace(/[×]/g, '*')
    .replace(/[÷]/g, '/')
    // 去掉全部空白（含不换行空格）
    .replace(/[\s\u00a0]+/g, '')
    .toLowerCase();
}

/** 判断题主是否答对（单选） */
export function judgeSingle(q: SingleQuestion, picked: string | null): boolean {
  if (!picked) return false;
  return picked === q.answer;
}

/** 逐空判定，返回每个空是否正确 */
export function judgeFill(q: FillQuestion, inputs: string[]): boolean[] {
  return q.blanks.map((blank, i) => {
    const raw = inputs[i] ?? '';
    if (!raw.trim()) return false;
    const n = normalize(raw);
    return blank.answers.some((ans) => normalize(ans) === n);
  });
}

/** 填空题整题判定：所有空都对才算对（软考按整题计分） */
export function judgeFillAll(q: FillQuestion, inputs: string[]): boolean {
  const flags = judgeFill(q, inputs);
  return flags.length > 0 && flags.every(Boolean);
}

/** 客观题判定入口。案例题不参与自动判定，返回 null */
export function judgeQuestion(
  q: Question,
  answer: { picked?: string | null; inputs?: string[] },
): boolean | null {
  if (q.type === 'single') return judgeSingle(q, answer.picked ?? null);
  if (q.type === 'fill') return judgeFillAll(q, answer.inputs ?? []);
  return null;
}

/** 解析题干中的图片相对路径 → 拼接 base */
export function resolveAsset(src: string): string {
  if (/^(https?:)?\/\//.test(src) || src.startsWith('data:')) return src;
  const base = import.meta.env.BASE_URL || '/';
  const clean = src.replace(/^\.?\//, '');
  return base.replace(/\/$/, '') + '/' + clean;
}
