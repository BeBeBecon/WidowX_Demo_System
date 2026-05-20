# WidowX Sub Agent

ロボットアーム（WidowX）をテキスト命令で操作するデモアプリケーション。  
ローカルLLM（Ollama）がスキルを選択し、LeRobotのACTモデルで動作を実行する。

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
    └──▶ subprocess ──▶ uv run lerobot-record（LeRobot ACT 実行）
```

---

## Ollama の管理（Linux）

Linux では Ollama がシステムサービスとして自動起動する。

```bash
# 状態確認
systemctl status ollama

# 一時停止（次回PC起動時は自動起動される）
sudo systemctl stop ollama

# 自動起動を無効化（共有PCでメモリを節約したい場合）
sudo systemctl disable ollama

# 手動で起動
sudo systemctl start ollama

# モデル一覧確認（qwen2.5:3b が表示されればOK）
ollama list
```

> 共有PCの場合は `disable` しておき、デモ前に `start` するのを推奨。

---

## セットアップ

### 0. Linux へのデプロイ（初回のみ）

```bash
# リポジトリ名と異なるフォルダ名でcloneする場合はフォルダ名を末尾に指定
git clone https://github.com/BeBeBecon/WidowX_Demo_System.git widowx_system
cd widowx_system

# .env.example をコピーして編集
cp .env.example .env
```

### 1. 初回インストール

```bash
bash setup.sh
```

### 2. 環境変数の設定

`.env` を編集して以下を設定する。

```
OLLAMA_HOST=http://localhost:11434               # Ollama サーバーの URL
LEROBOT_PATH=/home/<username>/lerobot_trossen    # LeRobot のインストールパス
ROBOT_IP=192.168.1.x                            # ロボットアームの IP アドレス
HF_USER=your_hf_username                        # Hugging Face ユーザー名
UV_PATH=/home/<username>/.local/bin/uv          # uv のフルパス（which uv で確認）
DRY_RUN=false                                   # アームを動かさない場合は true
```

> `UV_PATH` は `which uv` で確認する。

### 3. スキルの定義

新しいACTモデルを学習したら `config.json` の該当スキルを更新する。

```json
{
  "id": "grab_cube",
  "name": "Grab the cube",
  "description": "テーブル上の赤いキューブを掴む",
  "task_name": "Grab the cube",
  "policy_path": "/home/katsube/lerobot_trossen/outputs/train/grab_cube_act_XXXX/checkpoints/last/pretrained_model",
  "eval_repo_suffix": "eval_grab_cube_test_run01",
  "icon": "🟥"
}
```

| フィールド | 説明 |
|-----------|------|
| `task_name` | `--dataset.single_task` に渡す文字列（**学習時のタスク名と完全一致**させること） |
| `policy_path` | 学習済みモデルのチェックポイントへの絶対パス |
| `eval_repo_suffix` | HFキャッシュ削除・eval保存先のsuffix。実行ごとにユニークな名前にすることを推奨（例: `eval_grab_cube_run02`） |

**実行フロー（本番）:**
1. `~/.cache/huggingface/lerobot/{HF_USER}/{eval_repo_suffix}` を削除（file exists 回避）
2. `uv run --no-sync lerobot-record ...` を実行

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
- `ホームポジションに戻って`
- `Stack the cubes on top of each other`

---

## ファイル構成

```
widowx_system/
├── config.json          # スキル定義・ロボット設定（公開）
├── .env                 # 環境固有の秘匿設定（git管理外）
├── .env.example         # .env のテンプレート
├── setup.sh             # 初回セットアップ
├── start_backend.sh     # バックエンド起動
├── start_frontend.sh    # フロントエンド起動
├── backend/
│   ├── main.py          # FastAPI サーバー（WebSocket）
│   ├── config.py        # 設定ローダー
│   ├── llm.py           # Ollama 連携・スキル推論
│   ├── executor.py      # キャッシュ削除 + lerobot-record 実行
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.jsx               # メインコンポーネント・WebSocket管理
    │   └── components/
    │       ├── CommandInput.jsx  # 命令入力フォーム
    │       ├── StatusPanel.jsx   # ステータス・選択スキル表示
    │       ├── SkillList.jsx     # スキル一覧
    │       └── LogPanel.jsx      # 実行ログ
    └── ...
```

---

## 開発メモ（Mac環境）

`.env` で `DRY_RUN=true` にするとLeRobotコマンドを実行せず動作シミュレートするため、  
Macでもバックエンドの動作確認が可能。
