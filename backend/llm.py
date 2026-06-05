"""
# ----------------
# Ollama LLM 連携モジュール
# ask_agent(): ユーザー命令から自然言語返答+スキル選択を1回の推論で実現
# システムプロンプトはモジュール起動時に config.json から動的生成
# format_for_openvla(): OpenVLAモード向け属性抽出（Phase 1b）
# ----------------
"""
import json
import httpx

from config import CONFIG


# =====================================
# システムプロンプト動的生成ヘルパー
# config.json の skills 配列を参照してモジュール起動時に一度だけ生成
# =====================================

def _build_task_skill_enum() -> str:
    """task_skill として LLM に提示する値列挙（全スキルID + none）"""
    ids = ["none"] + [s["id"] for s in CONFIG.get("skills", [])]
    return " | ".join(ids)


def _build_skill_descriptions() -> str:
    """各スキルの説明文（LLMに何ができるかを教える）"""
    lines = []
    for s in CONFIG.get("skills", []):
        verb = s.get("command_verb", s["name"])
        lines.append(f'  - "{s["id"]}": {s["description"]}（例: 「{verb}」）')
    return "\n".join(lines)


# ----------------
# プロンプト骨格テンプレート（{task_skill_enum}/{skill_descriptions} を動的埋め込み）
# 簡潔に保ち LLM 推論時間を最小化する
# ----------------
_SYSTEM_PROMPT_TEMPLATE = """\
あなたは WidowX ロボットアームを備えた対話エージェントです。
ユーザーへ自然な日本語で返答し、必要なら動作スキルを選んでください。
返答(reply)はユーザーの言葉に応じた具体的な一言コメントにすること。毎回同じ「了解しました」はNG。
必ず JSON のみで返してください。

{{
  "reply": "ユーザーへの自然な日本語返答（具体的・バリエーションあり）",
  "task_skill": "{task_skill_enum}",
  "reaction_skill": "none | yes | no | wavehands"
}}

【task_skill】「〜して」「〜してください」等の明確な命令形のみ選ぶ。
「〜できますか？」「〜は何ですか？」等の質問形式は必ず task_skill=none。
{skill_descriptions}

【reaction_skill】自分の返答内容で決める（ユーザーの言葉ではなく）:
- yes  : 同意・肯定・できる・そうです
- no   : 否定・できない・わからない・危険
- wavehands: 挨拶（こんにちは・おはよう・さようなら・バイバイ等）
- none : 説明・情報提供・中立

【ルール】task_skill が none 以外 → reaction_skill は必ず none

【例】（→の後の「」内はreplyの要約。replyの内容から reaction_skill を決めること）
- 「キューブ取って」→ 命令形なので task_skill: grab_cube, reaction_skill: none
- 「うなずいて」→ 命令形なので task_skill: reaction_yes, reaction_skill: none
- 「タッチ決済できますか？」→ reply:「はい、できますよ！」← 肯定内容なので reaction_skill: yes
- 「今日の天気は？」→ reply:「わかりません」← 否定・不明内容なので reaction_skill: no
- 「こんにちは！」→ reply:「こんにちは！」← 挨拶なので reaction_skill: wavehands
- 「得意なことは？」→ reply:「物をつかむのが得意です」← 中立説明なので reaction_skill: none
"""

# ----------------
# モジュール起動時に一度だけ生成（スキル変更はサーバー再起動）
# ----------------
SYSTEM_PROMPT = _SYSTEM_PROMPT_TEMPLATE.format(
    task_skill_enum=_build_task_skill_enum(),
    skill_descriptions=_build_skill_descriptions(),
)

# ----------------
# バリデーション用許容値セット（config から動的生成）
# ----------------
ALLOWED_TASK     = {"none"} | {s["id"] for s in CONFIG.get("skills", [])}
ALLOWED_REACTION = {"none"} | set(CONFIG.get("llm", {}).get("reaction_skill_map", {}).keys())


# =====================================
# メイン推論関数
# =====================================
async def ask_agent(command: str) -> dict:
    """
    ユーザー命令に対して自然言語返答とスキル選択を同時に返す。
    返却型: { "reply": str, "task_skill": str, "reaction_skill": str }
    JSONパースエラー時はフォールバック（クラッシュさせない）。
    """
    ollama_url = f"{CONFIG['ollama']['host']}/api/generate"
    payload = {
        "model":  CONFIG["ollama"]["model"],
        "prompt": command,
        "system": SYSTEM_PROMPT,
        "stream": False,
        "format": "json",  # Ollama にJSON出力を強制
    }

    try:
        async with httpx.AsyncClient(timeout=CONFIG["ollama"]["timeout"]) as client:
            resp = await client.post(ollama_url, json=payload)
            resp.raise_for_status()
            result = resp.json()

        raw_text = result.get("response", "").strip()
        data     = json.loads(raw_text)

        reply          = str(data.get("reply", "")).strip() or "..."
        task_skill     = str(data.get("task_skill",     "none")).strip().lower()
        reaction_skill = str(data.get("reaction_skill", "none")).strip().lower()

        # バリデーション: 未知の値は none に正規化
        if task_skill     not in ALLOWED_TASK:     task_skill     = "none"
        if reaction_skill not in ALLOWED_REACTION: reaction_skill = "none"

        # task_skill が有効な場合は reaction_skill を強制 none（ルール準拠）
        if task_skill != "none":
            reaction_skill = "none"

        return {
            "reply":          reply,
            "task_skill":     task_skill,
            "reaction_skill": reaction_skill,
        }

    except (json.JSONDecodeError, KeyError, TypeError):
        return {
            "reply":          "応答の解析に失敗しました。もう一度お試しください。",
            "task_skill":     "none",
            "reaction_skill": "none",
        }


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
    base_task は ask_agent() で確定したスキルの task_name を使用する。
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
