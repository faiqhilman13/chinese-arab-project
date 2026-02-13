-- Add FSRS scheduler fields to ReviewCard with backward-compatible defaults
ALTER TABLE "ReviewCard" ADD COLUMN "schedulerVersion" TEXT NOT NULL DEFAULT 'LEGACY';
ALTER TABLE "ReviewCard" ADD COLUMN "fsrsStability" REAL;
ALTER TABLE "ReviewCard" ADD COLUMN "fsrsDifficulty" REAL;
ALTER TABLE "ReviewCard" ADD COLUMN "fsrsLastReview" DATETIME;
ALTER TABLE "ReviewCard" ADD COLUMN "fsrsReps" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ReviewCard" ADD COLUMN "fsrsLapses" INTEGER NOT NULL DEFAULT 0;
