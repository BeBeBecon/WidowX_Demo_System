from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

# ----------------
# スクリプト自身の場所からパスを解決（ユーザー・配置場所非依存）
# LEROBOT_PATH / UV_PATH / ROBOT_IP は .env から継承
# ----------------
PROJECT_DIR = Path(__file__).parent
_lerobot_default = str(Path.home() / "lerobot_trossen")
LEROBOT_DIR = Path(os.environ.get("LEROBOT_PATH", _lerobot_default))

ROBOT_IP = os.environ.get("ROBOT_IP", "192.168.1.4")
ROBOT_ID = "follower"

# ----------------
# アクション × 方向 → HF データセット repo_id のマッピング
# lerobot-replay はローカルキャッシュ（~/.cache/huggingface/lerobot/）を優先参照する
# ----------------
EPISODES = {
    "wave": {
        "left": "docomoshiken1/widowx_wave_left_20260528",
        "center": "docomoshiken1/widowx_wave_center_20260528",
        "right": "docomoshiken1/widowx_wave_right_20260528",
    },
    "yes": {
        "left": "docomoshiken1/widowx_reaction_left_yes_20260528",
        "center": "docomoshiken1/widowx_reaction_center_yes_20260528",
        "right": "docomoshiken1/widowx_reaction_right_yes_20260528",
    },
    "no": {
        "left": "docomoshiken1/widowx_reaction_left_no_20260528",
        "center": "docomoshiken1/widowx_reaction_center_no_20260528",
        "right": "docomoshiken1/widowx_reaction_right_no_20260528",
    },
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["wave", "yes", "no"])
    parser.add_argument("direction", choices=["left", "center", "right"])
    parser.add_argument("--flip-lr", action="store_true")
    args = parser.parse_args()

    direction = args.direction

    if args.flip_lr:
        if direction == "left":
            direction = "right"
        elif direction == "right":
            direction = "left"

    repo_id = EPISODES[args.action][direction]

    print(f"[EXECUTE] action={args.action}")
    print(f"[EXECUTE] direction={direction}")
    print(f"[EXECUTE] repo_id={repo_id}")

    # UV_PATH が設定されていればそれを使用、なければデフォルトパスを探す
    uv_path = os.environ.get("UV_PATH", str(Path.home() / ".local/bin/uv"))

    cmd = [
        uv_path,
        "run",
        "--no-sync",
        "lerobot-replay",
        "--robot.type=widowxai_follower_robot",
        f"--robot.ip_address={ROBOT_IP}",
        f"--robot.id={ROBOT_ID}",
        "--robot.min_time_to_move_multiplier=1.0",
        "--play_sounds=false",
        f"--dataset.repo_id={repo_id}",
        "--dataset.episode=0",
    ]

    print("[COMMAND]", " ".join(cmd))
    completed = subprocess.run(cmd, cwd=str(LEROBOT_DIR))
    return completed.returncode


if __name__ == "__main__":
    sys.exit(main())
