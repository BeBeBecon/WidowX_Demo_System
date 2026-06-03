#!/usr/bin/env bash
# =====================================
# run_yes.sh - うなずき動作の手動テスト用スクリプト
# =====================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJ_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [ -f "$PROJ_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$PROJ_ROOT/.env"
  set +a
fi

LEROBOT_PATH="${LEROBOT_PATH:-$HOME/lerobot_trossen}"
PYTHON="$LEROBOT_PATH/.venv/bin/python"

cd "$SCRIPT_DIR"
exec "$PYTHON" "$SCRIPT_DIR/execute_reaction_tool.py" yes
