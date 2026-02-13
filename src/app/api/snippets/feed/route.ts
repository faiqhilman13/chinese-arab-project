import { LanguageCode, type Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { buildArabicForms } from "@/lib/arabic-forms";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { handleRouteError, ok } from "@/lib/http";
import { snippetsFeedQuerySchema } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const input = snippetsFeedQuerySchema.parse({
      language: request.nextUrl.searchParams.get("language"),
      domain: request.nextUrl.searchParams.get("domain") ?? undefined,
      search: request.nextUrl.searchParams.get("search") ?? undefined,
      phase: request.nextUrl.searchParams.get("phase") ?? undefined,
      page: request.nextUrl.searchParams.get("page") ?? undefined,
      pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined,
    });

    const where: Prisma.SnippetWhereInput = {
      language: LanguageCode.AR_MSA,
      isActive: true,
      domain: input.domain,
    };

    if (typeof input.phase === "number") {
      where.AND = [
        { phaseMin: { lte: input.phase } },
        { phaseMax: { gte: input.phase } },
      ];
    }

    if (input.search) {
      where.OR = [
        {
          scriptText: {
            contains: input.search,
          },
        },
        {
          gloss: {
            contains: input.search,
          },
        },
        {
          transliteration: {
            contains: input.search,
          },
        },
      ];
    }

    const skip = (input.page - 1) * input.pageSize;

    const [total, snippets, domains, interactions, reviewCards] = await Promise.all([
      db.snippet.count({ where }),
      db.snippet.findMany({
        where,
        orderBy: [{ domain: "asc" }, { difficulty: "asc" }, { createdAt: "asc" }],
        skip,
        take: input.pageSize,
        select: {
          id: true,
          domain: true,
          kind: true,
          register: true,
          phaseMin: true,
          phaseMax: true,
          difficulty: true,
          scriptText: true,
          vowelledText: true,
          transliteration: true,
          gloss: true,
          sourceLabel: true,
          links: {
            select: {
              lexicalItemId: true,
              tokenText: true,
              lexicalItem: {
                select: {
                  scriptText: true,
                  transliteration: true,
                  gloss: true,
                  language: true,
                  lexicalVariants: {
                    select: {
                      register: true,
                      scriptText: true,
                      transliteration: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      db.snippet.findMany({
        where: {
          language: LanguageCode.AR_MSA,
          isActive: true,
        },
        distinct: ["domain"],
        select: {
          domain: true,
        },
      }),
      db.snippetInteraction.groupBy({
        by: ["snippetId"],
        where: {
          userId: user.id,
        },
        _avg: {
          comprehension: true,
        },
        _sum: {
          consumedMinutes: true,
          minedCount: true,
        },
        _max: {
          createdAt: true,
        },
      }),
      db.reviewCard.findMany({
        where: {
          userId: user.id,
        },
        select: {
          lexicalItemId: true,
          schedulerVersion: true,
        },
      }),
    ]);

    const interactionBySnippet = new Map(
      interactions.map((entry) => [
        entry.snippetId,
        {
          averageComprehension: entry._avg.comprehension ? Math.round(entry._avg.comprehension * 10) / 10 : null,
          consumedMinutes: entry._sum.consumedMinutes ?? 0,
          minedCount: entry._sum.minedCount ?? 0,
          lastSeenAt: entry._max.createdAt?.toISOString() ?? null,
        },
      ] as const),
    );

    const reviewCardByLexicalItemId = new Map(
      reviewCards.map((card) => [card.lexicalItemId, card.schedulerVersion]),
    );

    const totalPages = Math.max(1, Math.ceil(total / input.pageSize));

    return ok({
      language: input.language,
      total,
      page: input.page,
      pageSize: input.pageSize,
      totalPages,
      hasNextPage: input.page < totalPages,
      availableDomains: domains.map((entry) => entry.domain).sort((a, b) => a.localeCompare(b)),
      snippets: snippets.map((snippet) => {
        const stats = interactionBySnippet.get(snippet.id) ?? null;
        return {
          snippetId: snippet.id,
          domain: snippet.domain,
          kind: snippet.kind.toLowerCase(),
          register: snippet.register.toLowerCase(),
          phaseMin: snippet.phaseMin,
          phaseMax: snippet.phaseMax,
          difficulty: snippet.difficulty,
          scriptText: snippet.scriptText,
          vowelledText: snippet.vowelledText,
          transliteration: snippet.transliteration,
          gloss: snippet.gloss,
          sourceLabel: snippet.sourceLabel,
          stats,
          linkedTerms: snippet.links.map((link) => {
            const forms = buildArabicForms({
              language: link.lexicalItem.language,
              scriptText: link.lexicalItem.scriptText,
              transliteration: link.lexicalItem.transliteration,
              lexicalVariants: link.lexicalItem.lexicalVariants,
            });

            return {
              lexicalItemId: link.lexicalItemId,
              tokenText: link.tokenText ?? null,
              scriptText: link.lexicalItem.scriptText,
              transliteration: link.lexicalItem.transliteration,
              gloss: link.lexicalItem.gloss,
              forms,
              inReview: reviewCardByLexicalItemId.has(link.lexicalItemId),
            };
          }),
        };
      }),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
