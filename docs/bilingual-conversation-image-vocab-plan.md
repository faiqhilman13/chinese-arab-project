# Bilingual Conversation and Image Vocab Plan

## Purpose

Shape the app into a daily conversational learning tool for Arabic and Mandarin, with an image-heavy vocabulary lane for high-volume acquisition.

The app should feel ready when opened. Daily learning content should be prepared automatically, with user correction available during study but not required as daily admin.

## Product Direction

### Core Identity

The app is a personal bilingual daily learning tool for:

1. Arabic:
   - Speak and understand MSA.
   - Speak and understand Syrian dialect.
   - Read Arabic without harakat.
2. Mandarin:
   - Understand and speak practical Mandarin for Malaysia social contexts and China trips.
   - Hold useful everyday conversations.
   - Keep reading basic and supportive, not a deep literacy track.

### Bilingual Model

The app remains bilingual, but the two languages do not need identical drills.

Shared foundations:

1. Daily sessions.
2. Concept-centered vocabulary.
3. Spaced review.
4. Pronunciation and listening.
5. Image-heavy vocabulary acquisition.

Language-specific depth:

1. Arabic gets MSA/Syrian variants, no-harakat reading, morphology, and richer script support.
2. Mandarin gets listening-first and speaking-first travel/social conversation practice, with pinyin and basic hanzi as support.

## Daily Session Lanes

Each daily session should be organized into four lanes.

### 1. Conversation

The main learning lane.

Arabic:

1. MSA chunks.
2. Syrian variants where useful.
3. Listen, repeat, speak, and understand.
4. Move from phrase recall into short conversational prompts.

Mandarin:

1. Practical travel and social chunks.
2. Listen-first comprehension.
3. Spoken recall from English prompts.
4. Pinyin support and basic hanzi recognition only where useful.

### 2. Image Vocab

The high-volume vocabulary acquisition lane.

Defaults:

1. 12 new image concepts per language session.
2. 24 to 36 due image reviews max.
3. Pause new image concepts if total due reviews exceed the review cap.
4. Use the current day's language only, while sharing the underlying concept and image catalog across languages.

Content mix:

1. 80% concrete nouns.
2. 15% visually obvious actions.
3. 5% visually obvious adjectives.

Avoid image cards for abstract concepts such as "because", "already", "maybe", or "need". Teach those through chunks.

### 3. Review

Keep SRS useful but not chore-like.

Review should include:

1. Conversation chunks.
2. Image vocabulary.
3. Pronunciation targets.
4. Language-specific depth items.

Review should stay capped so it does not overwhelm the daily session. New content should pause when review debt is high.

### 4. Depth

Language-specific drills that support the real goal.

Arabic:

1. No-harakat reading.
2. MSA/Syrian comparison.
3. Morphology where it helps decoding and production.
4. Reading snippets without turning the app into a pure reading tool.

Mandarin:

1. Listening comprehension.
2. Spoken recall.
3. Tone-aware pronunciation feedback only where useful.
4. Travel and casual conversation scenarios.
5. Basic character recognition as memory support.

## Concept-Centered Content Model

The durable content unit should be a concept, not a single language-specific word.

Example concept:

```text
concept: train station
image assets: generic clear station image(s)
Arabic MSA: محطة قطار
Arabic Syrian: محطة قطار / spoken variant if different
Mandarin: 火车站
pinyin: huo3 che1 zhan4
conversation chunks:
  - Where is the train station?
  - I am going to the train station.
```

Model principles:

1. Concept familiarity can be shared across languages.
2. Mastery stays independent per language.
3. Arabic and Mandarin forms attach to the same concept.
4. Review cards remain language-specific because recall, pronunciation, and usage differ.
5. Image assets attach to concepts, not only to language-specific lexical rows.

The current `LexicalItem.conceptKey` can be used as the bridge in the first implementation before introducing a dedicated `Concept` table.

## Image Vocab Flow

### Learning Progression

Image vocabulary should use progressive strictness.

1. Stage 1: image -> multiple choice recognition.
2. Stage 2: image -> self-graded spoken recall.
3. Stage 3: image -> say or type the target.
4. Stage 4: image -> use the concept in a short conversational phrase.

Mandarin should prioritize spoken recall over hanzi typing.

Arabic should include MSA and Syrian forms once the base concept is familiar.

### Graduation Into Conversation

Every useful image concept should eventually graduate into at least one conversational chunk.

This prevents isolated word hoarding and keeps image vocabulary tied to the app's daily conversational identity.

## Daily Image Pipeline

The image pipeline should prepare content automatically before the user studies.

Target behavior:

