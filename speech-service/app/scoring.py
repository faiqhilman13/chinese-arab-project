from __future__ import annotations

from dataclasses import dataclass

import librosa
import numpy as np
from pypinyin import Style, lazy_pinyin

from app.text_utils import normalize_text, similarity_score


@dataclass
class ScoreResult:
    transcript: str
    score: float
    confidence: str
    components: dict[str, float]
    feedback: str


def _safe_float(value: float) -> float:
    return float(max(0.0, min(100.0, value)))


def _fluency_score(audio: np.ndarray, sr: int, transcript: str) -> float:
    duration = max(len(audio) / sr, 1e-6)
    intervals = librosa.effects.split(audio, top_db=28)
    voiced_seconds = sum((end - start) / sr for start, end in intervals)
    pause_ratio = max(0.0, min(1.0, 1.0 - voiced_seconds / duration))

    token_count = max(1, len(transcript.strip().split()))
    words_per_sec = token_count / duration

    pace_score = 100.0 - min(50.0, abs(words_per_sec - 2.2) * 25.0)
    pause_score = 100.0 - min(45.0, pause_ratio * 90.0)

    return _safe_float(0.6 * pace_score + 0.4 * pause_score)


def _classify_tone(segment_pitch: np.ndarray) -> int:
    if segment_pitch.size < 6:
        return 5

    semitone = 12 * np.log2(np.maximum(segment_pitch, 1e-6) / np.median(segment_pitch))
    start = np.mean(semitone[: max(1, len(semitone) // 4)])
    end = np.mean(semitone[-max(1, len(semitone) // 4) :])
    mid = np.mean(semitone[len(semitone) // 3 : 2 * len(semitone) // 3])
    slope = end - start
    spread = np.std(semitone)

    if spread < 0.45:
        return 1
    if slope > 0.8:
        return 2
    if slope < -0.8:
        return 4
    if mid < min(start, end) - 0.5:
        return 3
    return 5


def _mandarin_tone_score(audio: np.ndarray, sr: int, target_text: str) -> float:
    pinyin = lazy_pinyin(
        target_text,
        style=Style.TONE3,
        neutral_tone_with_five=True,
        errors="ignore",
    )

    expected_tones: list[int] = []
    for syllable in pinyin:
        if not syllable:
            continue
        tone = int(syllable[-1]) if syllable[-1].isdigit() else 5
        expected_tones.append(tone)

    if not expected_tones:
        return 60.0

    f0, _, _ = librosa.pyin(audio, fmin=75, fmax=420, sr=sr)
    voiced = f0[~np.isnan(f0)]

    if voiced.size < 16:
        return 60.0

    chunks = np.array_split(voiced, len(expected_tones))
    predicted_tones = [_classify_tone(chunk) for chunk in chunks]

    exact = 0
    near = 0
    for expected, predicted in zip(expected_tones, predicted_tones):
        if expected == predicted:
            exact += 1
        elif {expected, predicted} in ({2, 3}, {3, 4}, {1, 5}):
            near += 1

    score = (exact + 0.8 * near) / len(expected_tones) * 100.0
    # Keep tone guidance meaningful but less punishing for beginner drills.
    return _safe_float(0.7 * score + 0.3 * 65.0)


def _arabic_specific_score(audio: np.ndarray, sr: int, target_text: str, avg_logprob: float) -> float:
    letters = [ch for ch in target_text if "\u0600" <= ch <= "\u06ff"]
    emphatics = {"ص", "ض", "ط", "ظ", "ق", "خ", "غ", "ع", "ح"}

    emphatic_ratio = (sum(1 for ch in letters if ch in emphatics) / max(len(letters), 1))

    spectral_centroid = librosa.feature.spectral_centroid(y=audio, sr=sr)
    centroid_mean = float(np.mean(spectral_centroid)) if spectral_centroid.size else 1800.0
    centroid_score = 100.0 - min(30.0, abs(centroid_mean - 1700.0) / 55.0)

    expected_emphasis_adjustment = 10.0 * emphatic_ratio
    confidence_score = np.interp(avg_logprob, [-1.8, -0.4], [45.0, 100.0])

    return _safe_float(0.35 * centroid_score + 0.5 * confidence_score + 0.15 * (70.0 + expected_emphasis_adjustment))


def evaluate_pronunciation(
    transcript: str,
    target_text: str,
    transliteration: str | None,
    language: str,
    audio: np.ndarray,
    sr: int,
    avg_logprob: float,
) -> ScoreResult:
    norm_transcript = normalize_text(transcript)
    norm_target = normalize_text(target_text)
    norm_translit = normalize_text(transliteration or "")

    intelligibility = similarity_score(norm_transcript, norm_target)
    if norm_translit:
        intelligibility = max(intelligibility, similarity_score(norm_transcript, norm_translit))

    fluency = _fluency_score(audio=audio, sr=sr, transcript=transcript)

    confidence = "high" if avg_logprob > -0.8 else "medium" if avg_logprob > -1.25 else "low"

    if language == "zh":
        language_specific = _mandarin_tone_score(audio=audio, sr=sr, target_text=target_text)
        components = {
            "intelligibility": round(intelligibility, 2),
            "fluency": round(fluency, 2),
            "tone": round(language_specific, 2),
        }
        overall = 0.65 * intelligibility + 0.2 * fluency + 0.15 * language_specific
    else:
        language_specific = _arabic_specific_score(
            audio=audio,
            sr=sr,
            target_text=target_text,
            avg_logprob=avg_logprob,
        )
        components = {
            "intelligibility": round(intelligibility, 2),
            "fluency": round(fluency, 2),
            "arabic_phonology": round(language_specific, 2),
        }
        overall = 0.65 * intelligibility + 0.2 * fluency + 0.15 * language_specific

    if intelligibility >= 95 and confidence == "high":
        overall = max(overall, 90.0)
    elif intelligibility >= 90 and confidence in {"high", "medium"}:
        overall = max(overall, 84.0)
    elif intelligibility >= 80 and confidence == "high":
        overall = max(overall, 76.0)

    score = _safe_float(round(overall, 2))

    if intelligibility < 60:
        feedback = "Transcript mismatch is high. Repeat slowly and match each syllable."
    elif score >= 88:
        feedback = "Clear and natural delivery. Keep this pace and articulation."
    elif score >= 72:
        feedback = "Good pronunciation. Focus on cleaner rhythm and target sounds."
    elif score >= 56:
        feedback = "Understandable but inconsistent. Slow down and repeat in short chunks."
    else:
        feedback = "Needs more repetition. Listen once, then imitate with slower pacing."

    return ScoreResult(
        transcript=transcript,
        score=score,
        confidence=confidence,
        components=components,
        feedback=feedback,
    )
