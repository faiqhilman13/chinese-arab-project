from __future__ import annotations

import asyncio
import subprocess
import tempfile
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.config import SETTINGS
from app.ffmpeg import resolve_ffmpeg_command
from app.scoring import evaluate_pronunciation
from app.stt import transcriber
from app.tts import TtsError, synthesize, warmup_models_for_language

app = FastAPI(title="Local Speech Service", version="0.1.0")


class SynthesizeRequest(BaseModel):
    language: str = Field(pattern="^(ar|zh)$")
    text: str = Field(min_length=1, max_length=240)
    transliteration: str | None = None


@app.on_event("startup")
async def startup_warmup() -> None:
    async def run_warmup() -> None:
        try:
            await asyncio.to_thread(warmup_models_for_language, "zh")
        except Exception:
            # Keep service available even if model warmup fails.
            pass

        try:
            await asyncio.to_thread(transcriber.warmup, "zh")
        except Exception:
            # Keep service available even if model warmup fails.
            pass

    asyncio.create_task(run_warmup())


@app.get("/health")
def health():
    tts_mode = "local-only"
    if SETTINGS.elevenlabs_api_key and SETTINGS.elevenlabs_ar_voice_id:
        tts_mode = "arabic-elevenlabs"

    return {
        "ok": True,
        "whisper_model": SETTINGS.whisper_model,
        "tts_backend": SETTINGS.local_tts_backend,
        "tts_mode": tts_mode,
    }


@app.post("/synthesize")
async def synthesize_route(payload: SynthesizeRequest):
    try:
        result = await synthesize(
            payload.text,
            payload.language,
            transliteration=payload.transliteration,
        )
    except TtsError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return Response(content=result.audio_bytes, media_type=result.content_type)


def _load_audio_for_scoring(path: Path) -> tuple:
    try:
        return librosa.load(str(path), sr=16000, mono=True)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail="Audio decoding failed. Please retry with a short clear recording.",
        ) from exc


def _boost_quiet_signal(signal: np.ndarray) -> np.ndarray:
    if signal.size == 0:
        return signal.astype(np.float32, copy=False)

    signal32 = signal.astype(np.float32, copy=False)
    peak = float(np.max(np.abs(signal32)))
    if peak <= 0.0:
        return signal32

    rms = float(np.sqrt(np.mean(np.square(signal32))))
    target_peak = 0.92
    target_rms = 0.10

    clip_limited_gain = target_peak / peak
    if rms > 1e-8:
        loudness_gain = target_rms / rms
    else:
        loudness_gain = clip_limited_gain

    gain = min(clip_limited_gain, max(1.0, loudness_gain), 8.0)
    if gain <= 1.05:
        return signal32

    return np.clip(signal32 * gain, -0.98, 0.98).astype(np.float32, copy=False)


def _write_temp_wav(signal: np.ndarray, sample_rate: int) -> Path:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
        path = Path(temp_file.name)
    sf.write(path, signal, sample_rate, subtype="PCM_16")
    return path


def _convert_audio_to_scoring_wav(path: Path) -> Path:
    ffmpeg_command = resolve_ffmpeg_command()
    if not ffmpeg_command:
        raise HTTPException(
            status_code=500,
            detail="`ffmpeg` is required in PATH to decode microphone audio (webm/mp4).",
        )

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as converted_file:
        converted_path = Path(converted_file.name)

    convert = subprocess.run(
        [
            ffmpeg_command,
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(path),
            "-ar",
            "16000",
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            str(converted_path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    if convert.returncode != 0 or not converted_path.exists():
        converted_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=400,
            detail="Unsupported audio format. Try Chrome/Edge and allow microphone permissions.",
        )

    return converted_path


@app.post("/score")
async def score_route(
    audio: UploadFile = File(...),
    language: str = Form(...),
    target_text: str = Form(...),
    transliteration: str | None = Form(default=None),
):
    if language not in {"ar", "zh"}:
        raise HTTPException(status_code=400, detail="language must be ar or zh")

    suffix = Path(audio.filename or "attempt.webm").suffix or ".webm"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
        temp_path = Path(temp_file.name)
        data = await audio.read()
        temp_file.write(data)

    if not data:
        temp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="empty audio payload")

    try:
        prepared_audio_path = _convert_audio_to_scoring_wav(temp_path)
        boosted_audio_path: Path | None = None
        try:
            signal, sample_rate = _load_audio_for_scoring(prepared_audio_path)
            boosted_signal = _boost_quiet_signal(signal)
            signal = boosted_signal
            boosted_audio_path = _write_temp_wav(boosted_signal, int(sample_rate))

            duration_seconds = len(signal) / sample_rate if sample_rate else 0
            if duration_seconds > SETTINGS.max_upload_seconds:
                raise HTTPException(
                    status_code=400,
                    detail=f"audio too long; max {SETTINGS.max_upload_seconds} seconds",
                )

            stt = transcriber.transcribe(
                str(boosted_audio_path),
                language=language,
                target_text=target_text,
                transliteration=transliteration,
            )
            transcript = stt.transcript.strip() or ""

            if not transcript:
                raise HTTPException(status_code=400, detail="no speech recognized")

            result = evaluate_pronunciation(
                transcript=transcript,
                target_text=target_text,
                transliteration=transliteration,
                language=language,
                audio=signal,
                sr=sample_rate,
                avg_logprob=stt.avg_logprob,
            )

            return {
                "transcript": result.transcript,
                "score": result.score,
                "feedback": result.feedback,
                "confidence": result.confidence,
                "components": result.components,
            }
        finally:
            if boosted_audio_path is not None:
                boosted_audio_path.unlink(missing_ok=True)
            prepared_audio_path.unlink(missing_ok=True)
    finally:
        temp_path.unlink(missing_ok=True)
