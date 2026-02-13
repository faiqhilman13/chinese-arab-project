import { NextRequest } from "next/server";
import { DOMAIN_ORDER } from "@/lib/constants";
import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);

    return ok({
      domains: DOMAIN_ORDER,
      schedule: "alternating_by_day",
      languages: ["ar_msa", "zh_hans"],
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
