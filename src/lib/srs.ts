import { ReviewGrade, ReviewState, type ReviewCard } from "@prisma/client";
import { SRS_INTERVALS_DAYS } from "@/lib/constants";
import { addUtcDays, diffUtcDays } from "@/lib/dates";

type SrsUpdate = {
  ease: number;
  intervalDays: number;
  dueAt: Date;
  state: ReviewState;
  successCount: number;
  lastReviewedAt: Date;
  transliterationStage: number;
};

function intervalByIndex(index: number): number {
  const bounded = Math.max(0, Math.min(index, SRS_INTERVALS_DAYS.length - 1));
  return SRS_INTERVALS_DAYS[bounded];
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

export function gradeFromScore(score: number): ReviewGrade {
  if (score < 50) {
    return ReviewGrade.AGAIN;
  }

  if (score < 70) {
    return ReviewGrade.HARD;
  }

  if (score < 90) {
    return ReviewGrade.GOOD;
  }

  return ReviewGrade.EASY;
}

export function getNextReviewUpdate(card: ReviewCard, grade: ReviewGrade, now = new Date()): SrsUpdate {
  let successCount = card.successCount;
  let ease = card.ease;

  if (grade === ReviewGrade.AGAIN) {
    successCount = Math.max(0, successCount - 1);
    ease = Math.max(1.3, ease - 0.2);
  } else {
    successCount += 1;

    if (grade === ReviewGrade.HARD) {
      ease = Math.max(1.3, ease - 0.15);
    }

    if (grade === ReviewGrade.EASY) {
      ease = Math.min(2.8, ease + 0.15);
    }
  }

  const successIndex = Math.max(0, successCount - 1);
  let intervalDays = intervalByIndex(successIndex);

  if (grade === ReviewGrade.AGAIN) {
    intervalDays = 1;
  }

  if (grade === ReviewGrade.HARD) {
    intervalDays = Math.max(1, intervalByIndex(successIndex - 1));
  }

  if (grade === ReviewGrade.EASY) {
    intervalDays = intervalByIndex(successIndex + 1);
  }

  const daysSinceFirstSeen = diffUtcDays(now, card.firstSeenAt);

  let state: ReviewState = ReviewState.LEARNING;
  if (successCount >= 2) {
    state = ReviewState.REVIEW;
  }
  if (successCount >= 5 && daysSinceFirstSeen >= 7) {
    state = ReviewState.MASTERED;
  }

  return {
    ease,
    intervalDays,
    dueAt: addUtcDays(now, intervalDays),
    state,
    successCount,
    lastReviewedAt: now,
    transliterationStage: getTransliterationStage(successCount),
  };
}
