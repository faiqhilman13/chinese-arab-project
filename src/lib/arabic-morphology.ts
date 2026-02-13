const ARABIC_LETTER_REGEX = /[\u0621-\u064A]/g;

const DIACRITICS_REGEX =
  /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;

const LONG_VOWELS = new Set(["ا", "و", "ي", "ى", "ة"]);

function normalizeArabic(text: string): string {
  return text
    .replace(DIACRITICS_REGEX, "")
    .replaceAll("أ", "ا")
    .replaceAll("إ", "ا")
    .replaceAll("آ", "ا")
    .replaceAll("ؤ", "و")
    .replaceAll("ئ", "ي")
    .replaceAll("ة", "ه")
    .trim();
}

export function extractArabicWord(scriptText: string): string {
  const normalized = normalizeArabic(scriptText);
  const firstWord = normalized.split(/\s+/).find((token) => ARABIC_LETTER_REGEX.test(token)) ?? normalized;
  return firstWord.replace(/[^ء-ي]/g, "");
}

export function guessRoot(scriptText: string): string {
  const word = extractArabicWord(scriptText);
  if (!word) {
    return "غير معروف";
  }

  const withoutArticle = word.startsWith("ال") ? word.slice(2) : word;
  const chars = withoutArticle.split("").filter((char) => !LONG_VOWELS.has(char));
  const deduped: string[] = [];

  for (const char of chars) {
    if (deduped[deduped.length - 1] !== char) {
      deduped.push(char);
    }
  }

  const rootChars = deduped.slice(0, 3);
  if (rootChars.length < 3) {
    return withoutArticle.slice(0, 3) || "غير معروف";
  }

  return rootChars.join("");
}

export function guessWazn(scriptText: string): string {
  const word = extractArabicWord(scriptText);
  if (!word) {
    return "غير مصنف";
  }

  if (word.startsWith("است")) {
    return "X (استفعل)";
  }
  if (word.startsWith("ت")) {
    return "V (تفعّل)";
  }
  if (word.startsWith("ا")) {
    return "IV (أفعل)";
  }
  if (word.startsWith("م")) {
    return "Noun (مفعل/مفعول)";
  }
  if (word.length >= 5 && word[1] === "ا") {
    return "III (فاعل)";
  }
  if (word.length >= 4 && word[1] === word[2]) {
    return "II (فعّل)";
  }
  return "I (فعل)";
}

export function normalizeMorphAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
