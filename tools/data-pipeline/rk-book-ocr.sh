#!/bin/bash
set -u
SRC="/Users/careynohook/Downloads/中级软件设计师/25年软件设计师全套文档资料/02.历年真题+解析/09-23年"
OUT="/tmp/books"
mkdir -p "$OUT"

declare -a BOOKS=(
  "软件设计师2009至2016年试题分析与解答.pdf|b0916"
  "软件设计师2013至2018年试题分析与解答.pdf|b1318"
  "软件设计师2017至2019年试题分析与解答.pdf|b1719"
)

for item in "${BOOKS[@]}"; do
  pdf="${item%%|*}"; tag="${item##*|}"
  mkdir -p "$OUT/$tag/txt" "$OUT/$tag/work"
  total=$(pdfinfo "$SRC/$pdf" 2>/dev/null | awk '/^Pages/{print $2}')
  echo "[$tag] 共 $total 页"
  s=1
  while [ "$s" -le "$total" ]; do
    e=$((s+39)); [ "$e" -gt "$total" ] && e=$total
    pdftoppm -f "$s" -l "$e" -r 200 -png "$SRC/$pdf" "$OUT/$tag/work/pg" 2>/dev/null
    /tmp/ocrbin "$OUT/$tag/txt" "$OUT/$tag"/work/*.png > /dev/null 2>&1
    rm -f "$OUT/$tag"/work/*.png
    echo "[$tag] $s-$e done ($(ls "$OUT/$tag/txt" | wc -l | tr -d ' ') 页)"
    s=$((e+1))
  done
done
echo "ALL DONE"
