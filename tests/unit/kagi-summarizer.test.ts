import { describe, expect, it, vi } from "vitest";
import { KAGI_MAX_TEXT_BYTES, createKagiArticleSummarizer } from "@/server/ingestion/kagi-summarizer";

describe("Kagi article summarizer", () => {
  it("sends sanitized text with the Kagi privacy and Traditional Chinese options", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ data: { output: "本文說明安全取得資料的邊界。", tokens: 240 } }), { status: 200 }));
    const summarize = createKagiArticleSummarizer({ apiKey: "kagi-test", engine: "agnes", fetchFn });

    await expect(summarize("clean article text")).resolves.toEqual({ summary: "本文說明安全取得資料的邊界。", tokens: 240, targetLanguage: "ZH-HANT" });
    expect(fetchFn).toHaveBeenCalledWith("https://kagi.com/api/v0/summarize", expect.objectContaining({
      method: "POST",
      headers: { Authorization: "Bot kagi-test", "Content-Type": "application/json" },
      body: JSON.stringify({ text: "clean article text", engine: "agnes", summary_type: "summary", target_language: "ZH-HANT", cache: false }),
    }));
  });

  it("rejects non-success and malformed provider responses", async () => {
    const failing = createKagiArticleSummarizer({ apiKey: "kagi-test", engine: "agnes", fetchFn: async () => new Response("insufficient credits", { status: 402 }) });
    const malformed = createKagiArticleSummarizer({ apiKey: "kagi-test", engine: "agnes", fetchFn: async () => new Response(JSON.stringify({ data: { output: "", tokens: 0 } }), { status: 200 }) });

    await expect(failing("text")).rejects.toThrow("Kagi summarization failed");
    await expect(malformed("text")).rejects.toThrow("Kagi summarization response was invalid");
  });

  it("rejects text beyond Kagi's one-megabyte request limit before sending it", async () => {
    const fetchFn = vi.fn();
    const summarize = createKagiArticleSummarizer({ apiKey: "kagi-test", engine: "agnes", fetchFn });

    await expect(summarize("a".repeat(KAGI_MAX_TEXT_BYTES + 1))).rejects.toThrow("Kagi article text exceeds the 1 MB request limit");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("does not send a non-HTTP article URL to Kagi", async () => {
    const fetchFn = vi.fn<typeof fetch>();
    const summarize = createKagiArticleSummarizer({ apiKey: "kagi-test", engine: "agnes", fetchFn });

    await expect(summarize({ url: "file:///private/article" })).rejects.toThrow("Kagi article URL must use HTTP or HTTPS.");
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
