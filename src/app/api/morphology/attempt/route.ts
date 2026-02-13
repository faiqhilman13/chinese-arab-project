import { LanguageCode } from "@prisma/client";
import { NextRequest } from "next/server";
import { normalizeMorphAnswer } from "@/lib/arabic-morphology";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensure, handleRouteError, ok } from "@/lib/http";
import { morphologyAttemptSchema } from "@/lib/schemas";

function scoreMorphologyAttempt(expected: string, actual: string): number {
  if (expected === actual) {
    return 100;
  }
  if (actual.includes(expected) || expected.includes(actual)) {
    return 70;
  }
  return 25;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json();
    const input = morphologyAttemptSchema.parse(body);

    const entry = await db.morphologyEntry.findFirst({
      where: {
        lexicalItemId: input.lexicalItemId,
        lexicalItem: {
          language: LanguageCode.AR_MSA,
        },
      },
      select: {
        lexicalItemId: true,
        root: true,
        wazn: true,
        lemma: true,
        lexicalItem: {
          select: {
            scriptText: true,
            transliteration: true,
            gloss: true,
            domain: true,
          },
        },
      },
    });

    ensure(entry, 404, "MORPHOLOGY_ENTRY_NOT_FOUND", "Morphology entry does not exist.");

    const expectedAnswerRaw = input.promptType === "root" ? entry.root : entry.wazn;
    const expectedAnswer = normalizeMorphAnswer(expectedAnswerRaw);
    const actualAnswer = normalizeMorphAnswer(input.userAnswer);
    const score = scoreMorphologyAttempt(expectedAnswer, actualAnswer);
    const isCorrect = score >= 100;

    const created = await db.morphologyAttempt.create({
      data: {
        userId: user.id,
        lexicalItemId: entry.lexicalItemId,
        promptType: input.promptType,
        userAnswer: input.userAnswer.trim(),
        expectedAnswer: expectedAnswerRaw,
        isCorrect,
        score,
        root: entry.root,
        wazn: entry.wazn,
      },
      select: {
        id: true,
        score: true,
        isCorrect: true,
        promptType: true,
        userAnswer: true,
        expectedAnswer: true,
        createdAt: true,
      },
    });

    return ok({
      attemptId: created.id,
      lexicalItemId: entry.lexicalItemId,
      promptType: created.promptType,
      scriptText: entry.lexicalItem.scriptText,
      transliteration: entry.lexicalItem.transliteration,
      gloss: entry.lexicalItem.gloss,
      domain: entry.lexicalItem.domain,
      root: entry.root,
      wazn: entry.wazn,
      expectedAnswer: created.expectedAnswer,
      userAnswer: created.userAnswer,
      score: created.score,
      isCorrect: created.isCorrect,
      feedback: created.isCorrect
        ? "Correct. Keep chaining this root/form with another known word."
        : `Not quite. Expected ${created.expectedAnswer}. Compare pattern with ${entry.lexicalItem.scriptText}.`,
      createdAt: created.createdAt.toISOString(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
