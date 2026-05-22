import whisper
import tempfile
import os


_model = None


def _load_model(size: str = "small") -> whisper.Whisper:
    global _model
    if _model is None:
        _model = whisper.load_model(size)
    return _model


def transcribe_file(audio_path: str) -> str:
    model = _load_model()
    result = model.transcribe(audio_path, language="en")
    return result["text"].strip()


def transcribe_bytes(audio_bytes: bytes, suffix: str = ".ogg") -> str:
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(audio_bytes)
        tmp_path = f.name
    try:
        return transcribe_file(tmp_path)
    finally:
        os.unlink(tmp_path)
