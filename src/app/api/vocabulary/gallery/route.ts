import { ItemType, type Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { buildArabicForms } from "@/lib/arabic-forms";
import { requireUser } from "@/lib/auth";
import { DOMAIN_ORDER } from "@/lib/constants";
import { db } from "@/lib/db";
import { handleRouteError, ok } from "@/lib/http";
import { API_LANGUAGE_TO_DB } from "@/lib/mappers";
import { galleryQuerySchema } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);

    const input = galleryQuerySchema.parse({
      language: request.nextUrl.searchParams.get("language"),
      domain: request.nextUrl.searchParams.get("domain") ?? undefined,
      search: request.nextUrl.searchParams.get("search") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      page: request.nextUrl.searchParams.get("page") ?? undefined,
      pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined,
    });

    const where: Prisma.LexicalItemWhereInput = {
      language: API_LANGUAGE_TO_DB[input.language],
      itemType: {
        in: [ItemType.VOCAB, ItemType.CHUNK],
      },
      domain: input.domain,
    };

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
        {
          lexicalVariants: {
            some: {
              scriptText: {
                contains: input.search,
              },
            },
          },
        },
        {
          lexicalVariants: {
            some: {
              transliteration: {
                contains: input.search,
              },
            },
          },
        },
      ];
    }

    const isLegacyLimitQuery = typeof input.limit === "number";
    const pageSize = input.limit ?? input.pageSize;
    const page = isLegacyLimitQuery ? 1 : input.page;
    const skip = isLegacyLimitQuery ? 0 : (page - 1) * pageSize;

    const [totalMatching, items, distinctDomains] = await Promise.all([
      db.lexicalItem.count({ where }),
      db.lexicalItem.findMany({
        where,
        orderBy: [{ domain: "asc" }, { createdAt: "asc" }],
        skip,
        take: pageSize,
        select: {
          id: true,
          domain: true,
          itemType: true,
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
      }),
      db.lexicalItem.findMany({
        where: {
          language: API_LANGUAGE_TO_DB[input.language],
          itemType: {
            in: [ItemType.VOCAB, ItemType.CHUNK],
          },
        },
        distinct: ["domain"],
        select: {
          domain: true,
        },
      }),
    ]);

    const grouped = new Map<
      string,
      Array<{
        lexicalItemId: string;
        itemType: "vocab" | "chunk";
        scriptText: string;
        transliteration: string | null;
        gloss: string;
        forms: {
          primary: {
            scriptText: string;
            transliteration: string | null;
          };
          secondary: {
            scriptText: string;
            transliteration: string | null;
          } | null;
        } | null;
      }>
    >();

    for (const item of items) {
      const current = grouped.get(item.domain) ?? [];
      const forms = buildArabicForms({
        language: item.language,
        scriptText: item.scriptText,
        transliteration: item.transliteration,
        lexicalVariants: item.lexicalVariants,
      });
      current.push({
        lexicalItemId: item.id,
        itemType: item.itemType === ItemType.VOCAB ? "vocab" : "chunk",
        scriptText: item.scriptText,
        transliteration: item.transliteration,
        gloss: item.gloss,
        forms,
      });
      grouped.set(item.domain, current);
    }

    const sortedDomains = Array.from(grouped.keys()).sort((a, b) => {
      const leftIndex = DOMAIN_ORDER.indexOf(a as (typeof DOMAIN_ORDER)[number]);
      const rightIndex = DOMAIN_ORDER.indexOf(b as (typeof DOMAIN_ORDER)[number]);
      const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
      const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;

      if (normalizedLeft !== normalizedRight) {
        return normalizedLeft - normalizedRight;
      }

      return a.localeCompare(b);
    });

    const availableDomains = distinctDomains
      .map((entry) => entry.domain)
      .sort((a, b) => {
        const leftIndex = DOMAIN_ORDER.indexOf(a as (typeof DOMAIN_ORDER)[number]);
        const rightIndex = DOMAIN_ORDER.indexOf(b as (typeof DOMAIN_ORDER)[number]);
        const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
        const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;

        if (normalizedLeft !== normalizedRight) {
          return normalizedLeft - normalizedRight;
        }

        return a.localeCompare(b);
      });

    const totalPages = Math.max(1, Math.ceil(totalMatching / pageSize));
    const hasNextPage = page < totalPages;

    return ok({
      language: input.language,
      total: totalMatching,
      page,
      pageSize,
      totalPages,
      hasNextPage,
      availableDomains,
      domains: sortedDomains.map((domain) => {
        const domainItems = grouped.get(domain) ?? [];
        return {
          domain,
          count: domainItems.length,
          items: domainItems,
        };
      }),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
