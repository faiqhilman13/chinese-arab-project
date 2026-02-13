from __future__ import annotations

import io
import json
import subprocess
import tempfile
import threading
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path
from urllib import error as urlerror
from urllib import request as urlrequest

import numpy as np
import soundfile as sf

from app.config import SETTINGS
from app.ffmpeg import resolve_ffmpeg_command


class TtsError(RuntimeError):
    pass


@dataclass
class SynthesisResult:
    audio_bytes: bytes
    content_type: str


def _boost_arabic_tts_loudness(audio_bytes: bytes, language: str) -> bytes:
    if language != "ar":
        return audio_bytes

    try:
        signal, sample_rate = sf.read(io.BytesIO(audio_bytes), dtype="float32")
    except Exception:
        return audio_bytes

    if signal.size == 0:
        return audio_bytes

    peak = float(np.max(np.abs(signal)))
    if peak <= 0.0:
        return audio_bytes

    rms = float(np.sqrt(np.mean(np.square(signal))))
    target_peak = 0.95
    target_rms = 0.14

    clip_limited_gain = target_peak / peak
    if rms > 1e-8:
        loudness_gain = target_rms / rms
    else:
        loudness_gain = clip_limited_gain

    gain = min(clip_limited_gain, max(1.0, loudness_gain), 6.0)
    if gain <= 1.05:
        return audio_bytes

    boosted = np.clip(signal * gain, -0.98, 0.98).astype(np.float32, copy=False)
    out = io.BytesIO()
    sf.write(out, boosted, sample_rate, format="WAV", subtype="PCM_16")
    return out.getvalue()


def _assert_not_near_silent_wav(audio_bytes: bytes, backend: str, language: str) -> None:
    if language != "ar":
        return

    try:
        signal, _ = sf.read(io.BytesIO(audio_bytes), dtype="float32")
    except Exception:
        return

    if signal.size == 0:
        raise TtsError(f"{backend} produced empty WAV audio.")

    if signal.ndim > 1:
        signal = np.mean(signal, axis=1)

    peak = float(np.max(np.abs(signal)))
    rms = float(np.sqrt(np.mean(np.square(signal))))

    # Guardrail for unusably quiet Arabic clips (observed with some ElevenLabs
    # voice/text combinations): fail this backend so auto mode can fall back.
    if peak < 0.02 or rms < 0.001:
        raise TtsError(
            f"{backend} produced near-silent Arabic audio (peak={peak:.4f}, rms={rms:.4f})."
        )


