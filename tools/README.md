# tools —— 题库数据管线与验证脚本

这个目录存放构建、修复、校验题库时用过的脚本。它们本身不参与前端构建（`npm run build` 不会打包这里），只是把当时的处理过程留档，方便以后补题、修解析时复用。

> 脚本里出现的 `/tmp/rk-*` 路径是当时的临时工作目录，复用时按需改成自己的路径。

## 目录结构

```
tools/
├── data-pipeline/   题库抽取、清洗、入库、修复脚本（Python + Shell）
├── verify/          浏览器回归验证脚本（Playwright）
└── ocr/             macOS Vision OCR 工具源码
```

## 题库是怎么来的

题库分两层来源：**历年真题原文**（PDF）和**官方《试题分析与解答》**（三本，1810 页扫描件）。

```
PDF 扫描件
  │  pdftoppm -r 200 -png
  ▼
页面 PNG
  │  ocr/ocr.swift 编译出的 ocrbin（macOS Vision，约 1.2 秒/页）
  ▼
逐页文本
  │  data-pipeline/rk-parse-book.py（先切章，再去噪，最后切题）
  ▼
题目 + 解析结构化数据
  │  data-pipeline/rk-fill-book.py（入库 + OCR 错字清洗）
  ▼
src/data/areas/*.json
```

### data-pipeline 主要脚本

| 脚本 | 作用 |
|---|---|
| `rk-extract.py` | 从真题 PDF 里抽取题目与选项 |
| `rk-parse.py` / `rk-parse-book.py` | 官方书切章、切题、抽「试题（N）分析」与「参考答案」 |
| `rk-parse-exp.py` ~ `rk-parse-exp3.py` | 解析文本的逐步精修（题号组、区间展开、共用材料合并分析） |
| `rk-fill-book.py` / `rk-fill-exp.py` | 解析写入题库，同时清洗 OCR 错字（钓→的、描还→描述、兀→π 等） |
| `rk-clean-ocr.py` / `rk-reclean.py` | 独立的错字与噪音清理 |
| `rk-fix-formula.py` / `rk-fix-sub.py` | 公式字符转换、Unicode 上下标治理 |
| `rk-fix-stem-latex.py` / `rk-fix-stem2.py` | 题干里残留的 LaTeX 残块替换 |
| `rk-rewrite-expl.py` / `rk-rewrite-expl2.py` | 公式类解析重写为可读文本 |
| `rk-scan.py` | 全库质检扫描（选项缺失、答案越界、解析串题等） |
| `rk-restore.py` | 从快照回滚题库分片 |
| `rk-build*.py` | 早期题库构建脚本 |
| `rk-book-ocr.sh` / `rk-ocr-all.sh` | PDF → 图片 → OCR 的批处理入口 |

### 复现 OCR 工具

```bash
cd tools/ocr
swiftc -O -o ocrbin ocr.swift
./ocrbin page-001.png page-002.png
```

`ocr.swift` 用 `VNRecognizeTextRequest`，语言设为 `zh-Hans` + `en-US`，`.accurate` 模式。

## 验证脚本

`tools/verify/` 下的 `.mjs` 是 Playwright 脚本，跑在本地 `vite preview` 或线上站点上：

| 脚本 | 用途 |
|---|---|
| `rk-regress.mjs` | 全站回归（6 个页面走一遍，检查 console error、数据写入） |
| `rk-verify-fix.mjs` | 第二轮 9 项缺陷的逐条验证 |
| `rk-audit1~3.mjs` | 排查阶段的缺陷复现脚本 |
| `rk-final.mjs` | 自动交卷、草稿超时等边界场景 |
| `rk-online.mjs` | 线上站点验证 |

跑之前需要：`npx vite preview --port 4179 --strictPort`，并在脚本顶部改成本机 Playwright 的实际安装路径（脚本里硬编码了 `~/.npm/_npx/.../node_modules/playwright`）。

## 注意

- 这些脚本是**一次性处理脚本**，参数和路径都是当时现场改的，不是通用 CLI 工具
- 涉及写题库的脚本都会直接覆盖 `src/data/areas/*.json`，跑之前先 `cp -r src/data/areas /tmp/areas-bak`
- `npm run validate` 可以对题库做基础校验（选项完整性、答案合法性）
