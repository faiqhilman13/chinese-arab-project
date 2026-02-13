import { z } from "zod";
import {
  API_GRADE_TO_DB,
  API_IMMERSION_MODE_TO_DB,
  API_LANGUAGE_TO_DB,
  API_SKILL_TO_DB,
} from "@/lib/mappers";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const languageSchema = z.enum(Object.keys(API_LANGUAGE_TO_DB) as ["ar_msa", "zh_hans"]);

export const sessionStartSchema = z.object({
  language: languageSchema.optional(),
  plannedMinutes: z.number().int().min(10).max(60).optional(),
});

export const attemptSchema = z.object({
  lexicalItemId: z.string().cuid(),
  skillType: z.enum(Object.keys(API_SKILL_TO_DB) as ["listening", "speaking", "reading", "typing"]),
  score: z.number().int().min(0).max(100),
  latencyMs: z.number().int().min(0).max(120000).optional(),
});

export const pronunciationSchema = z.object({
  lexicalItemId: z.string().cuid(),
  transcript: z.string().min(1).max(120),
  audioPath: z.string().max(500).optional(),
  form: z.enum(["msa", "syrian"]).optional(),
});

export const pronunciationTargetAudioQuerySchema = z.object({
  lexicalItemId: z.string().cuid(),
  form: z.enum(["msa", "syrian"]).optional(),
});

export const noHarakatQueueQuerySchema = z.object({
  language: z.literal("ar_msa"),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

export const noHarakatAttemptSchema = z.object({
  lexicalItemId: z.string().cuid(),
  predictedTransliteration: z.string().trim().min(1).max(160),
});

export const noHarakatSummaryQuerySchema = z.object({
  range: z.enum(["7d", "30d"]).default("7d"),
});

export const reviewGradeSchema = z.object({
  reviewCardId: z.string().cuid(),
  grade: z.enum(Object.keys(API_GRADE_TO_DB) as ["again", "hard", "good", "easy"]),
});

export const galleryQuerySchema = z.object({
  language: languageSchema,
  domain: z.string().trim().min(1).max(64).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(90),
});

export const flashcardFeedQuerySchema = z.object({
  language: languageSchema,
  limit: z.coerce.number().int().min(1).max(1000).default(200),
});

export const flashcardGradeSchema = z.object({
  lexicalItemId: z.string().cuid(),
  reviewCardId: z.string().cuid().nullable().optional(),
  grade: z.enum(Object.keys(API_GRADE_TO_DB) as ["again", "hard", "good", "easy"]),
});

export const reminderSchema = z.object({
  enabled: z.boolean(),
  localTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional(),
  timezone: z.string().min(2).max(64).optional(),
});

export const rangeSchema = z.enum(["7d", "30d"]);

export const immersionLogSchema = z.object({
  language: z.literal("ar_msa"),
  mode: z.enum(Object.keys(API_IMMERSION_MODE_TO_DB) as ["input", "output", "study", "tutor"]),
  minutes: z.number().int().min(1).max(300),
  source: z.string().trim().min(1).max(120).optional(),
  notes: z.string().trim().max(400).optional(),
  occurredAt: z.coerce.date().optional(),
});

export const immersionSummaryQuerySchema = z.object({
  range: z.enum(["7d", "30d"]).default("7d"),
  language: z.literal("ar_msa").default("ar_msa"),
});

export const snippetsFeedQuerySchema = z.object({
  language: z.literal("ar_msa"),
  domain: z.string().trim().min(1).max(64).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  phase: z.coerce.number().int().min(1).max(4).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(30).default(8),
});

export const snippetInteractionSchema = z.object({
  snippetId: z.string().cuid(),
  comprehension: z.number().int().min(1).max(5).optional(),
  consumedMinutes: z.number().int().min(0).max(240).default(0),
  minedCount: z.number().int().min(0).max(100).default(0),
});

export const snippetMineSchema = z.object({
  snippetId: z.string().cuid(),
  lexicalItemIds: z.array(z.string().cuid()).min(1).max(30),
});

export const morphologyQueueQuerySchema = z.object({
  language: z.literal("ar_msa"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const morphologyAttemptSchema = z.object({
  lexicalItemId: z.string().cuid(),
  promptType: z.enum(["root", "wazn"]),
  userAnswer: z.string().trim().min(1).max(120),
});

export const morphologySummaryQuerySchema = z.object({
  range: z.enum(["7d", "30d"]).default("7d"),
  language: z.literal("ar_msa").default("ar_msa"),
});
