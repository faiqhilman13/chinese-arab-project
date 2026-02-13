import { NextRequest } from "next/server";
import {
  PRONUNCIATION_DAILY_LIMIT,
  PRONUNCIATION_MONTHLY_LIMIT,
} from "@/lib/constants";
import { db } from "@/lib/db";
import { startOfUtcDay, startOfUtcMonth } from "@/lib/dates";
import { ApiError, ensure, handleRouteError, ok } from "@/lib/http";
import {
  scorePronunciationWithLocalService,
} from "@/lib/local-speech-service";
import { evaluatePronunciation } from "@/lib/pronunciation";
import { pronunciationSchema } from "@/lib/schemas";
import { requireUser } from "@/lib/auth";

async function enforceAttemptLimits(userId: string) {
  const now = new Date();
  const dayStart = startOfUtcDay(now);
  const monthStart = startOfUtcMonth(now);

  const [dailyCount, monthlyCount] = await Promise.all([
    db.pronunciationAttempt.count({
      where: {
        userId,
        createdAt: {
          gte: dayStart,
        },
      },
    }),
    db.pronunciationAttempt.count({
      where: {
        userId,
        createdAt: {
          gte: monthStart,
        },
      },
    }),
  ]);

  if (dailyCount >= PRONUNCIATION_DAILY_LIMIT) {
    throw new ApiError(429, "PRONUNCIATION_DAILY_LIMIT", "Daily pronunciation limit reached.", {
      dailyLimit: PRONUNCIATION_DAILY_LIMIT,
    });
  }

  if (monthlyCount >= PRONUNCIATION_MONTHLY_LIMIT) {
    throw new ApiError(429, "PRONUNCIATION_MONTHLY_LIMIT", "Monthly pronunciation limit reached.", {
      monthlyLimit: PRONUNCIATION_MONTHLY_LIMIT,
    });
  }

  return { dailyCount, monthlyCount };
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const limits = await enforceAttemptLimits(user.id);

    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const lexicalItemId = form.get("lexicalItemId");
      const audio = form.get("audio");

      ensure(typeof lexicalItemId === "string", 400, "INVALID_INPUT", "lexicalItemId is required.");
      ensure(audio instanceof File, 400, "INVALID_INPUT", "audio file is required.");

      const lexicalItem = await db.lexicalItem.findUnique({
        where: { id: lexicalItemId },
        select: {
          id: true,
          scriptText: true,
          transliteration: true,
          language: true,
        },
      });

      ensure(lexicalItem, 404, "ITEM_NOT_FOUND", "Lexical item does not exist.");

      const evaluation = await scorePronunciationWithLocalService({
        audioFile: audio,
        language: lexicalItem.language,
        targetText: lexicalItem.scriptText,
        transliteration: lexicalItem.transliteration,
      });

      const attempt = await db.pronunciationAttempt.create({
        data: {
          userId: user.id,
          lexicalItemId: lexicalItem.id,
          transcript: evaluation.transcript,
          score: evaluation.score,
          audioPath: `upload:${audio.name || "audio"}`,
        },
      });

      return ok({
        attemptId: attempt.id,
        lexicalItemId: lexicalItem.id,
        transcript: evaluation.transcript,
        score: evaluation.score,
        feedback: evaluation.feedback,
        confidence: evaluation.confidence,
        components: evaluation.components,
        remainingDaily: PRONUNCIATION_DAILY_LIMIT - (limits.dailyCount + 1),
        remainingMonthly: PRONUNCIATION_MONTHLY_LIMIT - (limits.monthlyCount + 1),
      });
    }

    const body = await request.json();
    const input = pronunciationSchema.parse(body);

    const lexicalItem = await db.lexicalItem.findUnique({
      where: { id: input.lexicalItemId },
      select: {
        id: true,
        scriptText: true,
        transliteration: true,
      },
    });

    ensure(lexicalItem, 404, "ITEM_NOT_FOUND", "Lexical item does not exist.");

    const evaluation = evaluatePronunciation({
      transcript: input.transcript,
      scriptText: lexicalItem.scriptText,
      transliteration: lexicalItem.transliteration,
    });

    const attempt = await db.pronunciationAttempt.create({
      data: {
        userId: user.id,
        lexicalItemId: lexicalItem.id,
        transcript: input.transcript,
        score: evaluation.score,
        audioPath: input.audioPath,
      },
    });

    return ok({
      attemptId: attempt.id,
      lexicalItemId: lexicalItem.id,
      transcript: input.transcript,
      score: evaluation.score,
      feedback: evaluation.feedback,
      confidence: evaluation.confidence,
      components: {
        intelligibility: evaluation.score,
        fluency: Math.max(40, evaluation.score - 10),
      },
      remainingDaily: PRONUNCIATION_DAILY_LIMIT - (limits.dailyCount + 1),
      remainingMonthly: PRONUNCIATION_MONTHLY_LIMIT - (limits.monthlyCount + 1),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
