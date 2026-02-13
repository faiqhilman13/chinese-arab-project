import { LanguageCode } from "@prisma/client";
import { NextRequest } from "next/server";
import {
  DAILY_NEW_SHARE,
  DAILY_PRONUNCIATION_SHARE,
  DAILY_REVIEW_SHARE,
  LANGUAGE_LABELS,
  REVIEW_BACKLOG_BLOCK_THRESHOLD,
} from "@/lib/constants";
import {
  ensureLessonReviewCards,
  getNextLesson,
  getUnlockedPatternNotes,
} from "@/lib/curriculum";
import { db } from "@/lib/db";
import { ApiError, handleRouteError, ok } from "@/lib/http";
import { API_LANGUAGE_TO_DB, DB_LANGUAGE_TO_API } from "@/lib/mappers";
import { languageSchema } from "@/lib/schemas";
import { getOrCreateTodaySession } from "@/lib/session";
import { requireUser } from "@/lib/auth";

function resolveRequestedLanguage(request: NextRequest): LanguageCode | undefined {
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
    const requestedLanguage = resolveRequestedLanguage(request);

    const session = await getOrCreateTodaySession({
      userId: user.id,
      language: requestedLanguage,
    });

    const nextLesson = await getNextLesson(user.id, session.language);
    const now = new Date();

    let dueCount = await db.reviewCard.count({
      where: {
        userId: user.id,
        dueAt: {
          lte: now,
        },
      },
    });

    if (dueCount === 0 && nextLesson) {
      await ensureLessonReviewCards({
        userId: user.id,
        lessonId: nextLesson.id,
        maxNewCards: 6,
      });

      dueCount = await db.reviewCard.count({
        where: {
          userId: user.id,
          dueAt: {
            lte: new Date(),
          },
        },
      });
    }

    const unlockedPatternNotes = await getUnlockedPatternNotes(user.id, session.language);

    return ok({
      date: session.date.toISOString(),
      language: DB_LANGUAGE_TO_API[session.language],
      languageLabel: LANGUAGE_LABELS[session.language],
      session: {
        id: session.id,
        plannedMinutes: session.plannedMinutes,
        completedMinutes: session.completedMinutes,
        streakCount: session.streakCount,
      },
      reviewQueueDue: dueCount,
      allowNewContent: dueCount <= REVIEW_BACKLOG_BLOCK_THRESHOLD,
      dailyAllocation: {
        review: DAILY_REVIEW_SHARE,
        newContent: DAILY_NEW_SHARE,
        pronunciation: DAILY_PRONUNCIATION_SHARE,
      },
      nextLesson,
      unlockedPatternNotes,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
