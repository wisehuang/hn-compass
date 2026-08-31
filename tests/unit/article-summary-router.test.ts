import { describe, expect, it, vi } from "vitest";
import type { ArticleMaterial } from "@/server/ingestion/article-material";
import { createArticleSummaryRouter } from "@/server/ingestion/article-summary-router";
import type { ParsedResponsesClient } from "@/server/ingestion/summaries";

function material(overrides: Partial<ArticleMaterial> = {}): ArticleMaterial {
  return {
    sourceUrl: "https://example.test/article",
    articleFetchStatus: "SUCCESS",
    articleContent: "extracted article body",
    articleContentHash: "hash",
    articleSummaryInput: "extracted article body",
    articleExtractor: "readability",
    articleExtractionConfidence: 0.8,
    ...overrides,
  };
}

type ParseResult = { output_parsed: { summary: string }; usage?: { total_tokens: number } };

function openAiClient(parse: () => Promise<ParseResult> = vi.fn(async () => ({ output_parsed: { summary: "摘要內容。" }, usage: { total_tokens: 180 } }))) {
  return { client: { responses: { parse } } as unknown as ParsedResponsesClient, parse };
}

function kagiResponse(output = "Kagi 摘要。") {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ data: { output, tokens: 300 } }), { status: 200 }));
}

const kagiOptions = (fetchFn: typeof fetch) => ({ apiKey: "kagi-test", engine: "agnes", fetchFn });

describe("article summary routing", () => {
  it("summarizes high-confidence extractions with OpenAI and never calls Kagi", async () => {
    const { client, parse } = openAiClient();
    const kagiFetch = kagiResponse();
    const router = createArticleSummaryRouter({ openAi: { client, model: "gpt-5.6-luna" }, kagi: kagiOptions(kagiFetch) });

    const result = await router.generateArticle(material({ articleExtractionConfidence: 0.8 }));

    expect(result).toMatchObject({ provider: "openai", model: "openai:gpt-5.6-luna", promptVersion: "openai-article-v2", payload: { summary: "摘要內容。", tokens: 180, targetLanguage: "ZH-HANT" } });
    expect(parse).toHaveBeenCalledTimes(1);
    expect(kagiFetch).not.toHaveBeenCalled();
  });

  it("falls back to Kagi URL summarization when the extraction scored below the threshold", async () => {
    const { client, parse } = openAiClient();
    const kagiFetch = kagiResponse();
    const router = createArticleSummaryRouter({ openAi: { client, model: "gpt-5.6-luna" }, kagi: kagiOptions(kagiFetch) });

    const result = await router.generateArticle(material({ articleExtractionConfidence: 0.3 }));

    expect(result).toMatchObject({ provider: "kagi", model: "kagi:agnes" });
    expect(parse).not.toHaveBeenCalled();
    expect(kagiFetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to Kagi when the article could not be fetched at all", async () => {
    const { client, parse } = openAiClient();
    const kagiFetch = kagiResponse();
    const router = createArticleSummaryRouter({ openAi: { client, model: "gpt-5.6-luna" }, kagi: kagiOptions(kagiFetch) });

    const result = await router.generateArticle(material({ articleFetchStatus: "UNAVAILABLE", articleContent: null, articleSummaryInput: null, articleExtractor: null, articleExtractionConfidence: null }));

    expect(result).toMatchObject({ provider: "kagi" });
    expect(parse).not.toHaveBeenCalled();
  });

  it("falls back to Kagi when the OpenAI call fails", async () => {
    const parse = vi.fn(async () => { throw new Error("model unavailable"); });
    const { client } = openAiClient(parse);
    const kagiFetch = kagiResponse();
    const router = createArticleSummaryRouter({ openAi: { client, model: "gpt-5.6-luna" }, kagi: kagiOptions(kagiFetch) });

    await expect(router.generateArticle(material())).resolves.toMatchObject({ provider: "kagi" });
    expect(kagiFetch).toHaveBeenCalledTimes(1);
  });

  it("surfaces the OpenAI failure when the Kagi fallback is disabled", async () => {
    const parse = vi.fn(async () => { throw new Error("model unavailable"); });
    const { client } = openAiClient(parse);
    const kagiFetch = kagiResponse();
    const router = createArticleSummaryRouter({ openAi: { client, model: "gpt-5.6-luna" }, kagi: kagiOptions(kagiFetch), kagiFallbackEnabled: false });

    await expect(router.generateArticle(material())).rejects.toThrow("model unavailable");
    expect(kagiFetch).not.toHaveBeenCalled();
  });

  it("reuses a cached summary instead of calling any provider", async () => {
    const { client, parse } = openAiClient();
    const kagiFetch = kagiResponse();
    const findCachedSummary = vi.fn(async () => ({ payload: { summary: "快取摘要。", tokens: 10, targetLanguage: "ZH-HANT" as const }, inputHash: "cached", model: "openai:gpt-5.6-luna", promptVersion: "openai-article-v2" }));
    const router = createArticleSummaryRouter({ openAi: { client, model: "gpt-5.6-luna" }, kagi: kagiOptions(kagiFetch), findCachedSummary });

    await expect(router.generateArticle(material())).resolves.toMatchObject({ provider: "cache", payload: { summary: "快取摘要。" } });
    expect(parse).not.toHaveBeenCalled();
    expect(kagiFetch).not.toHaveBeenCalled();
  });

  it("still summarizes when the cache lookup itself fails", async () => {
    const { client } = openAiClient();
    const findCachedSummary = vi.fn(async () => { throw new Error("database unavailable"); });
    const router = createArticleSummaryRouter({ openAi: { client, model: "gpt-5.6-luna" }, findCachedSummary });

    await expect(router.generateArticle(material())).resolves.toMatchObject({ provider: "openai" });
  });

  it("honors a custom confidence threshold", async () => {
    const { client, parse } = openAiClient();
    const router = createArticleSummaryRouter({ openAi: { client, model: "gpt-5.6-luna" }, kagi: kagiOptions(kagiResponse()), minimumConfidence: 0.2 });

    await expect(router.generateArticle(material({ articleExtractionConfidence: 0.3 }))).resolves.toMatchObject({ provider: "openai" });
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("reports a clear error when no summarizer is configured", async () => {
    const router = createArticleSummaryRouter({});

    await expect(router.generateArticle(material())).rejects.toThrow("No article summarizer is configured.");
  });

  it("estimates a token count when the Responses API omits usage", async () => {
    const parse = vi.fn(async () => ({ output_parsed: { summary: "摘要內容。" }, usage: undefined }));
    const { client } = openAiClient(parse);
    const router = createArticleSummaryRouter({ openAi: { client, model: "gpt-5.6-luna" } });

    const result = await router.generateArticle(material());

    expect(result.payload.tokens).toBeGreaterThan(0);
  });
});
