#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OS_NAME="$(uname -s)"

missing=0

check_command() {
  local cmd="$1"
  local label="$2"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing: $label"
    missing=1
  fi
}

check_file() {
  local file="$1"
  local label="$2"
  if [ ! -f "$file" ]; then
    echo "Missing: $label ($file)"
    missing=1
  fi
}

whisper_path="${WHISPER_PATH:-}"
whisper_model_path="${WHISPER_MODEL_PATH:-}"
whisper_model="${WHISPER_MODEL:-small}"

if [ -z "$whisper_path" ]; then
  if command -v whisper >/dev/null 2>&1; then
    whisper_path="$(command -v whisper)"
  elif [ -f "$ROOT_DIR/whisper.cpp/build/bin/whisper-cli" ]; then
    whisper_path="$ROOT_DIR/whisper.cpp/build/bin/whisper-cli"
  elif [ -f "$ROOT_DIR/whisper.cpp/build/bin/main" ]; then
    whisper_path="$ROOT_DIR/whisper.cpp/build/bin/main"
  elif [ -f "$ROOT_DIR/whisper.cpp/main" ]; then
    whisper_path="$ROOT_DIR/whisper.cpp/main"
  fi
fi

if [ -z "$whisper_model_path" ]; then
  if [ -d "$ROOT_DIR/whisper.cpp/models" ]; then
    whisper_model_path="$ROOT_DIR/whisper.cpp/models/ggml-${whisper_model}.bin"
  fi
fi

echo "Preflight checks..."
check_command "node" "Node.js"
check_command "npm" "npm"

if ! command -v rec >/dev/null 2>&1; then
  check_command "sox" "SoX (rec)"
fi

if [ -z "$whisper_path" ]; then
  echo "Missing: Whisper binary (set WHISPER_PATH or place whisper.cpp/main)"
  missing=1
else
  check_file "$whisper_path" "Whisper binary"
fi

if [ -z "$whisper_model_path" ]; then
  echo "Missing: Whisper model (set WHISPER_MODEL_PATH or place model in whisper.cpp/models)"
  missing=1
else
  check_file "$whisper_model_path" "Whisper model"
fi

if ! command -v ollama >/dev/null 2>&1; then
  echo "Missing: Ollama binary (LLM)"
  missing=1
else
  if ! curl -fsS "http://localhost:11434/api/tags" >/dev/null 2>&1; then
    echo "Ollama is installed but not running (start with: ollama serve)"
  fi
fi

if [ "$missing" -eq 1 ]; then
  echo ""
  echo "Preflight failed. See README for setup steps."
  echo "Tip: run with AUTO_INSTALL=1 to attempt installs (macOS/Homebrew only)."
  echo "Tip: run 'npm run setup:whisper' to install Whisper locally."
  if [ "${AUTO_INSTALL:-0}" -eq 1 ] && [ "$OS_NAME" = "Darwin" ] && command -v brew >/dev/null 2>&1; then
    echo "Attempting automatic installs via Homebrew..."
    brew install sox || true
    if [ ! -d "$ROOT_DIR/whisper.cpp" ]; then
      echo "Whisper.cpp not found. Please clone it manually into $ROOT_DIR/whisper.cpp"
    fi
    if ! command -v ollama >/dev/null 2>&1; then
      brew install ollama || true
    fi
  fi
  exit 1
fi

echo "Preflight OK."
