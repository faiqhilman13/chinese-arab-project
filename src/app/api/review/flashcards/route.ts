import { ItemType, type ReviewState } from "@prisma/client";
import { NextRequest } from "next/server";
import { buildArabicForms } from "@/lib/arabic-forms";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { handleRouteError, ok } from "@/lib/http";
import { API_LANGUAGE_TO_DB } from "@/lib/mappers";
import { flashcardFeedQuerySchema } from "@/lib/schemas";

type FlashcardRow = {
  lexicalItemId: string;
  reviewCardId: string | null;
  scriptText: string;
  transliteration: string | null;
  gloss: string;
  domain: string;
  itemType: "vocab" | "chunk";
  dueAt: string | null;
  state: "new" | "learning" | "review" | "mastered";
  isDue: boolean;
  schedulerVersion: "legacy" | "fsrs" | null;
  transliterationStage: number;
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

type SortableFlashcard = FlashcardRow & {
  createdAt: Date;
  dueAtDate: Date | null;
};

function normalizeState(state: ReviewState | null): FlashcardRow["state"] {
  if (!state) {
    return "new";
  }

  return state.toLowerCase() as FlashcardRow["state"];
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const now = new Date();

    const input = flashcardFeedQuerySchema.parse({
      language: request.nextUrl.searchParams.get("language"),
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    });

    const items = await db.lexicalItem.findMany({
      where: {
        language: API_LANGUAGE_TO_DB[input.language],
        itemType: {
          in: [ItemType.VOCAB, ItemType.CHUNK],
        },
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
            schedulerVersion: true,
            transliterationStage: true,
          },
        },
      },
    });

    const mapped: SortableFlashcard[] = items.map((item) => {
      const card = item.reviewCards[0] ?? null;
      const dueAtDate = card?.dueAt ?? null;
      const isDue = dueAtDate ? dueAtDate <= now : false;
      const schedulerVersion = card
        ? (card.schedulerVersion.toLowerCase() as "legacy" | "fsrs")
        : null;
      const forms = buildArabicForms({
        language: item.language,
        scriptText: item.scriptText,
        transliteration: item.transliteration,
        lexicalVariants: item.lexicalVariants,
      });

      return {
        lexicalItemId: item.id,
        reviewCardId: card?.id ?? null,
        scriptText: item.scriptText,
        transliteration: item.transliteration,
        gloss: item.gloss,
        domain: item.domain,
        itemType: item.itemType === ItemType.VOCAB ? "vocab" : "chunk",
        dueAt: dueAtDate?.toISOString() ?? null,
        state: normalizeState(card?.state ?? null),
        isDue,
        schedulerVersion,
        transliterationStage: card?.transliterationStage ?? 1,
        forms,
        createdAt: item.createdAt,
        dueAtDate,
      };
    });

    const dueCount = mapped.filter((card) => card.isDue).length;

    mapped.sort((a, b) => {
      const aHasCard = a.reviewCardId !== null;
      const bHasCard = b.reviewCardId !== null;

      if (a.isDue !== b.isDue) {
        return a.isDue ? -1 : 1;
      }

      if (aHasCard !== bHasCard) {
        return aHasCard ? -1 : 1;
      }

      if (aHasCard && bHasCard) {
        if (a.dueAtDate && b.dueAtDate) {
          const byDueDate = a.dueAtDate.getTime() - b.dueAtDate.getTime();
          if (byDueDate !== 0) {
            return byDueDate;
          }
        }
      }

      const byDomain = a.domain.localeCompare(b.domain);
      if (byDomain !== 0) {
        return byDomain;
      }

      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    return ok({
      language: input.language,
      dueCount,
      cards: mapped.slice(0, input.limit).map((card) => ({
        lexicalItemId: card.lexicalItemId,
        reviewCardId: card.reviewCardId,
        scriptText: card.scriptText,
        transliteration: card.transliteration,
        gloss: card.gloss,
        domain: card.domain,
        itemType: card.itemType,
        dueAt: card.dueAt,
        state: card.state,
        isDue: card.isDue,
        schedulerVersion: card.schedulerVersion ?? null,
        transliterationStage: card.transliterationStage,
        forms: card.forms,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
