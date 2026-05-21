"""
# =====================================
# ACT実行モジュール
# 選択されたスキルに対して以下の2ステップを実行する:
#   Step 1: eval キャッシュの削除（file exists エラー回避）
#   Step 2: uv run --no-sync lerobot-record でアームへ命令を送信
# stdout/stderr をリアルタイムで yield する非同期ジェネレーター。
# 緊急停止（タスクキャンセル）時は finally ブロックでサブプロセスを強制終了する。
# =====================================
"""
import asyncio
import glob
import json
import os
import shutil
from typing import AsyncGenerator

from config import CONFIG


# ----------------
# 実行環境の構築（IntelRealSense 用 CUDA ライブラリのパスを注入）
# ----------------
def _build_env() -> dict:
    """
    lerobot_trossen の .venv 内に含まれる NVIDIA NPP ライブラリを
    LD_LIBRARY_PATH に追加した環境変数辞書を返す。
    IntelRealSense + CUDA 環境では libnppicc.so.12 が必要。
    ファイルが見つからない場合は現在の環境をそのまま返す。
    """
    lerobot_path = CONFIG["lerobot_path"]
    pattern = f"{lerobot_path}/.venv/lib/python3.*/site-packages/libnppicc.so.12"
    matches = glob.glob(pattern)
    env = dict(os.environ)
    if matches:
        npp_dir = os.path.dirname(matches[0])
        existing = env.get("LD_LIBRARY_PATH", "")
        env["LD_LIBRARY_PATH"] = f"{npp_dir}:{existing}" if existing else npp_dir
    return env


# ----------------
# ポリシー config.json の互換クリーニング
# ----------------
def clean_policy_config(skill: dict) -> str | None:
    """
    モデルの config.json に推論環境（現バージョンの ACTConfig）で無効なフィールドが
    含まれていれば自動削除する。学習環境と推論環境のパッケージバージョン差異を吸収する。
    変更があった場合はログメッセージを返し、変更なしの場合は None を返す。
    """
    policy_path = skill["policy_path"]
    if not os.path.isabs(policy_path):
        policy_path = os.path.join(CONFIG["lerobot_path"], policy_path)

    config_path = os.path.join(policy_path, "config.json")
    if not os.path.exists(config_path):
        return None

    with open(config_path, "r", encoding="utf-8") as f:
        cfg = json.load(f)

    # 推論環境の ACTConfig に存在しない不要フィールド
    invalid_fields = {"use_peft"}
    removed = [k for k in invalid_fields if k in cfg]
    if not removed:
        return None

    for k in removed:
        cfg.pop(k)

    shutil.copy2(config_path, config_path + ".bak")

    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)

    return f"[INFO] config.json を自動修正しました (削除フィールド: {', '.join(removed)})"


# ----------------
# コマンド引数の組み立て
# ----------------
def build_lerobot_args(skill: dict) -> list[str]:
    """uv run --no-sync lerobot-record の引数リストを構築する"""
    robot  = CONFIG["robot"]
    record = CONFIG["record"]
    policy = CONFIG["policy"]
    hf_user = CONFIG["hf_user"]

    # カメラ設定を JSON 文字列に変換（改行なし圧縮）
    cameras_json = json.dumps(robot["cameras"], separators=(",", ":"))

    # eval データセットの HuggingFace リポジトリ ID
    repo_id = f"{hf_user}/{skill['eval_repo_suffix']}"

    return [
        CONFIG["uv_path"], "run", "--no-sync", "lerobot-record",
        f"--robot.type={robot['type']}",
        f"--robot.ip_address={robot['ip_address']}",
        f"--robot.id={robot['id']}",
        f"--robot.max_relative_target={robot['max_relative_target']}",
        f"--robot.min_time_to_move_multiplier={robot['min_time_to_move_multiplier']}",
        f"--robot.cameras={cameras_json}",
        f"--display_data={str(record['display_data']).lower()}",
        f"--dataset.push_to_hub={str(record['push_to_hub']).lower()}",
        f"--dataset.repo_id={repo_id}",
        f"--dataset.num_episodes={record['num_episodes']}",
        f"--dataset.episode_time_s={record['episode_time_s']}",
        f"--dataset.reset_time_s={record['reset_time_s']}",
        f"--dataset.single_task={skill['task_name']}",
        f"--policy.path={skill['policy_path']}",
        f"--policy.device={policy['device']}",
    ]


# ----------------
# キャッシュ削除ヘルパー
# ----------------
async def clear_eval_cache(skill: dict) -> str:
    """
    HuggingFace の eval キャッシュを削除する。
    同一 repo_id で再実行する際の 'file exists' エラーを防ぐ。
    """
    hf_user = CONFIG["hf_user"]
    cache_path = os.path.expanduser(
        f"~/.cache/huggingface/lerobot/{hf_user}/{skill['eval_repo_suffix']}"
    )
    proc = await asyncio.create_subprocess_exec(
        "rm", "-rf", cache_path,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL,
    )
    await proc.wait()
    return cache_path


# ----------------
# メイン実行ジェネレーター
# ----------------
async def run_skill(skill: dict) -> AsyncGenerator[str, None]:
    """
    スキルを実行し、出力行を非同期に yield するジェネレーター。
    DRY_RUN=true の場合はコマンドをシミュレートする（Mac/開発環境用）。
    緊急停止（タスクキャンセル）時はサブプロセスを kill して終了する。
    """

    # ----------------
    # ドライランモード（開発環境向け）
    # ----------------
    if CONFIG["dry_run"]:
        args = build_lerobot_args(skill)
        yield "[DRY RUN] 実際のコマンドは実行されません"
        yield f"[DRY RUN] コマンド: {' '.join(args)}"
        await asyncio.sleep(1)
        yield f"[DRY RUN] スキル '{skill['name']}' の実行をシミュレート中..."
        for i in range(1, 4):
            await asyncio.sleep(0.8)
            yield f"[DRY RUN] Step {i}/3 完了"
        yield "[DRY RUN] 実行完了 (return code: 0)"
        return

    # ----------------
    # Step 0: policy_path の存在確認（早期エラー）
    # ----------------
    resolved_policy = skill["policy_path"] if os.path.isabs(skill["policy_path"]) \
        else os.path.join(CONFIG["lerobot_path"], skill["policy_path"])
    if not os.path.exists(resolved_policy):
        yield f"[ERROR] ポリシーが見つかりません: {resolved_policy}"
        return

    # ----------------
    # Step 1: eval キャッシュ削除
    # ----------------
    cache_path = await clear_eval_cache(skill)
    yield f"[INFO] キャッシュ削除: {cache_path}"

    # ----------------
    # Step 1.5: ポリシー config.json クリーニング（バージョン差異の自動吸収）
    # ----------------
    clean_msg = clean_policy_config(skill)
    if clean_msg:
        yield clean_msg

    # ----------------
    # Step 2: lerobot-record 実行
    # ----------------
    args = build_lerobot_args(skill)
    yield f"[INFO] コマンド: {' '.join(args)}"

    proc = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,  # stderr を stdout に合流
        cwd=CONFIG["lerobot_path"],        # uv のプロジェクトルートとして指定
        env=_build_env(),                  # LD_LIBRARY_PATH を含む環境変数を注入
    )

    try:
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
