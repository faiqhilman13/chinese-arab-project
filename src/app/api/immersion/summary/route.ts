import { LanguageCode } from "@prisma/client";
import { NextRequest } from "next/server";
import { ratioAdherenceScore } from "@/lib/arabic-immersion";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { handleRouteError, ok } from "@/lib/http";
import { DB_IMMERSION_MODE_TO_API } from "@/lib/mappers";
import { immersionSummaryQuerySchema } from "@/lib/schemas";
import { resolveArabicPhaseForUser } from "@/lib/immersion";

function rangeStart(range: "7d" | "30d"): Date {
  const days = range === "30d" ? 30 : 7;
  return new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);
}

function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function calculateStreak(keys: Set<string>): number {
  let streak = 0;
  const cursor = new Date();

  while (true) {
    const key = dayKey(cursor);
    if (!keys.has(key)) {
      break;
    }
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const input = immersionSummaryQuerySchema.parse({
      range: request.nextUrl.searchParams.get("range") ?? undefined,
      language: request.nextUrl.searchParams.get("language") ?? undefined,
    });

    const start = rangeStart(input.range);
    const { phase } = await resolveArabicPhaseForUser(user.id);

    const logs = await db.immersionLog.findMany({
      where: {
        userId: user.id,
        language: LanguageCode.AR_MSA,
        occurredAt: {
          gte: start,
        },
      },
      orderBy: {
        occurredAt: "asc",
      },
      select: {
        mode: true,
        minutes: true,
        occurredAt: true,
      },
    });

    const byMode = {
      input: 0,
      output: 0,
      study: 0,
      tutor: 0,
    };

    const daily = new Map<string, number>();
    const activeDayKeys = new Set<string>();

    for (const log of logs) {
      const mode = DB_IMMERSION_MODE_TO_API[log.mode];
      byMode[mode] += log.minutes;

      const key = dayKey(log.occurredAt);
      activeDayKeys.add(key);
      daily.set(key, (daily.get(key) ?? 0) + log.minutes);
    }

    const totalMinutes = Object.values(byMode).reduce((sum, value) => sum + value, 0);
    const adherenceScore = ratioAdherenceScore(byMode, phase.ratio);
    const activeDays = activeDayKeys.size;
    const averageDailyMinutes = activeDays > 0 ? Math.round(totalMinutes / activeDays) : 0;

    return ok({
      language: input.language,
      range: input.range,
      phase: {
        code: phase.code,
        label: phase.label,
      },
      totalMinutes,
      averageDailyMinutes,
      activeDays,
      activeStreak: calculateStreak(activeDayKeys),
      ratio: {
        target: phase.ratio,
        actual: totalMinutes > 0
          ? {
              input: Math.round((byMode.input / totalMinutes) * 100) / 100,
              output: Math.round((byMode.output / totalMinutes) * 100) / 100,
              study: Math.round((byMode.study / totalMinutes) * 100) / 100,
              tutor: Math.round((byMode.tutor / totalMinutes) * 100) / 100,
            }
          : {
              input: 0,
              output: 0,
              study: 0,
              tutor: 0,
            },
        adherenceScore,
      },
      byMode,
      byDay: Array.from(daily.entries())
        .map(([date, minutes]) => ({ date, minutes }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
