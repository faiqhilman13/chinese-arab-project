# Language Learning MVP

Personal web app for Arabic (MSA) and Mandarin (Simplified) with a baby-style progression:

1. Vocabulary first
2. Short chunks/phrases next
3. Grammar notes unlocked after enough exposure
4. Spaced repetition and pronunciation drills

## Stack

- Next.js (App Router, TypeScript)
- Prisma + SQLite
- JWT cookie auth (single-user)
- Zod validation

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

Create `.env`:

```env
DATABASE_URL="file:./dev.db"
SESSION_SECRET="replace-with-a-long-random-secret"
PRONUNCIATION_DAILY_LIMIT="20"
PRONUNCIATION_MONTHLY_LIMIT="200"
LOCAL_SPEECH_URL="http://127.0.0.1:8001"
```

Optional local speech settings:

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
```

If you prefer separate terminals:

```bash
npm run speech:dev
# second terminal
npm run dev
```

## Local Speech Service

The app now uses a local speech backend for voice drills:

- `POST /synthesize` (target pronunciation audio)
- `POST /score` (audio -> transcript + pronunciation components)
- `GET /health`

Service code lives in `speech-service/`.

Current scoring dimensions:

- intelligibility (target vs transcript)
- fluency (pace/pause)
- Mandarin tone contour score (`zh`)
- Arabic phonology proxy score (`ar`)

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
