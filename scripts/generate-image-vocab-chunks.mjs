import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ItemType, LanguageCode, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function argValue(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }

  return process.argv[index + 1] ?? fallback;
}

function apiLanguageToDb(value) {
  if (value === "ar_msa") return LanguageCode.AR_MSA;
  if (value === "zh_hans") return LanguageCode.ZH_HANS;
  throw new Error(`Unsupported language: ${value}`);
}

function chunkForItem(item) {
  const gloss = item.gloss.trim().toLowerCase();

  if (item.language === LanguageCode.ZH_HANS) {
    const templates = {
      home: {
        scriptText: "我想回家",
        transliteration: "wo xiang hui jia",
        gloss: "I want to go home",
      },
      door: {
        scriptText: "门在哪里？",
        transliteration: "men zai nali",
        gloss: "Where is the door?",
      },
      water: {
        scriptText: "我要水",
        transliteration: "wo yao shui",
        gloss: "I want water",
      },
      station: {
        scriptText: "车站在哪里？",
        transliteration: "chezhan zai nali",
        gloss: "Where is the station?",
      },
      bread: {
        scriptText: "我要面包",
        transliteration: "wo yao mianbao",
        gloss: "I want bread",
      },
      apple: {
        scriptText: "我要苹果",
        transliteration: "wo yao pingguo",
        gloss: "I want an apple",
      },
      milk: {
        scriptText: "我要牛奶",
        transliteration: "wo yao niunai",
        gloss: "I want milk",
      },
    };

    return templates[gloss] ?? null;
  }

  const templates = {
    help: {
      scriptText: "أحتاج مساعدة",
      transliteration: "ahtaj msaada",
      gloss: "I need help",
    },
    police: {
      scriptText: "أحتاج الشرطة",
      transliteration: "ahtaj al-shurta",
      gloss: "I need the police",
    },
    fire: {
      scriptText: "هناك حريق",
      transliteration: "hunak hariq",
      gloss: "There is a fire",
    },
    ambulance: {
      scriptText: "أحتاج إسعاف",
      transliteration: "ahtaj isaaf",
      gloss: "I need an ambulance",
    },
    passport: {
      scriptText: "أين جواز السفر؟",
      transliteration: "ayn jawaz al-safar",
      gloss: "Where is the passport?",
    },
    lost: {
      scriptText: "أنا ضائع",
      transliteration: "ana daia",
      gloss: "I am lost",
    },
    danger: {
      scriptText: "هناك خطر",
      transliteration: "hunak khatar",
      gloss: "There is danger",
    },
    accident: {
      scriptText: "هناك حادث",
      transliteration: "hunak hadith",
      gloss: "There is an accident",
    },
    injury: {
      scriptText: "عندي إصابة",
      transliteration: "indi isaba",
      gloss: "I have an injury",
    },
    stolen: {
      scriptText: "هذا مسروق",
      transliteration: "hadha masruq",
      gloss: "This is stolen",
    },
    emergency: {
      scriptText: "هذه حالة طارئة",
      transliteration: "hadhihi hala tari'a",
      gloss: "This is an emergency",
    },
    call: {
      scriptText: "أحتاج اتصال",
      transliteration: "ahtaj ittisal",
      gloss: "I need a call",
    },
  };

  return templates[gloss] ?? null;
}

async function main() {
  const manifestArg = argValue("--manifest");
  if (!manifestArg) {
    throw new Error("Usage: npm run image-vocab:chunks -- --manifest data/image-vocab-batch.zh_hans.json");
  }

  const manifestPath = path.isAbsolute(manifestArg) ? manifestArg : path.join(rootDir, manifestArg);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const language = apiLanguageToDb(manifest.language);

  let created = 0;
  let updated = 0;

  for (const concept of manifest.concepts ?? []) {
    const item = await prisma.lexicalItem.findUnique({
      where: {
        id: concept.lexicalItemId,
      },
      select: {
        id: true,
        conceptKey: true,
        language: true,
        domain: true,
        scriptText: true,
        transliteration: true,
        gloss: true,
      },
    });

    if (!item || item.language !== language) {
      continue;
    }

    const chunk = chunkForItem(item);
    if (!chunk) {
      continue;
    }
    const chunkConceptKey = `${item.conceptKey}.chunk.image`;
    const existing = await prisma.lexicalItem.findUnique({
      where: {
        conceptKey: chunkConceptKey,
      },
      select: {
        id: true,
      },
    });

    await prisma.lexicalItem.upsert({
      where: {
        conceptKey: chunkConceptKey,
      },
      create: {
        conceptKey: chunkConceptKey,
        language: item.language,
        domain: item.domain,
        itemType: ItemType.CHUNK,
        scriptText: chunk.scriptText,
        transliteration: chunk.transliteration,
        gloss: chunk.gloss,
        difficulty: 1,
      },
      update: {
        scriptText: chunk.scriptText,
        transliteration: chunk.transliteration,
        gloss: chunk.gloss,
      },
    });

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  console.log(`Image vocab chunks complete: ${created} created, ${updated} updated.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
