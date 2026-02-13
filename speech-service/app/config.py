from __future__ import annotations

import os
from dataclasses import dataclass


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    whisper_model: str = os.getenv("WHISPER_MODEL", "small")
    whisper_model_zh: str = os.getenv("WHISPER_MODEL_ZH", "tiny")
    whisper_device: str = os.getenv("WHISPER_DEVICE", "cpu")
    whisper_compute_type: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
    whisper_beam_size: int = int(os.getenv("WHISPER_BEAM_SIZE", "3"))
    whisper_best_of: int = int(os.getenv("WHISPER_BEST_OF", "3"))
    whisper_fallback_beam_size: int = int(os.getenv("WHISPER_FALLBACK_BEAM_SIZE", "5"))
    whisper_fallback_best_of: int = int(os.getenv("WHISPER_FALLBACK_BEST_OF", "5"))
    whisper_fast_threshold: float = float(os.getenv("WHISPER_FAST_THRESHOLD", "82"))
    whisper_zh_beam_size: int = int(os.getenv("WHISPER_ZH_BEAM_SIZE", "1"))
    whisper_zh_best_of: int = int(os.getenv("WHISPER_ZH_BEST_OF", "1"))
    whisper_zh_fallback_beam_size: int = int(os.getenv("WHISPER_ZH_FALLBACK_BEAM_SIZE", "2"))
    whisper_zh_fallback_best_of: int = int(os.getenv("WHISPER_ZH_FALLBACK_BEST_OF", "2"))
    whisper_zh_fast_threshold: float = float(os.getenv("WHISPER_ZH_FAST_THRESHOLD", "70"))
    whisper_zh_skip_quality_fallback: bool = _env_bool("WHISPER_ZH_SKIP_QUALITY_FALLBACK", True)
    whisper_zh_vad_filter: bool = _env_bool("WHISPER_ZH_VAD_FILTER", False)
    local_tts_backend: str = os.getenv("LOCAL_TTS_BACKEND", "auto")
    qwen_tts_model: str = os.getenv("QWEN_TTS_MODEL", "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign")
    artst_model: str = os.getenv("ARTST_MODEL", "MBZUAI/speecht5_tts_clartts_ar")
    elevenlabs_api_key: str = os.getenv("ELEVENLABS_API_KEY", "")
    elevenlabs_ar_voice_id: str = os.getenv("ELEVENLABS_AR_VOICE_ID", "")
    elevenlabs_model_id: str = os.getenv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")
    elevenlabs_timeout_seconds: float = float(os.getenv("ELEVENLABS_TIMEOUT_SECONDS", "20"))
    max_upload_seconds: float = float(os.getenv("MAX_UPLOAD_SECONDS", "12"))


SETTINGS = Settings()
