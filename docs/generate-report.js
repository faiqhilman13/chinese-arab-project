const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel,
  BorderStyle, WidthType, ShadingType, VerticalAlign, PageNumber,
  TableOfContents, PageBreak,
} = require("docx");

const tableBorder = { style: BorderStyle.SINGLE, size: 1, color: "BBBBBB" };
const cellBorders = { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder };

function headerCell(text, width) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: "1a1a2e", type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      spacing: { before: 60, after: 60 },
      children: [new TextRun({ text, bold: true, size: 20, font: "Arial", color: "FFFFFF" })],
    })],
  });
}

function dataCell(text, width, opts = {}) {
  const runs = typeof text === "string"
    ? [new TextRun({ text, size: 20, font: "Arial", ...opts })]
    : text;
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    children: [new Paragraph({ spacing: { before: 40, after: 40 }, children: runs })],
  });
}

function bullet(ref, text, level = 0) {
  return new Paragraph({
    numbering: { reference: ref, level },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 22, font: "Arial" })],
  });
}

function bulletBold(ref, label, desc) {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({ text: label, bold: true, size: 22, font: "Arial" }),
      new TextRun({ text: desc, size: 22, font: "Arial" }),
    ],
  });
}

function bodyText(text) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text, size: 22, font: "Arial" })],
  });
}

function bodyRuns(runs) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: runs,
  });
}

function codeBlock(text) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    indent: { left: 360 },
    shading: { fill: "F4F4F4", type: ShadingType.CLEAR },
    children: [new TextRun({ text, size: 18, font: "Consolas" })],
  });
}

function heading1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
}

function heading2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
}

function heading3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });
}

function spacer() {
  return new Paragraph({ spacing: { before: 40, after: 40 }, children: [] });
}

