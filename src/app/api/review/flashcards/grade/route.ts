import { randomUUID } from "node:crypto";
import { ItemType, SchedulerVersion, SkillType } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensure, handleRouteError, ok } from "@/lib/http";
import { API_GRADE_TO_DB } from "@/lib/mappers";
import { getNextSchedule } from "@/lib/review-scheduler";
import { flashcardGradeSchema } from "@/lib/schemas";

const scoreByGrade = {
  again: 30,
  hard: 60,
  good: 80,
  easy: 95,
} as const;

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json();
    const input = flashcardGradeSchema.parse(body);

    const lexicalItem = await db.lexicalItem.findUnique({
      where: {
        id: input.lexicalItemId,
      },
      select: {
        id: true,
        itemType: true,
      },
    });

    ensure(lexicalItem, 404, "ITEM_NOT_FOUND", "Lexical item does not exist.");
    ensure(
      lexicalItem.itemType === ItemType.VOCAB || lexicalItem.itemType === ItemType.CHUNK,
      400,
      "UNSUPPORTED_ITEM_TYPE",
      "Flashcards only support vocabulary and chunks.",
    );

    let card = input.reviewCardId
      ? await db.reviewCard.findUnique({
          where: {
            id: input.reviewCardId,
          },
        })
      : null;

    if (input.reviewCardId) {
      ensure(card, 404, "REVIEW_CARD_NOT_FOUND", "Review card does not exist.");
    }

    if (card) {
      ensure(card.userId === user.id, 403, "FORBIDDEN", "Review card does not belong to active user.");
      ensure(
        card.lexicalItemId === input.lexicalItemId,
        400,
        "MISMATCHED_REVIEW_CARD",
        "Review card does not match provided lexical item.",
      );
    } else {
      card = await db.reviewCard.upsert({
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
    }

    const grade = API_GRADE_TO_DB[input.grade];
    const next = getNextSchedule(card, grade, new Date());

    const [updatedCard, attemptLog] = await db.$transaction([
      db.reviewCard.update({
        where: {
          id: card.id,
        },
        data: {
          schedulerVersion: next.fsrs.schedulerVersion,
          ease: next.legacy.ease,
          intervalDays: next.legacy.intervalDays,
          dueAt: next.legacy.dueAt,
          fsrsStability: next.fsrs.fsrsStability,
          fsrsDifficulty: next.fsrs.fsrsDifficulty,
          fsrsLastReview: next.fsrs.fsrsLastReview,
          fsrsReps: next.fsrs.fsrsReps,
          fsrsLapses: next.fsrs.fsrsLapses,
          lastScore: scoreByGrade[input.grade],
          state: next.legacy.state,
          successCount: next.legacy.successCount,
          lastReviewedAt: next.legacy.lastReviewedAt,
          transliterationStage: next.legacy.transliterationStage,
        },
      }),
      db.attemptLog.create({
        data: {
          userId: user.id,
          lexicalItemId: input.lexicalItemId,
          skillType: SkillType.READING,
          score: scoreByGrade[input.grade],
          idempotencyKey: `flashcard-${randomUUID()}`,
        },
      }),
    ]);

    return ok({
      reviewCard: {
        id: updatedCard.id,
        lexicalItemId: updatedCard.lexicalItemId,
        dueAt: updatedCard.dueAt.toISOString(),
        state: updatedCard.state.toLowerCase(),
        successCount: updatedCard.successCount,
        transliterationStage: updatedCard.transliterationStage,
        schedulerVersion: updatedCard.schedulerVersion.toLowerCase(),
      },
      attempt: {
        id: attemptLog.id,
        score: attemptLog.score,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
