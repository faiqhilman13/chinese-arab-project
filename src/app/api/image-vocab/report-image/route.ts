import { ImageAssetStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensure, handleRouteError, ok } from "@/lib/http";
import { badImageReportSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const input = badImageReportSchema.parse(await request.json());

    const asset = await db.imageAsset.findUnique({
      where: {
        id: input.imageAssetId,
      },
      select: {
        id: true,
        contentHash: true,
      },
    });

    ensure(asset, 404, "IMAGE_ASSET_NOT_FOUND", "Image asset does not exist.");

    if (input.lexicalItemId) {
      const lexicalItem = await db.lexicalItem.findUnique({
        where: {
          id: input.lexicalItemId,
        },
        select: {
          id: true,
        },
      });
      ensure(lexicalItem, 404, "ITEM_NOT_FOUND", "Lexical item does not exist.");
    }

    const matchingAssetWhere = asset.contentHash
      ? {
          OR: [
            {
              id: input.imageAssetId,
            },
            {
              contentHash: asset.contentHash,
            },
          ],
        }
      : {
          id: input.imageAssetId,
        };

    const [report, updatedAssets] = await db.$transaction([
      db.badImageReport.create({
        data: {
          userId: user.id,
          imageAssetId: input.imageAssetId,
          lexicalItemId: input.lexicalItemId ?? null,
          reason: input.reason ?? null,
        },
        select: {
          id: true,
          createdAt: true,
        },
      }),
      db.imageAsset.updateMany({
        where: matchingAssetWhere,
        data: {
          reportCount: {
            increment: 1,
          },
          status: ImageAssetStatus.REPORTED,
        },
      }),
    ]);

    return ok({
      report: {
        id: report.id,
        createdAt: report.createdAt.toISOString(),
      },
      imageAsset: {
        id: input.imageAssetId,
        status: ImageAssetStatus.REPORTED.toLowerCase(),
        updatedCount: updatedAssets.count,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
