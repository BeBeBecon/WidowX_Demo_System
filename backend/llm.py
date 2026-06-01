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


# ----------------
# Yes/No トリガー判定ヘルパー
# predefined_qa / trigger_words いずれかにマッチした場合のみ
# reaction_yes / reaction_no を LLM 候補に含める。
# ----------------
_REACTION_IDS = {"reaction_yes", "reaction_no"}


def _check_yes_no_trigger(command: str) -> str | None:
    """
    predefined_qa に完全一致 → skill_id を直接返す（LLM スキップ）。
    trigger_words にいずれか含まれる → None を返す（通常フローで reaction 系を候補に含む）。
    reaction スキルの command_verb に一致 → None を返す（カード直クリック対応）。
    いずれも非マッチ → "_no_reaction" 番兵を返す（reaction 系を候補から除外するシグナル）。
    """
    llm_cfg  = CONFIG.get("llm", {})
    qa_list  = llm_cfg.get("predefined_qa", [])
    triggers = llm_cfg.get("yes_no_trigger_words", [])

    # 完全一致チェック（predefined_qa）
    for qa in qa_list:
        if qa.get("question", "").strip() == command.strip():
            return qa["skill_id"]

    # トリガーワード部分一致チェック
    for word in triggers:
        if word in command:
            return None  # reaction 系を候補に含めて通常フロー

    # reaction スキルの command_verb 部分一致チェック
    # スキルカード直クリック時に command_verb がそのまま送信されるケースに対応
    for skill in CONFIG.get("skills", []):
        if skill.get("id") not in _REACTION_IDS:
            continue
        verb = skill.get("command_verb", "")
        if verb and verb in command:
            return None  # reaction 系を候補に含めて通常フロー

    return "_no_reaction"  # reaction 系を除外するシグナル


async def select_skill(command: str) -> str | None:
    """
    Ollama API を呼び出してスキルIDを推論する。
    - predefined_qa に完全一致 → LLM をスキップして直接返す
    - trigger_words マッチ    → reaction 系を候補に含めて推論
    - いずれも非マッチ       → reaction 系を除外して推論
    返り値: スキルID文字列（例: "grab_cube"）、マッチしない場合は None
    """
    skills   = CONFIG["skills"]
    trigger_result = _check_yes_no_trigger(command)

    # predefined_qa 完全一致 → 直接返す
    if trigger_result not in (None, "_no_reaction"):
        return trigger_result

    # reaction 系を候補から除外するか判定
    if trigger_result == "_no_reaction":
        candidate_skills = [s for s in skills if s["id"] not in _REACTION_IDS]
    else:
        candidate_skills = skills

    skill_list_text = _build_skill_list(candidate_skills)
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

    # 有効なスキルIDか検証（候補スキルの範囲内のみ）
    valid_ids = {s["id"] for s in candidate_skills}
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
