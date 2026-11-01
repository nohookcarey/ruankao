#!/bin/sh
# 本地截图辅助脚本（仅开发期使用）
SHELL_BIN="$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell"
OUT="$1"
URL="$2"
"$SHELL_BIN" --headless=new --no-sandbox --disable-dev-shm-usage \
  --use-angle=swiftshader --hide-scrollbars --window-size=390,844 \
  --virtual-time-budget=6000 --screenshot="$OUT" "$URL"
