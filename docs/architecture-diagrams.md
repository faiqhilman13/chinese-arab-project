# Language Learning MVP Architecture Diagrams

If your VS Code Markdown Mermaid preview still fails, open these raw Mermaid files directly:
- `docs/architecture-overall.mmd`
- `docs/arabic-logic.mmd`

## 1) Overall App Architecture

```mermaid
graph LR
  subgraph FE[Frontend: Next.js pages + client UI]
    P1["/ar page"]
    P2["/zh page"]
    LW["LanguageWorkspace client<br/>Flashcards + Gallery + Pronunciation<br/>Immersion + Snippets + Morphology"]
    BROWSER["Browser Audio APIs<br/>MediaRecorder + SpeechSynthesis fallback"]
  end

  subgraph API[App and API Layer: Next.js route handlers]
    CORE["Core APIs<br/>auth, session, progress<br/>review, vocabulary"]
    AR["Arabic APIs<br/>pronunciation, no-harakat<br/>immersion, snippets, morphology"]
    LIB["Domain libraries<br/>schemas, mappers,<br/>review scheduler, scoring helpers"]
  end

  subgraph DATA[Data and Services]
    PRISMA["Prisma Client"]
    DB["SQLite dev.db<br/>User, LexicalItem, ReviewCard<br/>NoHarakatAttempt, ImmersionLog<br/>Snippet, Morphology"]
    SPEECH["speech-service FastAPI<br/>health, score, synthesize"]
    MODELS["Local models<br/>Whisper STT + TTS backend<br/>plus optional ElevenLabs Arabic"]
  end

  P1 --> LW
  P2 --> LW
  LW --> CORE
  LW --> AR
  LW --> BROWSER
  CORE --> LIB
  AR --> LIB
  LIB --> PRISMA
  PRISMA --> DB
  AR --> SPEECH
  SPEECH --> MODELS
```

## 2) Arabic Module Algorithms / Logic / Scoring

```mermaid
graph TD
  START["Arabic user action in UI<br/>Play Speak, No-Harakat,<br/>Immersion, Snippets, Morphology"]

  START --> ROUTE{"Which Arabic flow?"}

  ROUTE -->|Speak MSA or Syrian| PR1["POST pronunciation evaluate"]
  PR1 --> PR2["Auth and enforce daily monthly limits"]
  PR2 --> PR3["Resolve target form<br/>parseArabicForm + resolveArabicTarget<br/>MSA or Syrian lexical variant"]
  PR3 --> PR4{"multipart audio?"}
  PR4 -->|Yes| PR5["scorePronunciationWithLocalService<br/>POST speech-service score"]
  PR5 --> PR6["speech-service pipeline<br/>ffmpeg normalize to Whisper transcript<br/>evaluate_pronunciation"]
  PR6 --> PR7["Arabic scoring<br/>intelligibility max transcript target translit similarity<br/>fluency from pause and pace<br/>overall 0.75 intelligibility + 0.25 fluency"]
  PR4 -->|No debug transcript mode| PR8["evaluatePronunciation in app<br/>normalize + Levenshtein similarity"]
  PR7 --> PR9["Store PronunciationAttempt<br/>return score confidence components and limits"]
  PR8 --> PR9

  ROUTE -->|No-Harakat attempt| NH1["POST no-harakat attempt"]
  NH1 --> NH2["Auth and enforce limits<br/>validate Arabic lexical item and transliteration"]
  NH2 --> NH3["displayText stripArabicDiacritics<br/>expected transliteration from lexical item"]
  NH3 --> NH4["Local speech scoring with scriptText and expected transliteration"]
  NH4 --> NH5["Tip engine buildNoHarakatTips<br/>vowel and shadda and hamza and assimilation rules"]
  NH5 --> NH6["Store NoHarakatAttempt<br/>score confidence feedback and tipCodes"]

  ROUTE -->|Morphology queue and attempt| MO1["GET morphology queue"]
  MO1 --> MO2["Queue ranking<br/>unseen first then lower avgScore then older lastAttempt"]
  MO2 --> MO3["POST morphology attempt<br/>promptType root or wazn"]
  MO3 --> MO4["scoreMorphologyAttempt<br/>exact 100 overlap 70 else 25"]
  MO4 --> MO5["GET morphology summary<br/>accuracy confusions weak roots and weak wazn"]

  ROUTE -->|Immersion tracking| IM1["GET immersion plan<br/>phase from first Arabic activity day"]
  IM1 --> IM2["POST immersion log<br/>mode input output study tutor and minutes"]
  IM2 --> IM3["GET immersion summary<br/>aggregate by mode and day and active streak"]
  IM3 --> IM4["ratioAdherenceScore<br/>actual vs phase target ratio"]

  ROUTE -->|Sentence mining| SN1["GET snippets feed<br/>phase domain search pagination"]
  SN1 --> SN2["User selects linked terms from SnippetLexicalLink"]
  SN2 --> SN3["POST snippets mine"]
  SN3 --> SN4["Validate selected terms are linked to snippet"]
  SN4 --> SN5["Upsert ReviewCard FSRS<br/>dueAt now for selected lexical items"]
  SN5 --> SN6["Create snippet interaction<br/>deduped within 24h for minedCount"]
```
