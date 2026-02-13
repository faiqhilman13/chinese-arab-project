import { Prisma, SchedulerVersion } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfUtcDay } from "@/lib/dates";
import { ensure, handleRouteError, ok } from "@/lib/http";
import { API_SKILL_TO_DB } from "@/lib/mappers";
import { getNextSchedule } from "@/lib/review-scheduler";
import { attemptSchema } from "@/lib/schemas";
import { gradeFromScore } from "@/lib/srs";

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
        schedulerVersion: SchedulerVersion.FSRS,
      },
      update: {},
    });

    const nextGrade = gradeFromScore(input.score);
    const schedule = getNextSchedule(card, nextGrade, new Date());

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
          schedulerVersion: schedule.fsrs.schedulerVersion,
          ease: schedule.legacy.ease,
          intervalDays: schedule.legacy.intervalDays,
          dueAt: schedule.legacy.dueAt,
          fsrsStability: schedule.fsrs.fsrsStability,
          fsrsDifficulty: schedule.fsrs.fsrsDifficulty,
          fsrsLastReview: schedule.fsrs.fsrsLastReview,
          fsrsReps: schedule.fsrs.fsrsReps,
          fsrsLapses: schedule.fsrs.fsrsLapses,
          lastScore: input.score,
          state: schedule.legacy.state,
          successCount: schedule.legacy.successCount,
          lastReviewedAt: schedule.legacy.lastReviewedAt,
          transliterationStage: schedule.legacy.transliterationStage,
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
        schedulerVersion: updatedCard.schedulerVersion.toLowerCase(),
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
