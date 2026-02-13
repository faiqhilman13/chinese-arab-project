import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import { checkLocalSpeechHealth } from "@/lib/local-speech-service";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);

    const health = await checkLocalSpeechHealth();

    return ok({
      ...health,
      endpoint: process.env.LOCAL_SPEECH_URL ?? "http://127.0.0.1:8001",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
