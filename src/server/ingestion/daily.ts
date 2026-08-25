import OpenAI from "openai";
import { createDatabase } from "@/db/client";
import { finishIngestionRun, replaceStoryComments, savePublishedSummary, saveSummaryJob, startIngestionRun, upsertDigest, upsertStory } from "@/db/repositories";
import { resolveArticleMaterial, type ArticleMaterial } from "@/server/ingestion/article-material";
import { collectHnComments, type CollectedHnComment } from "@/server/ingestion/hn-comments";
import { parseDailyRss } from "@/server/ingestion/rss";
import { createArticleSummaryGenerator, createDiscussionSummaryGenerator } from "@/server/ingestion/summaries";

type Database = ReturnType<typeof createDatabase>["db"];
export type DailyConfig = { digestDate: string; rssUrl: string; openAiModel?: string; openAiApiKey?: string; kagiApiKey?: string; kagiSummarizerEngine?: string };
type Generated = { payload: unknown; inputHash: string; model: string; promptVersion: string };
type Generator = { generateArticleFromUrl: (url: string) => Promise<Generated>; generateDiscussion: (comments: Array<{ hnCommentId: number; bodyText: string }>) => Promise<Generated> };
export type DailyStore = {
  startRun(date: string): Promise<{ id: string }>; finishRun(id: string, status: "COMPLETED" | "PARTIAL_FAILURE" | "FAILED", metrics: Record<string, number>, error?: string): Promise<void>; upsertDigest(date: string, url: string): Promise<{ id: string }>;
  upsertStory(values: { digestId: string; rank: number; title: string; articleUrl: string; sourceDomain: string; hnItemId: number; hnDiscussionUrl: string; articleFetchStatus: string; articleContent: string | null; articleContentHash: string | null }): Promise<{ id: string }>;
  replaceComments(storyId: string, comments: CollectedHnComment[]): Promise<void>; savePublished(values: { storyId: string; kind: string; payloadJson: unknown; model: string; promptVersion: string; inputHash: string }): Promise<void>; saveFailure(storyId: string, kind: string, error: string): Promise<void>;
};
export type DailyDependencies = { fetchRss(url: string): Promise<string>; resolveArticle(url: string): Promise<ArticleMaterial>; collectComments(id: number): Promise<{ comments: CollectedHnComment[] }>; createGenerator(): Generator };

async function fetchRss(url: string) { const response = await fetch(url, { signal: AbortSignal.timeout(10_000) }); if (!response.ok) throw new Error("RSS feed could not be fetched."); return response.text(); }
function safeError(error: unknown) { return error instanceof Error ? error.message.slice(0, 200) : "Unknown ingestion failure."; }

export async function runDailyIngestionWith(store: DailyStore, config: DailyConfig, dependencies: DailyDependencies) {
  const run = await store.startRun(config.digestDate); const metrics = { storiesProcessed: 0, storyFailures: 0, summaryFailures: 0 };
  try {
    const digest = await store.upsertDigest(config.digestDate, config.rssUrl); const generator = dependencies.createGenerator();
    for (const entry of parseDailyRss(await dependencies.fetchRss(config.rssUrl))) {
      if (!entry.hnItemId || !entry.hnDiscussionUrl) continue;
      try {
        const material = await dependencies.resolveArticle(entry.articleUrl);
        const story = await store.upsertStory({ digestId: digest.id, rank: entry.rank, title: entry.title, articleUrl: entry.articleUrl, sourceDomain: new URL(entry.articleUrl).hostname, hnItemId: entry.hnItemId, hnDiscussionUrl: entry.hnDiscussionUrl, articleFetchStatus: material.articleFetchStatus, articleContent: material.articleContent, articleContentHash: material.articleContentHash });
        const collected = await dependencies.collectComments(entry.hnItemId); await store.replaceComments(story.id, collected.comments);
        const jobs: Array<{ kind: string; run: () => Promise<Generated> }> = [{ kind: "DISCUSSION", run: () => generator.generateDiscussion(collected.comments) }, { kind: "ARTICLE", run: () => generator.generateArticleFromUrl(entry.articleUrl) }];
        await Promise.all(jobs.map(async (job) => { try { const output = await job.run(); await store.savePublished({ storyId: story.id, kind: job.kind, payloadJson: output.payload, model: output.model, promptVersion: output.promptVersion, inputHash: output.inputHash }); } catch (error) { metrics.summaryFailures += 1; await store.saveFailure(story.id, job.kind, safeError(error)); } }));
        metrics.storiesProcessed += 1;
      } catch { metrics.storyFailures += 1; }
    }
    const status = metrics.storyFailures || metrics.summaryFailures ? "PARTIAL_FAILURE" : "COMPLETED"; await store.finishRun(run.id, status, metrics); return { status, metrics };
  } catch (error) { await store.finishRun(run.id, "FAILED", metrics, safeError(error)); throw error; }
}

export async function runDailyIngestion(db: Database, config: DailyConfig) {
  const store: DailyStore = { startRun: (date) => startIngestionRun(db, date), finishRun: (id, status, metrics, error) => finishIngestionRun(db, id, status, metrics, error), upsertDigest: (date, url) => upsertDigest(db, date, url), upsertStory: (values) => upsertStory(db, values), replaceComments: (id, values) => replaceStoryComments(db, id, values), savePublished: (values) => savePublishedSummary(db, values), saveFailure: (id, kind, error) => saveSummaryJob(db, { storyId: id, kind, status: "RETRYABLE_FAILURE", errorSummary: error }) };
  return runDailyIngestionWith(store, config, {
    fetchRss,
    resolveArticle: resolveArticleMaterial,
    collectComments: collectHnComments,
    createGenerator: () => {
      const articleGenerator = config.kagiApiKey && config.kagiSummarizerEngine ? createArticleSummaryGenerator({ apiKey: config.kagiApiKey, engine: config.kagiSummarizerEngine }) : undefined;
      const discussionGenerator = config.openAiApiKey && config.openAiModel ? createDiscussionSummaryGenerator({ client: new OpenAI({ apiKey: config.openAiApiKey }), model: config.openAiModel }) : undefined;
      return {
        generateArticleFromUrl: (url) => articleGenerator ? articleGenerator.generateArticleFromUrl(url) : Promise.reject(new Error("Kagi article summarizer is not configured.")),
        generateDiscussion: (comments) => discussionGenerator ? discussionGenerator.generateDiscussion(comments) : Promise.reject(new Error("OpenAI discussion summarizer is not configured.")),
      };
    },
  });
}
