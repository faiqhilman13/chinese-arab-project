import { LanguageCode } from "@prisma/client";
import { ApiError } from "@/lib/http";

const DEFAULT_URL = "http://127.0.0.1:8001";

function baseUrl(): string {
  return (process.env.LOCAL_SPEECH_URL ?? DEFAULT_URL).replace(/\/$/, "");
}

function detailFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") {
    return detail;
  }

  if (detail && typeof detail === "object") {
    return JSON.stringify(detail);
  }

  return null;
}

function speechLanguage(language: LanguageCode): "ar" | "zh" {
  return language === LanguageCode.AR_MSA ? "ar" : "zh";
}

type ScoreResponse = {
  transcript: string;
  score: number;
  feedback: string;
  confidence: string;
  components: Record<string, number>;
};

export async function scorePronunciationWithLocalService(args: {
  audioFile: File;
  language: LanguageCode;
  targetText: string;
  transliteration?: string | null;
}): Promise<ScoreResponse> {
  const form = new FormData();
  form.set("audio", args.audioFile, args.audioFile.name || "attempt.webm");
  form.set("language", speechLanguage(args.language));
  form.set("target_text", args.targetText);

  if (args.transliteration) {
    form.set("transliteration", args.transliteration);
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/score`, {
      method: "POST",
      body: form,
    });
  } catch {
    throw new ApiError(
      503,
      "LOCAL_SPEECH_UNAVAILABLE",
      "Local speech service is not reachable. Start it with `npm run speech:dev`.",
    );
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { detail?: unknown };
    const detail = detailFromPayload(payload);
    const status = response.status >= 400 && response.status < 500 ? response.status : 502;
    const message = detail
      ? `Local speech service failed to score audio. ${detail}`
      : "Local speech service failed to score audio.";

    throw new ApiError(status, "LOCAL_SPEECH_ERROR", message, payload);
  }

  return (await response.json()) as ScoreResponse;
}

export async function synthesizeWithLocalService(args: {
  language: LanguageCode;
  text: string;
  transliteration?: string | null;
}): Promise<{ audio: ArrayBuffer; contentType: string }> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/synthesize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        language: speechLanguage(args.language),
        text: args.text,
        transliteration: args.transliteration,
      }),
    });
  } catch {
    throw new ApiError(
      503,
      "LOCAL_SPEECH_UNAVAILABLE",
      "Local speech service is not reachable. Start it with `npm run speech:dev`.",
    );
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { detail?: unknown };
    const detail = detailFromPayload(payload);
    const status = response.status >= 400 && response.status < 500 ? response.status : 502;
    const message = detail
      ? `Local speech service failed to synthesize audio. ${detail}`
      : "Local speech service failed to synthesize audio.";

    throw new ApiError(status, "LOCAL_TTS_ERROR", message, payload);
  }

  return {
    audio: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") ?? "audio/wav",
  };
}

export async function checkLocalSpeechHealth() {
  try {
    const response = await fetch(`${baseUrl()}/health`, {
      method: "GET",
    });

    if (!response.ok) {
      return { available: false };
    }

    const payload = (await response.json()) as {
      whisper_model?: string;
      tts_backend?: string;
      tts_mode?: string;
    };

    return {
      available: true,
      whisperModel: payload.whisper_model ?? null,
      ttsBackend: payload.tts_backend ?? null,
      ttsMode: payload.tts_mode ?? null,
    };
  } catch {
    return { available: false };
  }
}
