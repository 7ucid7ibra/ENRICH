#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-}"
VENV_DIR="${ROOT_DIR}/assets/faster-whisper/venv"
MODEL_DIR="${ROOT_DIR}/assets/faster-whisper/models"
MODEL_NAME="${WHISPER_FW_MODEL:-base}"

mkdir -p "${MODEL_DIR}"

if [ -z "${PYTHON_BIN}" ]; then
  if command -v python3.11 >/dev/null 2>&1; then
    PYTHON_BIN="python3.11"
  elif command -v python3.10 >/dev/null 2>&1; then
    PYTHON_BIN="python3.10"
  elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
  else
    echo "Python 3.10+ is required. Set PYTHON_BIN to a Python 3.11/3.10 executable." >&2
    exit 1
  fi
fi

if [ ! -d "${VENV_DIR}" ]; then
  "${PYTHON_BIN}" -m venv "${VENV_DIR}"
fi

"${VENV_DIR}/bin/pip" install --upgrade pip
"${VENV_DIR}/bin/pip" install "faster-whisper==1.2.1"

"${VENV_DIR}/bin/python" - <<PY
from faster_whisper import WhisperModel

model_name = "${MODEL_NAME}"
download_root = r"${MODEL_DIR}"
WhisperModel(model_name, device="cpu", compute_type="int8", download_root=download_root)
print(f"Downloaded model '{model_name}' into {download_root}")
PY

echo "Faster-Whisper setup complete."
