from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    whisper_model: str = os.getenv("WHISPER_MODEL", "tiny")
    whisper_device: str = os.getenv("WHISPER_DEVICE", "cpu")
    whisper_compute_type: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
    whisper_beam_size: int = int(os.getenv("WHISPER_BEAM_SIZE", "3"))
    whisper_best_of: int = int(os.getenv("WHISPER_BEST_OF", "3"))
    whisper_fallback_beam_size: int = int(os.getenv("WHISPER_FALLBACK_BEAM_SIZE", "5"))
    whisper_fallback_best_of: int = int(os.getenv("WHISPER_FALLBACK_BEST_OF", "5"))
    whisper_fast_threshold: float = float(os.getenv("WHISPER_FAST_THRESHOLD", "82"))
    local_tts_backend: str = os.getenv("LOCAL_TTS_BACKEND", "say")
    qwen_tts_model: str = os.getenv("QWEN_TTS_MODEL", "Qwen/Qwen3-TTS-0.6B")
    max_upload_seconds: float = float(os.getenv("MAX_UPLOAD_SECONDS", "12"))


SETTINGS = Settings()
