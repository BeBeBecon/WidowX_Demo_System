#!/usr/bin/env bash
# =====================================
# widowx_reaction.sh - 画像認識付きリアクション実行スクリプト
# スクリプト自身の場所を基準にパスを解決（ユーザー・配置場所非依存）
# =====================================
set -euo pipefail

# ----------------
# スクリプト位置とプロジェクトルートを解決
# tools/widowx_reaction_tool/ → ../../ がプロジェクトルート
# ----------------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJ_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ----------------
# .env から設定を読み込む（LEROBOT_PATH / UV_PATH / ROBOT_IP を取得）
# ----------------
ENV_FILE="$PROJ_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

# LEROBOT_PATH が未設定の場合はデフォルト値を使用
LEROBOT_PATH="${LEROBOT_PATH:-$HOME/lerobot_trossen}"
PYTHON="$LEROBOT_PATH/.venv/bin/python"

ACTION="${1:-}"

if [ -z "$ACTION" ]; then
  echo '{"ok":false,"status":"invalid_usage","reason":"action is required: wavehands|yes|no"}'
  exit 64
fi

cd "$SCRIPT_DIR"

exec "$PYTHON" "$SCRIPT_DIR/execute_reaction_tool.py" "$ACTION"
