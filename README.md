# Language Learning MVP

Personal web app for Arabic (MSA) and Mandarin (Simplified) with a progressive curriculum:

1. Vocabulary first
2. Short chunks/phrases next
3. Grammar notes unlocked after enough exposure
4. Spaced repetition and pronunciation drills

## Stack

- Next.js (App Router, TypeScript)
- Prisma + SQLite
- JWT cookie auth (single-user)
- Zod validation
- Local speech worker: FastAPI + faster-whisper + pluggable TTS

## Quick Start

```bash
npm install
cp .env.example .env
npm run db:migrate -- --name init
npm run db:seed
npm run dev:all
```

Open `http://localhost:3000`.

First login creates the single user account if none exists yet.

## Environment Variables

Copy `.env.example` to `.env` and adjust values as needed.

Speech defaults are now:

```env
WHISPER_MODEL="small"
WHISPER_MODEL_ZH="tiny"
LOCAL_TTS_BACKEND="auto" # auto | qwen | artst | elevenlabs
ELEVENLABS_API_KEY=""
ELEVENLABS_AR_VOICE_ID=""
ELEVENLABS_MODEL_ID="eleven_multilingual_v2"
ELEVENLABS_TIMEOUT_SECONDS="20"
```

Debug-only transcript scoring path (disabled by default):

```env
ENABLE_PRONUNCIATION_DEBUG_TRANSCRIPT="false"
PRONUNCIATION_DEBUG_KEY=""
NEXT_PUBLIC_ENABLE_PRONUNCIATION_DEBUG_TRANSCRIPT="false"
```

## Local Speech Service

The app uses a local speech backend for voice drills:

- `POST /synthesize` (target pronunciation audio)
- `POST /score` (audio -> transcript + pronunciation components)
- `GET /health`

Service code lives in `speech-service/`.

Current scoring dimensions:

- intelligibility (target vs transcript)
- fluency (pace/pause)
- Mandarin tone contour score (`zh`)
- Arabic: intelligibility + fluency only (no fake phonology proxy)

STT behavior:

- primary decode: no target-text conditioning
- fallback decode: relaxed decode settings, still no target-text conditioning

TTS behavior:

- local backends (`qwen` for Mandarin, `artst` for Arabic)
- optional ElevenLabs backend for Arabic (`ELEVENLABS_API_KEY` + `ELEVENLABS_AR_VOICE_ID`)
- `LOCAL_TTS_BACKEND=auto` routes `zh` -> `qwen`, and `ar` -> `elevenlabs` (with fallback to `artst` if configured credentials fail)

## Local Runtime Prerequisites

- Python 3.10+
- `ffmpeg` in PATH (required for audio conversion), or set `FFMPEG_PATH`
- `qwen-tts` installed in the speech-service Python environment

Start speech worker:

```bash
npm run speech:dev
```

This launcher is cross-platform (PowerShell/cmd/bash).

## Speech Benchmarking

1. Create `scripts/benchmark/smoke-set.json` from `scripts/benchmark/smoke-set.sample.json`.
2. Add audio files under `scripts/benchmark/audio/`.
3. Run:

```bash
npm run speech:benchmark
```

It writes `docs/benchmark-baseline.md` with exact/near transcript match and p50/p95 latency.

## Arabic Vocabulary Dataset

Arabic content is now seeded from `data/ar_8020_msa_syrian.v1.json`:

- MSA is the primary form.
- Syrian dialect is stored as a secondary companion form on each concept.
- Phase 2 dataset size: 800 concepts (400 vocab + 400 chunks) across 8 balanced domains and 80 lessons.

Generate + validate before seeding:

```bash
npm run data:generate:ar
npm run data:enrich:ar
npm run data:validate:ar
```

## API Routes

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/session/today?language=ar_msa|zh_hans`
- `POST /api/session/start`
- `POST /api/attempt` (requires `x-idempotency-key` header)
- `POST /api/pronunciation/evaluate` (`form=msa|syrian`, default `msa`)
- `GET /api/pronunciation/target-audio?lexicalItemId=...&form=msa|syrian`
- `GET /api/pronunciation/no-harakat/queue?language=ar_msa&limit=...`
- `POST /api/pronunciation/no-harakat/attempt`
- `GET /api/pronunciation/no-harakat/summary?range=7d|30d`
- `GET /api/pronunciation/no-harakat/target-audio?lexicalItemId=...`
- `GET /api/review/queue?language=...`
- `POST /api/review/grade`
- `GET /api/progress/summary?range=7d|30d`
- `GET /api/curriculum/domains`
- `GET /api/lesson/:id`
- `GET /api/reminders/preferences`
- `POST /api/reminders/preferences`

## Notes

- Language schedule alternates by day (Arabic and Chinese).
- New content pauses automatically when review backlog exceeds 50 due cards.
- Mastery requires 5+ successful recalls across at least 7 days.

## Project Documentation

- Local model stack and runtime details: `docs/local-models.md`
- Short-term improvement plan: `docs/roadmap-2weeks.md`
- Latest benchmark report: `docs/benchmark-baseline.md`
