from __future__ import annotations

import tempfile
from pathlib import Path

import librosa
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.config import SETTINGS
from app.scoring import evaluate_pronunciation
from app.stt import transcriber
from app.tts import TtsError, synthesize

app = FastAPI(title="Local Speech Service", version="0.1.0")


class SynthesizeRequest(BaseModel):
    language: str = Field(pattern="^(ar|zh)$")
    text: str = Field(min_length=1, max_length=240)
    transliteration: str | None = None


@app.get("/health")
def health():
    return {
        "ok": True,
        "whisper_model": SETTINGS.whisper_model,
        "tts_backend": SETTINGS.local_tts_backend,
    }


@app.post("/synthesize")
def synthesize_route(payload: SynthesizeRequest):
    try:
        result = synthesize(payload.text, payload.language)
    except TtsError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return Response(content=result.audio_bytes, media_type=result.content_type)


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
        signal, sample_rate = librosa.load(str(temp_path), sr=16000, mono=True)

        duration_seconds = len(signal) / sample_rate if sample_rate else 0
        if duration_seconds > SETTINGS.max_upload_seconds:
            raise HTTPException(
                status_code=400,
                detail=f"audio too long; max {SETTINGS.max_upload_seconds} seconds",
            )

        stt = transcriber.transcribe(
            str(temp_path),
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
        temp_path.unlink(missing_ok=True)
