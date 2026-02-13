UPDATE "LexicalItem"
SET "vowelledText" = "scriptText"
WHERE "language" = 'AR_MSA' AND "vowelledText" IS NULL;
