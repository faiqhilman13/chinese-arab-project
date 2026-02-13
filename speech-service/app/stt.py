from __future__ import annotations

from dataclasses import dataclass
from threading import Lock

from faster_whisper import WhisperModel

from app.config import SETTINGS
from app.text_utils import normalize_text, similarity_score


@dataclass
class TranscriptionResult:
    transcript: str
    avg_logprob: float
    language: str


class WhisperTranscriber:
    def __init__(self) -> None:
        self._models: dict[str, WhisperModel] = {}
        self._model_lock = Lock()

    def _model_name_for_language(self, language: str | None) -> str:
        if language == "zh":
            return SETTINGS.whisper_model_zh
        return SETTINGS.whisper_model

    def _get_model(self, language: str | None) -> WhisperModel:
        model_name = self._model_name_for_language(language)
        existing = self._models.get(model_name)
        if existing is not None:
            return existing

        with self._model_lock:
            existing = self._models.get(model_name)
            if existing is not None:
                return existing

            model = WhisperModel(
                model_name,
                device=SETTINGS.whisper_device,
                compute_type=SETTINGS.whisper_compute_type,
            )
            self._models[model_name] = model
            return model

    def warmup(self, language: str) -> None:
        self._get_model(language)

    def _decode_once(
        self,
        audio_path: str,
        language: str | None,
        initial_prompt: str | None,
        hotwords: str | None,
        beam_size: int,
        best_of: int,
        vad_filter: bool,
    ) -> TranscriptionResult:
        model = self._get_model(language)
        kwargs = {
            "language": language,
            "beam_size": beam_size,
            "best_of": best_of,
            "vad_filter": vad_filter,
            "condition_on_previous_text": False,
            "word_timestamps": False,
            "temperature": 0.0,
            "initial_prompt": initial_prompt,
        }

        try:
            segments, info = model.transcribe(
                audio_path,
                hotwords=hotwords,
                **kwargs,
            )
        except TypeError:
            # Older faster-whisper builds may not support hotwords.
            segments, info = model.transcribe(audio_path, **kwargs)

        texts: list[str] = []
        logprobs: list[float] = []

        for segment in segments:
            text = (segment.text or "").strip()
            if text:
                texts.append(text)
            if segment.avg_logprob is not None:
                logprobs.append(float(segment.avg_logprob))

        transcript = " ".join(texts).strip()
        avg_logprob = sum(logprobs) / len(logprobs) if logprobs else -1.2

        return TranscriptionResult(
            transcript=transcript,
            avg_logprob=avg_logprob,
            language=info.language,
        )

    @staticmethod
    def _quality(
        candidate: TranscriptionResult,
        target_norm: str,
        translit_norm: str,
    ) -> float:
        transcript_norm = normalize_text(candidate.transcript)
        text_match = similarity_score(transcript_norm, target_norm)
        if translit_norm:
            text_match = max(text_match, similarity_score(transcript_norm, translit_norm))
        logprob_score = max(0.0, min(100.0, (candidate.avg_logprob + 2.0) / 1.8 * 100))
        return 0.75 * text_match + 0.25 * logprob_score

    def transcribe(
        self,
        audio_path: str,
        language: str,
        target_text: str,
        transliteration: str | None,
    ) -> TranscriptionResult:
        is_mandarin = language == "zh"
        target_norm = normalize_text(target_text)
        translit_norm = normalize_text(transliteration or "")

        primary_beam_size = SETTINGS.whisper_zh_beam_size if is_mandarin else SETTINGS.whisper_beam_size
        primary_best_of = SETTINGS.whisper_zh_best_of if is_mandarin else SETTINGS.whisper_best_of
        primary_vad = SETTINGS.whisper_zh_vad_filter if is_mandarin else True
        fast_threshold = SETTINGS.whisper_zh_fast_threshold if is_mandarin else SETTINGS.whisper_fast_threshold

        fallback_beam_size = (
            SETTINGS.whisper_zh_fallback_beam_size
            if is_mandarin
            else SETTINGS.whisper_fallback_beam_size
        )
        fallback_best_of = (
            SETTINGS.whisper_zh_fallback_best_of
            if is_mandarin
            else SETTINGS.whisper_fallback_best_of
        )

        # Primary decode: language hint only, no target-text conditioning.
        # This avoids biasing Whisper toward the expected answer so the
        # transcription reflects what the user actually said.
        primary = self._decode_once(
            audio_path=audio_path,
            language=language,
            initial_prompt=None,
            hotwords=None,
            beam_size=primary_beam_size,
            best_of=primary_best_of,
            vad_filter=primary_vad,
        )
        primary_quality = self._quality(primary, target_norm=target_norm, translit_norm=translit_norm)

        if primary_quality >= fast_threshold and primary.avg_logprob > -1.25:
            return primary

        # Mandarin speed path: skip global-language fallback unless primary was empty.
        if is_mandarin and SETTINGS.whisper_zh_skip_quality_fallback and primary.transcript:
            return primary

        # Fallback decode: still avoid target-text conditioning. We only relax
        # the language constraint and decode settings to recover harder clips.
        fallback = self._decode_once(
            audio_path=audio_path,
            language=language if is_mandarin else None,
            initial_prompt=None,
            hotwords=None,
            beam_size=fallback_beam_size,
            best_of=fallback_best_of,
            vad_filter=False,
        )

        fallback_quality = self._quality(fallback, target_norm=target_norm, translit_norm=translit_norm)
        best = fallback if fallback_quality > primary_quality else primary
        if best.transcript:
            return best

        rescue = self._decode_once(
            audio_path=audio_path,
            language=language,
            initial_prompt=None,
            hotwords=None,
            beam_size=fallback_beam_size,
            best_of=fallback_best_of,
            vad_filter=False,
        )
        return rescue if rescue.transcript else best


transcriber = WhisperTranscriber()
