#!/bin/bash
set -u
SRC="/Users/careynohook/Downloads/中级软件设计师/25年软件设计师全套文档资料/02.历年真题+解析/2020-2024年真题＋解析"
OUT="/tmp/ocr3"
rm -rf "$OUT"; mkdir -p "$OUT/img" "$OUT/txt"

declare -a MAP=(
  "2020年/2020年11月软件设计师真题及解析.pdf|2020L"
  "2021年/2021年05月软件设计师真题及解析.pdf|2021H"
  "2021年/2021年11月软件设计师真题及解析.pdf|2021L"
)

for item in "${MAP[@]}"; do
  pdf="${item%%|*}"
  tag="${item##*|}"
  echo "[$tag] 转图..."
  pdftoppm -r 200 -png "$SRC/$pdf" "$OUT/img/${tag}" 2>&1 | head -3
  echo "[$tag] 页数: $(ls "$OUT/img/${tag}"-*.png 2>/dev/null | wc -l)"
done

echo "开始 OCR..."
/tmp/ocrbin "$OUT/txt" "$OUT"/img/*.png
echo "OCR 完成: $(ls "$OUT/txt"/*.txt 2>/dev/null | wc -l) 个文件"
