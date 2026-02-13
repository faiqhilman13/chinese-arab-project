import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DATASET_PATH = resolve(process.cwd(), process.argv[2] ?? "data/ar_8020_msa_syrian.v1.json");
const OVERRIDES_PATH = resolve(process.cwd(), process.argv[3] ?? "data/ar_pronunciation_overrides.json");

const ARABIC_TO_LATIN = {
  ا: "a",
  أ: "a",
  إ: "i",
  آ: "aa",
  ب: "b",
  ت: "t",
  ث: "th",
  ج: "j",
  ح: "h",
  خ: "kh",
  د: "d",
  ذ: "dh",
  ر: "r",
  ز: "z",
  س: "s",
  ش: "sh",
  ص: "s",
  ض: "d",
  ط: "t",
  ظ: "z",
  ع: "a",
  غ: "gh",
  ف: "f",
  ق: "q",
  ك: "k",
  ل: "l",
  م: "m",
  ن: "n",
  ه: "h",
  ة: "a",
  و: "w",
  ي: "y",
  ى: "a",
  ء: "a",
  ئ: "i",
  ؤ: "u",
  " ": " ",
  "-": "-",
};

function transliterateArabic(text) {
  return text
    .split("")
    .map((char) => {
      if (ARABIC_TO_LATIN[char] !== undefined) {
        return ARABIC_TO_LATIN[char];
      }
      return /[؟،]/.test(char) ? "" : char;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function autoVowelWord(word) {
  if (!word) {
    return word;
  }

  if (/[\u0610-\u065f\u0670\u06d6-\u06ed]/.test(word)) {
    return word;
  }

  let out = "";
  for (let i = 0; i < word.length; i += 1) {
    const ch = word[i];
    const next = word[i + 1];
    out += ch;

    const isArabicLetter = /[\u0621-\u064A\u0671-\u06D3\u06FA-\u06FF]/.test(ch);
    const hasNextLetter = /[\u0621-\u064A\u0671-\u06D3\u06FA-\u06FF]/.test(next ?? "");
    const isLongCarrier = /[اويى]/.test(ch);
    if (isArabicLetter && hasNextLetter && !isLongCarrier) {
      out += "َ";
    }
  }

  return out;
}

function autoVowelText(text) {
  return text
    .split(" ")
    .map((word) => autoVowelWord(word))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

const dataset = JSON.parse(readFileSync(DATASET_PATH, "utf8"));
let overrides = {};
if (existsSync(OVERRIDES_PATH)) {
  overrides = JSON.parse(readFileSync(OVERRIDES_PATH, "utf8"));
}

let updated = 0;
for (const concept of dataset.concepts ?? []) {
  const conceptOverride = overrides[concept.conceptKey] ?? {};

  const expectedMsaTranslit = normalizeOptionalString(
    conceptOverride?.msa?.transliteration ?? concept.msa?.transliteration ?? transliterateArabic(concept.msa?.scriptText ?? ""),
  );
  const expectedMsaVowelled = normalizeOptionalString(
    conceptOverride?.msa?.vowelledText ?? concept.msa?.vowelledText ?? autoVowelText(concept.msa?.scriptText ?? ""),
  );
  const expectedSyrianTranslit = normalizeOptionalString(
    conceptOverride?.syrian?.transliteration ?? concept.syrian?.transliteration ?? transliterateArabic(concept.syrian?.scriptText ?? ""),
  );

  if (concept.msa.transliteration !== expectedMsaTranslit) {
    concept.msa.transliteration = expectedMsaTranslit;
    updated += 1;
  }
  if (concept.msa.vowelledText !== expectedMsaVowelled) {
    concept.msa.vowelledText = expectedMsaVowelled;
    updated += 1;
  }
  if (concept.syrian.transliteration !== expectedSyrianTranslit) {
    concept.syrian.transliteration = expectedSyrianTranslit;
    updated += 1;
  }
}

writeFileSync(DATASET_PATH, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
console.log(`Enriched ${dataset.concepts.length} concepts at ${DATASET_PATH}. Updated fields: ${updated}.`);
