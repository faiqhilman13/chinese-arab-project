import {
  ItemType,
  LanguageCode,
  PrismaClient,
} from "@prisma/client";

const prisma = new PrismaClient();

type SeedItem = {
  language: LanguageCode;
  domain: string;
  itemType: ItemType;
  scriptText: string;
  transliteration?: string;
  gloss: string;
  difficulty?: number;
  patternKey?: string;
};

type SeedLesson = {
  language: LanguageCode;
  domain: string;
  sequenceNo: number;
  estimatedMinutes: number;
  itemScripts: string[];
};

const patternSeeds = [
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
] as const;

const items: SeedItem[] = [
  { language: LanguageCode.AR_MSA, domain: "home", itemType: ItemType.VOCAB, scriptText: "بيت", transliteration: "bayt", gloss: "house" },
  { language: LanguageCode.AR_MSA, domain: "home", itemType: ItemType.VOCAB, scriptText: "باب", transliteration: "bab", gloss: "door" },
  { language: LanguageCode.AR_MSA, domain: "home", itemType: ItemType.VOCAB, scriptText: "ماء", transliteration: "maa", gloss: "water" },
  { language: LanguageCode.AR_MSA, domain: "home", itemType: ItemType.VOCAB, scriptText: "سرير", transliteration: "sarir", gloss: "bed" },
  { language: LanguageCode.AR_MSA, domain: "food", itemType: ItemType.VOCAB, scriptText: "خبز", transliteration: "khubz", gloss: "bread" },
  { language: LanguageCode.AR_MSA, domain: "food", itemType: ItemType.VOCAB, scriptText: "تفاح", transliteration: "tuffah", gloss: "apple" },
  { language: LanguageCode.AR_MSA, domain: "food", itemType: ItemType.VOCAB, scriptText: "حليب", transliteration: "halib", gloss: "milk" },
  { language: LanguageCode.AR_MSA, domain: "transport", itemType: ItemType.VOCAB, scriptText: "محطة", transliteration: "mahattah", gloss: "station" },
  { language: LanguageCode.AR_MSA, domain: "home", itemType: ItemType.CHUNK, scriptText: "أين الباب؟", transliteration: "ayna al-bab?", gloss: "where is the door?", patternKey: "ar_location" },
  { language: LanguageCode.AR_MSA, domain: "home", itemType: ItemType.CHUNK, scriptText: "الماء هنا", transliteration: "al-maa huna", gloss: "the water is here", patternKey: "ar_location" },
  { language: LanguageCode.AR_MSA, domain: "food", itemType: ItemType.CHUNK, scriptText: "أريد ماء", transliteration: "urid maa", gloss: "I want water", patternKey: "ar_request" },
  { language: LanguageCode.AR_MSA, domain: "food", itemType: ItemType.CHUNK, scriptText: "أريد خبز", transliteration: "urid khubz", gloss: "I want bread", patternKey: "ar_request" },
  { language: LanguageCode.AR_MSA, domain: "transport", itemType: ItemType.CHUNK, scriptText: "أين المحطة؟", transliteration: "ayna al-mahattah?", gloss: "where is the station?", patternKey: "ar_location" },
  { language: LanguageCode.AR_MSA, domain: "health", itemType: ItemType.CHUNK, scriptText: "أنا متعب", transliteration: "ana mutab", gloss: "I am tired" },
  { language: LanguageCode.AR_MSA, domain: "emergencies", itemType: ItemType.CHUNK, scriptText: "ساعدني", transliteration: "saeidni", gloss: "help me" },

  { language: LanguageCode.ZH_HANS, domain: "home", itemType: ItemType.VOCAB, scriptText: "家", transliteration: "jiā", gloss: "home" },
  { language: LanguageCode.ZH_HANS, domain: "home", itemType: ItemType.VOCAB, scriptText: "门", transliteration: "mén", gloss: "door" },
  { language: LanguageCode.ZH_HANS, domain: "home", itemType: ItemType.VOCAB, scriptText: "水", transliteration: "shuǐ", gloss: "water" },
  { language: LanguageCode.ZH_HANS, domain: "home", itemType: ItemType.VOCAB, scriptText: "床", transliteration: "chuáng", gloss: "bed" },
  { language: LanguageCode.ZH_HANS, domain: "food", itemType: ItemType.VOCAB, scriptText: "面包", transliteration: "miànbāo", gloss: "bread" },
  { language: LanguageCode.ZH_HANS, domain: "food", itemType: ItemType.VOCAB, scriptText: "苹果", transliteration: "píngguǒ", gloss: "apple" },
  { language: LanguageCode.ZH_HANS, domain: "food", itemType: ItemType.VOCAB, scriptText: "牛奶", transliteration: "niúnǎi", gloss: "milk" },
  { language: LanguageCode.ZH_HANS, domain: "transport", itemType: ItemType.VOCAB, scriptText: "车站", transliteration: "chēzhàn", gloss: "station" },
  { language: LanguageCode.ZH_HANS, domain: "home", itemType: ItemType.CHUNK, scriptText: "门在哪里？", transliteration: "mén zài nǎlǐ?", gloss: "where is the door?", patternKey: "zh_location" },
  { language: LanguageCode.ZH_HANS, domain: "home", itemType: ItemType.CHUNK, scriptText: "水在这里", transliteration: "shuǐ zài zhèlǐ", gloss: "the water is here", patternKey: "zh_location" },
  { language: LanguageCode.ZH_HANS, domain: "food", itemType: ItemType.CHUNK, scriptText: "我要水", transliteration: "wǒ yào shuǐ", gloss: "I want water", patternKey: "zh_request" },
  { language: LanguageCode.ZH_HANS, domain: "food", itemType: ItemType.CHUNK, scriptText: "我要面包", transliteration: "wǒ yào miànbāo", gloss: "I want bread", patternKey: "zh_request" },
  { language: LanguageCode.ZH_HANS, domain: "transport", itemType: ItemType.CHUNK, scriptText: "车站在哪里？", transliteration: "chēzhàn zài nǎlǐ?", gloss: "where is the station?", patternKey: "zh_location" },
  { language: LanguageCode.ZH_HANS, domain: "health", itemType: ItemType.CHUNK, scriptText: "我很累", transliteration: "wǒ hěn lèi", gloss: "I am tired" },
  { language: LanguageCode.ZH_HANS, domain: "emergencies", itemType: ItemType.CHUNK, scriptText: "帮帮我", transliteration: "bāngbāng wǒ", gloss: "help me" },
];

