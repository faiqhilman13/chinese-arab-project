import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function fail(message) {
  console.error(`Dataset validation failed: ${message}`);
  process.exit(1);
}

const datasetPath = process.argv[2] ?? "data/ar_8020_msa_syrian.v1.json";
const absolutePath = resolve(process.cwd(), datasetPath);

let parsed;
try {
  parsed = JSON.parse(readFileSync(absolutePath, "utf8"));
} catch (error) {
  fail(`Could not parse JSON at ${absolutePath}. ${error instanceof Error ? error.message : String(error)}`);
}

if (!Array.isArray(parsed.concepts) || parsed.concepts.length === 0) {
  fail("`concepts` must be a non-empty array.");
}

if (!Array.isArray(parsed.lessons) || parsed.lessons.length === 0) {
  fail("`lessons` must be a non-empty array.");
}

const targetConceptCount = Number.isInteger(parsed?.profile?.targetConceptCount)
  ? parsed.profile.targetConceptCount
  : null;

if (targetConceptCount !== null && parsed.concepts.length !== targetConceptCount) {
  fail(
    `Concept count mismatch. profile.targetConceptCount=${targetConceptCount}, concepts=${parsed.concepts.length}.`,
  );
}

const targetMix = parsed?.profile?.targetMix;
if (
  targetMix &&
  (typeof targetMix.vocab !== "number" || typeof targetMix.chunk !== "number")
) {
  fail("profile.targetMix must define numeric vocab and chunk ratios.");
}

if (targetMix && Math.abs(targetMix.vocab + targetMix.chunk - 1) > 0.0001) {
  fail(`profile.targetMix must sum to 1. Received ${targetMix.vocab + targetMix.chunk}.`);
}

const conceptKeySet = new Set();
const conceptTypeByKey = new Map();
const domainCounts = new Map();
const domainTypeCounts = new Map();
let vocabCount = 0;
let chunkCount = 0;

for (const concept of parsed.concepts) {
  if (typeof concept !== "object" || concept === null) {
    fail("Each concept must be an object.");
  }

  const requiredStringFields = ["conceptKey", "domain", "itemType", "gloss"];
  for (const field of requiredStringFields) {
    if (typeof concept[field] !== "string" || concept[field].trim() === "") {
      fail(`Concept is missing required string field: ${field}`);
    }
  }

  if (concept.itemType !== "vocab" && concept.itemType !== "chunk") {
    fail(`Invalid itemType for concept ${concept.conceptKey}: ${concept.itemType}`);
  }

  if (conceptKeySet.has(concept.conceptKey)) {
    fail(`Duplicate conceptKey: ${concept.conceptKey}`);
  }
  conceptKeySet.add(concept.conceptKey);
  conceptTypeByKey.set(concept.conceptKey, concept.itemType);

  const domain = concept.domain;
  const counts = domainTypeCounts.get(domain) ?? { vocab: 0, chunk: 0 };

  if (concept.itemType === "vocab") {
    vocabCount += 1;
    counts.vocab += 1;
  } else {
    chunkCount += 1;
    counts.chunk += 1;
  }

  domainTypeCounts.set(domain, counts);
  domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);

  for (const formName of ["msa", "syrian"]) {
    const form = concept[formName];
    if (!form || typeof form !== "object") {
      fail(`Concept ${concept.conceptKey} is missing ${formName} form.`);
    }

    if (typeof form.scriptText !== "string" || form.scriptText.trim() === "") {
      fail(`Concept ${concept.conceptKey} has invalid ${formName}.scriptText.`);
    }

    if (
      form.transliteration !== undefined &&
      form.transliteration !== null &&
      typeof form.transliteration !== "string"
    ) {
      fail(`Concept ${concept.conceptKey} has invalid ${formName}.transliteration.`);
    }
  }

  if (typeof concept.msa.transliteration !== "string" || concept.msa.transliteration.trim() === "") {
    fail(`Concept ${concept.conceptKey} must include non-empty msa.transliteration.`);
  }

  if (typeof concept.msa.vowelledText !== "string" || concept.msa.vowelledText.trim() === "") {
    fail(`Concept ${concept.conceptKey} must include non-empty msa.vowelledText.`);
  }

  if (typeof concept.syrian.transliteration !== "string" || concept.syrian.transliteration.trim() === "") {
    fail(`Concept ${concept.conceptKey} must include non-empty syrian.transliteration.`);
  }
}

