-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PatternNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "language" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "unlockExposureCount" INTEGER NOT NULL DEFAULT 12,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LexicalItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "language" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "scriptText" TEXT NOT NULL,
    "transliteration" TEXT,
    "gloss" TEXT NOT NULL,
    "audioUrl" TEXT,
    "imageUrl" TEXT,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "patternNoteId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LexicalItem_patternNoteId_fkey" FOREIGN KEY ("patternNoteId") REFERENCES "PatternNote" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "language" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "sequenceNo" INTEGER NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LessonItem" (
    "lessonId" TEXT NOT NULL,
    "lexicalItemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    PRIMARY KEY ("lessonId", "lexicalItemId"),
    CONSTRAINT "LessonItem_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LessonItem_lexicalItemId_fkey" FOREIGN KEY ("lexicalItemId") REFERENCES "LexicalItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lexicalItemId" TEXT NOT NULL,
    "ease" REAL NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "dueAt" DATETIME NOT NULL,
    "lastScore" INTEGER,
    "state" TEXT NOT NULL DEFAULT 'NEW',
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewedAt" DATETIME,
    "transliterationStage" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReviewCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewCard_lexicalItemId_fkey" FOREIGN KEY ("lexicalItemId") REFERENCES "LexicalItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AttemptLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lexicalItemId" TEXT NOT NULL,
    "skillType" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "latencyMs" INTEGER,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttemptLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttemptLog_lexicalItemId_fkey" FOREIGN KEY ("lexicalItemId") REFERENCES "LexicalItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PronunciationAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lexicalItemId" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "audioPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PronunciationAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PronunciationAttempt_lexicalItemId_fkey" FOREIGN KEY ("lexicalItemId") REFERENCES "LexicalItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailySession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "language" TEXT NOT NULL,
    "plannedMinutes" INTEGER NOT NULL,
    "completedMinutes" INTEGER NOT NULL DEFAULT 0,
    "streakCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    CONSTRAINT "DailySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReminderPref" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "localTime" TEXT NOT NULL DEFAULT '20:00',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReminderPref_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GeneratedVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lexicalItemId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "expectedGloss" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeneratedVariant_lexicalItemId_fkey" FOREIGN KEY ("lexicalItemId") REFERENCES "LexicalItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "LexicalItem_language_domain_idx" ON "LexicalItem"("language", "domain");

-- CreateIndex
CREATE INDEX "Lesson_language_sequenceNo_idx" ON "Lesson"("language", "sequenceNo");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_language_domain_sequenceNo_key" ON "Lesson"("language", "domain", "sequenceNo");

-- CreateIndex
CREATE UNIQUE INDEX "LessonItem_lessonId_position_key" ON "LessonItem"("lessonId", "position");

-- CreateIndex
CREATE INDEX "ReviewCard_userId_dueAt_idx" ON "ReviewCard"("userId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewCard_userId_lexicalItemId_key" ON "ReviewCard"("userId", "lexicalItemId");

-- CreateIndex
CREATE INDEX "AttemptLog_userId_createdAt_idx" ON "AttemptLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttemptLog_userId_idempotencyKey_key" ON "AttemptLog"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PronunciationAttempt_userId_createdAt_idx" ON "PronunciationAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DailySession_userId_date_idx" ON "DailySession"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailySession_userId_date_key" ON "DailySession"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderPref_userId_key" ON "ReminderPref"("userId");

-- CreateIndex
CREATE INDEX "GeneratedVariant_lexicalItemId_createdAt_idx" ON "GeneratedVariant"("lexicalItemId", "createdAt");
