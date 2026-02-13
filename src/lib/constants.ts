import { LanguageCode } from "@prisma/client";

export const DOMAIN_ORDER = [
  "home",
  "food",
  "transport",
  "shopping",
  "work",
  "health",
  "feelings",
  "emergencies",
] as const;

export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  [LanguageCode.AR_MSA]: "Arabic (MSA)",
  [LanguageCode.ZH_HANS]: "Mandarin (Simplified)",
};

export const SRS_INTERVALS_DAYS = [1, 2, 4, 7, 14, 30] as const;

export const DAILY_REVIEW_SHARE = 0.6;
export const DAILY_NEW_SHARE = 0.3;
export const DAILY_PRONUNCIATION_SHARE = 0.1;

export const DEFAULT_PLANNED_MINUTES = 25;
export const REVIEW_BACKLOG_BLOCK_THRESHOLD = 50;

export const ALT_SCHEDULE_ANCHOR_UTC = "2026-01-01T00:00:00.000Z";

export const COOKIE_NAME = "ll_session";

export const PRONUNCIATION_DAILY_LIMIT = Number.parseInt(
  process.env.PRONUNCIATION_DAILY_LIMIT ?? "20",
  10,
);

export const PRONUNCIATION_MONTHLY_LIMIT = Number.parseInt(
  process.env.PRONUNCIATION_MONTHLY_LIMIT ?? "200",
  10,
);

function readBooleanFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "0" || normalized === "false" || normalized === "off") {
    return false;
  }
  if (normalized === "1" || normalized === "true" || normalized === "on") {
    return true;
  }
  return defaultValue;
}

export const ENABLE_AR_IMMERSION_TRACKER = readBooleanFlag(
  process.env.NEXT_PUBLIC_ENABLE_AR_IMMERSION_TRACKER,
  true,
);
export const ENABLE_AR_SNIPPET_MINING = readBooleanFlag(
  process.env.NEXT_PUBLIC_ENABLE_AR_SNIPPET_MINING,
  true,
);
export const ENABLE_AR_MORPHOLOGY_TRAINER = readBooleanFlag(
  process.env.NEXT_PUBLIC_ENABLE_AR_MORPHOLOGY_TRAINER,
  true,
);
