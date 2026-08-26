import { describe, expect, it, vi } from "vitest";
import { runDailyIngestionWith, type DailyDependencies, type DailyStore } from "@/server/ingestion/daily";

const xml = "<rss><channel><item><description><![CDATA[<span class='storylink'><a href='https://example.test/a'>A</a></span><span class='postlink'><a href='https://news.ycombinator.com/item?id=1'>c</a></span><span class='storylink'><a href='https://example.test/b'>B</a></span><span class='postlink'><a href='https://news.ycombinator.com/item?id=2'>c</a></span>]]></description></item></channel></rss>";
function fixture() {
  const digests = new Map<string, { id: string }>(); const stories = new Map<string, { id: string; rank: number }>(); const published: string[] = []; const runs: Array<{ status?: string; metrics?: Record<string, number> }> = [];
  const store: DailyStore = { startRun: async () => { runs.push({}); return { id: "run" }; }, finishRun: async (_id, status, metrics) => { Object.assign(runs[0], { status, metrics }); }, upsertDigest: async (date) => { const value = digests.get(date) ?? { id: "digest" }; digests.set(date, value); return value; }, upsertStory: async (value) => { const key = `${value.digestId}:${value.rank}`; const story = stories.get(key) ?? { id: `story-${value.rank}`, rank: value.rank }; stories.set(key, story); return story; }, replaceComments: async () => {}, savePublished: async (value) => { published.push(`${value.storyId}:${value.kind}`); }, saveFailure: async () => {} };
  const deps: DailyDependencies = { fetchRss: async () => xml, resolveArticle: async (url) => { if (url.endsWith("/b")) throw new Error("article failure"); return { sourceUrl: url, articleFetchStatus: "SUCCESS", articleContent: "x", articleContentHash: "h", articleSummaryInput: "x", articleExtractor: "readability", articleExtractionConfidence: 0.8 }; }, collectComments: async (id) => ({ comments: [{ hnCommentId: id * 10, parentHnCommentId: null, author: null, score: null, bodyText: "comment", position: 0, fetchedAt: new Date() }] }), createGenerator: () => ({ generateArticle: async () => ({ payload: {}, inputHash: "a", model: "m", promptVersion: "v", provider: "openai" as const }), generateDiscussion: async () => ({ payload: {}, inputHash: "d", model: "m", promptVersion: "v" }) }) };
  return { store, deps, digests, stories, published, runs };
}
const config = { digestDate: "2026-08-24", rssUrl: "https://rss.test", openAiModel: "test", openAiApiKey: "test" };
describe("daily ingestion", () => {
  it("is idempotent for the same date", async () => { const f = fixture(); await runDailyIngestionWith(f.store, config, f.deps); await runDailyIngestionWith(f.store, config, f.deps); expect(f.digests).toHaveLength(1); expect(f.stories).toHaveLength(1); expect(new Set(f.published)).toHaveLength(2); });
  it("persists independent stories when one story fails", async () => { const f = fixture(); const result = await runDailyIngestionWith(f.store, config, f.deps); expect(result).toMatchObject({ status: "PARTIAL_FAILURE", metrics: { storiesProcessed: 1, storyFailures: 1 } }); expect(f.stories).toHaveLength(1); expect(f.runs[0].status).toBe("PARTIAL_FAILURE"); });

  it("keeps an OpenAI discussion summary when Kagi article work fails", async () => {
    const f = fixture();
    f.deps.createGenerator = () => ({
      generateArticle: async () => { throw new Error("Kagi summarization failed."); },
      generateDiscussion: async () => ({ payload: { overview: "discussion" }, inputHash: "discussion", model: "gpt-test", promptVersion: "v1" }),
    });

    const result = await runDailyIngestionWith(f.store, config, f.deps);

    expect(result).toMatchObject({ status: "PARTIAL_FAILURE", metrics: { summaryFailures: 1, storiesProcessed: 1 } });
    expect(f.published).toEqual(["story-1:DISCUSSION"]);
  });

  it("hands the already-extracted material to the summarizer instead of refetching the URL", async () => {
    const f = fixture();
    f.deps.resolveArticle = async (url) => ({ sourceUrl: url, articleFetchStatus: "UNAVAILABLE", articleContent: null, articleContentHash: null, articleSummaryInput: null, articleExtractor: null, articleExtractionConfidence: null });
    const summarize = vi.fn(async () => ({ payload: { summary: "Kagi URL summary" }, inputHash: "article-url", model: "kagi:agnes", promptVersion: "kagi-v1", provider: "kagi" as const }));
    f.deps.createGenerator = () => ({
      generateArticle: summarize,
      generateDiscussion: async () => ({ payload: { overview: "discussion" }, inputHash: "discussion", model: "gpt-test", promptVersion: "v1" }),
    });

    await runDailyIngestionWith(f.store, config, f.deps);

    expect(summarize).toHaveBeenCalledWith(expect.objectContaining({ sourceUrl: "https://example.test/a", articleFetchStatus: "UNAVAILABLE" }));
    expect(f.published).toContain("story-1:ARTICLE");
  });

  it("persists the extractor and confidence used for each story", async () => {
    const f = fixture();
    const upsertStory = vi.fn(f.store.upsertStory);
    f.store.upsertStory = upsertStory;

    await runDailyIngestionWith(f.store, config, f.deps);

    expect(upsertStory).toHaveBeenCalledWith(expect.objectContaining({ articleExtractor: "readability", articleExtractionConfidence: 0.8 }));
  });

  it("counts article summaries per provider so Kagi spend is visible in run metrics", async () => {
    const f = fixture();
    f.deps.createGenerator = () => ({
      generateArticle: async () => ({ payload: {}, inputHash: "a", model: "kagi:agnes", promptVersion: "kagi-v1", provider: "kagi" as const }),
      generateDiscussion: async () => ({ payload: {}, inputHash: "d", model: "m", promptVersion: "v" }),
    });

    const result = await runDailyIngestionWith(f.store, config, f.deps);

    expect(result.metrics).toMatchObject({ articleSummariesKagi: 1, articleSummariesOpenAi: 0, articleSummariesCached: 0 });
  });
});
