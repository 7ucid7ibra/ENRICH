#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WHISPER_DIR="$ROOT_DIR/whisper.cpp"
MODEL_NAME="${WHISPER_MODEL:-small}"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required but not found. Please install git first."
  exit 1
fi

if [ ! -d "$WHISPER_DIR" ]; then
  echo "Cloning whisper.cpp..."
  git clone https://github.com/ggerganov/whisper.cpp.git "$WHISPER_DIR"
fi

echo "Building whisper.cpp..."
(cd "$WHISPER_DIR" && make)

echo "Downloading Whisper model: $MODEL_NAME"
(cd "$WHISPER_DIR" && ./models/download-ggml-model.sh "$MODEL_NAME")

echo "Whisper setup complete."
echo "Set these env vars before running the app:"
if [ -f "$WHISPER_DIR/build/bin/whisper-cli" ]; then
  echo "export WHISPER_PATH=\"$WHISPER_DIR/build/bin/whisper-cli\""
elif [ -f "$WHISPER_DIR/build/bin/main" ]; then
  echo "export WHISPER_PATH=\"$WHISPER_DIR/build/bin/main\""
else
  echo "export WHISPER_PATH=\"$WHISPER_DIR/main\""
fi
echo "export WHISPER_MODEL_PATH=\"$WHISPER_DIR/models/ggml-${MODEL_NAME}.bin\""
