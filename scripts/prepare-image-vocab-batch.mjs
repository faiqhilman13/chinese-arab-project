import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ImageAssetStatus, ItemType, LanguageCode, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(rootDir, "data");

function apiLanguageToDb(value) {
  if (value === "ar_msa") {
    return LanguageCode.AR_MSA;
  }

  if (value === "zh_hans") {
    return LanguageCode.ZH_HANS;
  }

  throw new Error("Usage: npm run image-vocab:prepare -- --language ar_msa|zh_hans [--limit 12]");
}

function argValue(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }

  return process.argv[index + 1] ?? fallback;
}

function searchQueryFor(item) {
  const overrides = {
    home: "house",
    station: "train station",
    water: "glass of water",
    help: "help sign",
    lost: "lost sign",
  };
  const base = overrides[item.gloss.trim().toLowerCase()] ?? item.gloss.trim();
  if (item.language === LanguageCode.AR_MSA) {
    return `${base} clear object photograph`;
  }

  return `${base} clear object photograph`;
}

function normalizeConceptPart(value) {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
}

function sharedConceptKey(item) {
  return `shared.${normalizeConceptPart(item.domain) || "general"}.${normalizeConceptPart(item.gloss) || "concept"}`;
}

const poorImageGlosses = new Set([
  "already",
  "because",
  "call",
  "danger",
  "emergency",
  "help",
  "injury",
  "lost",
  "maybe",
  "need",
  "stolen",
]);

async function main() {
  const language = apiLanguageToDb(argValue("--language", "zh_hans"));
  const limit = Number.parseInt(argValue("--limit", "12"), 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new Error("--limit must be an integer from 1 to 50");
  }

  const items = await prisma.lexicalItem.findMany({
    where: {
      language,
      itemType: ItemType.VOCAB,
    },
    orderBy: [{ domain: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      conceptKey: true,
      language: true,
      domain: true,
      scriptText: true,
      transliteration: true,
      gloss: true,
      imageUrl: true,
      _count: {
        select: {
          badImageReports: true,
          imageVocabAttempts: true,
        },
      },
    },
  });

  const assets = await prisma.imageAsset.findMany({
    where: {
      conceptKey: {
        in: [
          ...items.map((item) => item.conceptKey),
          ...items.map((item) => sharedConceptKey(item)),
        ],
      },
      status: ImageAssetStatus.ACTIVE,
    },
    select: {
      conceptKey: true,
    },
  });
  const conceptsWithActiveAssets = new Set(assets.map((asset) => asset.conceptKey));

  const selected = items
    .filter(
      (item) =>
        !poorImageGlosses.has(item.gloss.trim().toLowerCase()) &&
        !conceptsWithActiveAssets.has(item.conceptKey) &&
        !conceptsWithActiveAssets.has(sharedConceptKey(item)),
    )
    .sort((a, b) => {
      const attemptDiff = a._count.imageVocabAttempts - b._count.imageVocabAttempts;
      if (attemptDiff !== 0) {
        return attemptDiff;
      }

      return a.domain.localeCompare(b.domain);
    })
    .slice(0, limit);

  const manifest = {
    generatedAt: new Date().toISOString(),
    language: language === LanguageCode.AR_MSA ? "ar_msa" : "zh_hans",
    limit,
    purpose: "image-vocab-daily-prep",
    notes: [
      "This scaffold selects concepts that do not yet have active image assets.",
      "A later scraper should turn searchQuery values into downloaded ImageAsset rows.",
    ],
    concepts: selected.map((item) => ({
      lexicalItemId: item.id,
      conceptKey: sharedConceptKey(item),
      lexicalConceptKey: item.conceptKey,
      domain: item.domain,
      scriptText: item.scriptText,
      transliteration: item.transliteration,
      gloss: item.gloss,
      searchQuery: searchQueryFor(item),
      badImageReports: item._count.badImageReports,
      imageVocabAttempts: item._count.imageVocabAttempts,
    })),
  };

  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `image-vocab-batch.${manifest.language}.json`);
  await writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Wrote ${manifest.concepts.length} concepts to ${outPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
