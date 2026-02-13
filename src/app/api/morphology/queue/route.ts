import { ItemType, LanguageCode } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { handleRouteError, ok } from "@/lib/http";
import { morphologyQueueQuerySchema } from "@/lib/schemas";

type QueueCandidate = {
  lexicalItemId: string;
  root: string;
  wazn: string;
  lemma: string | null;
  confidence: number;
  scriptText: string;
  transliteration: string | null;
  gloss: string;
  domain: string;
  itemType: "vocab" | "chunk";
  avgScore: number | null;
  lastAttemptAt: Date | null;
  seen: boolean;
};

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);

    const input = morphologyQueueQuerySchema.parse({
      language: request.nextUrl.searchParams.get("language"),
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    });

    const [entries, stats] = await Promise.all([
      db.morphologyEntry.findMany({
        where: {
          lexicalItem: {
            language: LanguageCode.AR_MSA,
          },
        },
        select: {
          lexicalItemId: true,
          root: true,
          wazn: true,
          lemma: true,
          confidence: true,
          lexicalItem: {
            select: {
              scriptText: true,
              transliteration: true,
              gloss: true,
              domain: true,
              itemType: true,
            },
          },
        },
      }),
      db.morphologyAttempt.groupBy({
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

    const statsByLexicalItemId = new Map(
      stats.map((entry) => [
        entry.lexicalItemId,
        {
          avgScore: entry._avg.score,
          lastAttemptAt: entry._max.createdAt,
        },
      ] as const),
    );

    const candidates: QueueCandidate[] = entries.map((entry) => {
      const metric = statsByLexicalItemId.get(entry.lexicalItemId);
      return {
        lexicalItemId: entry.lexicalItemId,
        root: entry.root,
        wazn: entry.wazn,
        lemma: entry.lemma,
        confidence: entry.confidence,
        scriptText: entry.lexicalItem.scriptText,
        transliteration: entry.lexicalItem.transliteration,
        gloss: entry.lexicalItem.gloss,
        domain: entry.lexicalItem.domain,
        itemType: entry.lexicalItem.itemType === ItemType.VOCAB ? "vocab" : "chunk",
        avgScore: metric?.avgScore ?? null,
        lastAttemptAt: metric?.lastAttemptAt ?? null,
        seen: Boolean(metric),
      };
    });

    candidates.sort((left, right) => {
      if (left.seen !== right.seen) {
        return left.seen ? 1 : -1;
      }

      const leftScore = left.avgScore ?? 100;
      const rightScore = right.avgScore ?? 100;
      if (leftScore !== rightScore) {
        return leftScore - rightScore;
      }

      const leftDate = left.lastAttemptAt?.getTime() ?? 0;
      const rightDate = right.lastAttemptAt?.getTime() ?? 0;
      if (leftDate !== rightDate) {
        return leftDate - rightDate;
      }

      return left.lexicalItemId.localeCompare(right.lexicalItemId);
    });

    const queue = candidates.slice(0, input.limit);

    return ok({
      language: input.language,
      totalEligible: candidates.length,
      queue: queue.map((item) => ({
        lexicalItemId: item.lexicalItemId,
        root: item.root,
        wazn: item.wazn,
        lemma: item.lemma,
        confidence: item.confidence,
        scriptText: item.scriptText,
        transliteration: item.transliteration,
        gloss: item.gloss,
        domain: item.domain,
        itemType: item.itemType,
        avgScore: item.avgScore === null ? null : Math.round(item.avgScore),
        lastAttemptAt: item.lastAttemptAt?.toISOString() ?? null,
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
