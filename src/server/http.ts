import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { ZodType } from "zod";
import { ApiError, type ApiErrorBody } from "@/contracts/errors";

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", "The request body must be valid JSON.");
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const fields = Object.fromEntries(
      Object.entries(result.error.flatten().fieldErrors).filter(
        (entry): entry is [string, string[]] => Array.isArray(entry[1]),
      ),
    );
    throw new ApiError(400, "VALIDATION_ERROR", "Check the submitted information.", fields);
  }
  return result.data;
}

export function requireIdempotencyKey(request: Request): string {
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key || key.length < 8 || key.length > 200) {
    throw new ApiError(400, "IDEMPOTENCY_KEY_REQUIRED", "A valid Idempotency-Key header is required.");
  }
  return key;
}

export function requireUuidParam(value: string, field: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", `The ${field} is invalid.`, { [field]: ["Expected a UUID."] });
  }
  return value;
}

export function requireProviderParam(value: string): string {
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", "The payment provider is invalid.");
  }
  return value;
}

export async function route<T>(operation: () => Promise<T | Response>): Promise<Response> {
  const requestId = randomUUID();
  try {
    const result = await operation();
    if (result instanceof Response) return result;
    return Response.json({ data: result }, { headers: { "x-request-id": requestId } });
  } catch (error) {
    const known = error instanceof ApiError ? error : mapPrismaError(error);
    if (!known) {
      console.error("Unhandled API error", {
        requestId,
        errorName: error instanceof Error ? error.name : typeof error,
        errorCode: (error as { code?: string } | null)?.code ?? "UNKNOWN",
      });
    }
    const resolved = known ?? new ApiError(500, "INTERNAL_ERROR", "Something went wrong.");
    const body: ApiErrorBody = {
      error: {
        code: resolved.code,
        message: resolved.message,
        ...(resolved.fields ? { fields: resolved.fields } : {}),
        ...(resolved.details !== undefined ? { details: resolved.details } : {}),
        requestId,
      },
    };
    return Response.json(body, { status: resolved.status, headers: { "x-request-id": requestId } });
  }
}

function mapPrismaError(error: unknown): ApiError | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const metadata = JSON.stringify(error.meta ?? {});
    if (metadata.includes("23P01") || metadata.includes("RoomReservation_no_overlap")) {
      return new ApiError(409, "AVAILABILITY_CHANGED", "The selected rooms are no longer available.");
    }
    if (error.code === "P2002") return new ApiError(409, "CONFLICT", "The request conflicts with existing data.");
    if (error.code === "P2025") return new ApiError(404, "NOT_FOUND", "The requested record was not found.");
    if (error.code === "P2034") return new ApiError(409, "SERIALIZATION_CONFLICT", "Please try again.");
  }
  const code = (error as { code?: string } | null)?.code;
  if (code === "23P01") return new ApiError(409, "AVAILABILITY_CHANGED", "The selected rooms are no longer available.");
  return null;
}
