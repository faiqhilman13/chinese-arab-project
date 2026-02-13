import { LanguageCode } from "@prisma/client";
import { ALT_SCHEDULE_ANCHOR_UTC, DEFAULT_PLANNED_MINUTES } from "@/lib/constants";
import { db } from "@/lib/db";
import { diffUtcDays, startOfUtcDay } from "@/lib/dates";

export function getAlternatingLanguage(date: Date): LanguageCode {
  const anchor = new Date(ALT_SCHEDULE_ANCHOR_UTC);
  const dayOffset = diffUtcDays(startOfUtcDay(date), startOfUtcDay(anchor));

  return Math.abs(dayOffset) % 2 === 0 ? LanguageCode.AR_MSA : LanguageCode.ZH_HANS;
}

async function calculateStreak(userId: string, today: Date) {
  const previousSessions = await db.dailySession.findMany({
    where: {
      userId,
      date: {
        lt: today,
      },
    },
    orderBy: {
      date: "desc",
    },
    take: 2,
  });

  if (previousSessions.length === 0) {
    return 1;
  }

  const latest = previousSessions[0];
  const gapDays = diffUtcDays(today, latest.date);

  if (gapDays <= 1) {
    return latest.streakCount + 1;
  }

  if (gapDays === 2) {
    // Lightweight freeze behavior: allows one missed day without streak reset.
    return latest.streakCount;
  }

  return 1;
}

export async function getOrCreateTodaySession(args: {
  userId: string;
  language?: LanguageCode;
  plannedMinutes?: number;
}) {
  const today = startOfUtcDay(new Date());
  const language = args.language ?? getAlternatingLanguage(today);
  const plannedMinutes = args.plannedMinutes ?? DEFAULT_PLANNED_MINUTES;

  const existing = await db.dailySession.findUnique({
    where: {
      userId_date: {
        userId: args.userId,
        date: today,
      },
    },
  });

  if (existing) {
    if (args.plannedMinutes || args.language) {
      return db.dailySession.update({
        where: { id: existing.id },
        data: {
          language,
          plannedMinutes,
        },
      });
    }

    return existing;
  }

  const streakCount = await calculateStreak(args.userId, today);

  return db.dailySession.create({
    data: {
      userId: args.userId,
      date: today,
      language,
      plannedMinutes,
      streakCount,
    },
  });
}
