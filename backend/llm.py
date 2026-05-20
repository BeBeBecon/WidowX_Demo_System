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
Select the single most appropriate skill based on the user's command.
Respond with ONLY the skill ID (e.g., grab_cube). No explanation.

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


async def select_skill(command: str) -> str:
    """
    Ollama API を呼び出してスキルIDを推論する。
    返り値: スキルID文字列（例: "grab_cube"）
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

    # 有効なスキルIDか検証（未知の場合は最初のスキルをフォールバック）
    valid_ids = {s["id"] for s in skills}
    if raw not in valid_ids:
        # 部分一致で救済
        for sid in valid_ids:
            if sid in raw or raw in sid:
                return sid
        return skills[0]["id"]

    return raw
