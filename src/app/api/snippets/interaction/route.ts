import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensure, handleRouteError, ok } from "@/lib/http";
import { snippetInteractionSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json();
    const input = snippetInteractionSchema.parse(body);

    const snippet = await db.snippet.findUnique({
      where: {
        id: input.snippetId,
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    ensure(snippet && snippet.isActive, 404, "SNIPPET_NOT_FOUND", "Snippet does not exist.");

    const interaction = await db.snippetInteraction.create({
      data: {
        userId: user.id,
        snippetId: input.snippetId,
        comprehension: input.comprehension,
        consumedMinutes: input.consumedMinutes,
        minedCount: input.minedCount,
      },
      select: {
        id: true,
        snippetId: true,
        comprehension: true,
        consumedMinutes: true,
        minedCount: true,
        createdAt: true,
      },
    });

    return ok({
      interaction: {
        ...interaction,
        createdAt: interaction.createdAt.toISOString(),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
