import {
  ReviewGrade,
  ReviewState,
  SchedulerVersion,
  type ReviewCard,
} from "@prisma/client";
import { addUtcDays, diffUtcDays } from "@/lib/dates";

type LegacyScheduleFields = {
  ease: number;
  intervalDays: number;
  dueAt: Date;
  state: ReviewState;
  successCount: number;
  lastReviewedAt: Date;
  transliterationStage: number;
};

type FsrsScheduleFields = {
  schedulerVersion: SchedulerVersion;
  fsrsStability: number;
  fsrsDifficulty: number;
  fsrsLastReview: Date;
  fsrsReps: number;
  fsrsLapses: number;
};

export type ReviewScheduleUpdate = {
  legacy: LegacyScheduleFields;
  fsrs: FsrsScheduleFields;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getTransliterationStage(successCount: number): number {
  if (successCount >= 5) {
    return 3;
  }

  if (successCount >= 2) {
    return 2;
  }

  return 1;
}

function deriveInitialStability(card: ReviewCard): number {
  if (card.fsrsStability && card.fsrsStability > 0) {
    return card.fsrsStability;
  }

  if (card.intervalDays > 0) {
    return Math.max(0.4, card.intervalDays);
  }

  return Math.max(0.4, 0.8 + card.successCount * 0.3);
}

function deriveInitialDifficulty(card: ReviewCard): number {
  if (card.fsrsDifficulty && card.fsrsDifficulty > 0) {
    return clamp(card.fsrsDifficulty, 1, 10);
  }

  return clamp(5 - (card.ease - 2.5) * 2, 1, 10);
}

function deriveLegacyEase(difficulty: number): number {
  const normalized = (difficulty - 1) / 9;
  return clamp(2.8 - normalized * 1.5, 1.3, 2.8);
}

function getNextState(successCount: number, firstSeenAt: Date, now: Date): ReviewState {
  if (successCount <= 0) {
    return ReviewState.NEW;
  }

  const daysSinceFirstSeen = diffUtcDays(now, firstSeenAt);

  if (successCount >= 5 && daysSinceFirstSeen >= 7) {
    return ReviewState.MASTERED;
  }

  if (successCount >= 2) {
    return ReviewState.REVIEW;
  }

  return ReviewState.LEARNING;
}

export function getNextSchedule(
  card: ReviewCard,
  grade: ReviewGrade,
  now = new Date(),
): ReviewScheduleUpdate {
  const successCount =
    grade === ReviewGrade.AGAIN
      ? Math.max(0, card.successCount - 1)
      : card.successCount + 1;

  let stability = deriveInitialStability(card);
  let difficulty = deriveInitialDifficulty(card);

  if (grade === ReviewGrade.AGAIN) {
    difficulty = clamp(difficulty + 0.35, 1, 10);
    stability = clamp(stability * 0.45, 0.3, 3650);
  } else if (grade === ReviewGrade.HARD) {
    difficulty = clamp(difficulty + 0.12, 1, 10);
    stability = clamp(stability * (1.08 + (10 - difficulty) * 0.015), 0.4, 3650);
  } else if (grade === ReviewGrade.GOOD) {
    difficulty = clamp(difficulty - 0.05, 1, 10);
    stability = clamp(stability * (1.22 + (10 - difficulty) * 0.018), 0.4, 3650);
  } else {
    difficulty = clamp(difficulty - 0.18, 1, 10);
    stability = clamp(stability * (1.4 + (10 - difficulty) * 0.02), 0.4, 3650);
  }

  let intervalDays = 1;
  if (grade === ReviewGrade.HARD) {
    intervalDays = Math.max(1, Math.round(stability * 0.8));
  } else if (grade === ReviewGrade.GOOD) {
    intervalDays = Math.max(1, Math.round(stability));
  } else if (grade === ReviewGrade.EASY) {
    intervalDays = Math.max(2, Math.round(stability * 1.3));
  }

  const dueAt = addUtcDays(now, intervalDays);
  const state = getNextState(successCount, card.firstSeenAt, now);
  const transliterationStage = getTransliterationStage(successCount);
  const fsrsReps = Math.max(0, (card.fsrsReps ?? 0) + 1);
  const fsrsLapses = Math.max(
    0,
    (card.fsrsLapses ?? 0) + (grade === ReviewGrade.AGAIN ? 1 : 0),
  );

  return {
    legacy: {
      ease: deriveLegacyEase(difficulty),
      intervalDays,
      dueAt,
      state,
      successCount,
      lastReviewedAt: now,
      transliterationStage,
    },
    fsrs: {
      schedulerVersion: SchedulerVersion.FSRS,
      fsrsStability: stability,
      fsrsDifficulty: difficulty,
      fsrsLastReview: now,
      fsrsReps,
      fsrsLapses,
    },
  };
}
