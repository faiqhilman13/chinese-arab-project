import { LanguageCode } from "@prisma/client";
import { db } from "@/lib/db";

export async function getNextLesson(userId: string, language: LanguageCode) {
  const lessons = await db.lesson.findMany({
    where: { language },
    include: {
      lessonItems: {
        orderBy: { position: "asc" },
        select: { lexicalItemId: true },
      },
    },
    orderBy: { sequenceNo: "asc" },
  });

  if (lessons.length === 0) {
    return null;
  }

  const lexicalIds = lessons.flatMap((lesson) => lesson.lessonItems.map((item) => item.lexicalItemId));
  const reviewCards = await db.reviewCard.findMany({
    where: {
      userId,
      lexicalItemId: {
        in: lexicalIds,
      },
    },
    select: { lexicalItemId: true, successCount: true },
  });

  const seenSet = new Set(reviewCards.filter((card) => card.successCount > 0).map((card) => card.lexicalItemId));

  const lesson =
    lessons.find((candidate) =>
      candidate.lessonItems.some((lessonItem) => !seenSet.has(lessonItem.lexicalItemId)),
    ) ?? lessons[lessons.length - 1];

  const lessonItemCount = lesson.lessonItems.length;
  const completedCount = lesson.lessonItems.filter((lessonItem) =>
    seenSet.has(lessonItem.lexicalItemId),
  ).length;

  return {
    id: lesson.id,
    domain: lesson.domain,
    sequenceNo: lesson.sequenceNo,
    estimatedMinutes: lesson.estimatedMinutes,
    completedCount,
    lessonItemCount,
  };
}

export async function getUnlockedPatternNotes(userId: string, language: LanguageCode) {
  const notes = await db.patternNote.findMany({
    where: { language },
    include: {
      lexicalItems: {
        select: {
          id: true,
        },
      },
    },
  });

  if (notes.length === 0) {
    return [];
  }

  const attempts = await db.attemptLog.findMany({
    where: {
      userId,
      lexicalItem: {
        language,
      },
    },
    select: {
      lexicalItem: {
        select: {
          patternNoteId: true,
        },
      },
    },
  });

  const exposureByPattern = new Map<string, number>();

  for (const attempt of attempts) {
    if (!attempt.lexicalItem.patternNoteId) {
      continue;
    }

    const count = exposureByPattern.get(attempt.lexicalItem.patternNoteId) ?? 0;
    exposureByPattern.set(attempt.lexicalItem.patternNoteId, count + 1);
  }

  return notes
    .map((note) => ({
      id: note.id,
      title: note.title,
      explanation: note.explanation,
      unlockExposureCount: note.unlockExposureCount,
      exposureCount: exposureByPattern.get(note.id) ?? 0,
    }))
    .filter((note) => note.exposureCount >= note.unlockExposureCount)
    .sort((a, b) => b.exposureCount - a.exposureCount);
}

export async function ensureLessonReviewCards(args: {
  userId: string;
  lessonId: string;
  maxNewCards?: number;
}) {
  const lesson = await db.lesson.findUnique({
    where: { id: args.lessonId },
    include: {
      lessonItems: {
        orderBy: { position: "asc" },
        select: { lexicalItemId: true },
      },
    },
  });

  if (!lesson) {
    return { created: 0 };
  }

  const maxNewCards = args.maxNewCards ?? 6;
  const orderedIds = lesson.lessonItems.map((item) => item.lexicalItemId);
  const existingCards = await db.reviewCard.findMany({
    where: {
      userId: args.userId,
      lexicalItemId: {
        in: orderedIds,
      },
    },
    select: { lexicalItemId: true },
  });

  const existingSet = new Set(existingCards.map((card) => card.lexicalItemId));
  const missingIds = orderedIds
    .filter((id) => !existingSet.has(id))
    .slice(0, maxNewCards);

  if (missingIds.length === 0) {
    return { created: 0 };
  }

  await db.$transaction(
    missingIds.map((lexicalItemId) =>
      db.reviewCard.create({
        data: {
          userId: args.userId,
          lexicalItemId,
          dueAt: new Date(),
        },
      }),
    ),
  );

  return { created: missingIds.length };
}
