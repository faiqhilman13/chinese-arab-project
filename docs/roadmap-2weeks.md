# 2-Week Roadmap: Speech Quality and Latency

## Objective
Improve pronunciation drill reliability and responsiveness for Arabic MSA and Mandarin, with a practical user-facing target of 1-3 seconds after speech completion on warm paths.

## Scope

### In scope
1. STT reliability for short phrase drills.
2. Pronunciation score fairness and explainability.
3. End-to-end latency tuning and visibility.
4. Better UI handling for backend readiness/errors.

### Out of scope
1. Multi-user architecture changes.
2. Large curriculum/content expansion.
3. Full phoneme-level coaching engine.
4. Cloud deployment/scale optimization.

## Week 1: Accuracy and Observability

## Milestone 1A: Transcript reliability baseline
1. Build a small internal smoke set of short target phrases (`zh` and `ar`) with expected transcript output.
2. Run repeated evaluate tests and capture exact/near match rate.
3. Log decoding path taken (`fast` vs `fallback`) per request in speech worker logs.

### Acceptance criteria
1. Baseline report exists in repo (`docs/benchmark-baseline.md` or appendix section).
2. Exact-or-near transcript match >= 85% on smoke set before week 1 closes.

## Milestone 1B: Score explainability
1. Ensure API responses consistently include:
   1. `transcript`,
   2. `score`,
   3. `confidence`,
   4. `components`.
2. Add UI helper copy clarifying that transcript mismatch is the first failure cause.

### Acceptance criteria
1. Every voice drill response includes component-level breakdown.
2. User can distinguish “STT mismatch” vs “pronunciation quality” from response text.

## Milestone 1C: Basic latency instrumentation
1. Add timing logs in local speech service for:
   1. audio load,
   2. STT decode,
   3. scoring,
   4. total request.
2. Add a reproducible benchmark command section in docs.

### Acceptance criteria
1. Timing logs visible in worker output with stable key names.
2. p50/p95 can be computed from log export without code edits.

## Week 2: Latency and Robustness

## Milestone 2A: Warm-path latency optimization
1. Tune whisper defaults for fast path:
   1. model size,
   2. beam/best-of,
   3. fast-threshold.
2. Keep fallback decode for low-confidence paths only.
3. Minimize client-side capture overhead (early silence stop and short max duration).

### Acceptance criteria
1. Warm-path p50 <= 1.5s.
2. Warm-path p95 <= 3.0s.
3. No measurable drop below 85% transcript exact-or-near baseline.

## Milestone 2B: Readiness and failure UX
1. Show backend online/offline status before running drills.
2. Ensure actionable errors for:
   1. backend unreachable,
   2. daily/monthly limits,
   3. missing microphone permissions.
3. Add “warming up” guidance for first-call slowness.

### Acceptance criteria
1. No silent failures during target playback or scoring.
2. Each error class maps to a user-readable instruction.

## Milestone 2C: Regression checks
1. Run functional smoke checklist:
   1. auth/login,
   2. review card playback,
   3. speak and score,
   4. limit enforcement,
   5. offline behavior.
2. Run technical checks:
   1. `npm run lint`,
   2. `npm run typecheck`,
   3. `npm run build`.

### Acceptance criteria
1. All smoke checks pass.
2. No new build/type/lint errors.

## Task Backlog by Priority

1. Add structured latency logging in `speech-service/app/main.py`.
2. Add smoke benchmark script under `scripts/` to automate N-request timing.
3. Add transcript quality calibration table in docs from latest run.
4. Add UI microcopy for first-call warm-up and transcript mismatch hints.
5. Evaluate MLX Whisper spike branch (time-boxed) and compare p95 latency.

## Risk Register

1. Risk: scoring improvements regress latency.
   1. Mitigation: keep fast decode path default; gate heavy fallbacks.
2. Risk: stricter scoring frustrates learners.
   1. Mitigation: preserve intelligibility-weighted scoring and confidence guardrails.
3. Risk: browser/device audio variability impacts consistency.
   1. Mitigation: keep short fixed drill prompts and require per-device smoke check.

## Definition of Done (2-week horizon)

1. Docs updated with latest model settings and benchmark numbers.
2. Warm-path latency target met in local benchmark report.
3. Transcript reliability target met on internal smoke set.
4. UI reliably communicates backend status and failure guidance.
5. No regressions in app build/type/lint pipeline.
