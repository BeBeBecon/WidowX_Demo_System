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
    cfg["ollama"]["host"]          = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    cfg["robot"]["ip_address"]     = os.getenv("ROBOT_IP",    "192.168.1.4")
    cfg["lerobot_path"]            = os.getenv("LEROBOT_PATH", "/home/ubuntu/lerobot_trossen")
    cfg["uv_path"]                 = os.getenv("UV_PATH",      "uv")
    cfg["hf_user"]                 = os.getenv("HF_USER",      "")
    cfg["dry_run"]                 = os.getenv("DRY_RUN",      "false").lower() == "true"

    return cfg


# モジュールロード時に一度だけ読み込む
CONFIG = load_config()
