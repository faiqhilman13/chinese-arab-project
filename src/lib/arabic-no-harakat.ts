export function stripArabicDiacritics(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeLatinPrediction(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isArabicNoHarakatEligible(item: {
  scriptText: string;
  vowelledText: string | null;
  transliteration: string | null;
}): boolean {
  if (!item.transliteration || !item.transliteration.trim()) {
    return false;
  }

  if (!item.vowelledText || !item.vowelledText.trim()) {
    return false;
  }

  const base = stripArabicDiacritics(item.scriptText);
  return base.length > 0;
}
