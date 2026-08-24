import { describe, expect, it, vi } from "vitest";
import { createInternalPostHandler, createPublicGetHandler } from "@/server/http";

describe("public route handlers", () => {
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
