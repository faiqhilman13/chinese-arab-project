# AGENTS.md - Agentic Coding Guidelines

This file provides context for AI agents working in this repository.

## Project Overview

A personal language learning web app for Arabic (MSA) and Mandarin Chinese (Simplified). Features spaced repetition, pronunciation drills, and a progressive curriculum:

1. Vocabulary
2. Chunks
3. Grammar pattern notes

The app uses a Next.js web layer plus a local FastAPI speech service.

### Tech Stack

- Framework: Next.js 16 (App Router)
- Language: TypeScript (strict mode)
- Database: Prisma + SQLite
- Authentication: JWT cookie-based (single-user)
- Validation: Zod schemas
- Styling: Tailwind CSS v4
- Linting: ESLint (Next.js + TypeScript)
- Speech service: Python FastAPI (`speech-service/`)
- STT: `faster-whisper`
- TTS: local-only backends (`auto`, `say`, `qwen`, `espeak`)

---

## Build, Lint, Test, Benchmark Commands

### Development

```bash
npm run dev              # Start Next.js dev server
npm run dev:all          # Run app + speech service concurrently
npm run speech:dev       # Start speech service only (cross-platform launcher)
```

### Production

```bash
npm run build            # Build Next.js app
npm run start            # Start production server
```

### Linting and Type Checking

```bash
npm run lint             # ESLint on src/ and prisma/
npm run typecheck        # TypeScript type checking (noEmit)
```

### Database

```bash
npm run db:migrate       # Run Prisma migrations (add -- --name <name>)
npm run db:generate      # Generate Prisma client
npm run db:seed          # Seed database
```

### Speech Benchmarking

```bash
npm run speech:benchmark # Run speech benchmark smoke set and write baseline report
```

### Testing

Note: No test framework is currently configured.

---

## Speech Runtime Rules

1. Keep speech local-only.
2. Do not add cloud TTS fallbacks.
3. STT decode must not inject target text as `initial_prompt`.
4. Transcript-only pronunciation scoring is debug-only and must stay gated.
5. If local TTS backend is unavailable, return explicit errors instead of silently falling back.

Current TTS behavior:

- `LOCAL_TTS_BACKEND=auto`:
  - `zh`: prefers `qwen`, then local fallback(s)
  - `ar`: uses local system fallback(s), not Qwen
- `LOCAL_TTS_BACKEND=qwen`: Mandarin only

Operational prerequisites for speech service:

- Python 3.10+
- `ffmpeg` available in PATH
- `espeak-ng` (or `espeak`) in PATH for `espeak` backend

---

## Code Style Guidelines

### General Principles

- Follow existing patterns in the codebase
- Keep functions small and focused
- Use descriptive names
- Handle errors explicitly with appropriate error types

### TypeScript

- Keep strict mode enabled
- Use explicit return types for exported functions
- Prefer `type` over `interface` unless extension is needed
- Use `unknown` instead of `any`
- Use `null` over `undefined` for optional data model fields

### Naming Conventions

- Files: kebab-case (example: `auth-helper.ts`)
- Components: PascalCase (example: `Dashboard.tsx`)
- Functions/variables: camelCase (example: `getOrCreateSession`)
- Database models: PascalCase
- Constants: UPPER_SNAKE_CASE
- Enums: PascalCase with PascalCase values

### Imports

- Use `@/*` path alias for internal imports
- Order imports: external -> internal -> relative
- Use explicit imports (no barrel files)

### Error Handling

- Use `ApiError` for API routes (`src/lib/http.ts`)
- Throw errors with appropriate HTTP status codes
- Wrap route handlers in try/catch and return via `handleRouteError`
- Validate inputs with Zod before processing

### Database (Prisma)

- Use Prisma client singleton from `src/lib/db.ts`
- Follow `schema.prisma` conventions
- Use enums for fixed sets
- Define relation behavior (`Cascade`, `SetNull`, etc.) deliberately

### API Routes

- Place routes in `src/app/api/`
- Use `NextRequest`/`NextResponse` from `next/server`
- Validate request input with Zod schemas
- Return standardized payloads via `ok()` helper
- Use idempotency keys where required

Pronunciation route specifics:

- `multipart/form-data` path is primary for real voice scoring
- JSON transcript path is debug-only and gated by:
  - `ENABLE_PRONUNCIATION_DEBUG_TRANSCRIPT`
  - optional `PRONUNCIATION_DEBUG_KEY`

### React/Next.js Components

- Use Server Components by default
- Add `"use client"` only when needed
- Keep client components separate from server logic where practical
- Use async/await correctly for fetch flows

### CSS and Styling

- Use Tailwind CSS v4
- Prefer utility classes over inline styles
- Keep mobile-first responsive behavior

---

## Project Structure

```text
src/
|-- app/
|   |-- api/
|   |-- globals.css
|   |-- layout.tsx
|   `-- page.tsx
|-- components/
`-- lib/
    |-- auth.ts
    |-- db.ts
    |-- http.ts
    |-- local-speech-service.ts
    |-- pronunciation.ts
    |-- schemas.ts
    `-- ...

speech-service/
|-- app/
|   |-- main.py
|   |-- stt.py
|   |-- scoring.py
|   |-- tts.py
|   `-- text_utils.py
`-- requirements.txt

prisma/
|-- schema.prisma
`-- seed.ts
```

---

## Environment Variables

Create `.env` (or copy from `.env.example`):

```env
DATABASE_URL="file:./dev.db"
SESSION_SECRET="replace-with-a-long-random-secret"
PRONUNCIATION_DAILY_LIMIT="20"
PRONUNCIATION_MONTHLY_LIMIT="200"
LOCAL_SPEECH_URL="http://127.0.0.1:8001"
```

Speech service variables:

```env
WHISPER_MODEL="small"
WHISPER_DEVICE="cpu"
WHISPER_COMPUTE_TYPE="int8"
WHISPER_BEAM_SIZE="3"
WHISPER_BEST_OF="3"
WHISPER_FALLBACK_BEAM_SIZE="5"
WHISPER_FALLBACK_BEST_OF="5"
WHISPER_FAST_THRESHOLD="82"
MAX_UPLOAD_SECONDS="12"
LOCAL_TTS_BACKEND="auto" # auto | say | qwen | espeak
QWEN_TTS_MODEL="Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"
```

Debug-only transcript scoring variables:

```env
ENABLE_PRONUNCIATION_DEBUG_TRANSCRIPT="false"
PRONUNCIATION_DEBUG_KEY=""
NEXT_PUBLIC_ENABLE_PRONUNCIATION_DEBUG_TRANSCRIPT="false"
```

---

## Common Patterns

### Creating a New API Route

1. Create file at `src/app/api/<resource>/route.ts`
2. Import Zod schema from `@/lib/schemas`
3. Use `requireUser()` for auth where required
4. Return via `ok()` or `handleRouteError()`

### Updating Speech Logic

1. Keep web contract in sync (`src/lib/local-speech-service.ts`)
2. Keep speech service responses stable (`transcript`, `score`, `feedback`, `confidence`, `components`)
3. Update docs when defaults/behavior change (`README.md`, `docs/local-models.md`)

### Benchmarking Speech Changes

1. Define smoke set in `scripts/benchmark/smoke-set.json`
2. Run `npm run speech:benchmark`
3. Review or update `docs/benchmark-baseline.md`

---

## Notes

- Single-user app with JWT auth (first login creates account)
- Language alternates daily (Arabic/Chinese)
- New content pauses when review backlog exceeds 50 due cards
- Mastery requires 5+ successful recalls across 7+ days
