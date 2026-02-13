/*
  Warnings:

  - The required column `conceptKey` was added to the `LexicalItem` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- CreateTable
CREATE TABLE "LexicalVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lexicalItemId" TEXT NOT NULL,
    "register" TEXT NOT NULL,
    "scriptText" TEXT NOT NULL,
    "transliteration" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LexicalVariant_lexicalItemId_fkey" FOREIGN KEY ("lexicalItemId") REFERENCES "LexicalItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LexicalItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conceptKey" TEXT NOT NULL,
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
INSERT INTO "new_LexicalItem" ("audioUrl", "conceptKey", "createdAt", "difficulty", "domain", "gloss", "id", "imageUrl", "itemType", "language", "patternNoteId", "scriptText", "transliteration", "updatedAt") SELECT "audioUrl", 'legacy.' || "id", "createdAt", "difficulty", "domain", "gloss", "id", "imageUrl", "itemType", "language", "patternNoteId", "scriptText", "transliteration", "updatedAt" FROM "LexicalItem";
DROP TABLE "LexicalItem";
ALTER TABLE "new_LexicalItem" RENAME TO "LexicalItem";
CREATE UNIQUE INDEX "LexicalItem_conceptKey_key" ON "LexicalItem"("conceptKey");
CREATE INDEX "LexicalItem_language_domain_idx" ON "LexicalItem"("language", "domain");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Backfill MSA primary variants for existing Arabic lexical items
INSERT INTO "LexicalVariant" ("id", "lexicalItemId", "register", "scriptText", "transliteration", "isPrimary", "createdAt", "updatedAt")
SELECT 'variant-' || "id" || '-msa', "id", 'MSA', "scriptText", "transliteration", true, "createdAt", "updatedAt"
FROM "LexicalItem"
WHERE "language" = 'AR_MSA';

-- CreateIndex
CREATE INDEX "LexicalVariant_register_scriptText_idx" ON "LexicalVariant"("register", "scriptText");

-- CreateIndex
CREATE UNIQUE INDEX "LexicalVariant_lexicalItemId_register_key" ON "LexicalVariant"("lexicalItemId", "register");
