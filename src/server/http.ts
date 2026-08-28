import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

type Logger = (record: string) => void;
type Work = () => Promise<unknown>;

const safeMessages = {
  notFound: "The requested resource was not found.",
  unauthorized: "Unauthorized.",
  internal: "An unexpected error occurred.",
};

/** Digest content changes once a day, so shared caches absorb the read traffic instead of the database. */
export const PUBLIC_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=3600";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Route identifiers are checked before they reach Postgres, where a bad cast would surface as a 500. */
export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

function errorResponse(status: number, code: "NOT_FOUND" | "UNAUTHORIZED" | "INTERNAL_ERROR", message: string) {
  return Response.json({ error: { code, message } }, { status });
}

/** Error messages can carry connection strings and API keys, so only the type and throw site are logged. */
function errorSignature(error: unknown) {
  if (!(error instanceof Error)) return { errorName: "NonError" };
  const frame = error.stack?.split("\n").find((line) => line.trim().startsWith("at "))?.trim();
  return { errorName: error.name, errorFrame: frame?.replaceAll(`${process.cwd()}/`, "") };
}

function logFailure(log: Logger, status: number, startedAt: number, correlationId: string, error: unknown) {
  log(JSON.stringify({ event: "http_request_failed", correlationId, status, durationMs: Date.now() - startedAt, metrics: {}, ...errorSignature(error) }));
}

export function createPublicGetHandler<T>(work: () => Promise<T | null>, log: Logger = console.error) {
  return async () => {
    const startedAt = Date.now();
    const correlationId = randomUUID();
    try {
      const value = await work();
      return value === null
        ? errorResponse(404, "NOT_FOUND", safeMessages.notFound)
        : Response.json(value, { headers: { "cache-control": PUBLIC_CACHE_CONTROL } });
    } catch (error) {
      logFailure(log, 500, startedAt, correlationId, error);
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
    } catch (error) {
      logFailure(log, 500, startedAt, correlationId, error);
      return errorResponse(500, "INTERNAL_ERROR", safeMessages.internal);
    }
  };
}
