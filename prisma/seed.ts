import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ArabicRegister,
  ItemType,
  LanguageCode,
  PrismaClient,
  SnippetKind,
  SnippetRegister,
} from "@prisma/client";
import { guessRoot, guessWazn } from "../src/lib/arabic-morphology";

const prisma = new PrismaClient();

type PatternSeed = {
  key: string;
  language: LanguageCode;
  title: string;
  explanation: string;
  unlockExposureCount?: number;
};

type ArabicConcept = {
  conceptKey: string;
  domain: string;
  itemType: "vocab" | "chunk";
  gloss: string;
  msa: {
    scriptText: string;
    vowelledText?: string | null;
    transliteration?: string | null;
  };
  syrian: {
    scriptText: string;
    transliteration?: string | null;
  };
};

type ArabicLesson = {
  language: "ar_msa";
  domain: string;
  sequenceNo: number;
  estimatedMinutes: number;
  conceptKeys: string[];
};

type ArabicDataset = {
  version: string;
  profile?: {
    label?: string;
    targetConceptCount?: number;
    targetMix?: {
      vocab?: number;
      chunk?: number;
    };
    notes?: string;
  };
  concepts: ArabicConcept[];
  lessons: ArabicLesson[];
};

type SeedConcept = {
  conceptKey: string;
  language: LanguageCode;
  domain: string;
  itemType: ItemType;
  gloss: string;
  primary: {
    scriptText: string;
    vowelledText?: string | null;
    transliteration?: string | null;
  };
  secondary?: {
    register: ArabicRegister;
    scriptText: string;
    transliteration?: string | null;
  };
  patternKey?: string;
};

type SeedLesson = {
  language: LanguageCode;
  domain: string;
  sequenceNo: number;
  estimatedMinutes: number;
  conceptKeys: string[];
};

type ArabicPhaseNumber = 1 | 2 | 3 | 4;

const patternSeeds: PatternSeed[] = [
  {
    key: "ar_location",
    language: LanguageCode.AR_MSA,
    title: "Location Pattern",
    explanation: "Use [noun] + هنا / هناك to describe location.",
  },
  {
    key: "ar_request",
    language: LanguageCode.AR_MSA,
    title: "Need and Want",
    explanation: "Use أريد + noun/verb to make basic requests.",
  },
  {
    key: "zh_location",
    language: LanguageCode.ZH_HANS,
    title: "Location with 在",
    explanation: "Use 在 before a place and 在哪里 for where-questions.",
  },
  {
    key: "zh_request",
    language: LanguageCode.ZH_HANS,
    title: "Want and Need",
    explanation: "Use 我要 for direct wants and 请给我 for requests.",
  },
];

