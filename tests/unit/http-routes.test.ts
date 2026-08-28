import { describe, expect, it, vi } from "vitest";
import { createInternalPostHandler, createPublicGetHandler, isUuid, PUBLIC_CACHE_CONTROL } from "@/server/http";

describe("route identifiers", () => {
  it("accepts canonical UUIDs and rejects anything Postgres would fail to cast", () => {
    expect(isUuid("3f1b8a2c-9d4e-4f6a-9b3c-2e5d7a1c8b04")).toBe(true);
    for (const value of ["", "not-a-uuid", "1; DROP TABLE stories", "3f1b8a2c9d4e4f6a9b3c2e5d7a1c8b04"]) expect(isUuid(value)).toBe(false);
  });
});

describe("public route handlers", () => {
  it("lets shared caches absorb repeated reads of a digest that changes once a day", async () => {
    const found = await createPublicGetHandler(async () => ({ digestDate: "2026-08-24" }))();
    const missing = await createPublicGetHandler(async () => null)();

    expect(found.headers.get("cache-control")).toBe(PUBLIC_CACHE_CONTROL);
    expect(missing.headers.get("cache-control")).toBeNull();
  });

  it("returns the standard safe 404 envelope for absent or invalid resources", async () => {
    const missing = await createPublicGetHandler(async () => null)();
    const invalid = await createPublicGetHandler(async () => null)();

    for (const response of [missing, invalid]) {
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: { code: "NOT_FOUND", message: "The requested resource was not found." } });
    }
  });

  it("logs unexpected failures and never exposes diagnostics", async () => {
    const log = vi.fn();
    const response = await createPublicGetHandler(async () => { throw new Error("postgres://user:secret@host/db"); }, log)();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"status":500'));
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining("secret"));
  });

  it("records the error type and throw site so production failures stay diagnosable", async () => {
    const log = vi.fn();
    await createPublicGetHandler(async () => { throw new TypeError("postgres://user:secret@host/db"); }, log)();

    const record = JSON.parse(log.mock.calls[0][0]);
    expect(record.errorName).toBe("TypeError");
    expect(record.errorFrame).toContain("tests/unit/http-routes.test.ts");
    expect(record.errorFrame).not.toContain(process.cwd());
  });
});

describe("internal route handlers", () => {
  it("rejects missing and mismatched secrets without starting work", async () => {
    const work = vi.fn();
    const handler = createInternalPostHandler("correct-secret", work);

    for (const secret of [null, "wrong-secret"]) {
      const response = await handler(new Request("http://localhost/api/internal", { method: "POST", headers: secret ? { authorization: `Bearer ${secret}` } : {} }));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: { code: "UNAUTHORIZED", message: "Unauthorized." } });
    }
    expect(work).not.toHaveBeenCalled();
  });

  it("uses a matching secret to run work and returns a safe 500 on failure", async () => {
    const work = vi.fn().mockRejectedValue(new Error("OpenAI request failed: token=private"));
    const log = vi.fn();
    const handler = createInternalPostHandler("correct-secret", work, log);
    const response = await handler(new Request("http://localhost/api/internal", { method: "POST", headers: { authorization: "Bearer correct-secret" } }));

    expect(work).toHaveBeenCalledOnce();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining("private"));
  });
});
