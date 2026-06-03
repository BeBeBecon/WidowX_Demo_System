from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

# ----------------
# スクリプト自身の場所からパスを解決（ユーザー・配置場所非依存）
# LEROBOT_PATH は .env から継承（widowx_reaction.sh が source 済み）
# ----------------
PROJECT_DIR = Path(__file__).parent
_lerobot_default = str(Path.home() / "lerobot_trossen")
PYTHON = Path(os.environ.get("LEROBOT_PATH", _lerobot_default)) / ".venv" / "bin" / "python"

DETECT_SCRIPT = PROJECT_DIR / "detect_person_direction.py"
RUN_SCRIPT = PROJECT_DIR / "run_reaction_by_direction.py"


ACTION_ALIASES = {
    "wave": "wave",
    "wavehands": "wave",
    "wave_hands": "wave",
    "bye": "wave",
    "goodbye": "wave",
    "yes": "yes",
    "nod": "yes",
    "no": "no",
    "shake": "no",
}


def emit(payload: dict) -> None:
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def normalize_action(action: str) -> str:
    key = action.strip().lower()
    if key not in ACTION_ALIASES:
        raise ValueError(f"unknown action: {action}")
    return ACTION_ALIASES[key]


def read_last_json_line(text: str) -> dict | None:
    for line in reversed(text.splitlines()):
        line = line.strip()
        if line.startswith("{") and line.endswith("}"):
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue
    return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", help="wavehands / yes / no")
    parser.add_argument("--flip-lr", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    try:
        action = normalize_action(args.action)
    except ValueError as e:
        emit({
            "ok": False,
            "status": "invalid_action",
            "executed": False,
            "reason": str(e),
        })
        return 64

    # 1. 人物方向を検出
    detect_cmd = [
        str(PYTHON),
        str(DETECT_SCRIPT),
    ]

    detect = subprocess.run(
        detect_cmd,
        cwd=str(PROJECT_DIR),
        text=True,
        capture_output=True,
    )

    direction_result = read_last_json_line(detect.stdout)

    if direction_result is None:
        emit({
            "ok": False,
            "status": "direction_detector_error",
            "executed": False,
            "action": action,
            "reason": "direction detector did not return JSON",
            "detect_returncode": detect.returncode,
            "detect_stdout_tail": detect.stdout[-1000:],
            "detect_stderr_tail": detect.stderr[-1000:],
        })
        return 20

    if not direction_result.get("ok"):
        emit({
            "ok": False,
            "status": "skipped_no_target",
            "executed": False,
            "action": action,
            "reason": direction_result.get("reason"),
            "direction": direction_result.get("direction"),
            "direction_result": direction_result,
        })
        return 10

    direction = direction_result["direction"]

    if args.flip_lr:
        if direction == "left":
            motion_direction = "right"
        elif direction == "right":
            motion_direction = "left"
        else:
            motion_direction = "center"
    else:
        motion_direction = direction

    if args.dry_run:
        emit({
            "ok": True,
            "status": "dry_run",
            "executed": False,
            "action": action,
            "detected_direction": direction,
            "motion_direction": motion_direction,
            "direction_result": direction_result,
        })
        return 0

    # 2. 方向に応じて WidowX replay を実行
    run_cmd = [
        str(PYTHON),
        str(RUN_SCRIPT),
        action,
        motion_direction,
    ]

    run = subprocess.run(
        run_cmd,
        cwd=str(PROJECT_DIR),
        text=True,
        capture_output=True,
    )

    if run.returncode != 0:
        emit({
            "ok": False,
            "status": "replay_failed",
            "executed": False,
            "action": action,
            "detected_direction": direction,
            "motion_direction": motion_direction,
            "direction_result": direction_result,
            "replay_returncode": run.returncode,
            "replay_stdout_tail": run.stdout[-2000:],
            "replay_stderr_tail": run.stderr[-2000:],
        })
        return 30

    emit({
        "ok": True,
        "status": "executed",
        "executed": True,
        "action": action,
        "detected_direction": direction,
        "motion_direction": motion_direction,
        "direction_result": direction_result,
        "replay_returncode": run.returncode,
        "replay_stdout_tail": run.stdout[-2000:],
    })
    return 0


if __name__ == "__main__":
    sys.exit(main())
