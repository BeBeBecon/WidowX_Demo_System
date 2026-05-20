#!/usr/bin/env bash
# ----------------
# フロントエンド開発サーバー起動スクリプト
# 本番環境では: npm run build && npm run preview
# ----------------
set -e
PROJ_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJ_DIR/frontend"
echo "[Frontend] http://localhost:5173 で起動中..."
npm run dev
