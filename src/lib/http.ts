import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

export class ApiError extends Error {
  status: number;
  payload: ErrorPayload;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.payload = { code, message, details };
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details,
      },
    },
    { status },
  );
}

export function ensure(condition: unknown, status: number, code: string, message: string): asserts condition {
  if (!condition) {
    throw new ApiError(status, code, message);
  }
}

export function handleRouteError(error: unknown) {
  if (error instanceof ApiError) {
    return fail(error.status, error.payload.code, error.payload.message, error.payload.details);
  }

  if (error instanceof ZodError) {
    return fail(400, "VALIDATION_ERROR", "Request validation failed.", error.flatten());
  }

  return fail(500, "INTERNAL_ERROR", "Unexpected server error.");
}
