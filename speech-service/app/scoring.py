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


# ---------------------------------------------------------------------------
# Fluency
# ---------------------------------------------------------------------------

def _count_tokens(transcript: str, language: str) -> int:
    """Return a syllable/word count appropriate for the language."""
    if language == "zh":
        # Count CJK characters as individual syllables.
        cjk = sum(1 for ch in transcript if "\u4e00" <= ch <= "\u9fff")
        return max(1, cjk) if cjk else max(1, len(transcript.strip().split()))
    return max(1, len(transcript.strip().split()))


def _fluency_score(audio: np.ndarray, sr: int, transcript: str, language: str) -> float:
    duration = max(len(audio) / sr, 1e-6)
    intervals = librosa.effects.split(audio, top_db=28)
    voiced_seconds = sum((end - start) / sr for start, end in intervals)
    pause_ratio = max(0.0, min(1.0, 1.0 - voiced_seconds / duration))

    token_count = _count_tokens(transcript, language)
    tokens_per_sec = token_count / duration

    # Target pace differs: Mandarin ~3.5-4 syllables/sec, Arabic ~2.2 words/sec.
    target_pace = 3.8 if language == "zh" else 2.2
    pace_score = 100.0 - min(50.0, abs(tokens_per_sec - target_pace) * 25.0)
    pause_score = 100.0 - min(45.0, pause_ratio * 90.0)

    return _safe_float(0.6 * pace_score + 0.4 * pause_score)


# ---------------------------------------------------------------------------
# Mandarin tone detection
# ---------------------------------------------------------------------------

def _classify_tone(segment_pitch: np.ndarray) -> int:
    if segment_pitch.size < 6:
        return 5

    semitone = 12 * np.log2(np.maximum(segment_pitch, 1e-6) / np.median(segment_pitch))
    quarter = max(1, len(semitone) // 4)
    start = np.mean(semitone[:quarter])
    end = np.mean(semitone[-quarter:])
    mid = np.mean(semitone[len(semitone) // 3 : 2 * len(semitone) // 3])
    slope = end - start
    spread = np.std(semitone)

    if spread < 0.45:
        return 1  # high-flat
    if slope > 0.8:
        return 2  # rising
    if slope < -0.8:
        return 4  # falling
    if mid < min(start, end) - 0.5:
        return 3  # dipping
    return 5  # neutral


def _segment_by_onsets(audio: np.ndarray, sr: int, n_segments: int) -> list[tuple[int, int]]:
    """Split audio into *n_segments* using onset detection.

    Falls back to equal-duration splitting when onset detection cannot
    produce enough boundaries.
    """
    total = len(audio)

    if n_segments <= 1:
        return [(0, total)]

    onset_env = librosa.onset.onset_strength(y=audio, sr=sr)
    onset_frames = librosa.onset.onset_detect(
        onset_envelope=onset_env,
        sr=sr,
        backtrack=True,
    )
    onset_samples = librosa.frames_to_samples(onset_frames, hop_length=512)
    # Keep only onsets that are far enough apart (~60 ms minimum gap).
    min_gap = int(sr * 0.06)
    filtered: list[int] = []
    for s in onset_samples:
        if not filtered or s - filtered[-1] >= min_gap:
            filtered.append(int(s))

    if len(filtered) >= n_segments - 1:
        boundaries = [0] + filtered[: n_segments - 1] + [total]
    else:
        # Not enough onsets detected; equal-duration fallback.
        boundaries = [int(i * total / n_segments) for i in range(n_segments + 1)]

    return [(boundaries[i], boundaries[i + 1]) for i in range(len(boundaries) - 1)]


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

    n_syllables = len(expected_tones)
    segments = _segment_by_onsets(audio, sr, n_syllables)

    predicted_tones: list[int] = []
    for start, end in segments:
        seg = audio[start:end]
        if len(seg) < int(sr * 0.05):
            predicted_tones.append(5)
            continue
        f0, _, _ = librosa.pyin(seg, fmin=75, fmax=420, sr=sr)
        voiced = f0[~np.isnan(f0)]
        predicted_tones.append(_classify_tone(voiced))

    exact = 0
    near = 0
    total = min(len(expected_tones), len(predicted_tones))
    for i in range(total):
        if expected_tones[i] == predicted_tones[i]:
            exact += 1
        elif {expected_tones[i], predicted_tones[i]} in ({2, 3}, {3, 4}, {1, 5}):
            near += 1

    if total == 0:
        return 60.0

    score = (exact + 0.8 * near) / total * 100.0
    # Keep tone guidance meaningful but less punishing for beginner drills.
    return _safe_float(0.7 * score + 0.3 * 65.0)


# ---------------------------------------------------------------------------
# Main evaluation
# ---------------------------------------------------------------------------

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

    confidence = "high" if avg_logprob > -0.8 else "medium" if avg_logprob > -1.25 else "low"

    if language == "zh":
        fluency = _fluency_score(audio=audio, sr=sr, transcript=transcript, language="zh")
        tone = _mandarin_tone_score(audio=audio, sr=sr, target_text=target_text)
        components = {
            "intelligibility": round(intelligibility, 2),
            "fluency": round(fluency, 2),
            "tone": round(tone, 2),
        }
        # 60% intelligibility, 20% fluency, 20% tone (tone weight increased
        # now that detection uses onset-based segmentation).
        overall = 0.60 * intelligibility + 0.20 * fluency + 0.20 * tone
    else:
        # Arabic: no reliable acoustic phonology scorer exists with these
        # tools, so score honestly on intelligibility + fluency only.
        fluency = _fluency_score(audio=audio, sr=sr, transcript=transcript, language="ar")
        components = {
            "intelligibility": round(intelligibility, 2),
            "fluency": round(fluency, 2),
        }
        overall = 0.75 * intelligibility + 0.25 * fluency

    # Confidence guardrails: prevent edge-case collapses when one component
    # scores low due to noise but the transcript clearly matches.
    if intelligibility >= 95 and confidence == "high":
        overall = max(overall, 88.0)
    elif intelligibility >= 90 and confidence == "high":
        overall = max(overall, 80.0)

    score = _safe_float(round(overall, 2))

    # ----- Feedback -----
    if intelligibility < 50:
        feedback = "The transcription doesn't match. Listen to the model audio and repeat slowly, syllable by syllable."
    elif intelligibility < 70:
        feedback = "Partially recognised. Slow down and focus on each sound individually."
    elif score >= 88:
        feedback = "Clear and natural delivery. Keep this pace and articulation."
    elif score >= 72:
        feedback = "Good pronunciation. Focus on cleaner rhythm and target sounds."
    elif score >= 56:
        feedback = "Understandable but inconsistent. Slow down and repeat in short chunks."
    else:
        feedback = "Needs more repetition. Listen once, then imitate with slower pacing."

    # Add language-specific guidance.
    if language == "zh" and tone < 55:
        feedback += " Pay extra attention to the tones for each syllable."
    elif language == "ar" and intelligibility < 80:
        feedback += " Make sure to distinguish emphatic sounds and throat letters clearly."

    return ScoreResult(
        transcript=transcript,
        score=score,
        confidence=confidence,
        components=components,
        feedback=feedback,
    )
