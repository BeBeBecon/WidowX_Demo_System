"""
# ----------------
# Ollama LLM 連携モジュール
# スキル一覧とユーザー命令をOllamaに渡し、最適なスキルIDを推論する
# ----------------
"""
import httpx

from config import CONFIG


# ----------------
# プロンプトテンプレート（スキルセレクター専用）
# ----------------
PROMPT_TEMPLATE = """\
You are a robot arm skill selector.
Select the most appropriate skill ID from the list below based on the user's command.
If no skill reasonably matches the command, respond with exactly: none

Respond with ONLY the skill ID or "none". No explanation.

Available skills:
{skill_list}

User command: {command}

Skill ID:"""


def _build_skill_list(skills: list[dict]) -> str:
    """スキル一覧をプロンプト用テキストに整形する"""
    lines = []
    for s in skills:
        lines.append(f"- {s['id']}: {s['name']} — {s['description']}")
    return "\n".join(lines)


async def select_skill(command: str) -> str | None:
    """
    Ollama API を呼び出してスキルIDを推論する。
    返り値: スキルID文字列（例: "grab_cube"）、マッチしない場合は None
    """
    skills = CONFIG["skills"]
    skill_list_text = _build_skill_list(skills)
    prompt = PROMPT_TEMPLATE.format(skill_list=skill_list_text, command=command)

    ollama_url = f"{CONFIG['ollama']['host']}/api/generate"
    payload = {
        "model": CONFIG["ollama"]["model"],
        "prompt": prompt,
        "stream": False,
    }

    async with httpx.AsyncClient(timeout=CONFIG["ollama"]["timeout"]) as client:
        resp = await client.post(ollama_url, json=payload)
        resp.raise_for_status()
        result = resp.json()

    # レスポンスからスキルIDを抽出・正規化
    raw = result.get("response", "").strip().lower().replace(" ", "_")

    # LLMが明示的に none を返した場合はスキルなしとして扱う
    if raw == "none":
        return None

    # 有効なスキルIDか検証
    valid_ids = {s["id"] for s in skills}
    if raw in valid_ids:
        return raw

    # 部分一致で救済
    for sid in valid_ids:
        if sid in raw or raw in sid:
            return sid

    return None


# ----------------
# OpenVLA 向け属性抽出テンプレート（2段階処理の Phase 1b）
# スキル選択で確定した base_task にユーザー命令の属性（色・サイズ等）を付加する。
# base_task のフォーマットを崩さず、属性のみを補完する（推論精度に直結）。
# ----------------
OPENVLA_FORMAT_TEMPLATE = """\
You are a robot task attribute extractor.
Base task: '{base_task}'
Add only the relevant attributes (color, size, position, etc.) \
from the user command to the base task. Keep the base format intact.
If no attributes apply, return the base task as-is.

Respond with ONLY the final task string. No explanation, no punctuation at end.

User command: {command}

Task:"""


async def format_for_openvla(command: str, base_task: str) -> str:
    """
    ユーザー命令から属性を抽出し、base_task に付加して返す（Phase 1b）。
    base_task は select_skill() で確定したスキルの task_name を使用する。
    例: command="黄色いキューブを掴んで", base_task="Grab the cube"
        → "Grab the yellow cube"
    """
    prompt = OPENVLA_FORMAT_TEMPLATE.format(base_task=base_task, command=command)

    ollama_url = f"{CONFIG['ollama']['host']}/api/generate"
    payload = {
        "model":  CONFIG["ollama"]["model"],
        "prompt": prompt,
        "stream": False,
    }

    async with httpx.AsyncClient(timeout=CONFIG["ollama"]["timeout"]) as client:
        resp = await client.post(ollama_url, json=payload)
        resp.raise_for_status()
        result = resp.json()

    return result.get("response", "").strip()
