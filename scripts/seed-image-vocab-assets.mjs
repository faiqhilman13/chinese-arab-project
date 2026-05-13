import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ImageAssetStatus, ItemType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const publicDir = path.join(rootDir, "public", "image-vocab", "seed");

const seedImages = [
  {
    glosses: ["home", "house"],
    label: "house",
    sourceUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/House%20in%20Cavite.jpg",
    sourcePageUrl: "https://commons.wikimedia.org/wiki/File:House_in_Cavite.jpg",
  },
  {
    glosses: ["door"],
    label: "door",
    sourceUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Front%20door%20of%20house.jpg",
    sourcePageUrl: "https://commons.wikimedia.org/wiki/File:Front_door_of_house.jpg",
  },
  {
    glosses: ["water"],
    label: "glass of water",
    sourceUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Glass%20of%20Water.jpg",
    sourcePageUrl: "https://commons.wikimedia.org/wiki/File:Glass_of_Water.jpg",
  },
  {
    glosses: ["bed"],
    label: "bed",
    sourceUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Bed.jpg",
    sourcePageUrl: "https://commons.wikimedia.org/wiki/File:Bed.jpg",
  },
  {
    glosses: ["bread"],
    label: "bread",
    sourceUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Bread%20rolls.jpg",
    sourcePageUrl: "https://commons.wikimedia.org/wiki/File:Bread_rolls.jpg",
  },
  {
    glosses: ["apple"],
    label: "apple",
    sourceUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Red%20Apple.jpg",
    sourcePageUrl: "https://commons.wikimedia.org/wiki/File:Red_Apple.jpg",
  },
  {
    glosses: ["milk"],
    label: "milk",
    sourceUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Glass%20of%20milk.jpg",
    sourcePageUrl: "https://commons.wikimedia.org/wiki/File:Glass_of_milk.jpg",
  },
  {
    glosses: ["station", "train station"],
    label: "train station",
    sourceUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Railway%20station%20platform.jpg",
    sourcePageUrl: "https://commons.wikimedia.org/wiki/File:Railway_station_platform.jpg",
  },
];

function normalizeGloss(value) {
  return value.trim().toLowerCase();
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

function sourceDomain(sourceUrl) {
  return new URL(sourceUrl).hostname;
}

function extensionFromContentType(contentType) {
  if (contentType?.includes("png")) {
    return "png";
  }

  if (contentType?.includes("webp")) {
    return "webp";
  }

  return "jpg";
}

async function downloadImage(entry) {
  await mkdir(publicDir, { recursive: true });
  const downloadUrl = new URL(entry.sourceUrl);
  if (downloadUrl.hostname.endsWith("wikimedia.org") && !downloadUrl.searchParams.has("width")) {
    downloadUrl.searchParams.set("width", "900");
  }

  const response = await fetch(downloadUrl, {
    redirect: "follow",
    headers: {
      "User-Agent": "language-learning-mvp-image-seed/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${entry.label}: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const ext = extensionFromContentType(contentType);
  const fileName = `${entry.label.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase()}.${ext}`;
  const filePath = path.join(publicDir, fileName);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(filePath, bytes);

  return {
    contentHash: createHash("sha256").update(bytes).digest("hex"),
    localPath: `/image-vocab/seed/${fileName}`,
  };
}

async function main() {
  const items = await prisma.lexicalItem.findMany({
    where: {
      itemType: ItemType.VOCAB,
    },
    select: {
      conceptKey: true,
      domain: true,
      gloss: true,
    },
  });

  let createdOrUpdated = 0;

  for (const entry of seedImages) {
    const matches = items.filter((item) => entry.glosses.includes(normalizeGloss(item.gloss)));
    if (matches.length === 0) {
      continue;
    }

    let downloaded;
    try {
      downloaded = await downloadImage(entry);
    } catch (error) {
      console.warn(error instanceof Error ? error.message : error);
      continue;
    }

    for (const item of matches) {
      const existing = await prisma.imageAsset.findFirst({
        where: {
          conceptKey: sharedConceptKey(item),
          sourceUrl: entry.sourceUrl,
        },
        select: {
          id: true,
        },
      });

      const data = {
        conceptKey: sharedConceptKey(item),
        label: entry.label,
        sourceUrl: entry.sourceUrl,
        sourcePageUrl: entry.sourcePageUrl,
        sourceDomain: sourceDomain(entry.sourceUrl),
        localPath: downloaded.localPath,
        contentHash: downloaded.contentHash,
        qualityScore: 80,
        status: ImageAssetStatus.ACTIVE,
      };

      if (existing) {
        await prisma.imageAsset.update({
          where: {
            id: existing.id,
          },
          data,
        });
      } else {
        await prisma.imageAsset.create({
          data,
        });
      }

      createdOrUpdated += 1;
    }
  }

  console.log(`Seeded ${createdOrUpdated} image vocab asset records.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
