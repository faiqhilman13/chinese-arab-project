import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfUtcDay } from "@/lib/dates";
import { ensure, handleRouteError, ok } from "@/lib/http";
import { API_SKILL_TO_DB } from "@/lib/mappers";
import { attemptSchema } from "@/lib/schemas";
import { getNextReviewUpdate, gradeFromScore } from "@/lib/srs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json();
    const input = attemptSchema.parse(body);

    const idempotencyKey = request.headers.get("x-idempotency-key")?.trim();
    ensure(idempotencyKey, 400, "MISSING_IDEMPOTENCY_KEY", "x-idempotency-key header is required.");

    const existing = await db.attemptLog.findUnique({
      where: {
        userId_idempotencyKey: {
          userId: user.id,
          idempotencyKey,
        },
      },
      include: {
        lexicalItem: {
          select: {
            scriptText: true,
            gloss: true,
          },
        },
      },
    });

    if (existing) {
      return ok({
        idempotent: true,
        attempt: {
          id: existing.id,
          lexicalItemId: existing.lexicalItemId,
          scriptText: existing.lexicalItem.scriptText,
          gloss: existing.lexicalItem.gloss,
          skillType: existing.skillType.toLowerCase(),
          score: existing.score,
          createdAt: existing.createdAt.toISOString(),
        },
      });
    }

    const lexicalItem = await db.lexicalItem.findUnique({
      where: { id: input.lexicalItemId },
      select: {
        id: true,
      },
    });

    ensure(lexicalItem, 404, "ITEM_NOT_FOUND", "Lexical item does not exist.");

    const card = await db.reviewCard.upsert({
      where: {
        userId_lexicalItemId: {
          userId: user.id,
          lexicalItemId: input.lexicalItemId,
        },
      },
      create: {
        userId: user.id,
        lexicalItemId: input.lexicalItemId,
        dueAt: new Date(),
      },
      update: {},
    });

    const nextGrade = gradeFromScore(input.score);
    const srsUpdate = getNextReviewUpdate(card, nextGrade, new Date());

    const [attempt, updatedCard] = await db.$transaction([
      db.attemptLog.create({
        data: {
          userId: user.id,
          lexicalItemId: input.lexicalItemId,
          skillType: API_SKILL_TO_DB[input.skillType],
          score: input.score,
          latencyMs: input.latencyMs,
          idempotencyKey,
        },
      }),
      db.reviewCard.update({
        where: { id: card.id },
        data: {
          ease: srsUpdate.ease,
          intervalDays: srsUpdate.intervalDays,
          dueAt: srsUpdate.dueAt,
          lastScore: input.score,
          state: srsUpdate.state,
          successCount: srsUpdate.successCount,
          lastReviewedAt: srsUpdate.lastReviewedAt,
          transliterationStage: srsUpdate.transliterationStage,
        },
      }),
    ]);

    const today = startOfUtcDay(new Date());
    const dailySession = await db.dailySession.findUnique({
      where: {
        userId_date: {
          userId: user.id,
          date: today,
        },
      },
      select: {
        id: true,
        plannedMinutes: true,
        completedMinutes: true,
      },
    });

    if (dailySession && dailySession.completedMinutes < dailySession.plannedMinutes) {
      await db.dailySession.update({
        where: { id: dailySession.id },
        data: {
          completedMinutes: dailySession.completedMinutes + 1,
        },
      });
    }

    return ok({
      idempotent: false,
      attempt: {
        id: attempt.id,
        lexicalItemId: attempt.lexicalItemId,
        skillType: attempt.skillType.toLowerCase(),
        score: attempt.score,
        createdAt: attempt.createdAt.toISOString(),
      },
      reviewCard: {
        id: updatedCard.id,
        state: updatedCard.state.toLowerCase(),
        dueAt: updatedCard.dueAt.toISOString(),
        successCount: updatedCard.successCount,
        transliterationStage: updatedCard.transliterationStage,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return ok({ idempotent: true });
    }

    return handleRouteError(error);
  }
}
