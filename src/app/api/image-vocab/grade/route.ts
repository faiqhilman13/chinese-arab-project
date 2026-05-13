import { randomUUID } from "node:crypto";
import { ImageVocabStage, ItemType, SchedulerVersion, SkillType } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { sharedConceptKey } from "@/lib/concepts";
import { db } from "@/lib/db";
import { ensure, handleRouteError, ok } from "@/lib/http";
import { API_GRADE_TO_DB } from "@/lib/mappers";
import { getNextSchedule } from "@/lib/review-scheduler";
import { imageVocabGradeSchema } from "@/lib/schemas";

const scoreByGrade = {
  again: 30,
  hard: 60,
  good: 80,
  easy: 95,
} as const;

const stageToDb = {
  recognition: ImageVocabStage.RECOGNITION,
  spoken_recall: ImageVocabStage.SPOKEN_RECALL,
  production: ImageVocabStage.PRODUCTION,
  chunk_use: ImageVocabStage.CHUNK_USE,
} as const;

const skillByStage = {
  recognition: SkillType.READING,
  spoken_recall: SkillType.SPEAKING,
  production: SkillType.SPEAKING,
  chunk_use: SkillType.SPEAKING,
} as const;

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const input = imageVocabGradeSchema.parse(await request.json());

    const lexicalItem = await db.lexicalItem.findUnique({
      where: {
        id: input.lexicalItemId,
      },
      select: {
        id: true,
        itemType: true,
        conceptKey: true,
        domain: true,
        gloss: true,
      },
    });

    ensure(lexicalItem, 404, "ITEM_NOT_FOUND", "Lexical item does not exist.");
    ensure(
      lexicalItem.itemType === ItemType.VOCAB,
      400,
      "UNSUPPORTED_ITEM_TYPE",
      "Image vocabulary only supports vocabulary items.",
    );

    const imageAsset = await db.imageAsset.findUnique({
      where: {
        id: input.imageAssetId,
      },
      select: {
        id: true,
        conceptKey: true,
      },
    });

    ensure(imageAsset, 404, "IMAGE_ASSET_NOT_FOUND", "Image asset does not exist.");
    ensure(
      imageAsset.conceptKey === lexicalItem.conceptKey ||
        imageAsset.conceptKey === sharedConceptKey({ domain: lexicalItem.domain, gloss: lexicalItem.gloss }),
      400,
      "MISMATCHED_IMAGE_ASSET",
      "Image asset does not belong to the provided lexical item concept.",
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
    const score = scoreByGrade[input.grade];

    const [updatedCard, imageAttempt, attemptLog] = await db.$transaction([
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
          lastScore: score,
          state: next.legacy.state,
          successCount: next.legacy.successCount,
          lastReviewedAt: next.legacy.lastReviewedAt,
          transliterationStage: next.legacy.transliterationStage,
        },
      }),
      db.imageVocabAttempt.create({
        data: {
          userId: user.id,
          lexicalItemId: input.lexicalItemId,
          imageAssetId: input.imageAssetId,
          stage: stageToDb[input.stage],
          grade,
          score,
        },
        select: {
          id: true,
          score: true,
        },
      }),
      db.attemptLog.create({
        data: {
          userId: user.id,
          lexicalItemId: input.lexicalItemId,
          skillType: skillByStage[input.stage],
          score,
          idempotencyKey: `image-vocab-${randomUUID()}`,
        },
        select: {
          id: true,
          score: true,
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
      imageAttempt,
      attempt: attemptLog,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
