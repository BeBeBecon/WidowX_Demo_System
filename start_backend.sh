#!/usr/bin/env bash
# ----------------
# バックエンドサーバー起動スクリプト
# ----------------
set -e
PROJ_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJ_DIR/backend"
source venv/bin/activate
echo "[Backend] http://localhost:8765 で起動中..."
uvicorn main:app --host 0.0.0.0 --port 8765 --reload
