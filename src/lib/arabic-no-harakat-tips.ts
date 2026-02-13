import { stripArabicDiacritics } from "@/lib/arabic-no-harakat";

export type NoHarakatTipCode =
  | "LONG_VOWEL_MISSING"
  | "SHORT_VOWEL_CONFUSION"
  | "SHADDA_GEMINATION"
  | "TAA_MARBUTA_ENDING"
  | "HAMZA_CARRIER"
  | "ALIF_MAQSURA"
  | "ARTICLE_ASSIMILATION"
  | "WEAK_LETTER_GUESS"
  | "GENERAL_LISTEN_REPEAT";

export type NoHarakatTip = {
  code: NoHarakatTipCode;
  title: string;
  body: string;
};

function normalizeLatin(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasDoubleConsonant(value: string): boolean {
  return /([bcdfghjklmnpqrstvwxyz])\1/.test(value);
}

function startsWithSunLetterArticle(displayText: string): boolean {
  const stripped = stripArabicDiacritics(displayText).replace(/\s+/g, "");
  if (!stripped.startsWith("ال") || stripped.length < 3) {
    return false;
  }

  const third = stripped[2];
  return "تثدذرزسشصضطظلن".includes(third);
}

const TIP_LIBRARY: Record<Exclude<NoHarakatTipCode, "GENERAL_LISTEN_REPEAT">, Omit<NoHarakatTip, "code">> = {
  LONG_VOWEL_MISSING: {
    title: "Mark long vowels explicitly",
    body: "Track long vowels (aa/ii/uu). If the word has ا/ي/و as vowel carriers, lengthen that sound clearly.",
  },
  SHORT_VOWEL_CONFUSION: {
    title: "Anchor short-vowel pattern",
    body: "Memorize the likely short-vowel skeleton (a/i/u) for this word family and repeat it in 2-3 slow reps.",
  },
  SHADDA_GEMINATION: {
    title: "Double consonant must be held",
    body: "When a consonant is doubled (shadda), hold/press it slightly longer. Do not reduce it to a single consonant.",
  },
  TAA_MARBUTA_ENDING: {
    title: "Watch taa marbuta ending",
    body: "Words ending with ة are often realized as -a/-ah in pause. Link it to a mnemonic phrase and repeat aloud.",
  },
  HAMZA_CARRIER: {
    title: "Hamza needs clean onset",
    body: "For hamza letters (أ/إ/ؤ/ئ), reset the onset cleanly instead of sliding through the vowel.",
  },
  ALIF_MAQSURA: {
    title: "Final alif maqsura often sounds like aa",
    body: "When you see ى at the end, test an aa ending and compare against the model audio.",
  },
  ARTICLE_ASSIMILATION: {
    title: "Lam assimilation with sun letters",
    body: "In ال + sun letter words, the lam assimilates. Emphasize the following consonant instead.",
  },
  WEAK_LETTER_GUESS: {
    title: "Weak-letter roots need memory anchors",
    body: "و/ي can shift vowel quality. Build a mini-pair or phrase for this word to lock in pronunciation.",
  },
};

export function buildNoHarakatTips(args: {
  displayText: string;
  vowelledText: string;
  expectedTransliteration: string;
  predictedTransliteration: string;
  transcript: string;
}): NoHarakatTip[] {
  const expected = normalizeLatin(args.expectedTransliteration);
  const predicted = normalizeLatin(args.predictedTransliteration);
  const displayText = stripArabicDiacritics(args.displayText);
  const vowelledText = args.vowelledText;
  const transcript = args.transcript.trim();

  const codes: NoHarakatTipCode[] = [];

  const longVowelExpected = (expected.match(/aa|ii|uu/g) ?? []).length;
  const longVowelPredicted = (predicted.match(/aa|ii|uu/g) ?? []).length;
  if (longVowelExpected > longVowelPredicted) {
    codes.push("LONG_VOWEL_MISSING");
  }

  const weakLetterCount = (displayText.match(/[وي]/g) ?? []).length;
  if (weakLetterCount > 0 && predicted.length > 0 && !/[wy]/.test(predicted)) {
    codes.push("WEAK_LETTER_GUESS");
  }

  if (hasDoubleConsonant(expected) && !hasDoubleConsonant(predicted)) {
    codes.push("SHADDA_GEMINATION");
  }

  if (displayText.endsWith("ة")) {
    codes.push("TAA_MARBUTA_ENDING");
  }

  if (/[أإؤئء]/.test(displayText + vowelledText)) {
    codes.push("HAMZA_CARRIER");
  }

  if (displayText.endsWith("ى")) {
    codes.push("ALIF_MAQSURA");
  }

  if (startsWithSunLetterArticle(displayText)) {
    codes.push("ARTICLE_ASSIMILATION");
  }

  if (predicted.length > 0 && expected.length > 0) {
    const sameLength = Math.abs(predicted.length - expected.length) <= 2;
    const likelyShortVowelIssue = sameLength && longVowelExpected === longVowelPredicted && predicted !== expected;
    if (likelyShortVowelIssue) {
      codes.push("SHORT_VOWEL_CONFUSION");
    }
  }

  if (transcript.length < 2) {
    codes.push("GENERAL_LISTEN_REPEAT");
  }

  const uniqueCodes = Array.from(new Set(codes)).slice(0, 3);

  if (uniqueCodes.length === 0) {
    return [
      {
        code: "GENERAL_LISTEN_REPEAT",
        title: "Use short listen-repeat cycles",
        body: "Listen once, repeat once, then compare with the vowelled form before your next attempt.",
      },
    ];
  }

  return uniqueCodes.map((code) => {
    if (code === "GENERAL_LISTEN_REPEAT") {
      return {
        code,
        title: "Use short listen-repeat cycles",
        body: "Listen once, repeat once, then compare with the vowelled form before your next attempt.",
      };
    }

    return {
      code,
      ...TIP_LIBRARY[code],
    };
  });
}
