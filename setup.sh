#!/usr/bin/env bash
# =====================================
# setup.sh - 依存パッケージの一括インストール
# 初回セットアップ時に一度だけ実行する
# =====================================
set -e

PROJ_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "======================================"
echo "  WidowX Sub Agent - Setup"
echo "======================================"

# ----------------
# .env ファイルの確認
# ----------------
if [ ! -f "$PROJ_DIR/.env" ]; then
  cp "$PROJ_DIR/.env.example" "$PROJ_DIR/.env"
  echo "[INFO] .env を作成しました。OllamaのURLなどを設定してください: $PROJ_DIR/.env"
else
  echo "[INFO] .env は既に存在します"
fi

# ----------------
# バックエンド: Python仮想環境 + pip
# ----------------
echo ""
echo "[Backend] Python仮想環境をセットアップ中..."
cd "$PROJ_DIR/backend"
python3 -m venv venv
source venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
deactivate
echo "[Backend] インストール完了"

# ----------------
# フロントエンド: npm install
# ----------------
echo ""
echo "[Frontend] npm パッケージをインストール中..."
cd "$PROJ_DIR/frontend"
npm install --silent
echo "[Frontend] インストール完了"

echo ""
echo "======================================"
echo "  セットアップ完了!"
echo ""
echo "  次のステップ:"
echo "  1. .env を編集して OLLAMA_HOST / LEROBOT_PATH を設定"
echo "  2. バックエンド起動: bash start_backend.sh"
echo "  3. フロントエンド起動: bash start_frontend.sh"
echo "======================================"
