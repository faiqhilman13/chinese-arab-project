import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { handleRouteError, ok } from "@/lib/http";
import { reminderSchema } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);

    const pref = await db.reminderPref.findUnique({
      where: {
        userId: user.id,
      },
    });

    return ok({
      enabled: pref?.enabled ?? false,
      localTime: pref?.localTime ?? "20:00",
      timezone: pref?.timezone ?? "UTC",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json();
    const input = reminderSchema.parse(body);

    const pref = await db.reminderPref.upsert({
      where: {
        userId: user.id,
      },
      create: {
        userId: user.id,
        enabled: input.enabled,
        localTime: input.localTime ?? "20:00",
        timezone: input.timezone ?? "UTC",
      },
      update: {
        enabled: input.enabled,
        localTime: input.localTime,
        timezone: input.timezone,
      },
    });

    return ok({
      enabled: pref.enabled,
      localTime: pref.localTime,
      timezone: pref.timezone,
      updatedAt: pref.updatedAt.toISOString(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
