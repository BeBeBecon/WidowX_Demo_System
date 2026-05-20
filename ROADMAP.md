# Sub Agent 開発ロードマップ (ROADMAP)

- [x] **STEP 1: プロジェクトの初期構成と各種設定ファイルの作成**
  - [x] `.gitignore` の作成
  - [x] 設定ファイル (`config.json` + `.env.example`) の作成 (OllamaのURL, スキル定義など)
  - [x] プロジェクトディレクトリ構造の定義 (frontend/ と backend/ の分離)

- [x] **STEP 2: フロントエンド（Web UI）の構築 (Vite + React + TailwindCSS)**
  - [x] Viteプロジェクトの初期化とパッケージインストール
  - [x] Tailwind CSSのセットアップ
  - [x] モダンなUI（ダークテーマ、Glassmorphism）のコーディング
  - [x] ユーザー入力欄、ステータス、スキル一覧、結果表示領域の実装

- [x] **STEP 3: バックエンド（Sub Agent API）の構築 (Python FastAPI)**
  - [x] 仮想環境（venv）の構築と必要ライブラリのインストール
  - [x] FastAPIを用いた軽量APIサーバーの作成（WebSocket対応）
  - [x] ローカルOllama APIへのプロンプト送信と回答のパース処理

- [x] **STEP 4: ACTモデル実行ロジックの実装 (Linux環境)**
  - [x] LLMの回答（スキルID）から対応する実行コマンドを構築するロジック
  - [x] `asyncio.create_subprocess_exec`を用いたリアルタイムログストリーミング
  - [x] `DRY_RUN`モードによるMac開発環境での動作確認サポート

- [x] **STEP 5: 結合テストと起動スクリプト・マニュアルの作成**
  - [x] 起動スクリプト (`setup.sh`, `start_backend.sh`, `start_frontend.sh`) の作成
  - [x] デモ者向けの `README.md` の作成（構成と実行手順）
