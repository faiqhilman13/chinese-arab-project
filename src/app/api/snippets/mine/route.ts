import { LanguageCode, SchedulerVersion } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensure, handleRouteError, ok } from "@/lib/http";
import { snippetMineSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json();
    const input = snippetMineSchema.parse(body);

    const snippet = await db.snippet.findUnique({
      where: { id: input.snippetId },
      select: {
        id: true,
        language: true,
        isActive: true,
        links: {
          select: {
            lexicalItemId: true,
          },
        },
      },
    });

    ensure(snippet && snippet.isActive, 404, "SNIPPET_NOT_FOUND", "Snippet does not exist.");
    ensure(snippet.language === LanguageCode.AR_MSA, 400, "INVALID_SNIPPET", "Snippet language must be Arabic.");

    const linkedLexicalIds = new Set(snippet.links.map((entry) => entry.lexicalItemId));
    const uniqueRequestedIds = Array.from(new Set(input.lexicalItemIds));
    const invalid = uniqueRequestedIds.filter((lexicalItemId) => !linkedLexicalIds.has(lexicalItemId));
    ensure(invalid.length === 0, 400, "INVALID_LEXICAL_ITEMS", "Some selected items are not linked to this snippet.");

    const now = new Date();
    const existingCards = await db.reviewCard.findMany({
      where: {
        userId: user.id,
        lexicalItemId: {
          in: uniqueRequestedIds,
        },
      },
      select: {
        lexicalItemId: true,
      },
    });

    const existingCardSet = new Set(existingCards.map((entry) => entry.lexicalItemId));

    await db.$transaction(
      uniqueRequestedIds.map((lexicalItemId) =>
        db.reviewCard.upsert({
          where: {
            userId_lexicalItemId: {
              userId: user.id,
              lexicalItemId,
            },
          },
          create: {
            userId: user.id,
            lexicalItemId,
            dueAt: now,
            schedulerVersion: SchedulerVersion.FSRS,
          },
          update: {
            dueAt: now,
          },
        }),
      ),
    );

    const dedupeWindowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const existingRecentMine = await db.snippetInteraction.findFirst({
      where: {
        userId: user.id,
        snippetId: input.snippetId,
        minedCount: {
          gt: 0,
        },
        createdAt: {
          gte: dedupeWindowStart,
        },
      },
      select: { id: true },
    });

    if (!existingRecentMine) {
      await db.snippetInteraction.create({
        data: {
          userId: user.id,
          snippetId: input.snippetId,
          minedCount: uniqueRequestedIds.length,
          consumedMinutes: 0,
        },
      });
    }

    return ok({
      snippetId: input.snippetId,
      selected: uniqueRequestedIds.length,
      addedToDeck: uniqueRequestedIds.filter((lexicalItemId) => !existingCardSet.has(lexicalItemId)).length,
      alreadyInDeck: uniqueRequestedIds.filter((lexicalItemId) => existingCardSet.has(lexicalItemId)).length,
      dedupedInteraction: Boolean(existingRecentMine),
      minedLexicalItemIds: uniqueRequestedIds,
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