const lessons: SeedLesson[] = [
  {
    language: LanguageCode.AR_MSA,
    domain: "home",
    sequenceNo: 1,
    estimatedMinutes: 25,
    itemScripts: ["بيت", "باب", "ماء", "سرير", "أين الباب؟", "الماء هنا"],
  },
  {
    language: LanguageCode.AR_MSA,
    domain: "food",
    sequenceNo: 2,
    estimatedMinutes: 25,
    itemScripts: ["خبز", "تفاح", "حليب", "أريد ماء", "أريد خبز"],
  },
  {
    language: LanguageCode.ZH_HANS,
    domain: "home",
    sequenceNo: 1,
    estimatedMinutes: 25,
    itemScripts: ["家", "门", "水", "床", "门在哪里？", "水在这里"],
  },
  {
    language: LanguageCode.ZH_HANS,
    domain: "food",
    sequenceNo: 2,
    estimatedMinutes: 25,
    itemScripts: ["面包", "苹果", "牛奶", "我要水", "我要面包"],
  },
];

async function main() {
  await prisma.lessonItem.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.generatedVariant.deleteMany();
  await prisma.lexicalItem.deleteMany();
  await prisma.patternNote.deleteMany();

  const patternMap = new Map<string, string>();

  for (const pattern of patternSeeds) {
    const note = await prisma.patternNote.create({
      data: {
        language: pattern.language,
        title: pattern.title,
        explanation: pattern.explanation,
        unlockExposureCount: 12,
      },
    });

    patternMap.set(pattern.key, note.id);
  }

  const itemMap = new Map<string, string>();

  for (const item of items) {
    const lexicalItem = await prisma.lexicalItem.create({
      data: {
        language: item.language,
        domain: item.domain,
        itemType: item.itemType,
        scriptText: item.scriptText,
        transliteration: item.transliteration,
        gloss: item.gloss,
        difficulty: item.difficulty ?? 1,
        patternNoteId: item.patternKey ? patternMap.get(item.patternKey) : null,
      },
    });

    itemMap.set(`${item.language}:${item.scriptText}`, lexicalItem.id);
  }

  for (const lesson of lessons) {
    const createdLesson = await prisma.lesson.create({
      data: {
        language: lesson.language,
        domain: lesson.domain,
        sequenceNo: lesson.sequenceNo,
        estimatedMinutes: lesson.estimatedMinutes,
      },
    });

    for (const [position, script] of lesson.itemScripts.entries()) {
      const lexicalItemId = itemMap.get(`${lesson.language}:${script}`);

      if (!lexicalItemId) {
        throw new Error(`Missing lexical item for ${lesson.language}:${script}`);
      }

      await prisma.lessonItem.create({
        data: {
          lessonId: createdLesson.id,
          lexicalItemId,
          position: position + 1,
        },
      });
    }
  }

  const allItems = await prisma.lexicalItem.findMany({ take: 4, orderBy: { createdAt: "asc" } });

  for (const item of allItems) {
    await prisma.generatedVariant.create({
      data: {
        lexicalItemId: item.id,
        language: item.language,
        promptText: `Use ${item.scriptText} in a short daily phrase`,
        expectedGloss: item.gloss,
      },
    });
  }

  console.log(`Seeded ${items.length} lexical items and ${lessons.length} lessons.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
