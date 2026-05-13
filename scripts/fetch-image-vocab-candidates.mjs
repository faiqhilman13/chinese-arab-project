import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ImageAssetStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const publicRoot = path.join(rootDir, "public", "image-vocab", "scraped");

function argValue(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }

  return process.argv[index + 1] ?? fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slug(value) {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "") || "image";
}

function sourceDomain(sourceUrl) {
  return new URL(sourceUrl).hostname;
}

function pageUrlForTitle(title) {
  return `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`;
}

function isLikelyBadTitle(title) {
  return [
    "book",
    "notes",
    "essay",
    "plate",
    "map",
    "diagram",
    "logo",
    "icon",
    "flag",
    "coat of arms",
    "flickr - internet archive book images",
    "firehouse",
  ].some((term) => title.toLowerCase().includes(term));
}

function extensionFromMime(mime) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

function jpegDimensions(bytes) {
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      return null;
    }

    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + length;
  }

  return null;
}

function pngDimensions(bytes) {
  if (bytes.length < 24 || bytes.toString("ascii", 1, 4) !== "PNG") {
    return null;
  }

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function webpDimensions(bytes) {
  if (bytes.length < 30 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") {
    return null;
  }

  const chunk = bytes.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    return {
      width: 1 + bytes.readUIntLE(24, 3),
      height: 1 + bytes.readUIntLE(27, 3),
    };
  }

  if (chunk === "VP8 ") {
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff,
    };
  }

  return null;
}

function imageDimensions(bytes, mime) {
  if (mime === "image/png") return pngDimensions(bytes);
  if (mime === "image/webp") return webpDimensions(bytes);
  return jpegDimensions(bytes);
}

function qualityScore(dimensions, candidateIndex) {
  if (!dimensions) {
    return 40;
  }

  const megapixels = (dimensions.width * dimensions.height) / 1_000_000;
  const sizeScore = Math.min(20, Math.round(megapixels * 8));
  const rankPenalty = Math.min(12, candidateIndex * 2);
  return Math.max(50, Math.min(95, 75 + sizeScore - rankPenalty));
}

async function searchCommons(query, limit) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrsearch", `${query} -book -page -map -diagram -logo -icon filetype:bitmap`);
  url.searchParams.set("gsrlimit", String(limit));
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|mime|size");
  url.searchParams.set("iiurlwidth", "900");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "language-learning-mvp-image-fetch/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`Commons search failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  return Object.values(payload.query?.pages ?? {})
    .map((page) => {
      const info = page.imageinfo?.[0];
      return {
        title: page.title,
        mime: info?.mime,
        width: info?.thumbwidth ?? info?.width ?? null,
        height: info?.thumbheight ?? info?.height ?? null,
        sourceUrl: info?.thumburl ?? info?.url,
        originalUrl: info?.url,
        sourcePageUrl: pageUrlForTitle(page.title),
      };
    })
    .filter((candidate) =>
      !isLikelyBadTitle(candidate.title) &&
      candidate.sourceUrl &&
      ["image/jpeg", "image/png", "image/webp"].includes(candidate.mime) &&
      (candidate.width ?? 0) >= 400 &&
      (candidate.height ?? 0) >= 300,
    );
}

async function downloadCandidate(concept, candidate, index) {
  const response = await fetch(candidate.sourceUrl, {
    headers: {
      "User-Agent": "language-learning-mvp-image-fetch/0.1",
    },
  });

  if (!response.ok) {
    return null;
  }

  const mime = response.headers.get("content-type")?.split(";")[0] ?? candidate.mime;
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
    return null;
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 10_000 || bytes.length > 4_000_000) {
    return null;
  }

  const dimensions = imageDimensions(bytes, mime);
  if (!dimensions || dimensions.width < 400 || dimensions.height < 300) {
    return null;
  }

  const contentHash = createHash("sha256").update(bytes).digest("hex");
  const existingBad = await prisma.imageAsset.findFirst({
    where: {
      contentHash,
      status: {
        in: [ImageAssetStatus.REPORTED, ImageAssetStatus.RETIRED],
      },
    },
    select: {
      id: true,
    },
  });

  if (existingBad) {
    return null;
  }

  const conceptDir = path.join(publicRoot, concept.conceptKey);
  await mkdir(conceptDir, { recursive: true });

  const ext = extensionFromMime(mime);
  const fileName = `${slug(concept.gloss)}-${contentHash.slice(0, 12)}.${ext}`;
  const filePath = path.join(conceptDir, fileName);
  await writeFile(filePath, bytes);

  return {
    conceptKey: concept.conceptKey,
    label: concept.gloss,
    sourceUrl: candidate.originalUrl ?? candidate.sourceUrl,
    sourcePageUrl: candidate.sourcePageUrl,
    sourceDomain: sourceDomain(candidate.sourceUrl),
    localPath: `/image-vocab/scraped/${concept.conceptKey}/${fileName}`,
    contentHash,
    width: dimensions.width,
    height: dimensions.height,
    qualityScore: qualityScore(dimensions, index),
    status: ImageAssetStatus.ACTIVE,
  };
}