def _convert_to_wav(source_path: Path) -> bytes:
    """Convert any ffmpeg-readable audio file to 24 kHz mono PCM WAV."""
    ffmpeg_command = resolve_ffmpeg_command()
    if not ffmpeg_command:
        raise TtsError("`ffmpeg` is required in PATH for this TTS backend.")

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as wav_file:
        wav_path = Path(wav_file.name)

    try:
        convert = subprocess.run(
            [
                ffmpeg_command,
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
                f"Failed to convert audio to WAV: {convert.stderr.strip() or convert.stdout.strip()}"
            )

        audio = wav_path.read_bytes()
        if not audio:
            raise TtsError("Converted WAV is empty.")
        return audio
    finally:
        wav_path.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# ArTST (MBZUAI SpeechT5) - lazy-loaded Arabic TTS
# ---------------------------------------------------------------------------
_artst_processor = None
_artst_model = None
_artst_vocoder = None
_artst_speaker_embeddings = None

_qwen_model = None
_qwen_model_lock = threading.Lock()

_synthesis_cache: OrderedDict[str, SynthesisResult] = OrderedDict()
_synthesis_cache_lock = threading.Lock()
_SYNTHESIS_CACHE_MAX_ITEMS = 512


def _elevenlabs_enabled() -> bool:
    return bool(SETTINGS.elevenlabs_api_key and SETTINGS.elevenlabs_ar_voice_id)


def _format_elevenlabs_error(payload: bytes) -> str:
    if not payload:
        return "Unknown ElevenLabs error."

    try:
        decoded = payload.decode("utf-8", errors="replace")
        body = json.loads(decoded)
    except Exception:
        return payload.decode("utf-8", errors="replace").strip() or "Unknown ElevenLabs error."

    if isinstance(body, dict):
        detail = body.get("detail")
        if isinstance(detail, str):
            return detail
        if isinstance(detail, dict):
            status = detail.get("status")
            message = detail.get("message")
            if isinstance(status, str) and isinstance(message, str):
                return f"{status}: {message}"
            return json.dumps(detail)

    return json.dumps(body)


def _load_artst():
    """Lazy-load ArTST model, vocoder, and speaker embeddings on first call."""
    global _artst_processor, _artst_model, _artst_vocoder, _artst_speaker_embeddings

    if _artst_processor is not None:
        return

    import torch
    from datasets import load_dataset
    from transformers import SpeechT5ForTextToSpeech, SpeechT5HifiGan, SpeechT5Processor

    model_id = SETTINGS.artst_model
    _artst_processor = SpeechT5Processor.from_pretrained(model_id)
    _artst_model = SpeechT5ForTextToSpeech.from_pretrained(model_id)
    _artst_vocoder = SpeechT5HifiGan.from_pretrained("microsoft/speecht5_hifigan")

    xvector_ds = load_dataset("herwoww/arabic_xvector_embeddings", split="validation")
    _artst_speaker_embeddings = torch.tensor(xvector_ds[0]["speaker_embeddings"]).unsqueeze(0)


async def _synthesize_with_artst(text: str, language: str) -> SynthesisResult:
    if language != "ar":
        raise TtsError("LOCAL_TTS_BACKEND=artst only supports Arabic (`ar`).")

    try:
        _load_artst()
    except Exception as exc:
        raise TtsError(f"ArTST model failed to load: {exc}") from exc

    import torch

    inputs = _artst_processor(text=text, return_tensors="pt")

    with torch.no_grad():
        speech = _artst_model.generate_speech(
            inputs["input_ids"],
            _artst_speaker_embeddings,
            vocoder=_artst_vocoder,
        )

    wav_array = speech.cpu().numpy()
    if wav_array.size == 0:
        raise TtsError("ArTST TTS generation returned no audio.")

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
        wav_path = Path(temp_file.name)

    try:
        # SpeechT5 outputs 16 kHz; _convert_to_wav resamples to 24 kHz mono.
        sf.write(wav_path, wav_array, 16000, subtype="PCM_16")
        audio = _convert_to_wav(wav_path)
        if not audio:
            raise TtsError("ArTST TTS produced empty audio.")
        return SynthesisResult(audio_bytes=audio, content_type="audio/wav")
    finally:
        wav_path.unlink(missing_ok=True)


async def _synthesize_with_qwen(text: str, language: str) -> SynthesisResult:
    if language != "zh":
        raise TtsError("LOCAL_TTS_BACKEND=qwen only supports Mandarin (`zh`).")

    model = _load_qwen_model()
    try:
        wav, sample_rate = model.generate_voice_design(
            text=text,
            language="chinese",
            instruct="calm female voice",
        )
    except ValueError as exc:
        raise TtsError(str(exc)) from exc

    if wav is None or len(wav) == 0:
        raise TtsError("Qwen TTS generation returned no audio.")

    wav_array = np.asarray(wav[0], dtype=np.float32)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
        wav_path = Path(temp_file.name)

    try:
        sf.write(wav_path, wav_array, int(sample_rate), subtype="PCM_16")
        audio = _convert_to_wav(wav_path)
        if not audio:
            raise TtsError("Qwen TTS produced empty audio.")
        return SynthesisResult(audio_bytes=audio, content_type="audio/wav")
    finally:
        wav_path.unlink(missing_ok=True)


async def _synthesize_with_elevenlabs(text: str, language: str) -> SynthesisResult:
    if language != "ar":
        raise TtsError("LOCAL_TTS_BACKEND=elevenlabs only supports Arabic (`ar`).")

    api_key = SETTINGS.elevenlabs_api_key
    voice_id = SETTINGS.elevenlabs_ar_voice_id
    if not api_key or not voice_id:
        raise TtsError(
            "ElevenLabs backend requires ELEVENLABS_API_KEY and ELEVENLABS_AR_VOICE_ID."
        )

    endpoint = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    payload = {
        "text": text,
        "model_id": SETTINGS.elevenlabs_model_id,
    }
    request_data = json.dumps(payload).encode("utf-8")
    request = urlrequest.Request(
        endpoint,
        data=request_data,
        method="POST",
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
    )

    try:
        with urlrequest.urlopen(request, timeout=SETTINGS.elevenlabs_timeout_seconds) as response:
            audio_bytes = response.read()
    except urlerror.HTTPError as exc:
        detail = _format_elevenlabs_error(exc.read())
        raise TtsError(f"ElevenLabs request failed ({exc.code}): {detail}") from exc
    except urlerror.URLError as exc:
        raise TtsError(f"ElevenLabs request failed: {exc.reason}") from exc
    except Exception as exc:
        raise TtsError(f"ElevenLabs request failed: {exc}") from exc

    if not audio_bytes:
        raise TtsError("ElevenLabs returned empty audio.")

    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_file:
        mp3_path = Path(temp_file.name)
        temp_file.write(audio_bytes)

    try:
        wav_audio = _convert_to_wav(mp3_path)
        if not wav_audio:
            raise TtsError("ElevenLabs audio conversion failed.")
        return SynthesisResult(audio_bytes=wav_audio, content_type="audio/wav")
    finally:
        mp3_path.unlink(missing_ok=True)


def _load_qwen_model():
    global _qwen_model

    if _qwen_model is not None:
        return _qwen_model

    with _qwen_model_lock:
        if _qwen_model is not None:
            return _qwen_model

        try:
            from qwen_tts.inference.qwen3_tts_model import Qwen3TTSModel
        except Exception as exc:
            raise TtsError("Qwen TTS backend selected but `qwen-tts` is not installed.") from exc

        _qwen_model = Qwen3TTSModel.from_pretrained(SETTINGS.qwen_tts_model)
        return _qwen_model


def _synthesis_cache_key(backend: str, language: str, text: str) -> str:
    return f"{backend}|{language}|{text}"


def _read_cached_synthesis(cache_key: str) -> SynthesisResult | None:
    with _synthesis_cache_lock:
        cached = _synthesis_cache.get(cache_key)
        if cached is None:
            return None
        _synthesis_cache.move_to_end(cache_key)
        return cached


def _write_cached_synthesis(cache_key: str, result: SynthesisResult) -> None:
    with _synthesis_cache_lock:
        _synthesis_cache[cache_key] = result
        _synthesis_cache.move_to_end(cache_key)
        if len(_synthesis_cache) > _SYNTHESIS_CACHE_MAX_ITEMS:
            _synthesis_cache.popitem(last=False)


def _resolve_auto_backends(language: str) -> list[str]:
    if language == "zh":
        return ["qwen"]
    if language == "ar":
        if _elevenlabs_enabled():
            return ["elevenlabs", "artst"]
        return ["artst"]

    raise TtsError(f"Unsupported language '{language}'.")


def _resolve_backends(language: str) -> list[str]:
    configured = SETTINGS.local_tts_backend.lower()

    if configured == "auto":
        return _resolve_auto_backends(language)

    if configured not in {"qwen", "artst", "elevenlabs"}:
        raise TtsError("LOCAL_TTS_BACKEND must be one of: auto, qwen, artst, elevenlabs.")

    if configured == "qwen" and language != "zh":
        raise TtsError("LOCAL_TTS_BACKEND=qwen only supports Mandarin (`zh`).")

    if configured == "artst" and language != "ar":
        raise TtsError("LOCAL_TTS_BACKEND=artst only supports Arabic (`ar`).")

    if configured == "elevenlabs" and language != "ar":
        raise TtsError("LOCAL_TTS_BACKEND=elevenlabs only supports Arabic (`ar`).")

    return [configured]


async def _run_backend(backend: str, text: str, language: str) -> SynthesisResult:
    if backend == "artst":
        return await _synthesize_with_artst(text=text, language=language)
    if backend == "qwen":
        return await _synthesize_with_qwen(text=text, language=language)
    if backend == "elevenlabs":
        return await _synthesize_with_elevenlabs(text=text, language=language)
    raise TtsError(f"Unsupported backend '{backend}'.")


async def synthesize(
    text: str,
    language: str,
    transliteration: str | None = None,
) -> SynthesisResult:
    """Synthesize *text* using configured TTS backends."""
    del transliteration

    backends = _resolve_backends(language)
    errors: list[str] = []

    for backend in backends:
        cache_key = _synthesis_cache_key(backend=backend, language=language, text=text)
        cached = _read_cached_synthesis(cache_key)
        if cached is not None:
            return cached

        try:
            result = await _run_backend(
                backend=backend,
                text=text,
                language=language,
            )
            if result.content_type == "audio/wav":
                _assert_not_near_silent_wav(
                    audio_bytes=result.audio_bytes,
                    backend=backend,
                    language=language,
                )
            if backend == "artst" and result.content_type == "audio/wav":
                result = SynthesisResult(
                    audio_bytes=_boost_arabic_tts_loudness(
                        audio_bytes=result.audio_bytes,
                        language=language,
                    ),
                    content_type=result.content_type,
                )
            _write_cached_synthesis(cache_key, result)
            return result
        except TtsError as exc:
            errors.append(f"{backend}: {exc}")

    raise TtsError("No TTS backend succeeded. " + " | ".join(errors))


def warmup_models_for_language(language: str) -> None:
    backends = _resolve_backends(language)
    for backend in backends:
        if backend == "qwen":
            _load_qwen_model()
        elif backend == "artst":
            _load_artst()
