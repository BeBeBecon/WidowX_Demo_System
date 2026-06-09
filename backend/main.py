"""
# =====================================
# WidowX Sub Agent - FastAPIバックエンド
# WebSocket で UI とリアルタイム通信し、
# config.json の model_mode に応じて
#   ACT     : ask_agent推論 → スキル選択 → ACT実行
#   OpenVLA : ask_agent推論 → タスク整形 → VLA Server へ送信
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
from direction_receiver import router as direction_router
from executor import run_skill
from llm import ask_agent, format_for_openvla
from openvla_client import check_vla_status, run_vla_task

# ----------------
# 起動時にモード確定（大文字で統一）
# ----------------
MODEL_MODE: str = CONFIG.get("model_mode", "ACT").upper()

# ----------------
# スキルIDマッピング: LLMが返す task_skill / reaction_skill を config の skill_id に変換
# ----------------
_LLM_CFG      = CONFIG.get("llm", {})
TASK_SKILL_MAP     = _LLM_CFG.get("task_skill_map",     {})
REACTION_SKILL_MAP = _LLM_CFG.get("reaction_skill_map", {})
SKILL_BY_ID        = {s["id"]: s for s in CONFIG.get("skills", [])}

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
# 向き指定受信ルーター登録（OpenCV チームからの内部 REST）
# ----------------
app.include_router(direction_router)


# ----------------
# ヘルスチェック（model_mode を含めて返す）
# ----------------
@app.get("/api/health")
async def health():
    return {
        "status":         "ok",
        "dry_run":        CONFIG["dry_run"],
        "episode_time_s": CONFIG["record"]["episode_time_s"],
        "model_mode":     MODEL_MODE,
    }


# ----------------
# スキル一覧エンドポイント
# ----------------
@app.get("/api/skills")
async def get_skills():
    return CONFIG["skills"]


# ----------------
# 公開設定取得エンドポイント（フロントエンド向け）
# 秘匿情報を除いた設定値（LLM設定・コマンドテンプレート等）を返す
# ----------------
@app.get("/api/config")
async def get_config():
    return {
        "llm":            CONFIG.get("llm", {}),
        "demo_examples":  CONFIG.get("demo_examples", {}),
    }


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


def _resolve_skill(task_skill: str, reaction_skill: str) -> dict | None:
    """
    ask_agent の返却値からスキルオブジェクトを解決する共通ヘルパー。
    task_skill 優先、次に reaction_skill。
    task_skill_map に未登録の場合は skill_id として直接 SKILL_BY_ID を参照する
    （config.jsonに skill_id がそのままLLMに渡る新設計に対応）。
    対応するスキルが見つからない場合は None を返す。
    """
    skill_id = None
    if task_skill != "none":
        # マップ経由 → マップ未登録なら skill_id として直接検索
        skill_id = TASK_SKILL_MAP.get(task_skill, task_skill)
    elif reaction_skill != "none":
        skill_id = REACTION_SKILL_MAP.get(reaction_skill)

    return SKILL_BY_ID.get(skill_id) if skill_id else None


# =====================================
# メイン WebSocket エンドポイント
# プロトコル:
#   受信（コマンド）: {"command": "ユーザー命令テキスト"}
#   受信（停止）:     {"action": "stop"}
#   送信: {"type": "status"|"llm_reply"|"llm_result"|"log"|"error", ...}
# =====================================
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()

    def send(data: dict):
        """WebSocket 送信ヘルパー（awaitable）"""
        return ws.send_text(json.dumps(data, ensure_ascii=False))

    try:
        while True:
            raw     = await ws.receive_text()
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
# ask_agent で返答+スキル選択 → スキルがあれば ACT 実行
# =====================================
async def _handle_act(ws: WebSocket, send, command: str):

    # Phase 1: LLM推論（返答+スキル選択を同時実行）
    await send({"type": "status", "status": "thinking"})
    await send({"type": "log",    "line":   f"[LLM] 推論開始: '{command}'"})

    stopped, result = await _run_with_stop_monitor(ask_agent(command), ws)
    if stopped:
        await send({"type": "log",    "line":   "[INFO] 緊急停止が実行されました（推論中）"})
        await send({"type": "status", "status": "idle"})
        return

    if isinstance(result, Exception):
        err = f"{type(result).__name__}: {result}" if str(result) else type(result).__name__
        await send({"type": "llm_reply", "text":    "LLMとの通信に失敗しました。もう一度お試しください。"})
        await send({"type": "error",     "message": f"LLM推論エラー: {err}"})
        await send({"type": "status",    "status":  "error"})
        return

    agent = result  # {reply, task_skill, reaction_skill}

    # LLM返答をフロントへ送信
    await send({"type": "llm_reply", "text": agent["reply"]})
    await send({"type": "log",       "line": f"[LLM] 返答: {agent['reply']}"})
    await send({"type": "log",       "line": f"[LLM] task_skill={agent['task_skill']} / reaction_skill={agent['reaction_skill']}"})

    # スキル解決
    selected = _resolve_skill(agent["task_skill"], agent["reaction_skill"])
    if selected is None:
        await send({"type": "log",    "line":   "[INFO] 実行スキルなし（会話のみ）"})
        await send({"type": "status", "status": "idle"})
        return

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
# ask_agent で返答+スキル選択 → external_script は直接実行、replay系は VLA Server へ
# =====================================
async def _handle_openvla(ws: WebSocket, send, command: str):
    """
    OpenVLA モード:
      Phase 1:  ask_agent()           → 返答 + スキル特定
      Phase 1b: format_for_openvla()  → replay系スキルのみ属性付加
      Phase 2:  run_vla_task()        → VLA Server へ送信 → アーム動作
                run_skill()           → external_script 系スキルは直接実行
    """
    await send({"type": "status", "status": "thinking"})
    await send({"type": "log",    "line":   f"[LLM] 推論開始: '{command}'"})

    stopped, result = await _run_with_stop_monitor(ask_agent(command), ws)
    if stopped:
        await send({"type": "log",    "line":   "[INFO] 緊急停止が実行されました（推論中）"})
        await send({"type": "status", "status": "idle"})
        return

    if isinstance(result, Exception):
        err = f"{type(result).__name__}: {result}" if str(result) else type(result).__name__
        await send({"type": "llm_reply", "text":    "LLMとの通信に失敗しました。もう一度お試しください。"})
        await send({"type": "error",     "message": f"LLM推論エラー: {err}"})
        await send({"type": "status",    "status":  "error"})
        return

    agent = result

    # LLM返答をフロントへ送信
    await send({"type": "llm_reply", "text": agent["reply"]})
    await send({"type": "log",       "line": f"[LLM] 返答: {agent['reply']}"})
    await send({"type": "log",       "line": f"[LLM] task_skill={agent['task_skill']} / reaction_skill={agent['reaction_skill']}"})

    # スキル解決
    selected = _resolve_skill(agent["task_skill"], agent["reaction_skill"])
    if selected is None:
        await send({"type": "log",    "line":   "[INFO] 実行スキルなし（会話のみ）"})
        await send({"type": "status", "status": "idle"})
        return

    await send({"type": "log",        "line":  f"[LLM] スキル選択: {selected['name']}"})
    await send({"type": "llm_result", "skill": selected})
    await send({"type": "status",     "status": "executing"})

    # ----------------
    # external_script 系（wave_hand / reaction_yes / reaction_no）は VLA を介さず直接実行
    # ----------------
    if selected.get("execution_type") == "external_script":
        async def execute_direct():
            async for line in run_skill(selected):
                await send({"type": "log", "line": line})

        stopped, exc = await _run_with_stop_monitor(execute_direct(), ws)
        if stopped:
            await send({"type": "log",    "line":   "[INFO] 緊急停止が実行されました"})
            await send({"type": "status", "status": "idle"})
        elif exc:
            err = f"{type(exc).__name__}: {exc}" if str(exc) else type(exc).__name__
            await send({"type": "error",  "message": f"実行エラー: {err}"})
            await send({"type": "status", "status": "error"})
        else:
            await send({"type": "status", "status": "done"})
        return

    # ----------------
    # Phase 1b: replay系スキルの属性付加（ユーザー命令から色・位置等を抽出）
    # ----------------
    base_task = selected.get("task_name", selected["name"])
    await send({"type": "log", "line": f"[LLM] 属性抽出・タスク整形中... ベース: '{base_task}'"})

    stopped, fmt_result = await _run_with_stop_monitor(format_for_openvla(command, base_task), ws)
    if stopped:
        await send({"type": "log",    "line":   "[INFO] 緊急停止が実行されました（タスク整形中）"})
        await send({"type": "status", "status": "idle"})
        return

    if isinstance(fmt_result, Exception):
        err = f"{type(fmt_result).__name__}: {fmt_result}" if str(fmt_result) else type(fmt_result).__name__
        await send({"type": "error",  "message": f"LLMタスク整形エラー: {err}"})
        await send({"type": "status", "status": "error"})
        return

    vla_task_str = fmt_result
    await send({"type": "log",        "line":  f"[LLM] タスク文字列確定: '{vla_task_str}'"})
    await send({"type": "llm_result", "skill": {**selected, "name": vla_task_str, "icon": "🤖"}})

    # Phase 2: VLA Server 実行
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
