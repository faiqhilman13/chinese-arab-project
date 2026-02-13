from __future__ import annotations

from dataclasses import dataclass

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
        self.model = WhisperModel(
            SETTINGS.whisper_model,
            device=SETTINGS.whisper_device,
            compute_type=SETTINGS.whisper_compute_type,
        )

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
            segments, info = self.model.transcribe(
                audio_path,
                hotwords=hotwords,
                **kwargs,
            )
        except TypeError:
            # Older faster-whisper builds may not support hotwords.
            segments, info = self.model.transcribe(audio_path, **kwargs)

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
        hotword_bits = [target_text.strip()]
        if transliteration:
            hotword_bits.append(transliteration.strip())
        hotwords = ", ".join(bit for bit in hotword_bits if bit)

        target_norm = normalize_text(target_text)
        translit_norm = normalize_text(transliteration or "")

        primary = self._decode_once(
            audio_path=audio_path,
            language=language,
            initial_prompt=target_text,
            hotwords=hotwords,
            beam_size=SETTINGS.whisper_beam_size,
            best_of=SETTINGS.whisper_best_of,
            vad_filter=True,
        )
        primary_quality = self._quality(primary, target_norm=target_norm, translit_norm=translit_norm)

        # Fast path: most short drills should finish in a single decode.
        if primary_quality >= SETTINGS.whisper_fast_threshold and primary.avg_logprob > -1.25:
            return primary

        fallback = self._decode_once(
            audio_path=audio_path,
            language=None,
            initial_prompt=target_text,
            hotwords=hotwords,
            beam_size=SETTINGS.whisper_fallback_beam_size,
            best_of=SETTINGS.whisper_fallback_best_of,
            vad_filter=False,
        )

        fallback_quality = self._quality(fallback, target_norm=target_norm, translit_norm=translit_norm)
        return fallback if fallback_quality > primary_quality else primary


transcriber = WhisperTranscriber()