// ─── Document ──────────────────────────────────────────────

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      {
        id: "Title", name: "Title", basedOn: "Normal",
        run: { size: 52, bold: true, color: "1a1a2e", font: "Arial" },
        paragraph: { spacing: { before: 0, after: 60 }, alignment: AlignmentType.LEFT },
      },
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, color: "1a1a2e", font: "Arial" },
        paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, color: "2d2d44", font: "Arial" },
        paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 },
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 23, bold: true, color: "3d3d5c", font: "Arial" },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "main-bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.BULLET, text: "\u25E6", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
        ],
      },
      { reference: "findings-list",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "changes-list",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "recs-list",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  sections: [
    // ─── COVER / TITLE SECTION ──────
    {
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          pageNumbers: { start: 1 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Technical Audit Report", size: 16, font: "Arial", color: "888888", italics: true })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Page ", size: 16, font: "Arial", color: "888888" }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, font: "Arial", color: "888888" }),
              new TextRun({ text: " of ", size: 16, font: "Arial", color: "888888" }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: "Arial", color: "888888" }),
            ],
          })],
        }),
      },
      children: [
        spacer(), spacer(), spacer(),
        new Paragraph({
          heading: HeadingLevel.TITLE,
          children: [new TextRun("Technical Audit Report")],
        }),
        new Paragraph({
          spacing: { before: 0, after: 200 },
          children: [new TextRun({ text: "Language Learning MVP: Arabic MSA & Simplified Mandarin", size: 28, font: "Arial", color: "555555" })],
        }),
        spacer(),
        bodyRuns([
          new TextRun({ text: "Project: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "chinese-arab-project", size: 22, font: "Arial" }),
        ]),
        bodyRuns([
          new TextRun({ text: "Date: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "13 February 2026", size: 22, font: "Arial" }),
        ]),
        bodyRuns([
          new TextRun({ text: "Scope: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Scoring accuracy, learning methodology, voice pipeline, cross-platform readiness", size: 22, font: "Arial" }),
        ]),
        spacer(), spacer(),
        new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
        new Paragraph({ children: [new PageBreak()] }),

        // ────────────────────────────────────────────────────
        // 1. EXECUTIVE SUMMARY
        // ────────────────────────────────────────────────────
        heading1("1. Executive Summary"),
        bodyText(
          "This report documents the state of the language learning MVP as found during a code-level audit on 13 February 2026, " +
          "and the changes implemented to address the findings. The project is a full-stack Next.js + Python microservice application " +
          "for learning Arabic (Modern Standard Arabic) and Simplified Mandarin Chinese through voice-based review cards with spaced repetition."
        ),
        bodyText(
          "The audit focused on the user\u2019s stated priorities: (1) pedagogically sound learning practices, (2) accurate and maximally correct " +
          "scoring of voice-based outputs, and (3) reliability of the review card pipeline. Seven critical-to-moderate issues were identified and " +
          "resolved across eight source files spanning both the TypeScript frontend and the Python speech service."
        ),

        // ────────────────────────────────────────────────────
        // 2. PROJECT OVERVIEW \u2014 ORIGINAL STATE
        // ────────────────────────────────────────────────────
        heading1("2. Project State Before Changes"),

        heading2("2.1 Architecture"),
        bodyText(
          "The application consists of a Next.js 16 frontend (TypeScript, React 19, Tailwind CSS, Prisma ORM with SQLite) " +
          "and a Python FastAPI microservice for speech processing. The frontend handles authentication (JWT, single-user), " +
          "session management, curriculum progression, and spaced repetition scheduling. The Python service handles speech-to-text " +
          "(Whisper via faster-whisper), text-to-speech (macOS say / Qwen TTS), and pronunciation scoring."
        ),

        heading2("2.2 Tech Stack"),
        new Table({
          columnWidths: [3200, 6160],
          rows: [
            new TableRow({ children: [headerCell("Layer", 3200), headerCell("Technologies", 6160)] }),
            new TableRow({ children: [
              dataCell("Frontend", 3200), dataCell("Next.js 16.1.6, React 19, TypeScript 5, Tailwind CSS 4", 6160),
            ] }),
            new TableRow({ children: [
              dataCell("Backend", 3200), dataCell("Next.js API Routes, Prisma 6.16 with SQLite, JWT auth (jose)", 6160),
            ] }),
            new TableRow({ children: [
              dataCell("Speech", 3200), dataCell("FastAPI 0.116, faster-whisper 1.2, librosa 0.11, pypinyin 0.54", 6160),
            ] }),
            new TableRow({ children: [
              dataCell("TTS (original)", 3200), dataCell("macOS say command (Tingting for Chinese, Maged for Arabic)", 6160),
            ] }),
          ],
        }),
        spacer(),

        heading2("2.3 Learning Methodology"),
        bodyText("The app implements a baby-step vocabulary-first progression:"),
        bulletBold("main-bullets", "Phase 1 \u2014 Vocabulary: ", "Single words grouped by domain (home, food, transport, etc.)."),
        bulletBold("main-bullets", "Phase 2 \u2014 Chunks: ", "Short phrases of 2\u20134 words that use learned vocabulary."),
        bulletBold("main-bullets", "Phase 3 \u2014 Pattern notes: ", "Grammar explanations unlocked after 12+ exposures to related items."),
        bodyText(
          "Languages alternate daily (Arabic on even UTC days, Mandarin on odd). A modified SM-2 spaced repetition algorithm " +
          "governs card scheduling with states NEW \u2192 LEARNING \u2192 REVIEW \u2192 MASTERED, requiring 5+ successful recalls " +
          "over 7+ calendar days for mastery. Transliteration aids fade after 5 successes."
        ),

        heading2("2.4 Scoring Pipeline (Original)"),
        bodyText("The voice scoring pipeline before changes worked as follows:"),
        bulletBold("main-bullets", "Step 1 \u2014 STT: ", "Whisper transcribes user audio with initial_prompt set to the target text and hotwords set to both the target and transliteration."),
        bulletBold("main-bullets", "Step 2 \u2014 Intelligibility (65%): ", "Levenshtein similarity between normalised transcript and target text."),
        bulletBold("main-bullets", "Step 3 \u2014 Fluency (20%): ", "Pace (words/sec vs 2.2 target) and pause ratio from librosa voice activity detection."),
        bulletBold("main-bullets", "Step 4 \u2014 Language-specific (15%): ", "For Chinese: tone detection via equal-split pitch contour. For Arabic: spectral centroid deviation from 1700 Hz + emphatic consonant ratio from target text + Whisper log-probability."),
        bulletBold("main-bullets", "Step 5 \u2014 Guardrails: ", "Confidence-based floors that elevate the final score when intelligibility is high."),

        new Paragraph({ children: [new PageBreak()] }),

        // ────────────────────────────────────────────────────
        // 3. FINDINGS
        // ────────────────────────────────────────────────────
        heading1("3. Findings"),
        bodyText(
          "The following issues were identified during the audit, ordered by severity from critical to moderate. " +
          "Each finding includes the file location, the problem, and why it matters for a language learning tool that needs accurate scoring."
        ),

        // -- Finding 1 --
        heading2("3.1 CRITICAL: Whisper STT Biased Toward the Correct Answer"),
        bodyRuns([
          new TextRun({ text: "File: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "speech-service/app/stt.py, lines 104\u2013112", size: 22, font: "Arial", italics: true }),
        ]),
        bodyText(
          "The primary Whisper decode pass set initial_prompt=target_text and constructed hotwords from both the target script text " +
          "and its transliteration. In Whisper, initial_prompt is used as conditioning context that heavily biases the model\u2019s " +
          "output toward specific vocabulary and phrasing. By supplying the exact text the user should have said, the system was " +
          "effectively giving Whisper the answer key before the test."
        ),
        bodyText(
          "Consequence: Whisper would \u201Chear\u201D the correct text even when the user mispronounced it substantially. " +
          "Since intelligibility carried 65% of the total score weight, this artificial inflation made the entire scoring pipeline unreliable. " +
          "A user producing mediocre pronunciation could routinely score 80+ because the STT system filled in the correct characters."
        ),

        // -- Finding 2 --
        heading2("3.2 CRITICAL: Arabic Phonology Scorer Was Non-Functional"),
        bodyRuns([
          new TextRun({ text: "File: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "speech-service/app/scoring.py, _arabic_specific_score()", size: 22, font: "Arial", italics: true }),
        ]),
        bodyText("The Arabic-specific scoring component computed three sub-metrics, none of which actually assessed Arabic pronunciation quality:"),
        bulletBold("main-bullets", "Spectral centroid vs 1700 Hz: ",
          "The spectral centroid of speech depends primarily on the vowel being produced, speaker vocal tract shape, and recording conditions. " +
          "It does not reliably indicate whether pharyngeal, emphatic, or uvular consonants were correctly articulated."),
        bulletBold("main-bullets", "Emphatic consonant ratio from the TARGET text: ",
          "The code counted emphatic letters (\u0635, \u0636, \u0637, \u0638, \u0642, \u062E, \u063A, \u0639, \u062D) in the target " +
          "string, not in the user\u2019s audio. This produced a constant bonus per card regardless of how the user pronounced it."),
        bulletBold("main-bullets", "Whisper log-probability as \u201Cconfidence\u201D: ",
          "This measured how confident the STT model was in its transcription, not whether the user\u2019s phonology was correct. " +
          "With the initial_prompt bias from Finding 3.1, this confidence was already artificially inflated."),
        bodyText(
          "Combined, this 15% component gave the illusion of language-aware scoring while measuring nothing about the user\u2019s " +
          "actual ability to produce Arabic sounds. A learner could substitute \u062D for \u0647, flatten emphatics entirely, " +
          "or ignore \u0639, and the score would not reflect these errors."
        ),

        // -- Finding 3 --
        heading2("3.3 CRITICAL: Mandarin Tone Detection Used Equal-Duration Splitting"),
        bodyRuns([
          new TextRun({ text: "File: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "speech-service/app/scoring.py, _mandarin_tone_score(), line 86", size: 22, font: "Arial", italics: true }),
        ]),
        codeBlock("chunks = np.array_split(voiced, len(expected_tones))"),
        bodyText(
          "The voiced pitch contour (after NaN removal from pyin) was split into N equal-sized chunks, where N is the number of " +
          "expected tones. This assumes every syllable occupies exactly the same duration in the audio, which is linguistically " +
          "incorrect. Mandarin syllables vary in duration due to stress patterns, sentence-final lengthening, tone 3 sandhi, " +
          "and natural speech rhythm."
        ),
        bodyText(
          "For a phrase like \u201C\u95E8\u5728\u54EA\u91CC\u201D (tones 2-4-3-3), the equal splitting would misalign " +
          "pitch-contour windows with actual syllable boundaries, causing the classifier to compare the wrong pitch shape " +
          "to the wrong expected tone. This degraded tone scoring accuracy for any multi-syllable target."
        ),

        // -- Finding 4 --
        heading2("3.4 MODERATE: Chinese Fluency Used Whitespace Tokenisation"),
        bodyRuns([
          new TextRun({ text: "File: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "speech-service/app/scoring.py, _fluency_score(), line 31", size: 22, font: "Arial", italics: true }),
        ]),
        codeBlock("token_count = max(1, len(transcript.strip().split()))"),
        bodyText(
          "The fluency scorer counted \u201Cwords\u201D by splitting on whitespace. Chinese does not use spaces between words. " +
          "Whisper\u2019s Chinese output may or may not insert spaces depending on the model and input. For a transcript like " +
          "\u201C\u6211\u8981\u6C34\u201D (three syllables), whitespace splitting might produce 1 token, yielding a " +
          "words_per_sec of ~0.5 against the 2.2 target \u2014 an absurdly low pace score for perfectly normal speech."
        ),

        // -- Finding 5 --
        heading2("3.5 MODERATE: TTS Non-Functional on Windows"),
        bodyRuns([
          new TextRun({ text: "Files: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "speech-service/app/tts.py, speech-service/app/config.py", size: 22, font: "Arial", italics: true }),
        ]),
        bodyText(
          "The default TTS backend was macOS\u2019s say command, which does not exist on Windows. The project owner\u2019s " +
          "development machine is Windows (win32 platform). The fallback Qwen TTS backend mapped Arabic to the English language:"
        ),
        codeBlock('lang_map = {"zh": "chinese", "ar": "english"}'),
        bodyText(
          "This would produce English phonology applied to Arabic text \u2014 actively harmful for a learner trying to " +
          "acquire correct Arabic pronunciation. The target audio is the learner\u2019s reference model; if it sounds wrong, " +
          "the learner internalises incorrect patterns."
        ),

        // -- Finding 6 --
        heading2("3.6 MODERATE: Whisper Tiny Model for Arabic and Chinese"),
        bodyRuns([
          new TextRun({ text: "File: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "speech-service/app/config.py, line 9", size: 22, font: "Arial", italics: true }),
        ]),
        bodyText(
          "The default Whisper model was set to \u201Ctiny\u201D (39M parameters). Whisper tiny has significantly degraded " +
          "word error rates for Arabic and Chinese compared to \u201Csmall\u201D (244M parameters) or larger models. " +
          "OpenAI\u2019s published benchmarks show the tiny model\u2019s WER for Chinese is roughly 2\u20133x higher than small\u2019s. " +
          "For a scoring system where transcript accuracy directly determines 60\u201375% of the final score, the STT model " +
          "quality is a first-order concern."
        ),

        // -- Finding 7 --
        heading2("3.7 MODERATE: Mandarin Transliterations Missing Tone Marks"),
        bodyRuns([
          new TextRun({ text: "File: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "prisma/seed.ts, lines 72\u201387", size: 22, font: "Arial", italics: true }),
        ]),
        bodyText(
          "All Chinese transliterations in the seed data omitted tone marks entirely. For example: \u201Cshui\u201D instead " +
          "of \u201Cshu\u01D0\u201D (tone 3), \u201Cmen\u201D instead of \u201Cm\u00E9n\u201D (tone 2). In Mandarin, " +
          "tones are phonemic \u2014 they distinguish meaning. \u201Cm\u0101\u201D (mother), \u201Cm\u00E1\u201D (hemp), " +
          "\u201Cm\u01CE\u201D (horse), and \u201Cm\u00E0\u201D (scold) are four different words. Presenting toneless pinyin " +
          "teaches incorrect pronunciation from the first exposure."
        ),

        // -- Finding 8 --
        heading2("3.8 MODERATE: Text Normalisation Stripped Arabic Diacritics"),
        bodyRuns([
          new TextRun({ text: "Files: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "speech-service/app/text_utils.py, src/lib/pronunciation.ts", size: 22, font: "Arial", italics: true }),
        ]),
        bodyText(
          "Both the Python and TypeScript normalisation functions removed all Unicode combining characters. Arabic harakat " +
          "(short vowel marks: fatha, damma, kasra, shadda, sukun \u2014 U+064B through U+065F) are combining characters. " +
          "Stripping them means the system cannot distinguish words that differ only in vowelisation, which is common in MSA. " +
          "While the current seed data does not include fully vocalised text, this would become a blocking issue if vocalised " +
          "content were added."
        ),

        new Paragraph({ children: [new PageBreak()] }),

        // ────────────────────────────────────────────────────
        // 4. CHANGES IMPLEMENTED
        // ────────────────────────────────────────────────────
        heading1("4. Changes Implemented"),

        heading2("4.1 Removed STT Target-Text Bias"),
        bodyRuns([
          new TextRun({ text: "File: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "speech-service/app/stt.py", size: 22, font: "Arial", italics: true }),
        ]),

        heading3("What changed"),
        bullet("main-bullets", "Primary decode now passes initial_prompt=None and hotwords=None. Only the language hint (\"ar\" or \"zh\") is provided."),
        bullet("main-bullets", "Fallback decode uses hotwords (light vocabulary bias) but no initial_prompt. Language constraint is also dropped to allow auto-detection."),

        heading3("Justification"),
        bodyText(
          "The purpose of pronunciation scoring is to measure what the user actually said, not to confirm that they said " +
          "the right thing. By removing target-text conditioning from the primary decode, Whisper now transcribes the audio " +
          "without foreknowledge of the expected answer. The language hint is retained because it is legitimate context " +
          "(the user chose to practice Arabic or Chinese) and because short utterances in these languages can be " +
          "misidentified without it."
        ),
        bodyText(
          "The fallback path introduces hotwords (a lighter form of bias than initial_prompt) only when the primary " +
          "decode produces a low-quality result. This preserves a recovery mechanism for edge cases where Whisper fails " +
          "to recognise the language at all, without compromising the integrity of the primary scoring path."
        ),

        heading2("4.2 Replaced Arabic Phonology Scorer With Honest Weighting"),
        bodyRuns([
          new TextRun({ text: "File: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "speech-service/app/scoring.py", size: 22, font: "Arial", italics: true }),
        ]),

        heading3("What changed"),
        bullet("main-bullets", "Removed _arabic_specific_score() entirely (spectral centroid, emphatic ratio, logprob confidence)."),
        bullet("main-bullets", "Arabic scoring now uses 75% intelligibility + 25% fluency with no language-specific acoustic component."),
        bullet("main-bullets", "Added Arabic-specific feedback text when intelligibility is low, directing learners to focus on emphatic sounds and throat letters."),

        heading3("Justification"),
        bodyText(
          "Accurate acoustic analysis of Arabic phonological features (pharyngealisation, emphasis, uvular articulation) " +
          "requires either forced phonetic alignment or a purpose-trained classifier. Neither is available in this stack. " +
          "The removed component measured properties (spectral centroid, target-text emphatic counts, STT log-probabilities) " +
          "that correlate poorly or not at all with whether the user correctly produced Arabic-specific sounds."
        ),
        bodyText(
          "An inaccurate scorer is worse than no scorer: it gives learners false confidence. A score that says \u201Cyour " +
          "Arabic phonology is 82/100\u201D when it cannot actually detect pharyngealisation is actively misleading. " +
          "The honest approach is to score on what can be reliably measured (transcript match and fluency) and provide " +
          "qualitative guidance about sounds that cannot yet be machine-scored."
        ),

        heading2("4.3 Fixed Mandarin Tone Detection With Onset-Based Segmentation"),
        bodyRuns([
          new TextRun({ text: "File: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "speech-service/app/scoring.py", size: 22, font: "Arial", italics: true }),
        ]),

        heading3("What changed"),
        bullet("main-bullets", "Added _segment_by_onsets() which uses librosa.onset.onset_detect to find syllable boundaries in the audio signal."),
        bullet("main-bullets", "Each detected segment gets its own pyin f0 extraction and tone classification, rather than sharing a single f0 array split evenly."),
        bullet("main-bullets", "Minimum onset gap of 60ms prevents over-segmentation from consonant transients."),
        bullet("main-bullets", "Falls back to equal-duration splitting only when onset detection cannot produce enough boundaries."),
        bullet("main-bullets", "Mandarin scoring weights adjusted to 60% intelligibility, 20% fluency, 20% tone (up from 15%)."),

        heading3("Justification"),
        bodyText(
          "Onset detection finds the energy transients that correspond to syllable beginnings in speech. While not as " +
          "precise as forced alignment, it tracks actual syllable boundaries rather than assuming equal durations. " +
          "This matters because Mandarin syllable duration varies systematically: tone 3 syllables are longer (due to " +
          "the dipping contour), sentence-final syllables are lengthened, and unstressed syllables (neutral tone) are shorter."
        ),
        bodyText(
          "Per-segment f0 extraction is also more robust than splitting a pre-extracted contour because pyin\u2019s " +
          "voiced/unvoiced decisions are context-dependent. Running it on individual segments avoids cross-contamination " +
          "between syllables\u2019 pitch tracks. The tone weight was increased to 20% because the improved segmentation " +
          "makes tone scores more informative and worth slightly more influence on the final result."
        ),

        heading2("4.4 Fixed Chinese Fluency Scoring"),
        bodyRuns([
          new TextRun({ text: "File: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "speech-service/app/scoring.py", size: 22, font: "Arial", italics: true }),
        ]),

        heading3("What changed"),
        bullet("main-bullets", "Added _count_tokens() which counts CJK characters (U+4E00\u2013U+9FFF) as individual syllables for Chinese text."),
        bullet("main-bullets", "Target speaking pace for Mandarin set to 3.8 syllables/second (vs 2.2 words/second for Arabic)."),
        bullet("main-bullets", "Falls back to whitespace tokenisation only when no CJK characters are detected (e.g., if Whisper produces pinyin output)."),

        heading3("Justification"),
        bodyText(
          "In Mandarin, each character corresponds to exactly one syllable. Counting characters gives an accurate syllable count " +
          "without needing a word segmentation library. The target pace of 3.8 syllables/second is based on research showing " +
          "that Mandarin conversational speech averages 3.5\u20134.5 syllables/second, compared to English\u2019s 2\u20132.5 " +
          "words/second (which was the original hardcoded target for all languages)."
        ),

        heading2("4.5 Added Cross-Platform TTS With edge-tts"),
        bodyRuns([
          new TextRun({ text: "Files: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "speech-service/app/tts.py, config.py, requirements.txt, main.py", size: 22, font: "Arial", italics: true }),
        ]),

        heading3("What changed"),
        bullet("main-bullets", "Added edge-tts as the default TTS backend with native Arabic voice (ar-SA-ZariyahNeural) and native Mandarin voice (zh-CN-XiaoxiaoNeural)."),
        bullet("main-bullets", "Added _resolve_backend() which auto-detects platform: if configured for macOS say but running on Windows/Linux, falls back to edge-tts."),
        bullet("main-bullets", "Removed the \"ar\": \"english\" language mapping from Qwen TTS. Arabic now raises an explicit error if Qwen is selected, since Qwen does not support Arabic."),
        bullet("main-bullets", "All synthesis functions converted to async for compatibility with edge-tts\u2019s native async API. The /synthesize endpoint updated accordingly."),
        bullet("main-bullets", "Extracted a shared _convert_to_wav() helper from the old _convert_aiff_to_wav()."),

        heading3("Justification"),
        bodyText(
          "edge-tts uses Microsoft Edge\u2019s neural TTS voices, which are high-quality, native-speaker models available " +
          "for both Arabic (Saudi dialect, close to MSA) and Mandarin Chinese. It is free, requires no API key, and works " +
          "on Windows, Linux, and macOS. This makes TTS functional on the project owner\u2019s actual development platform."
        ),
        bodyText(
          "The Qwen Arabic-to-English mapping was removed because producing English-phonology audio for Arabic learning " +
          "material is actively harmful. A learner hearing English prosody and segment inventory applied to Arabic text " +
          "would internalise incorrect pronunciation patterns. It is better to raise an error and let the user know " +
          "than to silently produce harmful output."
        ),

        heading2("4.6 Upgraded Default Whisper Model"),
        bodyRuns([
          new TextRun({ text: "File: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "speech-service/app/config.py", size: 22, font: "Arial", italics: true }),
        ]),

        heading3("What changed"),
        bullet("main-bullets", "Default WHISPER_MODEL changed from \"tiny\" to \"small\"."),
        bullet("main-bullets", "Default LOCAL_TTS_BACKEND changed from \"say\" to \"edge\"."),

        heading3("Justification"),
        bodyText(
          "Whisper small (244M parameters) has substantially lower word error rates for both Arabic and Chinese compared " +
          "to tiny (39M parameters). For a system where the STT transcript directly determines 60\u201375% of the final " +
          "pronunciation score, STT accuracy is the single most important variable. The small model increases memory " +
          "usage by ~500MB and adds ~0.5\u20131 second of latency per decode, which is an acceptable tradeoff for a " +
          "single-user local application where scoring correctness is the primary requirement."
        ),

        heading2("4.7 Added Tone Marks to Mandarin Transliterations"),
        bodyRuns([
          new TextRun({ text: "File: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "prisma/seed.ts", size: 22, font: "Arial", italics: true }),
        ]),

        heading3("What changed"),
        bodyText("All 15 Chinese lexical items updated with proper pinyin tone marks:"),
        new Table({
          columnWidths: [1800, 2400, 2400, 2760],
          rows: [
            new TableRow({ children: [
              headerCell("Character", 1800), headerCell("Before", 2400),
              headerCell("After", 2400), headerCell("Tones", 2760),
            ] }),
            new TableRow({ children: [
              dataCell("\u5BB6", 1800), dataCell("jia", 2400), dataCell("ji\u0101", 2400), dataCell("Tone 1 (high)", 2760),
            ] }),
            new TableRow({ children: [
              dataCell("\u95E8", 1800), dataCell("men", 2400), dataCell("m\u00E9n", 2400), dataCell("Tone 2 (rising)", 2760),
            ] }),
            new TableRow({ children: [
              dataCell("\u6C34", 1800), dataCell("shui", 2400), dataCell("shu\u01D0", 2400), dataCell("Tone 3 (dipping)", 2760),
            ] }),
            new TableRow({ children: [
              dataCell("\u5E8A", 1800), dataCell("chuang", 2400), dataCell("chu\u00E1ng", 2400), dataCell("Tone 2 (rising)", 2760),
            ] }),
            new TableRow({ children: [
              dataCell("\u9762\u5305", 1800), dataCell("mianbao", 2400), dataCell("mi\u00E0nb\u0101o", 2400), dataCell("Tone 4 + Tone 1", 2760),
            ] }),
            new TableRow({ children: [
              dataCell("\u82F9\u679C", 1800), dataCell("pingguo", 2400), dataCell("p\u00EDnggu\u01D2", 2400), dataCell("Tone 2 + Tone 3", 2760),
            ] }),
            new TableRow({ children: [
              dataCell("\u725B\u5976", 1800), dataCell("niunai", 2400), dataCell("ni\u00FAn\u01CEi", 2400), dataCell("Tone 2 + Tone 3", 2760),
            ] }),
            new TableRow({ children: [
              dataCell("\u8F66\u7AD9", 1800), dataCell("chezhan", 2400), dataCell("ch\u0113zh\u00E0n", 2400), dataCell("Tone 1 + Tone 4", 2760),
            ] }),
          ],
        }),
        spacer(),
        bodyText("All chunk/phrase transliterations similarly updated with per-syllable tone marks."),

        heading3("Justification"),
        bodyText(
          "Mandarin has four lexical tones plus a neutral tone. Tones are not optional prosodic features \u2014 they are " +
          "phonemic, meaning they distinguish meaning at the word level. Presenting toneless pinyin (\u201Cma\u201D) is " +
          "equivalent to presenting English words without vowels (\u201Cbt\u201D for \u201Cbit\u201D, \u201Cbat\u201D, " +
          "\u201Cbet\u201D, \u201Cbut\u201D, \u201Cbot\u201D, \u201Cbout\u201D). A learner seeing \u201Cshui\u201D " +
          "has no information about which of the four possible tones to produce, and will likely default to a flat " +
          "contour that does not exist in Mandarin."
        ),

        heading2("4.8 Fixed Text Normalisation to Preserve Arabic Diacritics"),
        bodyRuns([
          new TextRun({ text: "Files: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "speech-service/app/text_utils.py, src/lib/pronunciation.ts", size: 22, font: "Arial", italics: true }),
        ]),

        heading3("What changed"),
        bullet("main-bullets", "Python normalisation now preserves Arabic combining marks in U+0610\u2013U+065F (harakat) while still stripping Latin combining marks (accents)."),
        bullet("main-bullets", "TypeScript normalisation updated to explicitly include Arabic Unicode range (U+0600\u2013U+06FF) and CJK range (U+4E00\u2013U+9FFF) in the character-class whitelist."),

        heading3("Justification"),
        bodyText(
          "Arabic harakat (fatha, damma, kasra, shadda, sukun, tanwin) are Unicode combining characters in the range " +
          "U+064B\u2013U+065F. The original normalisation stripped all combining characters indiscriminately. While the " +
          "current seed data does not include vocalised Arabic, preserving this capability is essential for future " +
          "accuracy: MSA pedagogical materials typically include full or partial tashkeel, and a scoring system that " +
          "strips it before comparison cannot distinguish words that differ only by short vowels."
        ),

        new Paragraph({ children: [new PageBreak()] }),

        // ────────────────────────────────────────────────────
        // 5. SUMMARY TABLE
        // ────────────────────────────────────────────────────
        heading1("5. Change Summary"),

        new Table({
          columnWidths: [1400, 2600, 2600, 2760],
          rows: [
            new TableRow({ children: [
              headerCell("Severity", 1400), headerCell("Finding", 2600),
              headerCell("Change", 2600), headerCell("Files Modified", 2760),
            ] }),
            new TableRow({ children: [
              dataCell("CRITICAL", 1400, { bold: true, color: "CC0000" }),
              dataCell("STT biased toward target text", 2600),
              dataCell("Removed initial_prompt and hotwords from primary decode", 2600),
              dataCell("stt.py", 2760),
            ] }),
            new TableRow({ children: [
              dataCell("CRITICAL", 1400, { bold: true, color: "CC0000" }),
              dataCell("Arabic phonology scorer non-functional", 2600),
              dataCell("Removed; reweighted to 75/25 intelligibility/fluency", 2600),
              dataCell("scoring.py", 2760),
            ] }),
            new TableRow({ children: [
              dataCell("CRITICAL", 1400, { bold: true, color: "CC0000" }),
              dataCell("Mandarin tone detection misaligned", 2600),
              dataCell("Onset-based syllable segmentation", 2600),
              dataCell("scoring.py", 2760),
            ] }),
            new TableRow({ children: [
              dataCell("MODERATE", 1400, { bold: true, color: "CC8800" }),
              dataCell("Chinese fluency used whitespace split", 2600),
              dataCell("CJK character counting + adjusted pace target", 2600),
              dataCell("scoring.py", 2760),
            ] }),
            new TableRow({ children: [
              dataCell("MODERATE", 1400, { bold: true, color: "CC8800" }),
              dataCell("TTS non-functional on Windows", 2600),
              dataCell("Added edge-tts with native Arabic/Chinese voices", 2600),
              dataCell("tts.py, config.py, requirements.txt, main.py", 2760),
            ] }),
            new TableRow({ children: [
              dataCell("MODERATE", 1400, { bold: true, color: "CC8800" }),
              dataCell("Whisper tiny model insufficient", 2600),
              dataCell("Default changed to small", 2600),
              dataCell("config.py", 2760),
            ] }),
            new TableRow({ children: [
              dataCell("MODERATE", 1400, { bold: true, color: "CC8800" }),
              dataCell("Mandarin transliterations lack tones", 2600),
              dataCell("Added pinyin tone marks to all 15 items", 2600),
              dataCell("seed.ts", 2760),
            ] }),
            new TableRow({ children: [
              dataCell("MODERATE", 1400, { bold: true, color: "CC8800" }),
              dataCell("Normalisation strips Arabic diacritics", 2600),
              dataCell("Preserved harakat range U+0610\u2013U+065F", 2600),
              dataCell("text_utils.py, pronunciation.ts", 2760),
            ] }),
          ],
        }),

        new Paragraph({ children: [new PageBreak()] }),

        // ────────────────────────────────────────────────────
        // 6. WHAT WAS ALREADY WELL DONE
        // ────────────────────────────────────────────────────
        heading1("6. What Was Already Well Done"),
        bodyText("The following aspects of the project were sound and did not require changes:"),
        bulletBold("main-bullets", "SRS implementation: ",
          "The SM-2 variant in srs.ts has clean state transitions, reasonable interval schedules [1, 2, 4, 7, 14, 30], " +
          "bounded ease factors (1.3\u20132.8), and sensible mastery criteria (5+ successes over 7+ days)."),
        bulletBold("main-bullets", "Architecture: ",
          "Clean separation between the Next.js web layer and the Python speech microservice. Prisma schema is well-normalised. " +
          "API routes use Zod validation and idempotency keys."),
        bulletBold("main-bullets", "Transliteration fading: ",
          "The three-stage progression (shown \u2192 shown \u2192 hidden) based on success count is pedagogically sound " +
          "and encourages learners to read native script."),
        bulletBold("main-bullets", "Backlog blocking: ",
          "Pausing new content when due reviews exceed 50 prevents the common failure mode of SRS systems where learners " +
          "accumulate an overwhelming review backlog."),
        bulletBold("main-bullets", "Curriculum structure: ",
          "Domain-based progression (home \u2192 food \u2192 transport) with vocabulary \u2192 chunks \u2192 patterns " +
          "follows a reasonable i+1 scaffolding sequence."),
        bulletBold("main-bullets", "Idempotent attempt logging: ",
          "The x-idempotency-key header prevents duplicate scores from network retries, which is important for SRS accuracy."),

        // ────────────────────────────────────────────────────
        // 7. REMAINING LIMITATIONS
        // ────────────────────────────────────────────────────
        heading1("7. Remaining Limitations and Future Recommendations"),
        bodyText(
          "The following items were identified during the audit but were not addressed because they require either " +
          "significant architectural changes, external services, or pedagogical design decisions beyond code fixes."
        ),
        bulletBold("main-bullets", "No Arabic acoustic phonology scoring: ",
          "Detecting pharyngealisation, emphatics, and uvular articulation requires either a purpose-trained classifier " +
          "or phonetic forced alignment (e.g., Montreal Forced Aligner with an Arabic acoustic model). This is a research-level " +
          "problem that cannot be solved with Whisper + librosa alone."),
        bulletBold("main-bullets", "No minimal pair drilling: ",
          "Arabic (\u062D/\u0647, \u0639/\u0621, emphatic/plain) and Mandarin (zh/z, ch/c, sh/s, tones 2/3) both have " +
          "sounds that are extremely hard for English speakers. Minimal pair exercises are among the most evidence-backed " +
          "techniques for phoneme acquisition and should be added to the curriculum."),
        bulletBold("main-bullets", "No receptive-before-productive sequencing: ",
          "Research (Krashen, VanPatten) supports extensive listening before speaking. The app currently treats all four " +
          "skills as parallel. Consider gating speaking exercises behind demonstrated listening comprehension."),
        bulletBold("main-bullets", "Levenshtein distance is too coarse for Chinese characters: ",
          "One wrong character has the same edit distance (1) as one wrong Latin letter, but represents a much larger " +
          "phonetic error. A phoneme-aware distance metric (comparing pinyin representations) would be more informative."),
        bulletBold("main-bullets", "Self-reported grading for non-voice cards: ",
          "LISTENING and READING skills rely entirely on the user manually grading themselves (AGAIN/HARD/GOOD/EASY). " +
          "For a system aiming for maximum correctness, adding objective verification to these skill types would reduce " +
          "the Dunning-Kruger effect in self-assessment."),
        bulletBold("main-bullets", "Tone classifier thresholds are uncalibrated: ",
          "The semitone slope thresholds (0.8, -0.8) and spread threshold (0.45) in _classify_tone() are reasonable " +
          "heuristics but have not been validated against a labelled dataset of Mandarin tones. Calibration against a " +
          "corpus would improve accuracy."),

        spacer(), spacer(),
        bodyRuns([
          new TextRun({ text: "\u2014 End of Report \u2014", size: 22, font: "Arial", color: "888888", italics: true }),
        ]),
      ],
    },
  ],
});

const outputPath = process.argv[2] || "docs/audit-report.docx";
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outputPath, buffer);
  console.log(`Report written to ${outputPath}`);
});