```text
tomorrow's concept list
-> scrape public internet image candidates
-> download and cache candidates locally
-> filter and rank
-> attach safest image assets to concepts
-> daily session is ready when opened
```

### Batch Strategy

Daily batch composition:

1. 70% lesson-adjacent concepts.
2. 30% extra breadth concepts.

This keeps image vocabulary connected to conversation while still growing vocabulary volume quickly.

### Source Strategy

Use mostly generic object images for the first version.

Preferred first-pass image types:

1. Animals.
2. Food.
3. Rooms.
4. Buildings.
5. Tools.
6. Transport.
7. Clothing.
8. Clear everyday objects.

Avoid relying on generated images as the default. Prefer scraped public internet images, downloaded into local storage, and tracked with metadata.

### Local Caching

Scraped images should be downloaded and served locally instead of hotlinked.

Store metadata:

1. Source image URL.
2. Source page URL.
3. Source domain.
4. Local file path.
5. Image hash.
6. Width and height.
7. Quality score.
8. Bad-report count.
9. Concept association.
10. Created and last-used timestamps.

Benefits:

1. Stable lessons.
2. Faster loading.
3. Source and hash blacklist support.
4. Easier bad-image repair.
5. Possible offline-ish review later.

## Bad Image Feedback Loop

Every image card should include a quick "bad image" action.

User experience:

1. User taps "Bad image".
2. The card is removed or replaced immediately.
3. The user continues studying.
4. A background repair job handles replacement later.

Repair behavior:

```text
bad image report
-> increment report count
-> blacklist image hash if needed
-> blacklist weak source if repeated
-> rescrape candidates
-> attach replacement image
-> requeue concept for a future session
```

The correction system should not turn into a daily review chore. It exists to keep the automated pipeline improving while preserving the "open app and learn" flow.

## Content Automation Policy

The app should be automatic by default.

High-confidence content:

1. Enters the daily session automatically.
2. Can be corrected during study.

Low-confidence content:

1. Goes to a content inbox.
2. Does not block daily study.
3. Can be reviewed only when desired.

The user should not need to approve daily images or chunks before using the app.

## First Implementation Milestone

Build a narrow vertical slice for image vocabulary without changing the whole product at once.

### Milestone 1: Image Vocab Foundation

1. Add data model support for concept image assets and bad-image reports.
2. Use `LexicalItem.conceptKey` as the initial concept bridge.
3. Add local image storage under an app-controlled asset directory.
4. Add an image vocab queue API for the current day's language.
5. Add a bad-image report API.
6. Add an Image Vocab lane to the language workspace.
7. Seed or script a small first image set for concrete nouns.

Acceptance:

1. A session can show image vocab cards for Arabic and Mandarin.
2. The same concept can be practiced separately per language.
3. Bad-image reports persist and remove the image from active use.
4. Review cards remain language-specific.

Implementation status:

1. Added `ImageAsset`, `BadImageReport`, and `ImageVocabAttempt` models.
2. Added `GET /api/image-vocab/queue`, `POST /api/image-vocab/grade`, and `POST /api/image-vocab/report-image`.
3. Added an Image Vocab lane to the language workspace with reveal, play, speak, grade, and bad-image actions.
4. Added `npm run data:seed:images` for a small initial concrete-noun image set.
5. Current first slice uses a derived shared image key from `domain + gloss`, while keeping `LexicalItem.conceptKey` compatible.
6. A dedicated shared `Concept` table is still deferred until it is needed for richer cross-language authoring.

### Milestone 2: Daily Batch Image Prep

1. Create a script for selecting tomorrow's image concepts.
2. Scrape candidate images with Playwright or a replaceable provider adapter.
3. Download and cache candidates locally.
4. Filter by image dimensions, file type, duplicate hash, and obvious low-quality signals.
5. Auto-select high-confidence candidates.
6. Send low-confidence candidates to a non-blocking content inbox.

Acceptance:

1. Running the prep script creates ready-to-use images for the next session.
2. The app does not scrape images during active study.
3. Bad reported images are excluded from future selection.

Implementation status:

1. Added `npm run image-vocab:prepare -- --language ar_msa|zh_hans --limit 12`.
2. The scaffold selects vocab concepts without active image assets and writes `data/image-vocab-batch.<language>.json`.
3. Added `npm run image-vocab:fetch -- --manifest data/image-vocab-batch.<language>.json`.
4. The fetcher uses Wikimedia Commons as the first public-image provider, downloads bounded local copies, filters by file type, dimensions, hash, reported/retired status, and noisy title patterns, then upserts active shared `ImageAsset` rows.
5. The selector skips known poor image concepts such as abstract connectors and several non-visual emergency adjectives.
6. Playwright/browser-search scraping and stronger image-quality scoring are still pending.

