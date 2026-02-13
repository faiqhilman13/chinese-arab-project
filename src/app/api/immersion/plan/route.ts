import { LanguageCode } from "@prisma/client";
import { NextRequest } from "next/server";
import { ARABIC_DAILY_TARGET_MINUTES } from "@/lib/arabic-immersion";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { handleRouteError, ok } from "@/lib/http";
import { resolveArabicPhaseForUser } from "@/lib/immersion";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const language = request.nextUrl.searchParams.get("language") ?? "ar_msa";

    if (language !== "ar_msa") {
      return ok({
        language,
        supported: false,
      });
    }

    const { dayNumber, phase } = await resolveArabicPhaseForUser(user.id);
    const now = new Date();
    const weekStart = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

    const weeklyLogs = await db.immersionLog.findMany({
      where: {
        userId: user.id,
        language: LanguageCode.AR_MSA,
        occurredAt: {
          gte: weekStart,
        },
      },
      select: {
        mode: true,
        minutes: true,
      },
    });

    const totals = {
      input: 0,
      output: 0,
      study: 0,
      tutor: 0,
    };

    for (const log of weeklyLogs) {
      const key = log.mode.toLowerCase() as keyof typeof totals;
      totals[key] += log.minutes;
    }

    return ok({
      language,
      supported: true,
      phase: {
        code: phase.code,
        label: phase.label,
        dayNumber,
      },
      target: {
        dailyMinutes: ARABIC_DAILY_TARGET_MINUTES,
        weeklyMinutes: ARABIC_DAILY_TARGET_MINUTES * 7,
        ratio: phase.ratio,
      },
      thisWeek: {
        totalMinutes: Object.values(totals).reduce((sum, value) => sum + value, 0),
        byMode: totals,
      },
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
