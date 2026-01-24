import os
import sys

try:
    from faster_whisper import WhisperModel
except Exception as exc:
    sys.stderr.write(f"Failed to import faster_whisper: {exc}\n")
    sys.exit(1)


def main() -> int:
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: fw_runner.py <audio_path>\n")
        return 1

    audio_path = sys.argv[1]
    model_path = os.environ.get("WHISPER_FW_MODEL_PATH")
    model_name = model_path or os.environ.get("WHISPER_FW_MODEL", "base")
    device = os.environ.get("WHISPER_FW_DEVICE", "cpu")
    compute_type = os.environ.get("WHISPER_FW_COMPUTE", "int8")
    language = os.environ.get("WHISPER_FW_LANGUAGE") or None

    try:
        model = WhisperModel(model_name, device=device, compute_type=compute_type)
        segments, _info = model.transcribe(audio_path, beam_size=5, language=language)
        text = " ".join(segment.text for segment in segments).strip()
        print(text)
        return 0
    except Exception as exc:
        sys.stderr.write(f"Faster-Whisper transcription failed: {exc}\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
