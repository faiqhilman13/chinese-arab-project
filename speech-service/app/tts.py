from __future__ import annotations

import os
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import soundfile as sf

from app.config import SETTINGS


class TtsError(RuntimeError):
    pass


@dataclass
class SynthesisResult:
    audio_bytes: bytes
    content_type: str


def _voice_for_language(language: str) -> str:
    if language == "zh":
        return os.getenv("MACOS_TTS_VOICE_ZH", "Tingting")
    return os.getenv("MACOS_TTS_VOICE_AR", "Maged")


def _convert_aiff_to_wav(source_path: Path) -> bytes:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as wav_file:
        wav_path = Path(wav_file.name)

    try:
        convert = subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-i",
                str(source_path),
                "-ar",
                "24000",
                "-ac",
                "1",
                "-c:a",
                "pcm_s16le",
                str(wav_path),
            ],
            capture_output=True,
            text=True,
            check=False,
        )

        if convert.returncode != 0 or not wav_path.exists():
            raise TtsError(
                f"Failed to convert AIFF to WAV: {convert.stderr.strip() or convert.stdout.strip()}"
            )

        audio = wav_path.read_bytes()
        if not audio:
            raise TtsError("Converted WAV is empty.")

        return audio
    finally:
        wav_path.unlink(missing_ok=True)


def _synthesize_with_say(text: str, language: str) -> SynthesisResult:
    voice = _voice_for_language(language)

    with tempfile.NamedTemporaryFile(suffix=".aiff", delete=False) as temp_file:
        output_path = Path(temp_file.name)

    try:
        command = [
            "say",
            "-v",
            voice,
            "-o",
            str(output_path),
            text,
        ]
        result = subprocess.run(command, capture_output=True, text=True, check=False)

        if result.returncode != 0:
            raise TtsError(f"macOS say failed: {result.stderr.strip() or result.stdout.strip()}")

        audio = _convert_aiff_to_wav(output_path)
        if not audio:
            raise TtsError("macOS say produced empty audio.")

        return SynthesisResult(audio_bytes=audio, content_type="audio/wav")
    finally:
        output_path.unlink(missing_ok=True)


def _synthesize_with_qwen(text: str, language: str) -> SynthesisResult:
    try:
        from qwen_tts import Qwen3TTS
    except Exception as exc:  # pragma: no cover
        raise TtsError(
            "Qwen TTS backend selected but `qwen-tts` package is not available."
        ) from exc

    model = Qwen3TTS(SETTINGS.qwen_tts_model)
    language_name = "chinese" if language == "zh" else "arabic"
    wav, sample_rate = model.generate(text=text, language=language_name)

    if wav is None:
        raise TtsError("Qwen TTS generation returned no audio.")

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
        wav_path = Path(temp_file.name)

    try:
        wav_array = np.asarray(wav, dtype=np.float32)
        sf.write(wav_path, wav_array, int(sample_rate), subtype="PCM_16")
        return SynthesisResult(audio_bytes=wav_path.read_bytes(), content_type="audio/wav")
    finally:
        wav_path.unlink(missing_ok=True)


def synthesize(text: str, language: str) -> SynthesisResult:
    backend = SETTINGS.local_tts_backend.lower()

    if backend == "qwen":
        try:
            return _synthesize_with_qwen(text=text, language=language)
        except TtsError:
            # Fall back to system synthesis for reliability in local dev.
            return _synthesize_with_say(text=text, language=language)

    return _synthesize_with_say(text=text, language=language)
