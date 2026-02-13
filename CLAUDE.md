# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
# Full dev environment (Next.js + Python speech service)
npm run dev:all

# Next.js only (port 3000)
npm run dev

# Python speech service only (port 8001)
npm run speech:dev

# Production
npm run build && npm run start

# Type checking and linting
npm run typecheck
npm run lint

# Database
npm run db:migrate -- --name <migration_name>
npm run db:generate
npm run db:seed

# Speech benchmark (requires speech service running + smoke-set.json)
npm run speech:benchmark
```

The speech service uses a Python venv at `speech-service/.venv`. The `speech:dev` script (`scripts/speech-dev.mjs`, cross-platform Node launcher) auto-creates it and installs `speech-service/requirements.txt` on first run.

There are no tests. The project has no test runner configured.

## Architecture

This is a single-user language learning app for Arabic MSA and Simplified Mandarin with two runtime processes:

**Next.js server (TypeScript)** — handles auth, curriculum, SRS scheduling, review cards, progress tracking, and proxies speech requests to the Python service.

**Python FastAPI speech service** — runs Whisper STT, pronunciation scoring, and TTS. Communicates with Next.js via `LOCAL_SPEECH_URL` (default `http://127.0.0.1:8001`). Operates in local-only mode (no cloud API calls). Health endpoint reports `tts_mode: "local-only"`.

### Key data flow for voice drills

Browser records audio → `POST /api/pronunciation/evaluate` (Next.js) → `POST /score` (Python service: Whisper STT → scoring engine) → response with transcript, score, components, feedback → Next.js persists `PronunciationAttempt` → returns to browser.

Target audio: `GET /api/pronunciation/target-audio` → Python `POST /synthesize` → local TTS backend chain.

### TypeScript side (`src/`)

- `src/lib/srs.ts` — SM-2 spaced repetition algorithm. Card states: NEW → LEARNING → REVIEW → MASTERED. Interval schedule: [1, 2, 4, 7, 14, 30] days. Mastery = 5+ successes over 7+ days.
- `src/lib/pronunciation.ts` — text-based fallback pronunciation scorer (Levenshtein similarity). Used when the Python service is unavailable.
- `src/lib/local-speech-service.ts` — HTTP bridge to the Python speech service.
- `src/lib/auth.ts` — JWT auth with httpOnly cookies (single user, auto-created on first login).
- `src/lib/session.ts` — daily session management, streak tracking, language alternation (Arabic on even UTC days, Mandarin on odd).
- `src/lib/constants.ts` — SRS intervals, daily allocation ratios (60% review / 30% new / 10% pronunciation), backlog threshold (50 cards blocks new content).
- `src/app/api/` — all REST endpoints. Attempt logging uses `x-idempotency-key` header to prevent duplicates.

### Python side (`speech-service/app/`)

- `stt.py` — Whisper transcription with two-pass decode. Both primary and fallback passes are fully unbiased: no `initial_prompt`, no `hotwords`. Primary uses language hint; fallback drops language constraint and uses wider beam search.
- `scoring.py` — pronunciation scoring. Arabic: 75% intelligibility + 25% fluency (no acoustic phonology component). Mandarin: 60% intelligibility + 20% fluency + 20% tone (onset-based syllable segmentation + pyin pitch analysis).
- `tts.py` — async local-only TTS. Default backend is `auto`, which chains through available backends per platform and language. Backends: macOS `say` (Darwin only), `qwen` (Mandarin only), `artst` (Arabic only, MBZUAI SpeechT5), `espeak-ng`/`espeak` (cross-platform fallback). No cloud TTS dependencies.
- `text_utils.py` — text normalisation preserving Arabic harakat (U+0610–U+065F) and CJK characters.
- `config.py` — all speech tuning knobs from env vars. Default Whisper model: `small`. Default TTS: `auto`.

### Database (Prisma + SQLite)

Path alias `@/*` maps to `./src/*`. The Prisma schema is at `prisma/schema.prisma` with SQLite. Key models: `LexicalItem` (vocab/chunks), `ReviewCard` (SRS state per user-item), `AttemptLog` (scored practice), `PronunciationAttempt` (voice drill records), `DailySession`, `Lesson` → `LessonItem` (curriculum ordering), `PatternNote` (grammar unlocked after 12 exposures).

Languages: `AR_MSA`, `ZH_HANS`. Item types: `VOCAB`, `CHUNK`, `PATTERN`. Review grades: `AGAIN` (<50), `HARD` (<70), `GOOD` (<90), `EASY` (≥90).

## Important Conventions

- All dates in the database and SRS logic use UTC. See `src/lib/dates.ts`.
- Chinese transliterations use pinyin with tone marks (e.g., `shuǐ`, not `shui`).
- The STT pipeline is intentionally fully unbiased: neither `initial_prompt` nor `hotwords` are passed to Whisper in any decode path. This is a deliberate anti-bias measure so scores reflect what the user actually said.
- Arabic scoring omits an acoustic phonology component because reliable pharyngealisation/emphatic detection requires tools beyond what Whisper + librosa provide. This is a deliberate design decision, not a missing feature.
- TTS is local-only by policy. The `LOCAL_TTS_BACKEND` options are `auto`, `say`, `qwen`, `artst`, `espeak`. No cloud TTS (edge-tts, Google, Azure) is used.
- The `synthesize()` function in `tts.py` is async. The `/synthesize` FastAPI endpoint must use `await`.
- The pronunciation evaluate endpoint has an optional debug transcript mode gated by `ENABLE_PRONUNCIATION_DEBUG_TRANSCRIPT` and `PRONUNCIATION_DEBUG_KEY` env vars. The debug UI is hidden unless `NEXT_PUBLIC_ENABLE_PRONUNCIATION_DEBUG_TRANSCRIPT=true`.
- Benchmark tooling lives in `scripts/benchmark-speech.mjs` with sample data at `scripts/benchmark/smoke-set.sample.json`. Results go to `docs/benchmark-baseline.md`.