const vocabRatio = vocabCount / parsed.concepts.length;
if (targetMix) {
  if (Math.abs(vocabRatio - targetMix.vocab) > 0.01) {
    fail(
      `Vocab ratio mismatch. Expected ${targetMix.vocab.toFixed(2)}, got ${vocabRatio.toFixed(2)}.`,
    );
  }
} else if (vocabRatio < 0.45 || vocabRatio > 0.55) {
  fail(`Expected near 50/50 vocab/chunk mix. Got vocab ratio ${vocabRatio.toFixed(2)}.`);
}

const domains = Array.from(domainCounts.keys());
if (domains.length === 0) {
  fail("No domains found in concepts.");
}

if (targetConceptCount !== null && targetConceptCount % domains.length === 0) {
  const expectedPerDomain = targetConceptCount / domains.length;
  for (const domain of domains) {
    const count = domainCounts.get(domain) ?? 0;
    if (count !== expectedPerDomain) {
      fail(`Domain balance mismatch for ${domain}. Expected ${expectedPerDomain}, got ${count}.`);
    }
  }

  if (targetMix && Number.isInteger(expectedPerDomain * targetMix.vocab)) {
    const expectedDomainVocab = expectedPerDomain * targetMix.vocab;
    const expectedDomainChunk = expectedPerDomain * targetMix.chunk;

    for (const domain of domains) {
      const counts = domainTypeCounts.get(domain) ?? { vocab: 0, chunk: 0 };
      if (counts.vocab !== expectedDomainVocab || counts.chunk !== expectedDomainChunk) {
        fail(
          `Domain/type balance mismatch for ${domain}. Expected ${expectedDomainVocab} vocab and ${expectedDomainChunk} chunk, got ${counts.vocab} vocab and ${counts.chunk} chunk.`,
        );
      }
    }
  }
}

const sequenceNos = new Set();
const lessonSizeSet = new Set();
const lessonReferenceCounts = new Map();

for (const lesson of parsed.lessons) {
  if (typeof lesson !== "object" || lesson === null) {
    fail("Each lesson must be an object.");
  }

  if (lesson.language !== "ar_msa") {
    fail(`Lesson language must be ar_msa. Got: ${lesson.language}`);
  }

  if (typeof lesson.domain !== "string" || !lesson.domain.trim()) {
    fail("Lesson requires a non-empty domain.");
  }

  if (!Number.isInteger(lesson.sequenceNo) || lesson.sequenceNo <= 0) {
    fail(`Lesson sequenceNo must be a positive integer. Got: ${lesson.sequenceNo}`);
  }

  if (sequenceNos.has(lesson.sequenceNo)) {
    fail(`Duplicate lesson sequenceNo detected: ${lesson.sequenceNo}`);
  }
  sequenceNos.add(lesson.sequenceNo);

  if (!Array.isArray(lesson.conceptKeys) || lesson.conceptKeys.length === 0) {
    fail(`Lesson ${lesson.sequenceNo} has empty conceptKeys.`);
  }

  lessonSizeSet.add(lesson.conceptKeys.length);

  const lessonConceptSet = new Set();
  let lessonVocab = 0;
  let lessonChunk = 0;

  for (const conceptKey of lesson.conceptKeys) {
    if (!conceptKeySet.has(conceptKey)) {
      fail(`Lesson ${lesson.sequenceNo} references unknown conceptKey: ${conceptKey}`);
    }

    if (lessonConceptSet.has(conceptKey)) {
      fail(`Lesson ${lesson.sequenceNo} repeats conceptKey: ${conceptKey}`);
    }
    lessonConceptSet.add(conceptKey);

    lessonReferenceCounts.set(conceptKey, (lessonReferenceCounts.get(conceptKey) ?? 0) + 1);

    const itemType = conceptTypeByKey.get(conceptKey);
    if (itemType === "vocab") {
      lessonVocab += 1;
    } else {
      lessonChunk += 1;
    }
  }

  if (targetMix && lesson.conceptKeys.length % 2 === 0 && targetMix.vocab === 0.5) {
    if (lessonVocab !== lessonChunk) {
      fail(
        `Lesson ${lesson.sequenceNo} must be balanced (vocab=${lessonVocab}, chunk=${lessonChunk}).`,
      );
    }
  }
}

if (lessonSizeSet.size !== 1) {
  fail(`All lessons must have equal concept count. Sizes seen: ${Array.from(lessonSizeSet).join(", ")}`);
}

for (const conceptKey of conceptKeySet) {
  const count = lessonReferenceCounts.get(conceptKey) ?? 0;
  if (count !== 1) {
    fail(`Concept ${conceptKey} must appear in exactly one lesson. Seen ${count} time(s).`);
  }
}

console.log(
  `Arabic dataset valid: ${parsed.concepts.length} concepts (${vocabCount} vocab, ${chunkCount} chunks), ${parsed.lessons.length} lessons, ${domains.length} balanced domains.`,
);
