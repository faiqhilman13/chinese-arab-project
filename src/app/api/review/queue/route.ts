import { LanguageCode } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ApiError, handleRouteError, ok } from "@/lib/http";
import { API_LANGUAGE_TO_DB, DB_LANGUAGE_TO_API } from "@/lib/mappers";
import { languageSchema } from "@/lib/schemas";

function parseLanguageFilter(request: NextRequest): LanguageCode | undefined {
  const raw = request.nextUrl.searchParams.get("language");
  if (!raw) {
    return undefined;
  }

  const parsed = languageSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError(400, "INVALID_LANGUAGE", "Unsupported language code.");
  }

  return API_LANGUAGE_TO_DB[parsed.data];
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const language = parseLanguageFilter(request);

    const limitRaw = request.nextUrl.searchParams.get("limit") ?? "50";
    const limit = Math.min(100, Math.max(1, Number.parseInt(limitRaw, 10) || 50));

    const cards = await db.reviewCard.findMany({
      where: {
        userId: user.id,
        dueAt: {
          lte: new Date(),
        },
        lexicalItem: language
          ? {
              language,
            }
          : undefined,
      },
      include: {
        lexicalItem: {
          select: {
            language: true,
            domain: true,
            scriptText: true,
            transliteration: true,
            gloss: true,
            itemType: true,
          },
        },
      },
      orderBy: [{ dueAt: "asc" }],
      take: limit,
    });

    return ok({
      dueCount: cards.length,
      cards: cards.map((card) => ({
        id: card.id,
        lexicalItemId: card.lexicalItemId,
        language: DB_LANGUAGE_TO_API[card.lexicalItem.language],
        domain: card.lexicalItem.domain,
        scriptText: card.lexicalItem.scriptText,
        transliteration: card.transliterationStage < 3 ? card.lexicalItem.transliteration : null,
        gloss: card.lexicalItem.gloss,
        itemType: card.lexicalItem.itemType.toLowerCase(),
        dueAt: card.dueAt.toISOString(),
        state: card.state.toLowerCase(),
        transliterationStage: card.transliterationStage,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
