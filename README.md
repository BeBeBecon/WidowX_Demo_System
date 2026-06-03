# WidowX Sub Agent

ロボットアーム（WidowX）をテキスト命令で操作するデモアプリケーション。  
ローカルLLM（Ollama）がスキルを選択し、LeRobot のデータセットを再生してアームを動作させる。

> **セットアップ手順は [セットアップ手順書.md](セットアップ手順書.md) を参照してください。**

---

## システム構成

```
ユーザー入力 (Web UI)
    │
    ▼ WebSocket
FastAPI バックエンド
    │
    ├──▶ Ollama (LLM) ──▶ スキル選択
    │
    └──▶ subprocess ──▶ uv run lerobot-replay（LeRobot データセット再生）
                    └──▶ 外部スクリプト（widowx_reaction_tool）
```

---

## 起動方法

ターミナルを2つ開いて実行する。

**ターミナル1 - バックエンド:**
```bash
bash start_backend.sh
```

**ターミナル2 - フロントエンド:**
```bash
bash start_frontend.sh
```

ブラウザで `http://localhost:5278` を開く。

---

## 使い方

1. 左カラムの入力欄に命令を入力（日本語・英語どちらでも可）
2. **▶ Execute** ボタンを押す
3. 右カラムにLLMのスキル選択結果と実行ログがリアルタイム表示される
4. 実行中に **⏹ E-Stop** を押すとアームを即時停止できる

### サンプル命令

- `キューブを掴んでください`
- `Stack the cubes on top of each other`

---

## スキルの追加・変更（`config.json`）

スキル定義は `config.json` の `skills` セクションで管理する。新しいスキルを追加する場合は以下の要領でエントリを追記する。

```json
{
  "skills": [
    {
      "name": "grab_cube",
      "description": "キューブを掴む",
      "type": "replay",
      "dataset": {
        "repo_id": "docomoshiken1/grab_cube"
      }
    }
  ]
}
```

| フィールド | 説明 |
|-----------|------|
| `name` | スキルの識別子（LLMが選択に使う） |
| `description` | LLMへの説明文（日本語可）。命令とのマッチングに影響する |
| `type` | `replay`（データセット再生）または `external_script`（外部スクリプト呼び出し） |
| `dataset.repo_id` | HuggingFace のデータセット ID（`<org>/<name>` 形式） |

> `dataset.repo_id` に対応するデータセットは事前に `download_datasets.sh` でローカルにキャッシュしておくこと。

---

## ファイル構成

```
widowx_system/
├── config.json                  # スキル定義・ロボット設定（公開）
├── .env                         # 環境固有の秘匿設定（git管理外）
├── .env.example                 # .env のテンプレート
├── setup.sh                     # 初回セットアップ
├── download_datasets.sh         # データセット一括ダウンロード
├── start_backend.sh             # バックエンド起動
├── start_frontend.sh            # フロントエンド起動
├── backend/
│   ├── main.py                  # FastAPI サーバー（WebSocket）
│   ├── config.py                # 設定ローダー（config.json + .env）
│   ├── llm.py                   # Ollama 連携・スキル推論
│   ├── executor.py              # lerobot-replay / 外部スクリプト実行
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # メインコンポーネント・WebSocket管理
│   │   └── components/
│   │       ├── CommandInput.jsx # 命令入力フォーム
│   │       ├── StatusPanel.jsx  # ステータス・選択スキル表示
│   │       ├── SkillList.jsx    # スキル一覧
│   │       └── LogPanel.jsx     # 実行ログ
│   └── ...
└── tools/
    └── widowx_reaction_tool/    # 画像認識 + アーム反応スクリプト群
```
