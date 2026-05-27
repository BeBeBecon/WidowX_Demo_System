"""
# =====================================
# WidowX Sub Agent - FastAPIバックエンド
# WebSocket で UI とリアルタイム通信し、
# config.json の model_mode に応じて
#   ACT     : Ollama推論 → スキル選択 → ACT実行
#   OpenVLA : Ollama推論 → タスク整形 → VLA Server へ送信
# の実行ルートを切り替える。
# 緊急停止メッセージ（action: "stop"）は全フェーズで並行監視する。
# =====================================
"""
import asyncio
import json

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from a2a_router import router as a2a_router
from config import CONFIG
from executor import run_skill
from llm import format_for_openvla, select_skill
from openvla_client import check_vla_status, run_vla_task

# ----------------
# 起動時にモード確定（大文字で統一）
# ----------------
MODEL_MODE: str = CONFIG.get("model_mode", "ACT").upper()

# ----------------
# アプリ初期化・CORS設定
# ----------------
app = FastAPI(title="WidowX Sub Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # デモ環境のため全許可
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------
# A2A ルーター登録（既存 WebSocket フローとは独立）
# ----------------
app.include_router(a2a_router)


# ----------------
# ヘルスチェック（model_mode を含めて返す）
# ----------------
@app.get("/api/health")
async def health():
    return {
        "status":       "ok",
        "dry_run":      CONFIG["dry_run"],
        "episode_time_s": CONFIG["record"]["episode_time_s"],
        "model_mode":   MODEL_MODE,
    }


# ----------------
# スキル一覧エンドポイント
# ----------------
@app.get("/api/skills")
async def get_skills():
    return CONFIG["skills"]


# ----------------
# OpenVLA: VLA Server 死活確認エンドポイント
# ACT モードでもエラーにならず online: false を返すため安全
# ----------------
@app.get("/api/openvla/status")
async def openvla_status():
    return await check_vla_status()


# =====================================
# 共通ユーティリティ
# =====================================

async def _run_with_stop_monitor(task_coro, ws: WebSocket):
    """
    task_coro と WebSocket の停止信号を並行待機する共通ヘルパー。
    返り値: (stopped: bool, result_or_exception)
      - stopped=True  → 緊急停止が来た
      - stopped=False → タスク完了（例外も含む）
    """
    async def watch_stop():
        while True:
            raw = await ws.receive_text()
            if json.loads(raw).get("action") == "stop":
                return

    task      = asyncio.create_task(task_coro)
    stop_task = asyncio.create_task(watch_stop())

    done, pending = await asyncio.wait([task, stop_task], return_when=asyncio.FIRST_COMPLETED)
    for t in pending:
        t.cancel()
        try:
            await t
        except (asyncio.CancelledError, Exception):
            pass

    if stop_task in done:
        return True, None

    exc = task.exception() if not task.cancelled() else None
    return False, (exc or task.result())


# =====================================
# メイン WebSocket エンドポイント
# プロトコル:
#   受信（コマンド）: {"command": "ユーザー命令テキスト"}
#   受信（停止）:     {"action": "stop"}
#   送信: {"type": "status"|"llm_result"|"log"|"error", ...}
# =====================================
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()

    def send(data: dict):
        """WebSocket 送信ヘルパー（awaitable）"""
        return ws.send_text(json.dumps(data, ensure_ascii=False))

    try:
        while True:
            raw = await ws.receive_text()
            payload = json.loads(raw)

            # 待機中に受信した緊急停止は無視
            if payload.get("action") == "stop":
                continue

            command = payload.get("command", "").strip()
            if not command:
                await send({"type": "error", "message": "命令が空です"})
                continue

            # ----------------
            # モードに応じた実行ルートへ分岐
            # ----------------
            if MODEL_MODE == "OPENVLA":
                await _handle_openvla(ws, send, command)
            else:
                await _handle_act(ws, send, command)

    except WebSocketDisconnect:
        pass  # クライアント切断は正常終了


# =====================================
# ACT モード実行ハンドラ
# =====================================
async def _handle_act(ws: WebSocket, send, command: str):
    """ACT モード: LLM でスキル選択 → ACT 実行"""

    # Phase 1: LLM推論
    await send({"type": "status", "status": "thinking"})
    await send({"type": "log",    "line":   f"[LLM] 推論開始: '{command}'"})

    stopped, result = await _run_with_stop_monitor(select_skill(command), ws)
    if stopped:
        await send({"type": "log",    "line":   "[INFO] 緊急停止が実行されました（推論中）"})
        await send({"type": "status", "status": "idle"})
        return

    if isinstance(result, Exception):
        err = f"{type(result).__name__}: {result}" if str(result) else type(result).__name__
        await send({"type": "error",  "message": f"LLM推論エラー: {err}"})
        await send({"type": "status", "status": "error"})
        return

    skill_id = result
    if skill_id is None:
        await send({"type": "log",    "line":   "[INFO] 該当するスキルが見つかりませんでした。登録済みスキルの命令をお試しください。"})
        await send({"type": "status", "status": "idle"})
        return

    selected = {s["id"]: s for s in CONFIG["skills"]}[skill_id]
    await send({"type": "log",        "line":  f"[LLM] スキル選択: {selected['name']}"})
    await send({"type": "llm_result", "skill": selected})

    # Phase 2: ACT実行
    await send({"type": "status", "status": "executing"})

    async def execute():
        async for line in run_skill(selected):
            await send({"type": "log", "line": line})

    stopped, exc = await _run_with_stop_monitor(execute(), ws)

    if stopped:
        await send({"type": "log",    "line":   "[INFO] 緊急停止が実行されました"})
        await send({"type": "status", "status": "idle"})
    elif exc:
        err = f"{type(exc).__name__}: {exc}" if str(exc) else type(exc).__name__
        await send({"type": "error",  "message": f"実行エラー: {err}"})
        await send({"type": "status", "status": "error"})
    else:
        await send({"type": "status", "status": "done"})


# =====================================
# OpenVLA モード実行ハンドラ
# =====================================
async def _handle_openvla(ws: WebSocket, send, command: str):
    """
    OpenVLA モード:
      1. LLM でタスク文字列に整形（精度直結）
      2. VLA Server へ送信 → アーム動作
    """

    # Phase 1: LLM タスク整形
    await send({"type": "status", "status": "thinking"})
    await send({"type": "log",    "line":   f"[LLM] タスク整形開始: '{command}'"})

    stopped, result = await _run_with_stop_monitor(format_for_openvla(command), ws)
    if stopped:
        await send({"type": "log",    "line":   "[INFO] 緊急停止が実行されました（整形中）"})
        await send({"type": "status", "status": "idle"})
        return

    if isinstance(result, Exception):
        err = f"{type(result).__name__}: {result}" if str(result) else type(result).__name__
        await send({"type": "error",  "message": f"LLM整形エラー: {err}"})
        await send({"type": "status", "status": "error"})
        return

    vla_task_str = result
    await send({"type": "log",        "line":  f"[LLM] タスク文字列: '{vla_task_str}'"})
    await send({"type": "llm_result", "skill": {"id": "openvla_task", "name": vla_task_str, "icon": "🤖"}})

    # Phase 2: VLA Server 実行
    await send({"type": "status", "status": "executing"})

    async def execute_vla():
        async for line in run_vla_task(vla_task_str):
            await send({"type": "log", "line": line})

    stopped, exc = await _run_with_stop_monitor(execute_vla(), ws)

    if stopped:
        await send({"type": "log",    "line":   "[INFO] 緊急停止が実行されました"})
        await send({"type": "status", "status": "idle"})
    elif exc:
        err = f"{type(exc).__name__}: {exc}" if str(exc) else type(exc).__name__
        await send({"type": "error",  "message": f"VLA実行エラー: {err}"})
        await send({"type": "status", "status": "error"})
    else:
        await send({"type": "status", "status": "done"})
