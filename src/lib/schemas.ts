import { z } from "zod";
import { API_GRADE_TO_DB, API_LANGUAGE_TO_DB, API_SKILL_TO_DB } from "@/lib/mappers";

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
});

export const reviewGradeSchema = z.object({
  reviewCardId: z.string().cuid(),
  grade: z.enum(Object.keys(API_GRADE_TO_DB) as ["again", "hard", "good", "easy"]),
});

export const galleryQuerySchema = z.object({
  language: languageSchema,
  domain: z.string().trim().min(1).max(64).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
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
