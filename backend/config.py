"""
# ----------------
# 設定ローダー
# config.json と .env を統合して設定オブジェクトを提供する
# ----------------
"""
import json
import os
from pathlib import Path

from dotenv import load_dotenv

# プロジェクトルートの .env を読み込む
load_dotenv(Path(__file__).parent.parent / ".env")


def load_config() -> dict:
    """config.json を読み込み、.env の値でオーバーライドして返す"""
    config_path = Path(__file__).parent.parent / "config.json"
    with open(config_path, encoding="utf-8") as f:
        cfg = json.load(f)

    # ----------------
    # .env の値を注入（秘匿・環境固有の設定）
    # ----------------
    cfg["ollama"]["host"]          = os.getenv("OLLAMA_HOST",    "http://localhost:11434")
    cfg["robot"]["ip_address"]     = os.getenv("ROBOT_IP",       "192.168.1.4")
    cfg["lerobot_path"]            = os.getenv("LEROBOT_PATH",   str(Path.home() / "lerobot_trossen"))
    cfg["uv_path"]                 = os.getenv("UV_PATH",         "uv")
    cfg["hf_user"]                 = os.getenv("HF_USER",         "")
    cfg["dry_run"]                 = os.getenv("DRY_RUN",         "false").lower() == "true"

    # ----------------
    # OpenVLA 設定（.env の VLA_SERVER_URL で上書き可）
    # ----------------
    if "openvla" not in cfg:
        cfg["openvla"] = {}
    cfg["openvla"]["server_url"]   = os.getenv("VLA_SERVER_URL", cfg["openvla"].get("server_url", "http://localhost:8080"))

    # ----------------
    # dataset.cache_root: $HOME 等の環境変数を展開して絶対パスに解決
    # ----------------
    if "dataset" not in cfg:
        cfg["dataset"] = {}
    cfg["dataset"]["cache_root"] = os.path.expandvars(
        cfg["dataset"].get("cache_root", "$HOME/.cache/huggingface/lerobot")
    )

    # ----------------
    # external_script: script_path を絶対パスに解決、run_as_user を .env で上書き可
    # run_as_user が空の場合は sudo を使わない（tools/ 統合後はデフォルト空）
    # ----------------
    proj_dir = str(Path(__file__).parent.parent)
    if "external_script" not in cfg:
        cfg["external_script"] = {}
    raw_path = cfg["external_script"].get("script_path", "./tools/widowx_reaction_tool/widowx_reaction.sh")
    # 相対パスはプロジェクトルートからの絶対パスに展開
    if not os.path.isabs(raw_path):
        raw_path = os.path.join(proj_dir, raw_path)
    cfg["external_script"]["script_path"]  = os.getenv("REACTION_SCRIPT_PATH", raw_path)
    cfg["external_script"]["run_as_user"]  = os.getenv("REACTION_RUN_AS_USER",
                                                        cfg["external_script"].get("run_as_user", ""))

    return cfg


# モジュールロード時に一度だけ読み込む
CONFIG = load_config()