### Milestone 3: Progressive Image Recall

1. Add staged image vocab interactions.
2. Start with recognition and self-graded recall.
3. Add spoken recall for Mandarin.
4. Add Arabic MSA/Syrian form reveal.
5. Graduate eligible concepts into simple chunks.

Acceptance:

1. Image vocab is fast at first exposure.
2. Mature concepts move toward actual conversational use.
3. Mandarin does not require advanced reading.

### Milestone 4: Conversation Alignment

1. Generate or curate one or more chunks for image concepts.
2. Keep chunks language-specific and scenario-aware.
3. For Mandarin, prioritize travel and casual social situations.
4. For Arabic, include MSA and Syrian usage where appropriate.

Acceptance:

1. Image vocab feeds the conversation lane.
2. The app remains a daily conversation tool, not just a flashcard gallery.

Implementation status:

1. Added `npm run image-vocab:chunks -- --manifest data/image-vocab-batch.<language>.json`.
2. The chunk scaffold creates approved language-specific phrase templates for image concepts and stores them as normal `CHUNK` lexical items.
3. Generic chunk generation is deliberately gated; unsupported glosses are skipped instead of producing awkward phrases.

## Deployment Plan

### Recommended Hosting Shape

Use a local-first deployment on the always-on Windows PC first.

The current and planned app shape fits an always-on personal machine well because it needs:

1. Next.js server routes.
2. Prisma and SQLite persistence.
3. FastAPI speech service.
4. Local Whisper and TTS runtime.
5. Local cached image assets.
6. Future Playwright image scraping jobs.
7. Nightly content preparation jobs.

For personal use, the Windows PC can act as the app server. Use Tailscale for private access from outside the home instead of exposing the machine directly to the public internet.

Recommended phases:

1. Phase 1: Windows local-first deployment with Tailscale remote access.
2. Phase 2: Hetzner VPS later if public uptime, cleaner isolation, or hosted reliability becomes necessary.
3. Optional: Netlify for a separate landing page, marketing page, waitlist, or public docs.

Avoid splitting the MVP across Netlify and Hetzner until there is a clear need. Keeping the main runtime on one machine reduces deployment complexity.

### Target Runtime Topology

Local-first topology:

```text
Windows PC
  -> Next.js app on localhost:3000
  -> FastAPI speech service on 127.0.0.1:8001
  -> SQLite database
  -> local cached image assets
  -> scheduled image/content preparation jobs

Tailscale
  -> private remote access from phone or laptop outside home
```

Later Hetzner topology:

```text
https://learn.example.com
  -> Caddy or Nginx reverse proxy
  -> Next.js app on localhost:3000

http://127.0.0.1:8001
  -> FastAPI speech service

/var/lib/language-learning/
  -> production SQLite database
  -> cached image assets
  -> uploads
  -> scraped image candidates
  -> generated content artifacts
```

The speech service should stay private on `127.0.0.1` in both deployment modes. The browser should call the Next.js app, and the Next.js server should call the speech service.

### Production Storage

Use app-controlled storage outside the git checkout.

Recommended Windows local-first paths:

```text
C:\language-learning-mvp
  -> app checkout or release directory

C:\language-learning-data
  -> SQLite database
  -> image assets
  -> uploads
  -> scraped image candidates
  -> generated content artifacts

C:\language-learning-config
  -> production environment files
```

Recommended later Hetzner paths:

```text
/opt/language-learning-mvp
  -> app checkout or release directory

/var/lib/language-learning
  -> app data
  -> SQLite database
  -> image assets
  -> uploads

/etc/language-learning
  -> production environment files
```

SQLite is acceptable for the personal single-user deployment. If the app becomes multi-user or needs more reliable concurrent writes, move to Postgres.

Backups should include:

1. SQLite database.
2. Cached image assets.
3. Any manually corrected/generated content.
4. Production env file backup stored securely outside the server.

### LLM Integration

Use the OpenCode Go API key only on the server side.

The LLM should support content preparation and repair jobs, not block the live study session.

Recommended uses:

1. Concept expansion.
2. Arabic and Mandarin phrase drafts.
3. Image search query generation.
4. Image quality and caption checks.
5. Bad-image repair suggestions.
6. Chunk generation for concepts that graduate from image vocab.

Do not expose the key with any `NEXT_PUBLIC_*` variable.

Candidate environment variables:

```env
LLM_PROVIDER="opencode_go"
OPENCODE_GO_API_KEY=""
OPENCODE_GO_BASE_URL=""
OPENCODE_GO_MODEL=""
```

### Production Environment Variables

Required app variables:

