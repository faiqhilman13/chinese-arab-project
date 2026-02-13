# 2-Week Roadmap: Speech Quality and Latency

## Objective

Improve pronunciation drill reliability and responsiveness for Arabic MSA and Mandarin while keeping speech processing local-only.

## Scope

### In scope

1. STT reliability for short phrase drills.
2. Pronunciation score fairness and explainability.
3. End-to-end latency tracking.
4. Better local-backend readiness and error UX.

### Out of scope

1. Multi-user architecture changes.
2. Large curriculum expansion.
3. Full phoneme-level coaching engine.
4. Cloud speech providers.

## Week 1: Accuracy and Observability

### Milestone 1A: Transcript reliability baseline

1. Build a smoke set (`scripts/benchmark/smoke-set.json`) for `zh` and `ar`.
2. Run benchmark with `npm run speech:benchmark`.
3. Record exact/near transcript match and fallback frequency.

Acceptance:

1. `docs/benchmark-baseline.md` committed.
2. Exact-or-near transcript match >= 85% on smoke set.

### Milestone 1B: Score explainability

1. Keep voice responses returning:
   1. `transcript`,
   2. `score`,
   3. `confidence`,
   4. `components`.
2. Keep transcript-first feedback when mismatch drives score down.

Acceptance:

1. Every voice drill response includes component breakdown.
2. User can distinguish mismatch vs pacing/tone issues.

### Milestone 1C: Local TTS readiness checks

1. Confirm local backend selection is deterministic (`auto`/`say`/`qwen`/`espeak`).
2. Provide actionable errors when no local backend is available.

Acceptance:

1. No silent cloud fallback.
2. Errors point to concrete setup actions (`ffmpeg`, `espeak-ng`, backend switch).

## Week 2: Latency and Robustness

### Milestone 2A: Warm-path latency optimization

1. Tune whisper and fallback settings without reintroducing decode bias.
2. Reduce client capture overhead (silence stop, max duration).

Acceptance:

1. Warm-path p50 <= 1.5s.
2. Warm-path p95 <= 3.0s.
3. Transcript quality does not drop below week-1 baseline.

### Milestone 2B: Failure UX

1. Show backend health before drills.
2. Make daily/monthly limit and microphone errors explicit.
3. Keep first-run warm-up hints.

Acceptance:

1. No silent target-audio or scoring failures.
2. Each error class maps to user-readable instruction.

### Milestone 2C: Regression checks

1. Functional smoke:
   1. auth/login,
   2. target playback,
   3. speak + score,
   4. limit enforcement,
   5. local backend unavailable behavior.
2. Technical checks:
   1. `npm run lint`,
   2. `npm run typecheck`,
   3. `npm run build`.

Acceptance:

1. Smoke checks pass.
2. No new build/type/lint failures.
