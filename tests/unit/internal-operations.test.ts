import { beforeEach, describe, expect, it, vi } from "vitest";

const { saveFailure } = vi.hoisted(() => ({ saveFailure: vi.fn() }));

vi.mock("@/db/repositories", () => ({
  savePublishedSummary: vi.fn(),
  saveSummaryJob: saveFailure,
}));

vi.mock("@/db/schema", () => ({ stories: { id: "id" } }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));

import { regenerateStorySummaries } from "@/server/internal-operations";

describe("summary regeneration", () => {
  beforeEach(() => {
    vi.stubEnv("RSS_URL", "https://rss.test");
    vi.stubEnv("KAGI_API_KEY", "");
    vi.stubEnv("KAGI_SUMMARIZER_ENGINE", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_MODEL", "");
    saveFailure.mockReset();
  });

  it("persists retryable article work when Kagi is not configured", async () => {
    const db = { query: { stories: { findFirst: async () => ({ id: "story-1", articleContent: "sanitized text", comments: [] }) } } } as never;

    await expect(regenerateStorySummaries(db, "story-1")).resolves.toMatchObject({ regenerated: false, summaryCount: 2 });
    expect(saveFailure).toHaveBeenCalledWith(db, expect.objectContaining({ storyId: "story-1", kind: "ARTICLE", status: "RETRYABLE_FAILURE" }));
  });
});
