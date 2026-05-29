"""
# =====================================
# 向き指定受信モジュール
# 同一PC内の別システム（OpenCVチーム）から direction 通知を受け取る軽量 REST API。
# A2A ではなく独立した内部エンドポイント。受け口のみ実装（ロジックは最小限）。
# executor.py が direction_aware スキル実行時に get_current_direction() を参照する。
# =====================================
"""
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

# ----------------
# インメモリ direction 状態（最新値を上書き保持）
# ----------------
_current_direction: str = "center"

router = APIRouter()


# ----------------
# リクエストモデル
# ----------------
class DirectionRequest(BaseModel):
    direction: Literal["right", "left", "center"]


# ----------------
# POST /internal/direction — direction を受け取って上書き保存
# ----------------
@router.post("/internal/direction")
async def set_direction(body: DirectionRequest):
    global _current_direction
    _current_direction = body.direction
    return {"direction": _current_direction}


# ----------------
# GET /internal/direction — 現在の direction を返す（確認用）
# ----------------
@router.get("/internal/direction")
async def get_direction():
    return {"direction": _current_direction}


# ----------------
# executor.py から呼び出す関数インターフェース
# ----------------
def get_current_direction() -> str:
    return _current_direction
