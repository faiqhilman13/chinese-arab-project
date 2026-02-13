import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import { API_LANGUAGE_TO_DB, DB_LANGUAGE_TO_API } from "@/lib/mappers";
import { sessionStartSchema } from "@/lib/schemas";
import { getOrCreateTodaySession } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json();
    const input = sessionStartSchema.parse(body);

    const session = await getOrCreateTodaySession({
      userId: user.id,
      language: input.language ? API_LANGUAGE_TO_DB[input.language] : undefined,
      plannedMinutes: input.plannedMinutes,
    });

    return ok({
      session: {
        id: session.id,
        date: session.date.toISOString(),
        language: DB_LANGUAGE_TO_API[session.language],
        plannedMinutes: session.plannedMinutes,
        completedMinutes: session.completedMinutes,
        streakCount: session.streakCount,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
