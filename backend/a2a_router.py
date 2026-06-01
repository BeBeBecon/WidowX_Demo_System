"""
# =====================================
# A2A（Agent to Agent）通信ルーター
# Main Agent との接続に備えた A2A プロトコル対応レイヤー。
# 既存の WebSocket フローには一切手を加えない。
#
# エンドポイント一覧:
#   GET  /.well-known/agent.json    — Agent Card 配信
#   POST /tasks/send                — タスク受付（Main Agent → Sub Agent）
#   GET  /tasks/{task_id}           — タスクステータス取得
#   GET  /tasks/{task_id}/events    — 実行ログの SSE ストリーミング
# =====================================
"""
import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import CONFIG
from executor import run_skill
from llm import select_skill

router = APIRouter()


# ----------------
# タスク状態定数
# ----------------
SUBMITTED = "submitted"
WORKING   = "working"
COMPLETED = "completed"
FAILED    = "failed"


# ----------------
# インメモリ タスクストア
#   _tasks       : task_id → タスク辞書
#   _task_queues : task_id → SSE 配信用 asyncio.Queue
# ----------------
_tasks: dict[str, dict] = {}
_task_queues: dict[str, asyncio.Queue] = {}


# ----------------
# リクエストスキーマ（A2A プロトコル準拠）
# ----------------
class MessagePart(BaseModel):
    text: str

class Message(BaseModel):
    role: str = "user"
    parts: list[MessagePart]

class TaskSendRequest(BaseModel):
    id: str | None = None   # 指定なし時は自動採番
    message: Message


# =====================================
# Agent Card 配信
# =====================================
@router.get("/.well-known/agent.json")
async def agent_card():
    """
    A2A プロトコル標準の Agent Card を返す。
    スキル定義は config.json から動的生成する。
    """
    a2a = CONFIG.get("a2a", {})
    skills = [
        {
            "id": s["id"],
            "name": s["name"],
            "description": s["description"],
        }
        for s in CONFIG["skills"]
    ]
    return {
        "name":        a2a.get("agent_name",        "WidowX Sub Agent"),
        "description": a2a.get("agent_description", "WidowX ロボットアームを操作するサブエージェント"),
        "url":         a2a.get("agent_url",         "http://localhost:8000"),
        "version":     a2a.get("agent_version",     "1.0.0"),
        "capabilities": {"streaming": True},
        "skills": skills,
    }


# =====================================
# POST /tasks/send — タスク受付
# =====================================
@router.post("/tasks/send")
async def tasks_send(req: TaskSendRequest):
    """
    Main Agent からのタスクを受け付け、バックグラウンド実行を開始する。
    レスポンスはタスク ID と submitted 状態を即時返却する（非同期）。
    """
    task_id = req.id or str(uuid.uuid4())
    command = " ".join(p.text for p in req.message.parts).strip()

    if not command:
        raise HTTPException(status_code=400, detail="command が空です")

    task: dict = {
        "id":         task_id,
        "status":     SUBMITTED,
        "command":    command,
        "skill":      None,
        "logs":       [],
        "error":      None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _tasks[task_id]       = task
    _task_queues[task_id] = asyncio.Queue()

    # バックグラウンドでスキル実行
    asyncio.create_task(_execute_task(task_id, command))

    return _task_to_response(task)


# =====================================
# GET /tasks/{task_id} — ステータス取得
# =====================================
@router.get("/tasks/{task_id}")
async def get_task(task_id: str):
    """タスクの現在ステータスと蓄積ログを返す"""
    task = _tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"タスク '{task_id}' が見つかりません")
    return _task_to_response(task)


# =====================================
# GET /tasks/{task_id}/events — SSE ストリーミング
# =====================================
@router.get("/tasks/{task_id}/events")
async def task_events(task_id: str):
    """
    タスクの実行ログを Server-Sent Events でリアルタイム配信する。
    タスク完了後は event: done を送信してストリームを終了する。
    """
    if task_id not in _tasks:
        raise HTTPException(status_code=404, detail=f"タスク '{task_id}' が見つかりません")
    queue = _task_queues.get(task_id)
    if queue is None:
        raise HTTPException(status_code=410, detail="イベントストリームは既に終了しています")

    return StreamingResponse(
        _sse_generator(queue),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ----------------
# SSE ジェネレーター
# ----------------
async def _sse_generator(queue: asyncio.Queue) -> AsyncGenerator[str, None]:
    """キューのイベントを SSE 形式に変換して yield する。None を受け取ったら終了。"""
    while True:
        item = await queue.get()
        if item is None:
            yield "event: done\ndata: {}\n\n"
            break
        yield f"event: {item['type']}\ndata: {json.dumps(item, ensure_ascii=False)}\n\n"


# =====================================
# タスク実行バックグラウンド処理
# =====================================
async def _execute_task(task_id: str, command: str) -> None:
    """
    LLM 推論 → スキル選択 → ACT 実行 を順に処理する。
    例外発生時はタスクを failed に遷移させ、システムはクラッシュしない。
    """
    task  = _tasks[task_id]
    queue = _task_queues[task_id]

    async def log(msg: str) -> None:
        """ログを task.logs と SSE キューに同時記録する"""
        task["logs"].append(msg)
        await queue.put({"type": "log", "task_id": task_id, "data": msg})

    async def set_status(state: str) -> None:
        task["status"] = state
        await queue.put({"type": "status", "task_id": task_id, "data": state})

    try:
        # ----------------
        # Phase 1: LLM 推論
        # ----------------
        await set_status(WORKING)
        await log(f"[LLM] 推論開始: '{command}'")

        skill_id = await select_skill(command)

        if skill_id is None:
            await log("[INFO] 該当するスキルが見つかりませんでした")
            task["error"] = "スキル未マッチ"
            await set_status(FAILED)
            return

        skills_map = {s["id"]: s for s in CONFIG["skills"]}
        selected   = skills_map[skill_id]
        task["skill"] = selected
        await log(f"[LLM] スキル選択: {selected['name']}")

        # ----------------
        # Phase 2: ACT 実行
        # ----------------
        async for line in run_skill(selected):
            await log(line)

        await set_status(COMPLETED)

    except asyncio.CancelledError:
        task["error"] = "タスクがキャンセルされました"
        await set_status(FAILED)
        raise

    except Exception as e:
        err = f"{type(e).__name__}: {e}" if str(e) else type(e).__name__
        task["error"] = err
        await log(f"[ERROR] {err}")
        await set_status(FAILED)

    finally:
        # SSE クライアントへ終了シグナルを送信
        await queue.put(None)


# ----------------
# レスポンス整形ヘルパー
# ----------------
def _task_to_response(task: dict) -> dict:
    """A2A プロトコル準拠のタスクレスポンス辞書を生成する"""
    return {
        "id": task["id"],
        "status": {
            "state": task["status"],
            "error": task.get("error"),
        },
        "skill": task.get("skill"),
        "artifacts": [
            {"type": "log", "parts": [{"text": line}]}
            for line in task.get("logs", [])
        ],
        "metadata": {
            "command":    task.get("command"),
            "created_at": task.get("created_at"),
        },
    }