const zhConcepts: SeedConcept[] = [
  {
    conceptKey: "zh.home.vocab.home",
    language: LanguageCode.ZH_HANS,
    domain: "home",
    itemType: ItemType.VOCAB,
    gloss: "home",
    primary: { scriptText: "家", transliteration: "jia" },
  },
  {
    conceptKey: "zh.home.vocab.door",
    language: LanguageCode.ZH_HANS,
    domain: "home",
    itemType: ItemType.VOCAB,
    gloss: "door",
    primary: { scriptText: "门", transliteration: "men" },
  },
  {
    conceptKey: "zh.home.vocab.water",
    language: LanguageCode.ZH_HANS,
    domain: "home",
    itemType: ItemType.VOCAB,
    gloss: "water",
    primary: { scriptText: "水", transliteration: "shui" },
  },
  {
    conceptKey: "zh.home.vocab.bed",
    language: LanguageCode.ZH_HANS,
    domain: "home",
    itemType: ItemType.VOCAB,
    gloss: "bed",
    primary: { scriptText: "床", transliteration: "chuang" },
  },
  {
    conceptKey: "zh.food.vocab.bread",
    language: LanguageCode.ZH_HANS,
    domain: "food",
    itemType: ItemType.VOCAB,
    gloss: "bread",
    primary: { scriptText: "面包", transliteration: "mianbao" },
  },
  {
    conceptKey: "zh.food.vocab.apple",
    language: LanguageCode.ZH_HANS,
    domain: "food",
    itemType: ItemType.VOCAB,
    gloss: "apple",
    primary: { scriptText: "苹果", transliteration: "pingguo" },
  },
  {
    conceptKey: "zh.food.vocab.milk",
    language: LanguageCode.ZH_HANS,
    domain: "food",
    itemType: ItemType.VOCAB,
    gloss: "milk",
    primary: { scriptText: "牛奶", transliteration: "niunai" },
  },
  {
    conceptKey: "zh.transport.vocab.station",
    language: LanguageCode.ZH_HANS,
    domain: "transport",
    itemType: ItemType.VOCAB,
    gloss: "station",
    primary: { scriptText: "车站", transliteration: "chezhan" },
  },
  {
    conceptKey: "zh.home.chunk.where_door",
    language: LanguageCode.ZH_HANS,
    domain: "home",
    itemType: ItemType.CHUNK,
    gloss: "where is the door?",
    primary: { scriptText: "门在哪里？", transliteration: "men zai nali" },
    patternKey: "zh_location",
  },
  {
    conceptKey: "zh.home.chunk.water_here",
    language: LanguageCode.ZH_HANS,
    domain: "home",
    itemType: ItemType.CHUNK,
    gloss: "the water is here",
    primary: { scriptText: "水在这里", transliteration: "shui zai zheli" },
    patternKey: "zh_location",
  },
  {
    conceptKey: "zh.food.chunk.want_water",
    language: LanguageCode.ZH_HANS,
    domain: "food",
    itemType: ItemType.CHUNK,
    gloss: "I want water",
    primary: { scriptText: "我要水", transliteration: "wo yao shui" },
    patternKey: "zh_request",
  },
  {
    conceptKey: "zh.food.chunk.want_bread",
    language: LanguageCode.ZH_HANS,
    domain: "food",
    itemType: ItemType.CHUNK,
    gloss: "I want bread",
    primary: { scriptText: "我要面包", transliteration: "wo yao mianbao" },
    patternKey: "zh_request",
  },
  {
    conceptKey: "zh.transport.chunk.where_station",
    language: LanguageCode.ZH_HANS,
    domain: "transport",
    itemType: ItemType.CHUNK,
    gloss: "where is the station?",
    primary: { scriptText: "车站在哪里？", transliteration: "chezhan zai nali" },
    patternKey: "zh_location",
  },
  {
    conceptKey: "zh.health.chunk.i_am_tired",
    language: LanguageCode.ZH_HANS,
    domain: "health",
    itemType: ItemType.CHUNK,
    gloss: "I am tired",
    primary: { scriptText: "我很累", transliteration: "wo hen lei" },
  },
  {
    conceptKey: "zh.emergencies.chunk.help_me",
    language: LanguageCode.ZH_HANS,
    domain: "emergencies",
    itemType: ItemType.CHUNK,
    gloss: "help me",
    primary: { scriptText: "帮帮我", transliteration: "bangbang wo" },
  },
];

const zhLessons: SeedLesson[] = [
  {
    language: LanguageCode.ZH_HANS,
    domain: "home",
    sequenceNo: 1,
    estimatedMinutes: 25,
    conceptKeys: [
      "zh.home.vocab.home",
      "zh.home.vocab.door",
      "zh.home.vocab.water",
      "zh.home.vocab.bed",
      "zh.home.chunk.where_door",
      "zh.home.chunk.water_here",
    ],
  },
  {
    language: LanguageCode.ZH_HANS,
    domain: "food",
    sequenceNo: 2,
    estimatedMinutes: 25,
    conceptKeys: [
      "zh.food.vocab.bread",
      "zh.food.vocab.apple",
      "zh.food.vocab.milk",
      "zh.food.chunk.want_water",
      "zh.food.chunk.want_bread",
    ],
  },
];

function parseArabicItemType(value: string): ItemType {
  return value === "vocab" ? ItemType.VOCAB : ItemType.CHUNK;
}