```env
DATABASE_URL="file:C:/language-learning-data/prod.db"
SESSION_SECRET=""
PRONUNCIATION_DAILY_LIMIT="20"
PRONUNCIATION_MONTHLY_LIMIT="200"
LOCAL_SPEECH_URL="http://127.0.0.1:8001"
```

Speech service variables:

```env
WHISPER_MODEL="small"
WHISPER_MODEL_ZH="tiny"
WHISPER_DEVICE="cpu"
WHISPER_COMPUTE_TYPE="int8"
MAX_UPLOAD_SECONDS="12"
LOCAL_TTS_BACKEND="auto"
QWEN_TTS_MODEL="Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"
ARTST_MODEL="MBZUAI/speecht5_tts_clartts_ar"
```

Optional Arabic cloud TTS variables, if used:

```env
ELEVENLABS_API_KEY=""
ELEVENLABS_AR_VOICE_ID=""
ELEVENLABS_MODEL_ID="eleven_multilingual_v2"
ELEVENLABS_TIMEOUT_SECONDS="20"
```

Debug transcript scoring should stay disabled in production:

```env
ENABLE_PRONUNCIATION_DEBUG_TRANSCRIPT="false"
PRONUNCIATION_DEBUG_KEY=""
NEXT_PUBLIC_ENABLE_PRONUNCIATION_DEBUG_TRANSCRIPT="false"
```

### Server Services

Recommended Windows local-first process model:

1. Run the Next.js app as a background process or Windows service.
2. Run the FastAPI speech service as a background process or Windows service.
3. Use Windows Task Scheduler for nightly image and content preparation.
4. Use Windows Task Scheduler for periodic database and asset backups.
5. Use Tailscale for private remote access outside the home.

Later Hetzner process model:

1. `language-learning-web.service`: runs `npm run start` or a standalone Next.js server.
2. `language-learning-speech.service`: runs FastAPI with the speech-service Python environment.
3. `language-learning-content-prep.timer`: nightly image and content preparation.
4. `language-learning-backup.timer`: periodic database and asset backups.

Use Caddy or Nginx for HTTPS and reverse proxying only when moving to a public VPS or public domain setup. For Tailscale-only access, public reverse proxying is not required for the first version.

### Deployment Inputs Needed

Before local-first deployment, collect:

1. Confirmation that the Windows PC is the first deployment target.
2. Windows username and preferred app/data directories.
3. Whether the app should run after reboot without manual commands.
4. Tailscale account/device setup status.
5. Preferred Tailscale hostname or MagicDNS name for the PC.
6. Whether access should be limited to Tailscale only.
7. Production `SESSION_SECRET`, or permission to generate one.
8. OpenCode Go API key.
9. OpenCode Go base URL.
10. OpenCode Go model name.
11. Whether optional ElevenLabs Arabic TTS should be used.
12. PC CPU, RAM, and GPU availability to decide realistic Whisper/TTS settings.
13. Whether deployment should use the current local repo state or wait for a clean commit first.

If moving to Hetzner later, collect:

1. Hetzner VPS IP address.
2. SSH username.
3. SSH access method.
4. Domain or subdomain for the app, for example `learn.example.com`.
5. DNS provider and access path, such as Cloudflare, Porkbun, Netlify DNS, or Hetzner DNS.
6. Hetzner VPS size, especially CPU and RAM.

### First Deployment Milestone

The first deployment milestone should be a local Windows deployment reachable through Tailscale.

Acceptance:

1. App is reachable from the Windows PC.
2. App is reachable from another approved device through Tailscale.
2. Login works.
3. Prisma migrations and seed run successfully.
4. Next.js API routes work.
5. Speech health check works from the app server.
6. The speech service is not reachable except locally from the app server.
7. SQLite database and image asset paths live outside the repo.
8. Environment secrets are present only on the Windows PC.
9. A basic backup job exists for the database and app data directory.
10. App and speech service can start after reboot or with one documented command.

## Open Decisions

These should be resolved before or during implementation.

1. Where local image files should live in development and production.
2. Whether image scraping should use Playwright browser search, a search API, or both.
3. How strict the first automated image quality threshold should be.
4. Whether to introduce a dedicated `Concept` Prisma model immediately or start with `conceptKey`.
5. How the daily session UI should expose the four lanes without feeling heavier.
6. Whether image vocab should count toward the same daily new-content cap or have its own cap.

## Recommended Next Step

Start with Milestone 1.

Keep the first implementation deliberately small:

1. Data model for image assets and reports.
2. API to fetch image vocab cards.
3. UI lane to practice image cards.
4. One-tap bad-image reporting.
5. A small seeded image set before building full scraping automation.

This gives a usable proof of the image-vocab lane before investing in the scraping pipeline.
