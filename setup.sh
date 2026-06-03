#!/usr/bin/env bash
# =====================================
# setup.sh - 初回セットアップスクリプト
# 依存パッケージのインストール、GPU/CUDA環境チェック、tools/権限設定を一括実行
# 初回のみ実行。以降は start_backend.sh / start_frontend.sh で起動する。
# =====================================
set -e

PROJ_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "======================================"
echo "  WidowX Sub Agent - Setup"
echo "======================================"

# ----------------
# Python バージョン確認（3.10以上必須）
# ----------------
echo ""
echo "[Check] Python バージョン確認..."
PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null || echo "0.0")
PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)
if [ "$PYTHON_MAJOR" -lt 3 ] || { [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 10 ]; }; then
  echo "[ERROR] Python 3.10 以上が必要です（現在: $PYTHON_VERSION）"
  echo "        pyenv や deadsnakes PPA で最新版をインストールしてください"
  exit 1
fi
echo "[OK] Python $PYTHON_VERSION"

# ----------------
# GPU / CUDA バージョン確認
# ----------------
echo ""
echo "[Check] GPU / CUDA 環境確認..."
if command -v nvidia-smi &>/dev/null; then
  GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1 || echo "不明")
  CUDA_VERSION=$(nvidia-smi | grep -oP "CUDA Version: \K[0-9.]+" 2>/dev/null || echo "不明")
  echo "[OK] GPU: $GPU_NAME"
  echo "[OK] CUDA: $CUDA_VERSION"

  # Blackwell アーキテクチャ (RTX 50xx) の検出
  if echo "$GPU_NAME" | grep -qiE "RTX 50[0-9]{2}|5080|5090|5070|5060"; then
    echo ""
    echo "[WARN] ============================================================"
    echo "[WARN] Blackwell GPU (RTX 5000系) が検出されました。"
    echo "[WARN] 標準PyTorchはBlackwellに対応していないため、"
    echo "[WARN] LeRobot セットアップ後に以下を必ず実行してください:"
    echo "[WARN]"
    echo "[WARN]   cd ~/lerobot_trossen"
    echo "[WARN]   VIRTUAL_ENV=.venv uv pip install --force-reinstall --pre \\"
    echo "[WARN]     torch torchvision torchaudio \\"
    echo "[WARN]     --index-url https://download.pytorch.org/whl/nightly/cu128"
    echo "[WARN] ============================================================"
    echo ""
  fi
else
  echo "[INFO] nvidia-smi が見つかりません（GPU なし / ドライバ未インストール）"
  echo "[INFO] GPU が必要な場合は NVIDIA ドライバをインストールしてください"
fi

# ----------------
# uv コマンド確認
# ----------------
echo ""
echo "[Check] uv コマンド確認..."
if command -v uv &>/dev/null; then
  echo "[OK] uv: $(uv --version)"
else
  echo "[INFO] uv が見つかりません。インストールします..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  # シェルに PATH を反映
  export PATH="$HOME/.local/bin:$PATH"
  if command -v uv &>/dev/null; then
    echo "[OK] uv をインストールしました: $(uv --version)"
  else
    echo "[WARN] uv のインストール後、以下を実行してシェルを再起動してください:"
    echo "       source ~/.bashrc  (または ~/.zshrc)"
  fi
fi

# ----------------
# Ollama 確認
# ----------------
echo ""
echo "[Check] Ollama 確認..."
if command -v ollama &>/dev/null; then
  echo "[OK] ollama: $(ollama --version 2>/dev/null || echo 'インストール済み')"
  if ollama list 2>/dev/null | grep -q "qwen2.5:3b"; then
    echo "[OK] モデル qwen2.5:3b は取得済みです"
  else
    echo "[INFO] qwen2.5:3b を取得します..."
    ollama pull qwen2.5:3b
    echo "[OK] qwen2.5:3b の取得完了"
  fi
else
  echo "[WARN] ollama が見つかりません。以下でインストールしてください:"
  echo "       curl -fsSL https://ollama.com/install.sh | sh"
fi

# ----------------
# .env ファイルの確認・生成
# ----------------
echo ""
echo "[Setup] .env ファイル確認..."
if [ ! -f "$PROJ_DIR/.env" ]; then
  cp "$PROJ_DIR/.env.example" "$PROJ_DIR/.env"
  echo "[INFO] .env を作成しました。以下を設定してください: $PROJ_DIR/.env"
  echo "       - LEROBOT_PATH: lerobot_trossen のパス"
  echo "       - ROBOT_IP    : ロボットアームの IP アドレス"
  echo "       - UV_PATH     : uv のフルパス (which uv で確認)"
else
  echo "[OK] .env は既に存在します"
fi

# ----------------
# バックエンド: Python仮想環境 + pip
# ----------------
echo ""
echo "[Backend] Python仮想環境をセットアップ中..."
cd "$PROJ_DIR/backend"
python3 -m venv venv
source venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
deactivate
echo "[Backend] インストール完了"

# ----------------
# Node.js / npm がなければ自動インストール（Linux向け）
# ----------------
if ! command -v npm &>/dev/null; then
  echo "[Frontend] npm が見つかりません。Node.js をインストールします..."
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
  sudo apt-get install -y nodejs
  echo "[Frontend] Node.js インストール完了: $(node -v)"
fi

# ----------------
# フロントエンド: npm install
# ----------------
echo ""
echo "[Frontend] npm パッケージをインストール中..."
cd "$PROJ_DIR/frontend"
npm install --silent
echo "[Frontend] インストール完了"

# ----------------
# tools/ 内スクリプトに実行権限を付与
# ----------------
echo ""
echo "[Tools] tools/ スクリプトの実行権限を設定中..."
find "$PROJ_DIR/tools" -name "*.sh" -exec chmod +x {} \;
echo "[OK] tools/*.sh に実行権限を付与しました"

echo ""
echo "======================================"
echo "  セットアップ完了!"
echo ""
echo "  次のステップ:"
echo "  1. .env を編集して各環境の値を設定"
echo "     例) nano $PROJ_DIR/.env"
echo "  2. Hugging Face ログイン（初回のみ）:"
echo "     cd ~/lerobot_trossen && uv run huggingface-cli login"
echo "  3. データセットのダウンロード:"
echo "     bash $PROJ_DIR/download_datasets.sh"
echo "  4. バックエンド起動: bash start_backend.sh"
echo "  5. フロントエンド起動: bash start_frontend.sh"
echo "======================================"
