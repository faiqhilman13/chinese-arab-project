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
- Local speech worker: FastAPI + faster-whisper + local-only TTS

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
LOCAL_TTS_BACKEND="auto" # auto | qwen | artst
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

- model-only local backends (`qwen` for Mandarin, `artst` for Arabic)
- `LOCAL_TTS_BACKEND=auto` selects model by language with no fallback chain
- no cloud fallback

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

## API Routes

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/session/today?language=ar_msa|zh_hans`
- `POST /api/session/start`
- `POST /api/attempt` (requires `x-idempotency-key` header)
- `POST /api/pronunciation/evaluate`
- `GET /api/pronunciation/target-audio?lexicalItemId=...`
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
