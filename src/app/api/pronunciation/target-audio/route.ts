import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensure, handleRouteError } from "@/lib/http";
import { synthesizeWithLocalService } from "@/lib/local-speech-service";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);

    const lexicalItemId = request.nextUrl.searchParams.get("lexicalItemId");
    ensure(lexicalItemId, 400, "INVALID_INPUT", "lexicalItemId is required.");

    const lexicalItem = await db.lexicalItem.findUnique({
      where: {
        id: lexicalItemId,
      },
      select: {
        language: true,
        scriptText: true,
        transliteration: true,
      },
    });

    ensure(lexicalItem, 404, "ITEM_NOT_FOUND", "Lexical item does not exist.");

    const result = await synthesizeWithLocalService({
      language: lexicalItem.language,
      text: lexicalItem.scriptText,
      transliteration: lexicalItem.transliteration,
    });

    return new NextResponse(result.audio, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