function normalizeTransliteration(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

function normalizeArabicForMatch(value: string): string {
  return value
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[^\u0621-\u064A\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function phaseFromLessonSequence(sequenceNo: number): ArabicPhaseNumber {
  if (sequenceNo <= 20) {
    return 1;
  }
  if (sequenceNo <= 40) {
    return 2;
  }
  if (sequenceNo <= 60) {
    return 3;
  }
  return 4;
}

function loadArabicDataset(): ArabicDataset {
  const datasetPath = path.resolve(process.cwd(), "data", "ar_8020_msa_syrian.v1.json");
  const raw = readFileSync(datasetPath, "utf8");
  const parsed = JSON.parse(raw) as ArabicDataset;

  if (!Array.isArray(parsed.concepts) || parsed.concepts.length === 0) {
    throw new Error("Arabic dataset is missing `concepts`.");
  }

  if (!Array.isArray(parsed.lessons) || parsed.lessons.length === 0) {
    throw new Error("Arabic dataset is missing `lessons`.");
  }

  const seenConceptKeys = new Set<string>();
  for (const concept of parsed.concepts) {
    if (seenConceptKeys.has(concept.conceptKey)) {
      throw new Error(`Duplicate Arabic concept key: ${concept.conceptKey}`);
    }
    seenConceptKeys.add(concept.conceptKey);
  }

  return parsed;
}

async function ensurePatternMap() {
  const map = new Map<string, string>();

  for (const pattern of patternSeeds) {
    const existing = await prisma.patternNote.findFirst({
      where: {
        language: pattern.language,
        title: pattern.title,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.patternNote.update({
        where: { id: existing.id },
        data: {
          explanation: pattern.explanation,
          unlockExposureCount: pattern.unlockExposureCount ?? 12,
        },
      });
      map.set(pattern.key, existing.id);
      continue;
    }

    const created = await prisma.patternNote.create({
      data: {
        language: pattern.language,
        title: pattern.title,
        explanation: pattern.explanation,
        unlockExposureCount: pattern.unlockExposureCount ?? 12,
      },
      select: { id: true },
    });

    map.set(pattern.key, created.id);
  }

  return map;
}

async function upsertConcept(
  concept: SeedConcept,
  patternMap: Map<string, string>,
): Promise<string> {
  const patternNoteId = concept.patternKey ? patternMap.get(concept.patternKey) ?? null : null;

  const lexicalItem = await prisma.lexicalItem.upsert({
    where: { conceptKey: concept.conceptKey },
    create: {
      conceptKey: concept.conceptKey,
      language: concept.language,
      domain: concept.domain,
      itemType: concept.itemType,
      scriptText: concept.primary.scriptText,
      vowelledText: concept.language === LanguageCode.AR_MSA
        ? concept.primary.vowelledText ?? concept.primary.scriptText
        : null,
      transliteration: normalizeTransliteration(concept.primary.transliteration),
      gloss: concept.gloss,
      patternNoteId,
    },
    update: {
      language: concept.language,
      domain: concept.domain,
      itemType: concept.itemType,
      scriptText: concept.primary.scriptText,
      vowelledText: concept.language === LanguageCode.AR_MSA
        ? concept.primary.vowelledText ?? concept.primary.scriptText
        : null,
      transliteration: normalizeTransliteration(concept.primary.transliteration),
      gloss: concept.gloss,
      patternNoteId,
    },
    select: { id: true },
  });

  if (concept.language === LanguageCode.AR_MSA) {
    await prisma.lexicalVariant.upsert({
      where: {
        lexicalItemId_register: {
          lexicalItemId: lexicalItem.id,
          register: ArabicRegister.MSA,
        },
      },
      create: {
        lexicalItemId: lexicalItem.id,
        register: ArabicRegister.MSA,
        scriptText: concept.primary.scriptText,
        transliteration: normalizeTransliteration(concept.primary.transliteration),
        isPrimary: true,
      },
      update: {
        scriptText: concept.primary.scriptText,
        transliteration: normalizeTransliteration(concept.primary.transliteration),
        isPrimary: true,
      },
    });

    if (concept.secondary) {
      await prisma.lexicalVariant.upsert({
        where: {
          lexicalItemId_register: {
            lexicalItemId: lexicalItem.id,
            register: concept.secondary.register,
          },
        },
        create: {
          lexicalItemId: lexicalItem.id,
          register: concept.secondary.register,
          scriptText: concept.secondary.scriptText,
          transliteration: normalizeTransliteration(concept.secondary.transliteration),
          isPrimary: false,
        },
        update: {
          scriptText: concept.secondary.scriptText,
          transliteration: normalizeTransliteration(concept.secondary.transliteration),
          isPrimary: false,
        },
      });
    }
  }

  return lexicalItem.id;
}

async function upsertLesson(lesson: SeedLesson, conceptIdMap: Map<string, string>) {
  const lessonRecord = await prisma.lesson.upsert({
    where: {
      language_domain_sequenceNo: {
        language: lesson.language,
        domain: lesson.domain,
        sequenceNo: lesson.sequenceNo,
      },
    },
    create: {
      language: lesson.language,
      domain: lesson.domain,
      sequenceNo: lesson.sequenceNo,
      estimatedMinutes: lesson.estimatedMinutes,
    },
    update: {
      estimatedMinutes: lesson.estimatedMinutes,
    },
    select: { id: true },
  });

  await prisma.lessonItem.deleteMany({ where: { lessonId: lessonRecord.id } });

  await prisma.$transaction(
    lesson.conceptKeys.map((conceptKey, index) => {
      const lexicalItemId = conceptIdMap.get(conceptKey);
      if (!lexicalItemId) {
        throw new Error(`Lesson references missing concept key: ${conceptKey}`);
      }

      return prisma.lessonItem.create({
        data: {
          lessonId: lessonRecord.id,
          lexicalItemId,
          position: index + 1,
        },
      });
    }),
  );
}

async function rebuildArabicSnippetsAndMorphology(
  args: {
    datasetVersion: string;
    concepts: SeedConcept[];
    lessons: SeedLesson[];
    conceptIdMap: Map<string, string>;
  },
) {
  const arabicConcepts = args.concepts.filter((concept) => concept.language === LanguageCode.AR_MSA);
  const phaseByConceptKey = new Map<string, ArabicPhaseNumber>();
  for (const lesson of args.lessons.filter((lesson) => lesson.language === LanguageCode.AR_MSA)) {
    const phase = phaseFromLessonSequence(lesson.sequenceNo);
    for (const conceptKey of lesson.conceptKeys) {
      if (!phaseByConceptKey.has(conceptKey)) {
        phaseByConceptKey.set(conceptKey, phase);
      }
    }
  }

  const arabicVocab = arabicConcepts.filter((concept) => concept.itemType === ItemType.VOCAB);
  const arabicChunks = arabicConcepts.filter((concept) => concept.itemType === ItemType.CHUNK);
  const sourceLabel = `Arabic 80/20 internal corpus ${args.datasetVersion}`;

  await prisma.snippet.deleteMany({
    where: {
      language: LanguageCode.AR_MSA,
    },
  });

  for (const chunk of arabicChunks) {
    const lexicalItemId = args.conceptIdMap.get(chunk.conceptKey);
    if (!lexicalItemId) {
      continue;
    }

    const phase = phaseByConceptKey.get(chunk.conceptKey) ?? 1;
    const normalizedChunk = normalizeArabicForMatch(chunk.primary.scriptText);
    const linkedLexicalItemIds = new Set<string>([lexicalItemId]);

    const matchingVocab = arabicVocab
      .filter((vocab) => vocab.domain === chunk.domain)
      .filter((vocab) => vocab.primary.scriptText.trim().length >= 2)
      .filter((vocab) => {
        const normalizedVocab = normalizeArabicForMatch(vocab.primary.scriptText);
        return normalizedVocab.length > 0 && normalizedChunk.includes(normalizedVocab);
      })
      .slice(0, 6);

    for (const vocab of matchingVocab) {
      const id = args.conceptIdMap.get(vocab.conceptKey);
      if (id) {
        linkedLexicalItemIds.add(id);
      }
    }

    await prisma.snippet.create({
      data: {
        language: LanguageCode.AR_MSA,
        kind: SnippetKind.SENTENCE,
        register: SnippetRegister.MSA,
        domain: chunk.domain,
        phaseMin: phase,
        phaseMax: Math.min(4, phase + 1),
        difficulty: phase,
        scriptText: chunk.primary.scriptText,
        vowelledText: chunk.primary.vowelledText ?? chunk.primary.scriptText,
        transliteration: normalizeTransliteration(chunk.primary.transliteration),
        gloss: chunk.gloss,
        sourceLabel,
        isActive: true,
        links: {
          create: Array.from(linkedLexicalItemIds).map((linkedId) => ({
            lexicalItemId: linkedId,
          })),
        },
      },
    });
  }

  await prisma.morphologyEntry.deleteMany({
    where: {
      lexicalItem: {
        language: LanguageCode.AR_MSA,
      },
    },
  });

  const morphologyCandidates = arabicVocab.filter((concept) => !/\s/.test(concept.primary.scriptText));
  for (const concept of morphologyCandidates) {
    const lexicalItemId = args.conceptIdMap.get(concept.conceptKey);
    if (!lexicalItemId) {
      continue;
    }

    await prisma.morphologyEntry.create({
      data: {
        lexicalItemId,
        register: ArabicRegister.MSA,
        root: guessRoot(concept.primary.scriptText),
        wazn: guessWazn(concept.primary.scriptText),
        pos: "lexical",
        lemma: concept.primary.scriptText,
        confidence: 60,
      },
    });
  }
}

async function main() {
  const arabicDataset = loadArabicDataset();
  const patternMap = await ensurePatternMap();
  const conceptIdMap = new Map<string, string>();

  const arabicConcepts: SeedConcept[] = arabicDataset.concepts.map((concept) => ({
    conceptKey: concept.conceptKey,
    language: LanguageCode.AR_MSA,
    domain: concept.domain,
    itemType: parseArabicItemType(concept.itemType),
    gloss: concept.gloss,
    primary: {
      scriptText: concept.msa.scriptText,
      vowelledText: concept.msa.vowelledText ?? concept.msa.scriptText,
      transliteration: concept.msa.transliteration,
    },
    secondary: {
      register: ArabicRegister.SYRIAN,
      scriptText: concept.syrian.scriptText,
      transliteration: concept.syrian.transliteration,
    },
  }));

  const allConcepts = [...arabicConcepts, ...zhConcepts];

  for (const concept of allConcepts) {
    const id = await upsertConcept(concept, patternMap);
    conceptIdMap.set(concept.conceptKey, id);
  }

  // Keep Arabic curriculum authoritative to the dataset file.
  const arabicConceptKeys = arabicConcepts.map((concept) => concept.conceptKey);
  await prisma.lexicalItem.deleteMany({
    where: {
      language: LanguageCode.AR_MSA,
      conceptKey: {
        notIn: arabicConceptKeys,
      },
    },
  });

  const arabicLessons: SeedLesson[] = arabicDataset.lessons.map((lesson) => ({
    language: LanguageCode.AR_MSA,
    domain: lesson.domain,
    sequenceNo: lesson.sequenceNo,
    estimatedMinutes: lesson.estimatedMinutes,
    conceptKeys: lesson.conceptKeys,
  }));

  await prisma.lesson.deleteMany({
    where: {
      language: LanguageCode.AR_MSA,
    },
  });

  for (const lesson of [...arabicLessons, ...zhLessons]) {
    await upsertLesson(lesson, conceptIdMap);
  }

  await rebuildArabicSnippetsAndMorphology({
    datasetVersion: arabicDataset.version,
    concepts: arabicConcepts,
    lessons: arabicLessons,
    conceptIdMap,
  });

  const sampleItems = await prisma.lexicalItem.findMany({
    where: { language: LanguageCode.AR_MSA },
    orderBy: { createdAt: "asc" },
    take: 6,
    select: { id: true, language: true, scriptText: true, gloss: true },
  });

  for (const item of sampleItems) {
    const existing = await prisma.generatedVariant.findFirst({
      where: {
        lexicalItemId: item.id,
        promptText: `Use ${item.scriptText} in a short daily phrase`,
      },
      select: { id: true },
    });

    if (!existing) {
      await prisma.generatedVariant.create({
        data: {
          lexicalItemId: item.id,
          language: item.language,
          promptText: `Use ${item.scriptText} in a short daily phrase`,
          expectedGloss: item.gloss,
        },
      });
    }
  }

  const arabicCount = await prisma.lexicalItem.count({ where: { language: LanguageCode.AR_MSA } });
  const zhCount = await prisma.lexicalItem.count({ where: { language: LanguageCode.ZH_HANS } });

  console.log(
    `Seed complete. Arabic concepts: ${arabicCount}. Chinese concepts: ${zhCount}. Lessons synced: ${arabicLessons.length + zhLessons.length}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
