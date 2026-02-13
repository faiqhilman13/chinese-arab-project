import { randomUUID } from "node:crypto";
import { SkillType } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensure, handleRouteError, ok } from "@/lib/http";
import { API_GRADE_TO_DB } from "@/lib/mappers";
import { reviewGradeSchema } from "@/lib/schemas";
import { getNextReviewUpdate } from "@/lib/srs";

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
    const input = reviewGradeSchema.parse(body);

    const card = await db.reviewCard.findUnique({
      where: {
        id: input.reviewCardId,
      },
    });

    ensure(card, 404, "REVIEW_CARD_NOT_FOUND", "Review card does not exist.");
    ensure(card.userId === user.id, 403, "FORBIDDEN", "Review card does not belong to active user.");

    const grade = API_GRADE_TO_DB[input.grade];
    const next = getNextReviewUpdate(card, grade, new Date());

    const [updatedCard, attemptLog] = await db.$transaction([
      db.reviewCard.update({
        where: {
          id: card.id,
        },
        data: {
          ease: next.ease,
          intervalDays: next.intervalDays,
          dueAt: next.dueAt,
          lastScore: scoreByGrade[input.grade],
          state: next.state,
          successCount: next.successCount,
          lastReviewedAt: next.lastReviewedAt,
          transliterationStage: next.transliterationStage,
        },
      }),
      db.attemptLog.create({
        data: {
          userId: user.id,
          lexicalItemId: card.lexicalItemId,
          skillType: SkillType.READING,
          score: scoreByGrade[input.grade],
          idempotencyKey: `review-${randomUUID()}`,
        },
      }),
    ]);

    return ok({
      reviewCard: {
        id: updatedCard.id,
        dueAt: updatedCard.dueAt.toISOString(),
        state: updatedCard.state.toLowerCase(),
        successCount: updatedCard.successCount,
        transliterationStage: updatedCard.transliterationStage,
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
