import { NextRequest } from "next/server";
import { attachSessionCookie, hashPassword, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { ApiError, handleRouteError, ok } from "@/lib/http";
import { loginSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = loginSchema.parse(body);

    const existingUsers = await db.user.count();

    if (existingUsers === 0) {
      await db.user.create({
        data: {
          email: input.email,
          passwordHash: await hashPassword(input.password),
        },
      });
    }

    const user = await db.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    }

    const validPassword = await verifyPassword(input.password, user.passwordHash);
    if (!validPassword) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    }

    const response = ok({
      user: {
        id: user.id,
        email: user.email,
      },
    });

    await attachSessionCookie(response, user);
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
