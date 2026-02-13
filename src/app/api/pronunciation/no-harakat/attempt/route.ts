import { ArabicRegister, LanguageCode } from "@prisma/client";
import { NextRequest } from "next/server";
import { buildNoHarakatTips } from "@/lib/arabic-no-harakat-tips";
import { stripArabicDiacritics } from "@/lib/arabic-no-harakat";
import { requireUser } from "@/lib/auth";
import {
  PRONUNCIATION_DAILY_LIMIT,
  PRONUNCIATION_MONTHLY_LIMIT,
} from "@/lib/constants";
import { db } from "@/lib/db";
import { startOfUtcDay, startOfUtcMonth } from "@/lib/dates";
import { ApiError, ensure, handleRouteError, ok } from "@/lib/http";
import { scorePronunciationWithLocalService } from "@/lib/local-speech-service";
import { noHarakatAttemptSchema } from "@/lib/schemas";

async function enforceNoHarakatAttemptLimits(userId: string) {
  const now = new Date();
  const dayStart = startOfUtcDay(now);
  const monthStart = startOfUtcMonth(now);

  const [dailyCount, monthlyCount] = await Promise.all([
    db.noHarakatAttempt.count({
      where: {
        userId,
        createdAt: {
          gte: dayStart,
        },
      },
    }),
    db.noHarakatAttempt.count({
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

  return {
    dailyCount,
    monthlyCount,
  };
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const limits = await enforceNoHarakatAttemptLimits(user.id);

    const form = await request.formData();
    const lexicalItemId = form.get("lexicalItemId");
    const predictedTransliteration = form.get("predictedTransliteration");
    const audio = form.get("audio");

    const input = noHarakatAttemptSchema.parse({
      lexicalItemId,
      predictedTransliteration,
    });

    ensure(audio instanceof File, 400, "INVALID_INPUT", "audio file is required.");

    const lexicalItem = await db.lexicalItem.findUnique({
      where: {
        id: input.lexicalItemId,
      },
      select: {
        id: true,
        language: true,
        scriptText: true,
        vowelledText: true,
        transliteration: true,
      },
    });

    ensure(lexicalItem, 404, "ITEM_NOT_FOUND", "Lexical item does not exist.");
    ensure(lexicalItem.language === LanguageCode.AR_MSA, 400, "INVALID_INPUT", "Arabic drill only supports AR_MSA.");
    ensure(
      typeof lexicalItem.transliteration === "string" && lexicalItem.transliteration.trim().length > 0,
      400,
      "INVALID_ITEM",
      "This item is missing expected transliteration.",
    );

    const expectedTransliteration = lexicalItem.transliteration.trim();
    const vowelledText = lexicalItem.vowelledText?.trim() || lexicalItem.scriptText;
    const displayText = stripArabicDiacritics(lexicalItem.scriptText);

    const evaluation = await scorePronunciationWithLocalService({
      audioFile: audio,
      language: lexicalItem.language,
      targetText: lexicalItem.scriptText,
      transliteration: expectedTransliteration,
    });

    const tips = buildNoHarakatTips({
      displayText,
      vowelledText,
      expectedTransliteration,
      predictedTransliteration: input.predictedTransliteration,
      transcript: evaluation.transcript,
    });

    const attempt = await db.noHarakatAttempt.create({
      data: {
        userId: user.id,
        lexicalItemId: lexicalItem.id,
        predictedTransliteration: input.predictedTransliteration,
        expectedTransliteration,
        displayText,
        vowelledText,
        transcript: evaluation.transcript,
        score: Math.round(evaluation.score),
        confidence: evaluation.confidence,
        feedback: evaluation.feedback,
        components: evaluation.components,
        tipCodes: tips.map((tip) => tip.code),
        form: ArabicRegister.MSA,
      },
    });

    return ok({
      attemptId: attempt.id,
      lexicalItemId: lexicalItem.id,
      score: attempt.score,
      confidence: attempt.confidence,
      feedback: attempt.feedback,
      components: evaluation.components,
      transcript: attempt.transcript,
      predictedTransliteration: attempt.predictedTransliteration,
      expectedTransliteration,
      displayText,
      vowelledText,
      tipCodes: tips.map((tip) => tip.code),
      tips,
      remainingDaily: PRONUNCIATION_DAILY_LIMIT - (limits.dailyCount + 1),
      remainingMonthly: PRONUNCIATION_MONTHLY_LIMIT - (limits.monthlyCount + 1),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
