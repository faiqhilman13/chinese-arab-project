import { NextRequest } from "next/server";
import { buildArabicForms } from "@/lib/arabic-forms";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensure, handleRouteError, ok } from "@/lib/http";
import { DB_LANGUAGE_TO_API } from "@/lib/mappers";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;

    const lesson = await db.lesson.findUnique({
      where: {
        id,
      },
      include: {
        lessonItems: {
          orderBy: {
            position: "asc",
          },
          include: {
            lexicalItem: {
              include: {
                patternNote: true,
                lexicalVariants: {
                  select: {
                    register: true,
                    scriptText: true,
                    transliteration: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    ensure(lesson, 404, "LESSON_NOT_FOUND", "Lesson does not exist.");

    const lexicalItemIds = lesson.lessonItems.map((item) => item.lexicalItemId);

    const [cards, attempts] = await Promise.all([
      db.reviewCard.findMany({
        where: {
          userId: user.id,
          lexicalItemId: {
            in: lexicalItemIds,
          },
        },
      }),
      db.attemptLog.findMany({
        where: {
          userId: user.id,
          lexicalItemId: {
            in: lexicalItemIds,
          },
        },
        select: {
          lexicalItem: {
            select: {
              patternNoteId: true,
            },
          },
        },
      }),
    ]);

    const cardByItem = new Map(cards.map((card) => [card.lexicalItemId, card]));
    const exposureByPattern = new Map<string, number>();

    for (const attempt of attempts) {
      const patternNoteId = attempt.lexicalItem.patternNoteId;
      if (!patternNoteId) {
        continue;
      }

      exposureByPattern.set(patternNoteId, (exposureByPattern.get(patternNoteId) ?? 0) + 1);
    }

    const grammarNotes = new Map<string, { id: string; title: string; explanation: string; exposureCount: number }>();

    for (const item of lesson.lessonItems) {
      const note = item.lexicalItem.patternNote;
      if (!note) {
        continue;
      }

      const exposureCount = exposureByPattern.get(note.id) ?? 0;
      if (exposureCount >= note.unlockExposureCount) {
        grammarNotes.set(note.id, {
          id: note.id,
          title: note.title,
          explanation: note.explanation,
          exposureCount,
        });
      }
    }

    return ok({
      lesson: {
        id: lesson.id,
        language: DB_LANGUAGE_TO_API[lesson.language],
        domain: lesson.domain,
        sequenceNo: lesson.sequenceNo,
        estimatedMinutes: lesson.estimatedMinutes,
      },
      items: lesson.lessonItems.map((lessonItem) => {
        const card = cardByItem.get(lessonItem.lexicalItemId);
        const stage = card?.transliterationStage ?? 1;

        return {
          position: lessonItem.position,
          lexicalItemId: lessonItem.lexicalItemId,
          itemType: lessonItem.lexicalItem.itemType.toLowerCase(),
          scriptText: lessonItem.lexicalItem.scriptText,
          transliteration:
            stage === 1 ? lessonItem.lexicalItem.transliteration : null,
          transliterationRevealAvailable: stage >= 2,
          gloss: lessonItem.lexicalItem.gloss,
          domain: lessonItem.lexicalItem.domain,
          transliterationStage: stage,
          forms: buildArabicForms({
            language: lesson.language,
            scriptText: lessonItem.lexicalItem.scriptText,
            transliteration: lessonItem.lexicalItem.transliteration,
            lexicalVariants: lessonItem.lexicalItem.lexicalVariants,
          }),
        };
      }),
      unlockedGrammarNotes: Array.from(grammarNotes.values()),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
