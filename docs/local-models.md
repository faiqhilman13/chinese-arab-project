# Local Models and Speech Runtime

## Goal
This document defines the local speech model stack for the project, why each component exists, how to operate it, and what to validate when tuning for accuracy and latency.

## Current Canonical Stack

| Layer | Current implementation | Status | Why this is primary now |
| --- | --- | --- | --- |
| STT | `faster-whisper` (`WHISPER_MODEL=tiny` by default) | Active | Stable local inference, low setup friction, good short-phrase performance with target-biased decode. |
| TTS | macOS `say` -> converted to browser-safe WAV | Active | Reliable local synthesis on macOS without extra model download. |
| Pronunciation scoring | Local heuristic scorer in `speech-service/app/scoring.py` | Active | Low-cost, language-aware scoring for Mandarin tone + Arabic phonology proxy + fluency/intelligibility. |
| App integration | `src/lib/local-speech-service.ts` + `/api/pronunciation/*` routes | Active | Uniform API contract between web app and local speech worker. |

## Planned Model Upgrades

These are planned improvements and not default runtime paths yet.

| Priority | Component | Candidate | Trigger to adopt | Rollback plan |
| --- | --- | --- | --- | --- |
| 1 | TTS | `Qwen/Qwen3-TTS-0.6B` (or later Qwen3-TTS variants) | Better naturalness and language consistency than `say` while keeping acceptable latency. | Switch `LOCAL_TTS_BACKEND=say`. |
| 2 | STT | Apple Silicon optimized STT path (MLX Whisper) | Better p95 latency and warm-start behavior on M-series hardware. | Keep `faster-whisper` as fallback default. |
| 3 | Scoring | More explicit phoneme/prosody modules | Higher correlation between user-perceived correctness and score outputs. | Keep current weighted heuristic scorer. |

## Runtime Topology

1. Browser records utterance (`MediaRecorder`) and posts multipart form to `POST /api/pronunciation/evaluate`.
2. Next.js route validates auth, checks limits, resolves lexical target.
3. Route calls local speech worker (`LOCAL_SPEECH_URL`) endpoint `POST /score`.
4. Speech worker runs STT + scoring and returns `{ transcript, score, feedback, confidence, components }`.
5. Next.js persists attempt and returns response to UI.
6. For target audio, UI calls `GET /api/pronunciation/target-audio` -> local worker `POST /synthesize`.

## Key Contracts

## App routes
1. `POST /api/pronunciation/evaluate`
2. `GET /api/pronunciation/target-audio?lexicalItemId=...`
3. `GET /api/pronunciation/health`

## Local speech worker routes
1. `GET /health`
2. `POST /synthesize`
3. `POST /score`

## App error codes (pronunciation path)
1. `LOCAL_SPEECH_UNAVAILABLE` (503): local worker not reachable.
2. `LOCAL_SPEECH_ERROR` (502): score call failed.
3. `LOCAL_TTS_ERROR` (502): synth call failed.
4. `PRONUNCIATION_DAILY_LIMIT` (429): daily attempt cap reached.
5. `PRONUNCIATION_MONTHLY_LIMIT` (429): monthly attempt cap reached.
6. `ITEM_NOT_FOUND` (404): lexical item missing.
7. `INVALID_INPUT` (400): malformed request.

## Configuration Matrix

### Required app variables
```env
DATABASE_URL="file:./dev.db"
SESSION_SECRET="..."
LOCAL_SPEECH_URL="http://127.0.0.1:8001"
PRONUNCIATION_DAILY_LIMIT="20"
PRONUNCIATION_MONTHLY_LIMIT="200"
```

### Speech model tuning variables
```env
WHISPER_MODEL="tiny"
WHISPER_DEVICE="cpu"
WHISPER_COMPUTE_TYPE="int8"
WHISPER_BEAM_SIZE="3"
WHISPER_BEST_OF="3"
WHISPER_FALLBACK_BEAM_SIZE="5"
WHISPER_FALLBACK_BEST_OF="5"
WHISPER_FAST_THRESHOLD="82"
LOCAL_TTS_BACKEND="say" # or qwen
QWEN_TTS_MODEL="Qwen/Qwen3-TTS-0.6B"
MAX_UPLOAD_SECONDS="12"
```

### Recommended profiles
1. `dev-fast`: `WHISPER_MODEL=tiny`, `BEAM/BEST_OF=3`.
2. `balanced`: `WHISPER_MODEL=base`, `BEAM/BEST_OF=4`.
3. `quality-check`: `WHISPER_MODEL=small`, `FALLBACK_BEAM/BEST_OF=6`.

## Validation and Benchmarking

## Health checks
1. `curl http://127.0.0.1:8001/health`
2. `curl http://localhost:3000/api/pronunciation/health` (auth required)

## Latency check procedure
1. Run `npm run dev:all`.
2. Use a fixed short utterance audio sample and send 10 evaluate requests.
3. Record:
   1. p50 and p95 total request time,
   2. transcript match rate,
   3. fallback decode frequency (from logs),
   4. error-rate by code.

## Acceptance targets (current phase)
1. Warm-path p50 <= 1.5s.
2. Warm-path p95 <= 3.0s.
3. Short-phrase transcript exact-or-near match >= 90%.
4. No silent failures in UI when local worker is offline.

## Troubleshooting

1. Symptom: `503 LOCAL_SPEECH_UNAVAILABLE`.
   1. Action: run `npm run speech:dev` or `npm run dev:all`.
2. Symptom: target audio button silent.
   1. Action: check `/api/pronunciation/health`, confirm worker online and browser allows autoplay/audio output.
3. Symptom: score too strict with good utterance.
   1. Action: verify transcript first; adjust `WHISPER_FAST_THRESHOLD` and beam settings before changing scoring weights.
4. Symptom: very slow first evaluate call.
   1. Action: expected warm-up; use a warm-up request after startup and measure warm-path metrics separately.
