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
    └──▶ subprocess ──▶ uv run --no-sync lerobot-record（LeRobot ACT 実行）
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
git clone https://github.com/BeBeBecon/WidowX_Demo_System.git widowx_system
cd widowx_system
cp .env.example .env
```

### 1. 初回インストール

```bash
bash setup.sh
```

### 2. 環境変数の設定（`.env`）

`.env` を編集して各環境に合わせた値を設定する。

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `OLLAMA_HOST` | Ollama サーバーの URL | `http://localhost:11434` |
| `LEROBOT_PATH` | lerobot_trossen のインストールパス | `/home/<username>/lerobot_trossen` |
| `ROBOT_IP` | ロボットアームの IP アドレス | `192.168.1.x` |
| `HF_USER` | Hugging Face ユーザー名 | `your_hf_username` |
| `UV_PATH` | uv のフルパス（`which uv` で確認） | `/home/<username>/.local/bin/uv` |
| `DRY_RUN` | `true` にするとアームを動かさずシミュレート | `false` |

> `UV_PATH` は `which uv` で確認する。  
> Mac での動作確認時は `DRY_RUN=true` に設定する。

### 3. スキルの設定（`config.json`）

`config.json` の主要設定項目と意味を以下に示す。

#### `robot` セクション

| フィールド | 説明 |
|-----------|------|
| `type` | ロボットタイプ（変更不要） |
| `id` | ロボット識別子（変更不要） |
| `max_relative_target` | 1ステップあたりの最大移動量（安全リミット） |
| `min_time_to_move_multiplier` | 動作速度の制限係数（大きいほど遅く・安全） |
| `cameras` | カメラ設定（シリアル番号・解像度・FPS・ウォームアップ時間） |

#### `record` セクション (ポリシーの実行)

| フィールド | 説明 | デフォルト |
|-----------|------|-----------|
| `num_episodes` | 1回の実行で評価するエピソード数 | `1`（デモは1回） |
| `episode_time_s` | 1エピソードあたりの最大実行時間（秒） | `20` |
| `reset_time_s` | エピソード間のリセット待ち時間（秒） | `5` |
| `push_to_hub` | eval データを HF に送信するか | `false` |
| `display_data` | カメラ映像をウィンドウ表示するか | `false` |

#### `skills` セクション（スキルごとに設定）

| フィールド | 説明 |
|-----------|------|
| `task_name` | `--dataset.single_task` に渡す文字列（**学習時のタスク名と完全一致**） |
| `policy_path` | 学習済みモデルのパス（後述） |
| `eval_repo_suffix` | eval データの保存先 suffix（実行ごとにユニークにすると後から確認できる） |

### 4. 学習済みモデルの準備（`policy_path`）

ポリシーパスの指定方法は2種類ある。**デモ本番ではAのローカルパスを推奨**（ネット依存なし・起動高速）。

#### A. ローカルパス（推奨）

**① モデルをアップロード（モデルを持っているユーザーが実行）:**

```bash
# 学習済みモデルを HuggingFace にアップロード
cd /home/<model_owner>/lerobot_trossen
huggingface-cli upload <HF_USER>/grab_cube_act \
  outputs/train/<モデルフォルダ>/checkpoints/last/pretrained_model \
  --repo-type model
```

**② モデルをダウンロード（使用するユーザーが実行）:**

```bash
cd /home/<username>/lerobot_trossen
mkdir -p outputs/pretrained
huggingface-cli download <HF_USER>/grab_cube_act \
  --local-dir outputs/pretrained/grab_cube_act \
  --repo-type model
```

**③ `config.json` の `policy_path` を更新:**

```json
"policy_path": "outputs/pretrained/grab_cube_act"
```

> `LEROBOT_PATH` 配下からの相対パスで指定する。  
> `LEROBOT_PATH` 直下で学習した場合は `outputs/train/<フォルダ名>/checkpoints/last/pretrained_model` でもよい。

#### B. HuggingFace リポジトリ ID を直接指定（インターネット必須）

```json
"policy_path": "<HF_USER>/grab_cube_act"
```

初回起動時にモデルを自動ダウンロードする。起動が遅くなるためデモ本番には不向き。

### 5. LeRobot CLI の確認（初回のみ）

```bash
ls /home/<username>/lerobot_trossen/.venv/bin/lerobot*
# → lerobot-record が存在すればOK
```

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

## IntelRealSense 固有の設定

本システムは IntelRealSense カメラを使用するため、NVIDIA NPP ライブラリのパスが必要。  
`executor.py` が起動時に `.venv` 内の `libnppicc.so.12` を自動検出し `LD_LIBRARY_PATH` を設定するため、**手動での `export` は不要**。

> lerobot_trossen の公式マニュアルでは OpenCV カメラ（`type: opencv`）を使用するコマンド例が記載されているが、  
> 本システムは IntelRealSense（`type: intelrealsense`）に対応した設定になっている。

---

## 開発メモ（Mac環境）

`.env` で `DRY_RUN=true` にするとLeRobotコマンドを実行せず動作シミュレートするため、  
Macでもバックエンドの動作確認が可能。
