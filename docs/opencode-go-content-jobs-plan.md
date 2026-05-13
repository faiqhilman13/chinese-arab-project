# OpenCode Go Content Jobs Plan

## Goal

Wire OpenCode Go into offline content preparation jobs for the language learning app.

The LLM should improve content preparation and repair workflows, not become a dependency for live study sessions. Daily learning should still load from the local database, cached assets, and precomputed content.

## Current Gap

OpenCode Go environment variables are documented and configured for deployment, but no active code calls the API yet.

Current implemented scripts are deterministic:

```bash
npm run image-vocab:prepare
npm run image-vocab:fetch
npm run image-vocab:chunks
```

The existing `image-vocab:chunks` script uses approved templates and skips unsupported concepts. It does not call an LLM.

## Environment Variables

Use server-side variables only:

```env
LLM_PROVIDER="opencode_go"
OPENCODE_GO_API_KEY=""
OPENCODE_GO_BASE_URL="https://opencode.ai/zen/go/v1"
OPENCODE_GO_MODEL="kimi-k2.6"
```

Never expose these through `NEXT_PUBLIC_*`.

## Design Principles

1. LLM jobs run offline through scripts or admin-only server jobs.
2. The live study UI never blocks on an LLM call.
3. Generated output must be validated with Zod before writing to Prisma.
4. Generated language content should be reviewable and traceable.
5. The app should prefer deterministic templates when they are good enough.
6. LLM failures should fail explicitly and leave existing content untouched.
7. Prompts should request compact JSON, not prose.
8. Secrets stay in `.env` or production config, never in repo docs or generated artifacts.

## First Implementation Target

Add an LLM-backed chunk generation script:

```bash
npm run image-vocab:llm-chunks -- --manifest data/image-vocab-batch.zh_hans.json
npm run image-vocab:llm-chunks -- --manifest data/image-vocab-batch.ar_msa.json
```

The script should:

1. Read an image vocab manifest.
2. Load related `LexicalItem` rows by `conceptKey`, language, and gloss.
3. Ask OpenCode Go for short conversation chunks for each concept.
4. Validate generated JSON.
5. Upsert generated chunks as normal `LexicalItem` rows with `itemType=CHUNK`.
6. Link generated chunks to the same domain and language.
7. Skip concepts where the model output is invalid or low confidence.
8. Write a report file under `data/`, for example `data/image-vocab-llm-chunks-report.zh_hans.json`.

## Proposed Output Schema

The model should return JSON shaped like:

```json
{
  "conceptKey": "shared.food.apple",
  "language": "zh_hans",
  "chunks": [
    {
      "scriptText": "我要苹果。",
      "transliteration": "wo yao pingguo",
      "gloss": "I want an apple.",
      "usageNote": "Basic request phrase.",
      "confidence": 0.92
    }
  ]
}
```

Arabic output should include MSA first. Syrian variants can be added in a later pass.

## Validation Rules

Reject generated chunks when:

1. `scriptText`, `gloss`, or `transliteration` is empty.
2. `language` does not match the manifest job language.
3. `confidence` is below a configured threshold, default `0.75`.
4. The chunk is too long for early conversation practice.
5. The chunk does not contain or clearly use the target concept.
6. The output is not valid JSON.

Recommended length limits:

1. Mandarin: 3 to 12 hanzi, unless the chunk is a very common phrase.
2. Arabic: 2 to 7 words.
3. English gloss: 3 to 12 words.

## File/Code Changes

Expected implementation files:

```text
src/lib/llm/opencode-go.ts
src/lib/llm/content-schemas.ts
scripts/generate-image-vocab-llm-chunks.mjs
```

Package script:

```json
{
  "image-vocab:llm-chunks": "node ./scripts/generate-image-vocab-llm-chunks.mjs"
}
```

Optional later files:

```text
scripts/repair-bad-image-vocab.mjs
scripts/generate-image-search-queries.mjs
src/app/api/admin/content-jobs/route.ts
```

## OpenCode Go Client

The client should be a tiny wrapper around the OpenAI-compatible chat completions API:

```text
POST ${OPENCODE_GO_BASE_URL}/chat/completions
Authorization: Bearer ${OPENCODE_GO_API_KEY}
model: OPENCODE_GO_MODEL
```

It should:

1. Throw a clear error when env vars are missing.
2. Use timeouts.
3. Return parsed assistant content.
4. Keep raw responses out of normal logs unless debug mode is enabled.
5. Include enough context in errors for failed jobs without printing secrets.

## Prompt Strategy

Use language-specific system instructions.

Mandarin prompt requirements:

1. Practical spoken Mandarin for travel and social use.
2. Prefer simple, high-frequency chunks.
3. Include pinyin without tone marks for the first version unless a tone format is explicitly added.
4. Avoid advanced written-register phrases.

Arabic prompt requirements:

1. Generate MSA chunks first.
2. Keep chunks short and useful for daily conversation.
3. Include transliteration.
4. Avoid rare literary wording.
5. Do not invent dialect forms in the first pass.

## Persistence Strategy

Generated chunks should become normal `LexicalItem` records:

```text
language: manifest language
domain: source concept domain
itemType: CHUNK
scriptText: generated chunk
transliteration: generated transliteration
gloss: generated English gloss
conceptKey: derived from source concept key and stable chunk hash
```

The script should avoid duplicates by checking:

1. Existing `conceptKey`.
2. Same language + normalized `scriptText`.
3. Same language + normalized `gloss` for the same source concept.

## Reporting

Each run should write a JSON report with:

1. Manifest path.
2. Language.
3. Model.
4. Started and finished timestamps.
5. Concepts processed.
6. Chunks created.
7. Chunks skipped.
8. Validation failures.
9. API failures.

Do not write prompts containing secrets. Do not write API keys.

## Later Jobs

After LLM chunk generation works, add:

1. Image search query expansion:
   - Input: concept gloss/domain/language forms.
   - Output: safer search terms for public image providers.
2. Bad-image repair suggestions:
   - Input: bad report + existing image metadata + concept.
   - Output: replacement query candidates and rejection reason categories.
3. Concept expansion:
   - Input: domain and target language.
   - Output: concrete concepts suitable for image vocab and conversation.
4. Content inbox:
   - Store low-confidence generated content for manual approval rather than immediate study use.

## Acceptance Criteria

1. `npm run image-vocab:llm-chunks -- --manifest <path>` runs without touching live study flow.
2. Missing OpenCode Go env vars produce a clear error.
3. Valid model output creates or updates chunk `LexicalItem` rows.
4. Invalid model output is skipped and reported.
5. No API keys or secrets appear in logs, reports, docs, or committed files.
6. Existing deterministic `image-vocab:chunks` remains available as a fallback.
7. `npm run lint`, `npm run typecheck`, and `npm run build` pass after implementation.

## Implementation Order

1. Add OpenCode Go client.
2. Add Zod schemas for generated chunk output.
3. Add the `image-vocab:llm-chunks` script.
4. Add report writing.
5. Test with one Mandarin manifest and one Arabic manifest.
6. Compare generated chunks against current deterministic templates.
7. Decide whether generated chunks should auto-approve or go through a content inbox.
