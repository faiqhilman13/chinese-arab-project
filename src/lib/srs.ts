import { ReviewGrade, type ReviewCard } from "@prisma/client";
import { getNextSchedule } from "@/lib/review-scheduler";

type SrsUpdate = {
  ease: number;
  intervalDays: number;
  dueAt: Date;
  state: ReviewCard["state"];
  successCount: number;
  lastReviewedAt: Date;
  transliterationStage: number;
};

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
  return getNextSchedule(card, grade, now).legacy;
}