async function upsertAsset(data) {
  const existing = await prisma.imageAsset.findFirst({
    where: {
      conceptKey: data.conceptKey,
      contentHash: data.contentHash,
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    await prisma.imageAsset.update({
      where: {
        id: existing.id,
      },
      data,
    });
    return "updated";
  }

  await prisma.imageAsset.create({
    data,
  });
  return "created";
}

async function main() {
  const manifestArg = argValue("--manifest");
  if (!manifestArg) {
    throw new Error("Usage: npm run image-vocab:fetch -- --manifest data/image-vocab-batch.zh_hans.json");
  }

  const manifestPath = path.isAbsolute(manifestArg) ? manifestArg : path.join(rootDir, manifestArg);
  const maxPerConcept = Number.parseInt(argValue("--max-per-concept", "1"), 10);
  const searchLimit = Number.parseInt(argValue("--candidates", "8"), 10);
  const delayMs = Number.parseInt(argValue("--delay-ms", "500"), 10);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const report = {
    generatedAt: new Date().toISOString(),
    sourceManifest: path.relative(rootDir, manifestPath),
    language: manifest.language ?? null,
    accepted: [],
    skipped: [],
  };

  for (const concept of manifest.concepts ?? []) {
    const existingActive = await prisma.imageAsset.count({
      where: {
        conceptKey: concept.conceptKey,
        status: ImageAssetStatus.ACTIVE,
      },
    });

    if (existingActive >= maxPerConcept) {
      skipped += 1;
      report.skipped.push({
        conceptKey: concept.conceptKey,
        gloss: concept.gloss,
        reason: "active asset already exists",
      });
      continue;
    }

    let candidates = [];
    try {
      candidates = await searchCommons(concept.searchQuery, searchLimit);
    } catch (error) {
      skipped += 1;
      const message = error instanceof Error ? error.message : String(error);
      report.skipped.push({
        conceptKey: concept.conceptKey,
        gloss: concept.gloss,
        reason: message,
      });
      console.warn(`${concept.conceptKey}: ${message}`);
      await sleep(delayMs);
      continue;
    }
    let accepted = 0;

    for (let index = 0; index < candidates.length && accepted < maxPerConcept; index += 1) {
      const data = await downloadCandidate(concept, candidates[index], index);
      if (!data) {
        continue;
      }

      const result = await upsertAsset(data);
      report.accepted.push({
        conceptKey: concept.conceptKey,
        gloss: concept.gloss,
        result,
        localPath: data.localPath,
        sourcePageUrl: data.sourcePageUrl,
        width: data.width,
        height: data.height,
        qualityScore: data.qualityScore,
      });
      if (result === "created") {
        created += 1;
      } else {
        updated += 1;
      }
      accepted += 1;
    }

    if (accepted === 0) {
      skipped += 1;
      report.skipped.push({
        conceptKey: concept.conceptKey,
        gloss: concept.gloss,
        reason: "no accepted image candidate",
        searchQuery: concept.searchQuery,
      });
      console.warn(`No accepted image for ${concept.conceptKey} (${concept.searchQuery})`);
    }

    await sleep(delayMs);
  }

  const reportPath = path.join(rootDir, "data", `image-vocab-fetch-report.${manifest.language ?? "unknown"}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Image candidate fetch complete: ${created} created, ${updated} updated, ${skipped} skipped.`);
  console.log(`Wrote fetch report to ${reportPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
