#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Bootstrapping Voice Intelligence..."

if [ -z "${WHISPER_PATH:-}" ]; then
  if [ -f "$ROOT_DIR/whisper.cpp/build/bin/whisper-cli" ]; then
    export WHISPER_PATH="$ROOT_DIR/whisper.cpp/build/bin/whisper-cli"
  elif [ -f "$ROOT_DIR/whisper.cpp/build/bin/main" ]; then
    export WHISPER_PATH="$ROOT_DIR/whisper.cpp/build/bin/main"
  elif [ -f "$ROOT_DIR/whisper.cpp/main" ]; then
    export WHISPER_PATH="$ROOT_DIR/whisper.cpp/main"
  fi
fi

if [ -z "${WHISPER_MODEL_PATH:-}" ]; then
  if [ -f "$ROOT_DIR/whisper.cpp/models/ggml-small.bin" ]; then
    export WHISPER_MODEL_PATH="$ROOT_DIR/whisper.cpp/models/ggml-small.bin"
  fi
fi

if [ -f "$ROOT_DIR/scripts/preflight.sh" ]; then
  bash "$ROOT_DIR/scripts/preflight.sh"
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but not found. Please install Node.js first."
  exit 1
fi

if [ ! -d "$ROOT_DIR/node_modules" ]; then
  echo "Installing root dependencies..."
  (cd "$ROOT_DIR" && npm install)
else
  echo "Root dependencies already installed."
fi

if [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
  echo "Installing frontend dependencies..."
  (cd "$ROOT_DIR/frontend" && npm install)
else
  echo "Frontend dependencies already installed."
fi

if [ -z "${DEV_PORT:-}" ]; then
  for port in 3000 3001 3002 3003 3004 3005; do
    if ! lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      DEV_PORT="$port"
      break
    fi
  done
fi

if [ -z "${DEV_PORT:-}" ]; then
  echo "No free port found in 3000-3005. Set DEV_PORT and try again."
  exit 1
fi

export DEV_PORT
echo "Using DEV_PORT=$DEV_PORT"

echo "Starting app..."
(cd "$ROOT_DIR" && npm run dev)
