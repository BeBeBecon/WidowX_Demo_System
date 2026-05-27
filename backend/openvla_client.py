"""
# =====================================
# OpenVLA クライアントモジュール
# VLA Server（別プロセスで起動済み）への HTTP通信を担当する
# ・死活確認: GET  /health
# ・タスク実行: POST /run  {"task": "<formatted instruction>"}
# =====================================
"""
import httpx

from config import CONFIG

# ----------------
# VLA Server の規定エンドポイント
# ----------------
_HEALTH_PATH = "/health"
_RUN_PATH    = "/run"


async def check_vla_status() -> dict:
    """
    VLA Server の死活確認。
    返り値: {"online": bool, "url": str}
    """
    url = CONFIG["openvla"]["server_url"] + _HEALTH_PATH
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url)
        return {"online": resp.status_code == 200, "url": CONFIG["openvla"]["server_url"]}
    except Exception:
        return {"online": False, "url": CONFIG["openvla"]["server_url"]}


async def run_vla_task(task: str):
    """
    VLA Server にフォーマット済みタスク文字列を送信し、
    実行ログを非同期ジェネレータとして返す。
    エラー時は RuntimeError を raise する。
    """
    url = CONFIG["openvla"]["server_url"] + _RUN_PATH
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json={"task": task})
            resp.raise_for_status()
            result = resp.json()
        # VLA Server のレスポンスに含まれるメッセージをログとして返す
        msg = result.get("message", "タスク完了")
        yield f"[VLA] {msg}"
    except httpx.HTTPStatusError as e:
        raise RuntimeError(f"VLA Server HTTP エラー: {e.response.status_code} {e.response.text}")
    except httpx.ConnectError:
        raise RuntimeError(f"VLA Server に接続できません: {url}")
    except Exception as e:
        raise RuntimeError(f"VLA Server エラー: {e}")
