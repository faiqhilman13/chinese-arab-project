-- AlterTable
ALTER TABLE "LexicalItem" ADD COLUMN "vowelledText" TEXT;

-- CreateTable
CREATE TABLE "NoHarakatAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lexicalItemId" TEXT NOT NULL,
    "predictedTransliteration" TEXT NOT NULL,
    "expectedTransliteration" TEXT NOT NULL,
    "displayText" TEXT NOT NULL,
    "vowelledText" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "confidence" TEXT NOT NULL,
    "feedback" TEXT NOT NULL,
    "components" JSONB,
    "tipCodes" JSONB NOT NULL,
    "form" TEXT NOT NULL DEFAULT 'MSA',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NoHarakatAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NoHarakatAttempt_lexicalItemId_fkey" FOREIGN KEY ("lexicalItemId") REFERENCES "LexicalItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "NoHarakatAttempt_userId_createdAt_idx" ON "NoHarakatAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "NoHarakatAttempt_userId_lexicalItemId_createdAt_idx" ON "NoHarakatAttempt"("userId", "lexicalItemId", "createdAt");
