import { ImageAssetStatus, ItemType, type ReviewState } from "@prisma/client";
import { NextRequest } from "next/server";
import { buildArabicForms } from "@/lib/arabic-forms";
import { requireUser } from "@/lib/auth";
import { sharedConceptKey } from "@/lib/concepts";
import { db } from "@/lib/db";
import { handleRouteError, ok } from "@/lib/http";
import { API_LANGUAGE_TO_DB } from "@/lib/mappers";
import { imageVocabQueueQuerySchema } from "@/lib/schemas";

type ImageVocabCard = {
  lexicalItemId: string;
  reviewCardId: string | null;
  imageAssetId: string;
  imageUrl: string;
  imageLabel: string;
  conceptKey: string;
  domain: string;
  scriptText: string;
  transliteration: string | null;
  gloss: string;
  state: "new" | "learning" | "review" | "mastered";
  isDue: boolean;
  stage: "recognition" | "spoken_recall" | "production" | "chunk_use";
  forms: {
    primary: {
      scriptText: string;
      transliteration: string | null;
    };
    secondary: {
      scriptText: string;
      transliteration: string | null;
    } | null;
  } | null;
};

function normalizeState(state: ReviewState | null): ImageVocabCard["state"] {
  if (!state) {
    return "new";
  }

  return state.toLowerCase() as ImageVocabCard["state"];
}

function stageForTransliterationStage(stage: number): ImageVocabCard["stage"] {
  if (stage >= 4) {
    return "chunk_use";
  }

  if (stage >= 3) {
    return "production";
  }

  if (stage >= 2) {
    return "spoken_recall";
  }

  return "recognition";
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const now = new Date();
    const input = imageVocabQueueQuerySchema.parse({
      language: request.nextUrl.searchParams.get("language"),
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    });

    const items = await db.lexicalItem.findMany({
      where: {
        language: API_LANGUAGE_TO_DB[input.language],
        itemType: ItemType.VOCAB,
      },
      orderBy: [{ domain: "asc" }, { createdAt: "asc" }],
      include: {
        lexicalVariants: {
          select: {
            register: true,
            scriptText: true,
            transliteration: true,
          },
        },
        reviewCards: {
          where: {
            userId: user.id,
          },
          orderBy: {
            dueAt: "asc",
          },
          take: 1,
          select: {
            id: true,
            dueAt: true,
            state: true,
            transliterationStage: true,
          },
        },
      },
    });

    const conceptKeys = Array.from(
      new Set([
        ...items.map((item) => item.conceptKey),
        ...items.map((item) => sharedConceptKey({ domain: item.domain, gloss: item.gloss })),
      ]),
    );
    const imageAssets = await db.imageAsset.findMany({
      where: {
        conceptKey: {
          in: conceptKeys,
        },
        status: ImageAssetStatus.ACTIVE,
      },
      orderBy: [{ qualityScore: "desc" }, { reportCount: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        conceptKey: true,
        label: true,
        localPath: true,
      },
    });

    const assetByConceptKey = new Map<string, (typeof imageAssets)[number]>();
    for (const asset of imageAssets) {
      if (!assetByConceptKey.has(asset.conceptKey)) {
        assetByConceptKey.set(asset.conceptKey, asset);
      }
    }

    const cards = items.flatMap((item): Array<ImageVocabCard & { createdAt: Date; dueAtDate: Date | null }> => {
      const sharedKey = sharedConceptKey({ domain: item.domain, gloss: item.gloss });
      const asset = assetByConceptKey.get(sharedKey) ?? assetByConceptKey.get(item.conceptKey);
      if (!asset) {
        return [];
      }

      const reviewCard = item.reviewCards[0] ?? null;
      const dueAtDate = reviewCard?.dueAt ?? null;
      const forms = buildArabicForms({
        language: item.language,
        scriptText: item.scriptText,
        transliteration: item.transliteration,
        lexicalVariants: item.lexicalVariants,
      });

      return [
        {
          lexicalItemId: item.id,
          reviewCardId: reviewCard?.id ?? null,
          imageAssetId: asset.id,
          imageUrl: asset.localPath,
          imageLabel: asset.label,
          conceptKey: asset.conceptKey,
          domain: item.domain,
          scriptText: item.scriptText,
          transliteration: item.transliteration,
          gloss: item.gloss,
          state: normalizeState(reviewCard?.state ?? null),
          isDue: dueAtDate ? dueAtDate <= now : false,
          stage: stageForTransliterationStage(reviewCard?.transliterationStage ?? 1),
          forms,
          createdAt: item.createdAt,
          dueAtDate,
        },
      ];
    });

    cards.sort((a, b) => {
      if (a.isDue !== b.isDue) {
        return a.isDue ? -1 : 1;
      }

      const aHasCard = a.reviewCardId !== null;
      const bHasCard = b.reviewCardId !== null;
      if (aHasCard !== bHasCard) {
        return aHasCard ? -1 : 1;
      }

      if (a.dueAtDate && b.dueAtDate) {
        const dueDiff = a.dueAtDate.getTime() - b.dueAtDate.getTime();
        if (dueDiff !== 0) {
          return dueDiff;
        }
      }

      const domainDiff = a.domain.localeCompare(b.domain);
      if (domainDiff !== 0) {
        return domainDiff;
      }

      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    await db.imageAsset.updateMany({
      where: {
        id: {
          in: cards.slice(0, input.limit).map((card) => card.imageAssetId),
        },
      },
      data: {
        lastUsedAt: now,
      },
    });

    const dueCount = cards.filter((card) => card.isDue).length;

    const responseCards = cards.slice(0, input.limit).map((card) => ({
      lexicalItemId: card.lexicalItemId,
      reviewCardId: card.reviewCardId,
      imageAssetId: card.imageAssetId,
      imageUrl: card.imageUrl,
      imageLabel: card.imageLabel,
      conceptKey: card.conceptKey,
      domain: card.domain,
      scriptText: card.scriptText,
      transliteration: card.transliteration,
      gloss: card.gloss,
      state: card.state,
      isDue: card.isDue,
      stage: card.stage,
      forms: card.forms,
    }));

    return ok({
      language: input.language,
      dueCount,
      cards: responseCards,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
