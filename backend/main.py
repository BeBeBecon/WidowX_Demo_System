"""
# =====================================
# WidowX Sub Agent - FastAPIバックエンド
# WebSocket で UI とリアルタイム通信し、
# Ollama推論 → ACT実行 → ログ配信 を行う
# 実行フェーズは asyncio タスクで並行処理し、
# 緊急停止メッセージ（action: "stop"）を随時受け付ける
# =====================================
"""
import asyncio
import json

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from config import CONFIG
from executor import run_skill
from llm import select_skill

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
# ヘルスチェック
# ----------------
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "dry_run": CONFIG["dry_run"],
        "episode_time_s": CONFIG["record"]["episode_time_s"],
    }


# ----------------
# スキル一覧エンドポイント
# ----------------
@app.get("/api/skills")
async def get_skills():
    return CONFIG["skills"]


# ----------------
# メインWebSocketエンドポイント
# プロトコル:
#   受信（コマンド）: {"command": "ユーザー命令テキスト"}
#   受信（停止）:     {"action": "stop"}
#   送信: {"type": "status"|"llm_result"|"log"|"error", ...}
# ----------------
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
            # Phase 1: LLM推論（緊急停止も並行監視）
            # ----------------
            await send({"type": "status", "status": "thinking"})
            await send({"type": "log", "line": f"[LLM] 推論開始: '{command}'"})

            async def llm_infer():
                return await select_skill(command)

            async def watch_stop_p1():
                """LLM推論中の緊急停止を待機する"""
                while True:
                    raw2 = await ws.receive_text()
                    msg2 = json.loads(raw2)
                    if msg2.get("action") == "stop":
                        return

            llm_task  = asyncio.create_task(llm_infer())
            stop_task1 = asyncio.create_task(watch_stop_p1())

            done1, pending1 = await asyncio.wait(
                [llm_task, stop_task1],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for t in pending1:
                t.cancel()
                try:
                    await t
                except (asyncio.CancelledError, Exception):
                    pass

            if stop_task1 in done1:
                await send({"type": "log", "line": "[INFO] 緊急停止が実行されました（推論中）"})
                await send({"type": "status", "status": "idle"})
                continue

            try:
                skill_id = llm_task.result()
            except Exception as e:
                err_detail = f"{type(e).__name__}: {e}" if str(e) else type(e).__name__
                await send({"type": "error", "message": f"LLM推論エラー: {err_detail}"})
                await send({"type": "status", "status": "error"})
                continue

            # スキル未マッチ: 対応するスキルがない旨を通知して待機状態へ
            if skill_id is None:
                await send({"type": "log", "line": "[INFO] 該当するスキルが見つかりませんでした。登録済みスキルの命令をお試しください。"})
                await send({"type": "status", "status": "idle"})
                continue

            # 選択されたスキルオブジェクトを取得
            skills_map = {s["id"]: s for s in CONFIG["skills"]}
            selected = skills_map[skill_id]

            await send({"type": "log", "line": f"[LLM] スキル選択: {selected['name']}"})
            await send({"type": "llm_result", "skill": selected})

            # ----------------
            # Phase 2: ACT実行（緊急停止メッセージを並行監視）
            # ----------------
            await send({"type": "status", "status": "executing"})

            async def execute():
                """スキルを実行しログをストリーミングする"""
                async for line in run_skill(selected):
                    await send({"type": "log", "line": line})

            async def watch_stop():
                """実行中の緊急停止メッセージを待機する"""
                while True:
                    raw2 = await ws.receive_text()
                    msg2 = json.loads(raw2)
                    if msg2.get("action") == "stop":
                        return

            exec_task = asyncio.create_task(execute())
            stop_task = asyncio.create_task(watch_stop())

            # どちらか先に完了したタイミングで処理を分岐
            done, pending = await asyncio.wait(
                [exec_task, stop_task],
                return_when=asyncio.FIRST_COMPLETED,
            )

            # 未完了タスクをキャンセル（executor 側でサブプロセスを kill する）
            for t in pending:
                t.cancel()
                try:
                    await t
                except (asyncio.CancelledError, Exception):
                    pass

            if stop_task in done:
                # 緊急停止が要求された場合
                await send({"type": "log", "line": "[INFO] 緊急停止が実行されました"})
                await send({"type": "status", "status": "idle"})
            else:
                # 通常完了またはエラー
                exc = exec_task.exception() if not exec_task.cancelled() else None
                if exc:
                    err_detail = f"{type(exc).__name__}: {exc}" if str(exc) else type(exc).__name__
                    await send({"type": "error", "message": f"実行エラー: {err_detail}"})
                    await send({"type": "status", "status": "error"})
                else:
                    await send({"type": "status", "status": "done"})

    except WebSocketDisconnect:
        pass  # クライアント切断は正常終了
