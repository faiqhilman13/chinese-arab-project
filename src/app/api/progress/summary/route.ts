import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import { getProgressSummary } from "@/lib/progress";
import { rangeSchema } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const rangeParam = request.nextUrl.searchParams.get("range") ?? "7d";
    const range = rangeSchema.parse(rangeParam);

    const summary = await getProgressSummary(user.id, range);
    return ok(summary);
  } catch (error) {
    return handleRouteError(error);
  }
}
