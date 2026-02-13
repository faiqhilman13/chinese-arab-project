import { ItemType, type Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
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
      ];
    }

    const items = await db.lexicalItem.findMany({
      where,
      orderBy: [{ domain: "asc" }, { createdAt: "asc" }],
      take: input.limit,
      select: {
        id: true,
        domain: true,
        itemType: true,
        scriptText: true,
        transliteration: true,
        gloss: true,
      },
    });

    const grouped = new Map<
      string,
      Array<{
        lexicalItemId: string;
        itemType: "vocab" | "chunk";
        scriptText: string;
        transliteration: string | null;
        gloss: string;
      }>
    >();

    for (const item of items) {
      const current = grouped.get(item.domain) ?? [];
      current.push({
        lexicalItemId: item.id,
        itemType: item.itemType === ItemType.VOCAB ? "vocab" : "chunk",
        scriptText: item.scriptText,
        transliteration: item.transliteration,
        gloss: item.gloss,
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

    return ok({
      language: input.language,
      total: items.length,
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
