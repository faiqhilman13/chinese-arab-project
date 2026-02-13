import { ItemType, LanguageCode } from "@prisma/client";
import { NextRequest } from "next/server";
import { stripArabicDiacritics } from "@/lib/arabic-no-harakat";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { handleRouteError, ok } from "@/lib/http";
import { noHarakatQueueQuerySchema } from "@/lib/schemas";

type QueueItem = {
  lexicalItemId: string;
  scriptText: string;
  displayText: string;
  vowelledText: string;
  transliteration: string;
  gloss: string;
  domain: string;
  itemType: "vocab" | "chunk";
  avgScore: number | null;
  lastAttemptAt: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);

    const input = noHarakatQueueQuerySchema.parse({
      language: request.nextUrl.searchParams.get("language"),
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    });

    const [items, metrics] = await Promise.all([
      db.lexicalItem.findMany({
        where: {
          language: LanguageCode.AR_MSA,
          itemType: {
            in: [ItemType.VOCAB, ItemType.CHUNK],
          },
          transliteration: {
            not: null,
          },
          vowelledText: {
            not: null,
          },
        },
        select: {
          id: true,
          scriptText: true,
          transliteration: true,
          vowelledText: true,
          gloss: true,
          domain: true,
          itemType: true,
          createdAt: true,
        },
      }),
      db.noHarakatAttempt.groupBy({
        by: ["lexicalItemId"],
        where: {
          userId: user.id,
        },
        _avg: {
          score: true,
        },
        _max: {
          createdAt: true,
        },
      }),
    ]);

    const metricById = new Map(
      metrics.map((metric) => [
        metric.lexicalItemId,
        {
          avgScore: metric._avg.score,
          lastAttemptAt: metric._max.createdAt,
        },
      ] as const),
    );

    const sortable = items.map((item) => {
      const metric = metricById.get(item.id);
      const seen = Boolean(metric);
      return {
        item,
        seen,
        avgScore: metric?.avgScore ?? null,
        lastAttemptAt: metric?.lastAttemptAt ?? null,
      };
    });

    sortable.sort((left, right) => {
      if (left.seen !== right.seen) {
        return left.seen ? 1 : -1;
      }

      if (!left.seen && !right.seen) {
        return left.item.createdAt.getTime() - right.item.createdAt.getTime();
      }

      const leftScore = left.avgScore ?? 100;
      const rightScore = right.avgScore ?? 100;
      if (leftScore !== rightScore) {
        return leftScore - rightScore;
      }

      const leftDate = left.lastAttemptAt?.getTime() ?? 0;
      const rightDate = right.lastAttemptAt?.getTime() ?? 0;
      return leftDate - rightDate;
    });

    const queue: QueueItem[] = sortable.slice(0, input.limit).map(({ item, avgScore, lastAttemptAt }) => ({
      lexicalItemId: item.id,
      scriptText: item.scriptText,
      displayText: stripArabicDiacritics(item.scriptText),
      vowelledText: item.vowelledText ?? item.scriptText,
      transliteration: item.transliteration ?? "",
      gloss: item.gloss,
      domain: item.domain,
      itemType: item.itemType === ItemType.VOCAB ? "vocab" : "chunk",
      avgScore: avgScore === null ? null : Math.round(avgScore),
      lastAttemptAt: lastAttemptAt ? lastAttemptAt.toISOString() : null,
    }));

    return ok({
      language: input.language,
      totalEligible: items.length,
      queue,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
