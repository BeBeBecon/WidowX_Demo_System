"""
# ----------------
# ACT実行モジュール
# 選択されたスキルIDに対応するLeRobotコマンドを構築・実行する
# subprocess の stdout/stderr をリアルタイムで yield する非同期ジェネレーター
# 緊急停止（タスクキャンセル）時は finally ブロックでサブプロセスを強制終了する
# ----------------
"""
import asyncio
import shlex
from typing import AsyncGenerator

from config import CONFIG


def build_command(skill: dict) -> str:
    """スキル定義とACTテンプレートからコマンド文字列を生成する"""
    tpl = CONFIG["act"]["command_template"]
    return tpl.format(
        lerobot_path=CONFIG["act"]["lerobot_path"],
        robot_type=CONFIG["act"]["robot_type"],
        policy_path=skill["policy_path"],
    )


async def run_skill(skill: dict) -> AsyncGenerator[str, None]:
    """
    スキルを実行し、出力行を非同期にyieldするジェネレーター。
    DRY_RUN=true の場合はコマンドをシミュレートする（Mac開発用）。
    緊急停止（タスクキャンセル）時はサブプロセスを kill して終了する。
    """
    cmd = build_command(skill)

    yield f"[INFO] コマンド: {cmd}"

    # ----------------
    # ドライランモード（Mac開発環境向け）
    # ----------------
    if CONFIG["dry_run"]:
        yield "[DRY RUN] 実際のコマンドは実行されません"
        await asyncio.sleep(1)
        yield f"[DRY RUN] スキル '{skill['name']}' の実行をシミュレート中..."
        for i in range(1, 4):
            await asyncio.sleep(0.8)
            yield f"[DRY RUN] Step {i}/3 完了"
        yield "[DRY RUN] 実行完了 (return code: 0)"
        return

    # ----------------
    # 実コマンド実行（Linux本番環境）
    # ----------------
    args = shlex.split(cmd)
    proc = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,  # stderr を stdout に合流
    )

    try:
        # stdout をリアルタイムでストリーミング
        assert proc.stdout is not None
        async for line in proc.stdout:
            yield line.decode("utf-8", errors="replace").rstrip()

        await proc.wait()
        rc = proc.returncode
        if rc == 0:
            yield f"[INFO] 実行完了 (return code: {rc})"
        else:
            yield f"[ERROR] 実行失敗 (return code: {rc})"

    finally:
        # 緊急停止や例外発生時にプロセスが残存していれば強制終了
        if proc.returncode is None:
            proc.kill()
            await proc.wait()
