import { LanguageCode, ReviewGrade, SkillType } from "@prisma/client";

export const API_LANGUAGE_TO_DB = {
  ar_msa: LanguageCode.AR_MSA,
  zh_hans: LanguageCode.ZH_HANS,
} as const;

export type ApiLanguage = keyof typeof API_LANGUAGE_TO_DB;

export const DB_LANGUAGE_TO_API: Record<LanguageCode, ApiLanguage> = {
  [LanguageCode.AR_MSA]: "ar_msa",
  [LanguageCode.ZH_HANS]: "zh_hans",
};

export const API_SKILL_TO_DB = {
  listening: SkillType.LISTENING,
  speaking: SkillType.SPEAKING,
  reading: SkillType.READING,
  typing: SkillType.TYPING,
} as const;

export type ApiSkill = keyof typeof API_SKILL_TO_DB;

export const API_GRADE_TO_DB = {
  again: ReviewGrade.AGAIN,
  hard: ReviewGrade.HARD,
  good: ReviewGrade.GOOD,
  easy: ReviewGrade.EASY,
} as const;

export type ApiGrade = keyof typeof API_GRADE_TO_DB;
