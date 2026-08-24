import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

type Logger = (record: string) => void;
type Work = () => Promise<unknown>;

const safeMessages = {
  notFound: "The requested resource was not found.",
  unauthorized: "Unauthorized.",
  internal: "An unexpected error occurred.",
};

function errorResponse(status: number, code: "NOT_FOUND" | "UNAUTHORIZED" | "INTERNAL_ERROR", message: string) {
  return Response.json({ error: { code, message } }, { status });
}

function logFailure(log: Logger, status: number, startedAt: number, correlationId: string) {
  log(JSON.stringify({ event: "http_request_failed", correlationId, status, durationMs: Date.now() - startedAt, metrics: {} }));
}

export function createPublicGetHandler<T>(work: () => Promise<T | null>, log: Logger = console.error) {
  return async () => {
    const startedAt = Date.now();
    const correlationId = randomUUID();
    try {
      const value = await work();
      return value === null
        ? errorResponse(404, "NOT_FOUND", safeMessages.notFound)
        : Response.json(value);
    } catch {
      logFailure(log, 500, startedAt, correlationId);
      return errorResponse(500, "INTERNAL_ERROR", safeMessages.internal);
    }
  };
}

function fingerprint(value: string) {
  return createHash("sha256").update(value).digest();
}

export function hasMatchingInternalSecret(request: Request, expectedSecret: string | undefined) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!expectedSecret || !supplied) return false;
  return timingSafeEqual(fingerprint(supplied), fingerprint(expectedSecret));
}

export function createInternalPostHandler(expectedSecret: string | undefined, work: Work, log: Logger = console.error) {
  return async (request: Request) => {
    if (!hasMatchingInternalSecret(request, expectedSecret)) {
      return errorResponse(401, "UNAUTHORIZED", safeMessages.unauthorized);
    }
    const startedAt = Date.now();
    const correlationId = randomUUID();
    try {
      return Response.json(await work(), { status: 202 });
    } catch {
      logFailure(log, 500, startedAt, correlationId);
      return errorResponse(500, "INTERNAL_ERROR", safeMessages.internal);
    }
  };
}
