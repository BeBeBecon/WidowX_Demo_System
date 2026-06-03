#!/usr/bin/env bash
# =====================================
# download_datasets.sh - HuggingFace からデータセットを一括ダウンロード
# setup.sh 実行後に一度だけ実行する
# ダウンロード先: $HOME/.cache/huggingface/lerobot/docomoshiken1/<dataset>
# =====================================
set -e

PROJ_DIR="$(cd "$(dirname "$0")" && pwd)"
PYTHON="$PROJ_DIR/backend/venv/bin/python"

# ----------------
# Python 仮想環境の確認
# ----------------
if [ ! -f "$PYTHON" ]; then
  echo "[ERROR] backend/venv が見つかりません。先に setup.sh を実行してください"
  exit 1
fi

echo ""
echo "======================================"
echo "  データセット ダウンロード開始"
echo "  保存先: \$HOME/.cache/huggingface/lerobot/docomoshiken1/"
echo "======================================"
echo ""

# ----------------
# Python スクリプトでダウンロード実行
# ----------------
"$PYTHON" - <<'PYEOF'
import os
from pathlib import Path
from huggingface_hub import snapshot_download

# ----------------
# ダウンロードするデータセット一覧
# replay スキル用 + 外部スクリプト(widowx_reaction)用を含む
# ----------------
ORG = "docomoshiken1"
CACHE_ROOT = Path.home() / ".cache" / "huggingface" / "lerobot" / ORG

DATASETS = [
    # --- replay スキル用（config.json の dataset.repo_id に対応）---
    "widowx_contactless_payment_20260602",
    "widowx_grab_bottle_20260528",
    "widowx_pour_bottle_20260528",
    "grab_cube",

    # --- widowx_reaction_tool 用（外部スクリプトが参照）---
    "widowx_reaction_right_yes_20260528",
    "widowx_reaction_center_yes_20260528",
    "widowx_reaction_left_yes_20260528",
    "widowx_reaction_right_no_20260528",
    "widowx_reaction_center_no_20260528",
    "widowx_reaction_left_no_20260528",
    "widowx_wave_right_20260528",
    "widowx_wave_center_20260528",
    "widowx_wave_left_20260528",
]

failed = []
for ds in DATASETS:
    repo_id   = f"{ORG}/{ds}"
    local_dir = CACHE_ROOT / ds
    print(f"[Download] {repo_id} → {local_dir}")
    try:
        snapshot_download(
            repo_id=repo_id,
            repo_type="dataset",
            local_dir=str(local_dir),
        )
        print(f"[OK] {ds}")
    except Exception as e:
        print(f"[ERROR] {ds}: {e}")
        failed.append(ds)
    print()

# ----------------
# 結果サマリー
# ----------------
print("=" * 50)
total = len(DATASETS)
success = total - len(failed)
print(f"完了: {success}/{total} 件")
if failed:
    print("失敗したデータセット:")
    for f in failed:
        print(f"  - {f}")
    print("huggingface_hub でログインしているか確認してください（セクション5参照）")
else:
    print("全データセットのダウンロードが完了しました")
print("=" * 50)
PYEOF
