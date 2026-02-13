-- CreateTable
CREATE TABLE "ImmersionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "source" TEXT,
    "notes" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImmersionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Snippet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "language" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "register" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "phaseMin" INTEGER NOT NULL DEFAULT 1,
    "phaseMax" INTEGER NOT NULL DEFAULT 4,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "scriptText" TEXT NOT NULL,
    "vowelledText" TEXT,
    "transliteration" TEXT,
    "gloss" TEXT NOT NULL,
    "audioUrl" TEXT,
    "sourceLabel" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SnippetLexicalLink" (
    "snippetId" TEXT NOT NULL,
    "lexicalItemId" TEXT NOT NULL,
    "tokenText" TEXT,
    "position" INTEGER,
    CONSTRAINT "SnippetLexicalLink_snippetId_fkey" FOREIGN KEY ("snippetId") REFERENCES "Snippet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SnippetLexicalLink_lexicalItemId_fkey" FOREIGN KEY ("lexicalItemId") REFERENCES "LexicalItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("snippetId", "lexicalItemId")
);

-- CreateTable
CREATE TABLE "SnippetInteraction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "snippetId" TEXT NOT NULL,
    "comprehension" INTEGER,
    "minedCount" INTEGER NOT NULL DEFAULT 0,
    "consumedMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SnippetInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SnippetInteraction_snippetId_fkey" FOREIGN KEY ("snippetId") REFERENCES "Snippet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MorphologyEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lexicalItemId" TEXT NOT NULL,
    "root" TEXT NOT NULL,
    "wazn" TEXT NOT NULL,
    "pos" TEXT,
    "lemma" TEXT,
    "register" TEXT NOT NULL DEFAULT 'MSA',
    "confidence" INTEGER NOT NULL DEFAULT 60,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MorphologyEntry_lexicalItemId_fkey" FOREIGN KEY ("lexicalItemId") REFERENCES "LexicalItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MorphologyAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lexicalItemId" TEXT NOT NULL,
    "promptType" TEXT NOT NULL,
    "userAnswer" TEXT NOT NULL,
    "expectedAnswer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "score" INTEGER NOT NULL,
    "root" TEXT,
    "wazn" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MorphologyAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MorphologyAttempt_lexicalItemId_fkey" FOREIGN KEY ("lexicalItemId") REFERENCES "LexicalItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ImmersionLog_userId_language_occurredAt_idx" ON "ImmersionLog"("userId", "language", "occurredAt");

-- CreateIndex
CREATE INDEX "ImmersionLog_userId_createdAt_idx" ON "ImmersionLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Snippet_language_domain_phaseMin_phaseMax_idx" ON "Snippet"("language", "domain", "phaseMin", "phaseMax");

-- CreateIndex
CREATE INDEX "Snippet_language_isActive_createdAt_idx" ON "Snippet"("language", "isActive", "createdAt");

-- CreateIndex
CREATE INDEX "SnippetLexicalLink_lexicalItemId_idx" ON "SnippetLexicalLink"("lexicalItemId");

-- CreateIndex
CREATE INDEX "SnippetInteraction_userId_createdAt_idx" ON "SnippetInteraction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SnippetInteraction_userId_snippetId_createdAt_idx" ON "SnippetInteraction"("userId", "snippetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MorphologyEntry_lexicalItemId_register_key" ON "MorphologyEntry"("lexicalItemId", "register");

-- CreateIndex
CREATE INDEX "MorphologyEntry_root_wazn_idx" ON "MorphologyEntry"("root", "wazn");

-- CreateIndex
CREATE INDEX "MorphologyAttempt_userId_createdAt_idx" ON "MorphologyAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MorphologyAttempt_userId_lexicalItemId_createdAt_idx" ON "MorphologyAttempt"("userId", "lexicalItemId", "createdAt");
