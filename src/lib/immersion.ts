import { LanguageCode } from "@prisma/client";
import { dayNumberFromStart, getArabicPhase } from "@/lib/arabic-immersion";
import { db } from "@/lib/db";

export async function resolveArabicPhaseForUser(userId: string) {
  const [firstSession, firstAttempt] = await Promise.all([
    db.dailySession.findFirst({
      where: {
        userId,
        language: LanguageCode.AR_MSA,
      },
      orderBy: { date: "asc" },
      select: { date: true },
    }),
    db.attemptLog.findFirst({
      where: {
        userId,
        lexicalItem: {
          language: LanguageCode.AR_MSA,
        },
      },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);

  const startDate = firstSession?.date ?? firstAttempt?.createdAt ?? new Date();
  const dayNumber = dayNumberFromStart(startDate);
  const phase = getArabicPhase(dayNumber);

  return {
    startDate,
    dayNumber,
    phase,
  };
}
