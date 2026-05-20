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
    └──▶ subprocess ──▶ LeRobot ACT 実行
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

# モデル一覧確認
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
vi .env
```

### 1. 初回インストール

```bash
bash setup.sh
```

### 2. 環境変数の設定

```bash
vi .env
```

```
OLLAMA_HOST=http://<LinuxのIP>:11434   # OllamaサーバーのURL
LEROBOT_PATH=/home/ubuntu/lerobot      # LeRobotのインストールパス
DRY_RUN=false                          # Mac開発時は true に設定
```

### 3. スキルの定義

`config.json` の `skills` 配列を編集してスキルを追加・変更する。

```json
{
  "id": "grab_cube",           // 一意のID（英数字とアンダースコア）
  "name": "Grab the cube",     // 表示名
  "description": "説明文",
  "policy_path": "/path/to/policy",  // ACTポリシーのパス
  "icon": "🟥"                 // UI表示用絵文字
}
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
2. **▶ 実行** ボタンを押す（またはEnterキー）
3. 右カラムにLLMのスキル選択結果と実行ログがリアルタイム表示される

### サンプル命令

- `キューブを掴んでください`
- `Pick up the red cube`
- `ホームポジションに戻って`
- `Stack the cubes on top of each other`

---

## ファイル構成

```
widowx_system/
├── config.json          # スキル定義・モデル設定（公開）
├── .env                 # 環境固有の秘匿設定（git管理外）
├── .env.example         # .env のテンプレート
├── setup.sh             # 初回セットアップ
├── start_backend.sh     # バックエンド起動
├── start_frontend.sh    # フロントエンド起動
├── backend/
│   ├── main.py          # FastAPI サーバー（WebSocket）
│   ├── config.py        # 設定ローダー
│   ├── llm.py           # Ollama 連携・スキル推論
│   ├── executor.py      # ACT コマンド実行
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
