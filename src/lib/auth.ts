import { type User } from "@prisma/client";
import { compare, hash } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/constants";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";

type SessionPayload = {
  sub: string;
  email: string;
};

const encoder = new TextEncoder();
const secret = encoder.encode(process.env.SESSION_SECRET ?? "dev-only-session-secret");

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash);
}

export async function signSession(user: Pick<User, "id" | "email">): Promise<string> {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

async function verifySession(token: string): Promise<SessionPayload> {
  const result = await jwtVerify(token, secret);

  if (!result.payload.sub || typeof result.payload.email !== "string") {
    throw new ApiError(401, "UNAUTHORIZED", "Invalid session payload.");
  }

  return {
    sub: result.payload.sub,
    email: result.payload.email,
  };
}

export async function attachSessionCookie(response: NextResponse, user: Pick<User, "id" | "email">) {
  const token = await signSession(user);

  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function requireUser(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    throw new ApiError(401, "UNAUTHORIZED", "Login required.");
  }

  const payload = await verifySession(token).catch(() => {
    throw new ApiError(401, "UNAUTHORIZED", "Session is invalid or expired.");
  });

  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, createdAt: true },
  });

  if (!user) {
    throw new ApiError(401, "UNAUTHORIZED", "Account not found.");
  }

  return user;
}
