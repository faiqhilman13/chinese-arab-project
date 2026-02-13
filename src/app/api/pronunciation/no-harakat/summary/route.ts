import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { handleRouteError, ok } from "@/lib/http";
import { noHarakatSummaryQuerySchema } from "@/lib/schemas";

function startDateFromRange(range: "7d" | "30d"): Date {
  const days = range === "30d" ? 30 : 7;
  const now = new Date();
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);

    const input = noHarakatSummaryQuerySchema.parse({
      range: request.nextUrl.searchParams.get("range") ?? undefined,
    });

    const startDate = startDateFromRange(input.range);

    const attempts = await db.noHarakatAttempt.findMany({
      where: {
        userId: user.id,
        createdAt: {
          gte: startDate,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 500,
      select: {
        id: true,
        score: true,
        createdAt: true,
        tipCodes: true,
      },
    });

    const total = attempts.length;
    const avgScore =
      total === 0
        ? 0
        : Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / total);

    const tipCounts = new Map<string, number>();
    for (const attempt of attempts) {
      const tipCodes = Array.isArray(attempt.tipCodes) ? attempt.tipCodes : [];
      for (const rawCode of tipCodes) {
        if (typeof rawCode !== "string") {
          continue;
        }
        tipCounts.set(rawCode, (tipCounts.get(rawCode) ?? 0) + 1);
      }
    }

    const topTips = Array.from(tipCounts.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5);

    return ok({
      range: input.range,
      attempts: total,
      averageScore: avgScore,
      topTips,
      recent: attempts.slice(0, 10).map((attempt) => ({
        id: attempt.id,
        score: attempt.score,
        createdAt: attempt.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
