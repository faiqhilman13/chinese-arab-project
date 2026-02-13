# Local Models and Speech Runtime

## Goal

Define the local speech stack for scoring and synthesis, plus how to benchmark changes.

## Canonical Runtime (Current)

| Layer | Implementation | Status |
| --- | --- | --- |
| STT | `faster-whisper` (`WHISPER_MODEL=small` default) | Active |
| TTS | Model-only backends in `speech-service/app/tts.py` (`auto`, `qwen`, `artst`) | Active |
| Pronunciation scoring | `speech-service/app/scoring.py` | Active |
| App integration | `src/lib/local-speech-service.ts` + `/api/pronunciation/*` routes | Active |

## STT Decode Policy

1. Primary decode uses language hint only.
2. Target text is not injected into decode prompts.
3. Fallback decode relaxes decode settings, but still avoids target-text conditioning.

This keeps transcript scoring from being biased toward expected answers.

## Scoring Policy

1. `zh`: intelligibility + fluency + tone.
2. `ar`: intelligibility + fluency (no fake acoustic phonology proxy).
3. Confidence guardrails are limited to prevent collapse on noisy clips.

## TTS Policy (Local-Only)

1. No cloud TTS fallback.
2. Backends:
   1. `qwen`: local Mandarin TTS.
   2. `artst`: local Arabic TTS.
   3. `auto`: strict model routing (`zh` -> `qwen`, `ar` -> `artst`) with no fallback chain.
3. `ffmpeg` is required for audio conversion to browser-safe WAV.

## Runtime Topology

1. Browser records utterance and posts multipart form to `POST /api/pronunciation/evaluate`.
2. Next.js route validates auth/limits and resolves lexical target.
3. Route calls local speech worker `POST /score`.
4. Worker returns `{ transcript, score, feedback, confidence, components }`.
5. Next.js stores attempt and returns response to UI.
6. For target audio: `GET /api/pronunciation/target-audio` -> worker `POST /synthesize`.

## Required Environment Variables

```env
DATABASE_URL="file:./dev.db"
SESSION_SECRET="..."
LOCAL_SPEECH_URL="http://127.0.0.1:8001"
PRONUNCIATION_DAILY_LIMIT="20"
PRONUNCIATION_MONTHLY_LIMIT="200"
```

```env
WHISPER_MODEL="small"
WHISPER_MODEL_ZH="tiny"
WHISPER_DEVICE="cpu"
WHISPER_COMPUTE_TYPE="int8"
WHISPER_BEAM_SIZE="3"
WHISPER_BEST_OF="3"
WHISPER_FALLBACK_BEAM_SIZE="5"
WHISPER_FALLBACK_BEST_OF="5"
WHISPER_FAST_THRESHOLD="82"
WHISPER_ZH_BEAM_SIZE="1"
WHISPER_ZH_BEST_OF="1"
WHISPER_ZH_FALLBACK_BEAM_SIZE="2"
WHISPER_ZH_FALLBACK_BEST_OF="2"
WHISPER_ZH_FAST_THRESHOLD="70"
WHISPER_ZH_SKIP_QUALITY_FALLBACK="true"
WHISPER_ZH_VAD_FILTER="false"
MAX_UPLOAD_SECONDS="12"
FFMPEG_PATH=""
LOCAL_TTS_BACKEND="auto" # auto | qwen | artst
QWEN_TTS_MODEL="Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"
ARTST_MODEL="MBZUAI/speecht5_tts_clartts_ar"
```

## Benchmark Procedure

1. Copy `scripts/benchmark/smoke-set.sample.json` to `scripts/benchmark/smoke-set.json`.
2. Add sample audio clips under `scripts/benchmark/audio/`.
3. Run:

```bash
npm run speech:benchmark
```

4. Review `docs/benchmark-baseline.md` for:
   1. exact transcript match rate,
   2. near transcript match rate,
   3. p50 latency,
   4. p95 latency.

## Operational Checks

1. `curl http://127.0.0.1:8001/health`
2. `curl http://localhost:3000/api/pronunciation/health` (auth required)
3. `npm run lint`
4. `npm run typecheck`
5. `npm run build`
