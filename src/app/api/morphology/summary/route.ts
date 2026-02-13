import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { handleRouteError, ok } from "@/lib/http";
import { morphologySummaryQuerySchema } from "@/lib/schemas";

function rangeStart(range: "7d" | "30d"): Date {
  const days = range === "30d" ? 30 : 7;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const input = morphologySummaryQuerySchema.parse({
      range: request.nextUrl.searchParams.get("range") ?? undefined,
      language: request.nextUrl.searchParams.get("language") ?? undefined,
    });

    const start = rangeStart(input.range);
    const attempts = await db.morphologyAttempt.findMany({
      where: {
        userId: user.id,
        createdAt: {
          gte: start,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 1000,
      select: {
        id: true,
        promptType: true,
        userAnswer: true,
        expectedAnswer: true,
        isCorrect: true,
        score: true,
        root: true,
        wazn: true,
        createdAt: true,
      },
    });

    const total = attempts.length;
    const averageScore = total > 0
      ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / total)
      : 0;
    const accuracy = total > 0
      ? Math.round((attempts.filter((attempt) => attempt.isCorrect).length / total) * 100)
      : 0;

    const byPromptType = {
      root: {
        attempts: 0,
        correct: 0,
      },
      wazn: {
        attempts: 0,
        correct: 0,
      },
    };

    const confusionCounts = new Map<string, number>();
    const weakWazn = new Map<string, { attempts: number; scoreTotal: number }>();
    const weakRoots = new Map<string, { attempts: number; scoreTotal: number }>();

    for (const attempt of attempts) {
      const prompt = attempt.promptType === "root" ? "root" : "wazn";
      byPromptType[prompt].attempts += 1;
      if (attempt.isCorrect) {
        byPromptType[prompt].correct += 1;
      } else {
        const key = `${attempt.expectedAnswer} -> ${attempt.userAnswer}`;
        confusionCounts.set(key, (confusionCounts.get(key) ?? 0) + 1);
      }

      if (attempt.wazn) {
        const current = weakWazn.get(attempt.wazn) ?? { attempts: 0, scoreTotal: 0 };
        current.attempts += 1;
        current.scoreTotal += attempt.score;
        weakWazn.set(attempt.wazn, current);
      }

      if (attempt.root) {
        const current = weakRoots.get(attempt.root) ?? { attempts: 0, scoreTotal: 0 };
        current.attempts += 1;
        current.scoreTotal += attempt.score;
        weakRoots.set(attempt.root, current);
      }
    }

    const topConfusions = Array.from(confusionCounts.entries())
      .map(([pair, count]) => ({ pair, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const weakWaznList = Array.from(weakWazn.entries())
      .map(([wazn, value]) => ({
        wazn,
        attempts: value.attempts,
        averageScore: Math.round(value.scoreTotal / value.attempts),
      }))
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 6);

    const weakRootList = Array.from(weakRoots.entries())
      .map(([root, value]) => ({
        root,
        attempts: value.attempts,
        averageScore: Math.round(value.scoreTotal / value.attempts),
      }))
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 6);

    return ok({
      language: input.language,
      range: input.range,
      attempts: total,
      averageScore,
      accuracy,
      byPromptType: {
        root: {
          ...byPromptType.root,
          accuracy: byPromptType.root.attempts > 0
            ? Math.round((byPromptType.root.correct / byPromptType.root.attempts) * 100)
            : 0,
        },
        wazn: {
          ...byPromptType.wazn,
          accuracy: byPromptType.wazn.attempts > 0
            ? Math.round((byPromptType.wazn.correct / byPromptType.wazn.attempts) * 100)
            : 0,
        },
      },
      topConfusions,
      weakWazn: weakWaznList,
      weakRoots: weakRootList,
      recent: attempts.slice(0, 12).map((attempt) => ({
        id: attempt.id,
        promptType: attempt.promptType,
        score: attempt.score,
        isCorrect: attempt.isCorrect,
        createdAt: attempt.createdAt.toISOString(),
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
