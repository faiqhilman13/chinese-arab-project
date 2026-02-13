import { LanguageCode } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { handleRouteError, ok } from "@/lib/http";
import { API_IMMERSION_MODE_TO_DB } from "@/lib/mappers";
import { immersionLogSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json();
    const input = immersionLogSchema.parse(body);

    const created = await db.immersionLog.create({
      data: {
        userId: user.id,
        language: LanguageCode.AR_MSA,
        mode: API_IMMERSION_MODE_TO_DB[input.mode],
        minutes: input.minutes,
        source: input.source,
        notes: input.notes,
        occurredAt: input.occurredAt ?? new Date(),
      },
      select: {
        id: true,
        language: true,
        mode: true,
        minutes: true,
        source: true,
        notes: true,
        occurredAt: true,
        createdAt: true,
      },
    });

    return ok({
      log: {
        ...created,
        language: "ar_msa",
        mode: created.mode.toLowerCase(),
        occurredAt: created.occurredAt.toISOString(),
        createdAt: created.createdAt.toISOString(),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
