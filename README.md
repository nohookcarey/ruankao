# 软考 · 软件设计师刷题

中级《软件设计师》备考刷题工具。纯静态站点，可安装为 PWA，手机加到主屏后断网也能刷。

线上地址：<https://nohookcarey.github.io/ruankao/>

## 功能

- **三种题型**：单选题、填空题（多空、同义词判定）、案例题（对照参考答案自评）
- **两种练习节奏**
  - 练习模式：选中即判定，展开解析；可关闭「即时判定」，改为点确认后判定
  - 随机模考：随机组卷、150 分钟倒计时、答题卡、交卷后按知识域出分项报告
- **模拟真题考试**：按真实卷面分上下午两卷
  - 上午卷：75 道单选、150 分钟、满分 75 分
  - 下午卷：5 道案例、150 分钟、交卷后逐小问对照采分要点自评
  - 真题卷按 `year`+`session` 自动聚合成整卷，按题号排序；题库不足时按现有题量成卷，分数折算 75 分制（只作趋势参考）
  - 上午卷交卷后可逐题展开回顾：你的选项、正确答案、解析
- **错题本**：答错自动收录；同一道题**连续答对 5 次**自动归档为「已学会」，中途答错一次即清零重计；可手动移回待复习
- **收藏夹**、**学习统计**（总正确率、各知识域掌握度、最近 7 天趋势、模考记录）
- **数据自持**：进度只存本机 `localStorage`，支持导出 JSON 备份、导入恢复、以及一段 Base64「同步码」在手机与电脑之间搬运

## 技术栈

Vite + React 18 + TypeScript，`react-markdown` 渲染题干与解析，`vite-plugin-pwa` 做离线与安装。无 UI 组件库、无图表库（统计图是手写 SVG/CSS）。

题库按知识域拆成 `src/data/areas/*.json`，Vite 自动对 `import.meta.glob` 生成独立 chunk，首屏只加载外壳。

## 本地开发

```bash
npm install
npm run dev        # http://localhost:5173/ruankao/
npm run validate   # 题库 schema 校验
npm run build      # 类型检查 + 生产构建到 dist/
npm run preview    # 预览构建产物
```

> `.npm` 缓存目录权限异常时，可加 `--cache /tmp/npm-cache` 绕过。

## 部署

推送到 `main` 后，GitHub Actions 自动执行「校验 → 构建 → 发布 Pages」。首次需在仓库 Settings → Pages 中把 Source 设为 **GitHub Actions**。

`vite.config.ts` 里 `base: '/ruankao/'` 与仓库名绑定；改仓库名时要同步修改，否则线上白屏。路由使用 HashRouter，避免静态站深链接 404。

## 题库格式

`src/data/meta.json` 定义知识域，`src/data/areas/<areaId>.json` 存放该域题目数组。

```jsonc
// 单选
{
  "id": "arch-001",            // 全局唯一
  "type": "single",
  "area": "arch",              // 必须在 meta.json 中定义
  "difficulty": 2,             // 1 易 / 2 中 / 3 难
  "source": "seed",            // seed | past-exam | other
  "tags": ["数据表示", "补码"],
  "stem": "题干，支持 Markdown 与图片 `![图](figures/2023H-42.png)`",
  "options": [
    { "key": "A", "text": "选项文本" },
    { "key": "B", "text": "..." },
    { "key": "C", "text": "..." },
    { "key": "D", "text": "..." }
  ],
  "answer": "A",
  "explanation": "解析，支持 Markdown"
}
```

```jsonc
// 填空：answers 是可接受答案的列表，判题时做归一化（去空白、全角转半角、忽略大小写）后精确匹配
{
  "id": "os-006",
  "type": "fill",
  "area": "os",
  "stem": "进程的三种基本状态是运行、就绪和（1）。",
  "blanks": [{ "id": "b1", "answers": ["阻塞", "等待"], "hint": "填两个字", "size": "sm" }],
  "explanation": "..."
}
```

```jsonc
// 案例：不自动判分，交卷后展示参考答案与采分要点，由用户自评
{
  "id": "ds-008",
  "type": "case",
  "area": "ds",
  "stem": "题干",
  "subQuestions": [
    { "no": "1", "stem": "小问", "reference": "参考答案（Markdown）", "keyPoints": ["采分要点"] }
  ],
  "explanation": "..."
}
```

新增题目后跑 `npm run validate`：会检查 id 唯一性、选项完整性、答案是否在选项中、填空答案是否为空、图片文件是否存在，并打印各知识域题量。CI 也会执行这一步，不通过则不会发布。

### 录入真题

模考页的「真题卷」由题库自动聚合，无需单独维护卷子文件。一道真题要带上这四个字段：

```jsonc
{
  "id": "2023H-42",
  "type": "single",
  "area": "ds",
  "source": "past-exam",   // 必须是 past-exam 才会进真题卷
  "year": 2023,
  "session": "H",          // H 上半年 / L 下半年
  "no": 42,                // 卷内题号，上午卷 1~75，下午卷 1~5
  "stem": "...",
  "options": [...],
  "answer": "B",
  "explanation": "..."
}
```

`year`+`session` 相同的题会自动组成一套卷：单选按题号排成上午卷，案例排成下午卷。`npm run validate` 会检查三个字段是否齐全、同卷题号是否重复，并打印每套卷「上午卷 x/75、下午卷 y/5」和缺哪些题号。

图片放在 `public/figures/`，按题号命名（如 `2023H-42.png`），题干中用相对路径引用。

## 数据与隐私

不联网、不上传、无账号。所有答题记录保存在浏览器 `localStorage`（键 `ruankao.state.v1`）。清除浏览器数据或换设备会丢失，请用设置页的「导出 JSON」或「同步码」迁移。

## 说明

- 当前题库为**自建种子题**（覆盖十个知识域，用于验证产品闭环），真题尚未录入；因此真题卷列表为空，模考页只能用「模拟卷」，题量也不足 75 道。
- 案例题只能自评，统计中单列，不混入客观题正确率。下午卷按小问自评比例折算得分，同样不计入客观题正确率。
- 题目内容仅供个人备考学习使用，请勿用于商业传播。
