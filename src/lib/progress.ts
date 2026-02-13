import { ReviewState } from "@prisma/client";
import { db } from "@/lib/db";
import { addUtcDays } from "@/lib/dates";
import { DB_LANGUAGE_TO_API } from "@/lib/mappers";

export async function getProgressSummary(userId: string, range: "7d" | "30d") {
  const days = range === "30d" ? 30 : 7;
  const now = new Date();
  const start = addUtcDays(now, -(days - 1));

  const [attempts, reviewCards, latestSession, dueCards] = await Promise.all([
    db.attemptLog.findMany({
      where: {
        userId,
        createdAt: {
          gte: start,
        },
      },
      include: {
        lexicalItem: {
          select: {
            language: true,
            domain: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.reviewCard.findMany({
      where: { userId },
      include: {
        lexicalItem: {
          select: {
            language: true,
            domain: true,
          },
        },
      },
    }),
    db.dailySession.findFirst({
      where: { userId },
      orderBy: { date: "desc" },
      select: {
        streakCount: true,
      },
    }),
    db.reviewCard.findMany({
      where: {
        userId,
        dueAt: {
          lte: now,
        },
      },
      select: {
        lexicalItem: {
          select: {
            language: true,
          },
        },
      },
    }),
  ]);

  const attemptsBySkill: Record<string, number> = {};
  const languageStats: Record<string, { attempts: number; averageScore: number; mastered: number; due: number }> = {
    ar_msa: { attempts: 0, averageScore: 0, mastered: 0, due: 0 },
    zh_hans: { attempts: 0, averageScore: 0, mastered: 0, due: 0 },
  };

  const languageScoreTotals: Record<string, number> = {
    ar_msa: 0,
    zh_hans: 0,
  };

  for (const attempt of attempts) {
    const skill = attempt.skillType.toLowerCase();
    attemptsBySkill[skill] = (attemptsBySkill[skill] ?? 0) + 1;

    const language = DB_LANGUAGE_TO_API[attempt.lexicalItem.language];
    languageStats[language].attempts += 1;
    languageScoreTotals[language] += attempt.score;
  }

  for (const language of Object.keys(languageStats) as Array<keyof typeof languageStats>) {
    const total = languageStats[language].attempts;
    languageStats[language].averageScore = total > 0 ? Math.round(languageScoreTotals[language] / total) : 0;
  }

  const domainProgress = new Map<string, { seen: number; mastered: number }>();

  for (const card of reviewCards) {
    const key = `${DB_LANGUAGE_TO_API[card.lexicalItem.language]}:${card.lexicalItem.domain}`;
    const current = domainProgress.get(key) ?? { seen: 0, mastered: 0 };
    current.seen += 1;

    if (card.state === ReviewState.MASTERED) {
      current.mastered += 1;
      const language = DB_LANGUAGE_TO_API[card.lexicalItem.language];
      languageStats[language].mastered += 1;
    }

    domainProgress.set(key, current);
  }

  for (const due of dueCards) {
    const language = DB_LANGUAGE_TO_API[due.lexicalItem.language];
    languageStats[language].due += 1;
  }

  const domainSummary = Array.from(domainProgress.entries()).map(([key, value]) => {
    const [language, domain] = key.split(":");
    return {
      language,
      domain,
      seen: value.seen,
      mastered: value.mastered,
    };
  });

  return {
    range,
    generatedAt: now.toISOString(),
    streakCount: latestSession?.streakCount ?? 0,
    totalAttempts: attempts.length,
    attemptsBySkill,
    languageStats,
    domainSummary,
  };
}
