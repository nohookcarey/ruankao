#!/usr/bin/env node
/**
 * 题库校验脚本
 * 用法：npm run validate
 * 任何一项不通过即以退出码 1 结束，可接入 CI。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const areasDir = join(root, 'src/data/areas');
const metaPath = join(root, 'src/data/meta.json');
const figuresDir = join(root, 'public/figures');

const errors = [];
const warnings = [];

function err(qid, msg) {
  errors.push(`[${qid}] ${msg}`);
}
function warn(qid, msg) {
  warnings.push(`[${qid}] ${msg}`);
}

const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
const areaIds = new Set(meta.areas.map((a) => a.id));
const typeSet = new Set(['single', 'fill', 'case']);
const sourceSet = new Set(['seed', 'past-exam', 'other']);

const files = readdirSync(areasDir).filter((f) => f.endsWith('.json'));
const seen = new Set();
const perArea = {};
const perType = { single: 0, fill: 0, case: 0 };
let total = 0;

for (const file of files) {
  const areaFromFile = basename(file, '.json');
  if (!areaIds.has(areaFromFile)) {
    errors.push(`[文件] ${file} 对应的知识域 "${areaFromFile}" 未在 meta.json 中定义`);
  }

  let list;
  try {
    list = JSON.parse(readFileSync(join(areasDir, file), 'utf8'));
  } catch (e) {
    errors.push(`[文件] ${file} JSON 解析失败：${e.message}`);
    continue;
  }
  if (!Array.isArray(list)) {
    errors.push(`[文件] ${file} 顶层必须是数组`);
    continue;
  }

  for (const q of list) {
    total += 1;
    const qid = q.id ?? `(${file} 第 ${total} 条)`;

    if (!q.id) err(qid, '缺少 id');
    else if (seen.has(q.id)) err(qid, 'id 重复');
    else seen.add(q.id);

    if (!typeSet.has(q.type)) err(qid, `type 非法：${q.type}`);
    if (!areaIds.has(q.area)) err(qid, `area 未在 meta.json 中定义：${q.area}`);
    if (q.area !== areaFromFile) err(qid, `area(${q.area}) 与所在文件 ${file} 不一致`);
    if (![1, 2, 3].includes(q.difficulty)) err(qid, `difficulty 必须是 1/2/3，当前：${q.difficulty}`);
    if (!sourceSet.has(q.source)) err(qid, `source 非法：${q.source}`);
    if (!q.stem || !String(q.stem).trim()) err(qid, '题干为空');
    if (!Array.isArray(q.tags) || q.tags.length === 0) warn(qid, '没有 tags');
    if (!q.explanation || !String(q.explanation).trim()) warn(qid, '没有解析');

    if (q.type === 'single') {
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        err(qid, '单选题必须有且仅有 4 个选项');
      } else {
        const keys = q.options.map((o) => o.key);
        if (new Set(keys).size !== 4) err(qid, '选项 key 有重复');
        for (const k of ['A', 'B', 'C', 'D']) {
          if (!keys.includes(k)) err(qid, `缺少选项 ${k}`);
        }
        if (q.options.some((o) => !o.text || !String(o.text).trim())) err(qid, '存在空选项文本');
        if (!keys.includes(q.answer)) err(qid, `answer(${q.answer}) 不在选项 key 中`);
      }
    }

    if (q.type === 'fill') {
      if (!Array.isArray(q.blanks) || q.blanks.length === 0) {
        err(qid, '填空题至少要有一个空');
      } else {
        for (const b of q.blanks) {
          if (!b.id) err(qid, '填空缺少 id');
          if (!Array.isArray(b.answers) || b.answers.length === 0) {
            err(qid, `空 ${b.id} 的 answers 不能为空`);
            continue;
          }
          if (b.answers.some((a) => !a || !String(a).trim())) {
            err(qid, `空 ${b.id} 存在空答案字符串`);
          }
          const norm = b.answers.map((a) => String(a).replace(/\s+/g, '').toLowerCase());
          if (new Set(norm).size !== norm.length) {
            warn(qid, `空 ${b.id} 的 answers 归一化后有重复项`);
          }
        }
      }
    }

    if (q.type === 'case') {
      if (!Array.isArray(q.subQuestions) || q.subQuestions.length === 0) {
        err(qid, '案例题至少要有一个小问');
      } else {
        for (const s of q.subQuestions) {
          if (!s.no) err(qid, '小问缺少编号');
          if (!s.stem) err(qid, `小问 ${s.no} 缺少题干`);
          if (!s.reference) err(qid, `小问 ${s.no} 缺少参考答案`);
          if (!Array.isArray(s.keyPoints) || s.keyPoints.length === 0) {
            warn(qid, `小问 ${s.no} 没有采分要点`);
          }
        }
      }
    }

    // 图片引用检查
    const text = JSON.stringify(q);
    const imgRe = /!\[[^\]]*\]\(([^)\s]+)\)/g;
    let m;
    while ((m = imgRe.exec(text))) {
      const src = m[1];
      if (/^https?:/.test(src)) continue;
      const fileName = basename(src);
      if (!existsSync(join(figuresDir, fileName))) {
        err(qid, `图片不存在：public/figures/${fileName}`);
      }
    }

    perType[q.type] = (perType[q.type] ?? 0) + 1;
    perArea[q.area] = (perArea[q.area] ?? 0) + 1;
  }
}

console.log('\n===== 题库校验 =====');
console.log(`知识域文件：${files.length} 个 / meta 定义 ${meta.areas.length} 个`);
console.log(`题目总数：${total}  （单选 ${perType.single} · 填空 ${perType.fill} · 案例 ${perType.case}）\n`);

console.log('各知识域题量：');
for (const a of meta.areas) {
  const n = perArea[a.id] ?? 0;
  const flag = n === 0 ? '  ← 空' : '';
  console.log(`  ${String(a.order).padStart(2)}. ${a.name.padEnd(16, '　')} ${String(n).padStart(3)} 题${flag}`);
}

if (warnings.length) {
  console.log(`\n警告 ${warnings.length} 条：`);
  warnings.forEach((w) => console.log('  ⚠ ' + w));
}

if (errors.length) {
  console.log(`\n错误 ${errors.length} 条：`);
  errors.forEach((e) => console.log('  ✗ ' + e));
  console.log('\n校验未通过\n');
  process.exit(1);
}

console.log('\n校验通过 ✓\n');
