-- CreateTable
CREATE TABLE "ImageAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conceptKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourcePageUrl" TEXT,
    "sourceDomain" TEXT,
    "localPath" TEXT NOT NULL,
    "contentHash" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "qualityScore" INTEGER NOT NULL DEFAULT 70,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BadImageReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "imageAssetId" TEXT NOT NULL,
    "lexicalItemId" TEXT,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BadImageReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BadImageReport_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "ImageAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BadImageReport_lexicalItemId_fkey" FOREIGN KEY ("lexicalItemId") REFERENCES "LexicalItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImageVocabAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lexicalItemId" TEXT NOT NULL,
    "imageAssetId" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'RECOGNITION',
    "grade" TEXT,
    "score" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImageVocabAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImageVocabAttempt_lexicalItemId_fkey" FOREIGN KEY ("lexicalItemId") REFERENCES "LexicalItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImageVocabAttempt_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "ImageAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ImageAsset_conceptKey_status_qualityScore_idx" ON "ImageAsset"("conceptKey", "status", "qualityScore");

-- CreateIndex
CREATE INDEX "ImageAsset_sourceDomain_idx" ON "ImageAsset"("sourceDomain");

-- CreateIndex
CREATE INDEX "ImageAsset_contentHash_idx" ON "ImageAsset"("contentHash");

-- CreateIndex
CREATE INDEX "BadImageReport_userId_createdAt_idx" ON "BadImageReport"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BadImageReport_imageAssetId_createdAt_idx" ON "BadImageReport"("imageAssetId", "createdAt");

-- CreateIndex
CREATE INDEX "BadImageReport_lexicalItemId_createdAt_idx" ON "BadImageReport"("lexicalItemId", "createdAt");

-- CreateIndex
CREATE INDEX "ImageVocabAttempt_userId_createdAt_idx" ON "ImageVocabAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ImageVocabAttempt_userId_lexicalItemId_createdAt_idx" ON "ImageVocabAttempt"("userId", "lexicalItemId", "createdAt");

-- CreateIndex
CREATE INDEX "ImageVocabAttempt_imageAssetId_createdAt_idx" ON "ImageVocabAttempt"("imageAssetId", "createdAt");
