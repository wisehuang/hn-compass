import OpenAI from "openai";
import pLimit from "p-limit";
import { createDatabase } from "@/db/client";
import { finishIngestionRun, findSummaryByInputHash, replaceStoryComments, savePublishedSummary, saveSummaryJob, startIngestionRun, upsertDigest, upsertStory } from "@/db/repositories";
import { createArticleSummaryRouter, type ArticleSummaryProvider } from "@/server/ingestion/article-summary-router";
import { resolveArticleMaterial, type ArticleMaterial } from "@/server/ingestion/article-material";
import { collectHnComments, type CollectedHnComment } from "@/server/ingestion/hn-comments";
import { parseDailyRss, type RssStory } from "@/server/ingestion/rss";
import { createDiscussionSummaryGenerator, type ArticleSummary, type GeneratedSummary } from "@/server/ingestion/summaries";

type Database = ReturnType<typeof createDatabase>["db"];
export type DailyConfig = { digestDate: string; rssUrl: string; openAiModel?: string; openAiArticleModel?: string; openAiApiKey?: string; kagiApiKey?: string; kagiSummarizerEngine?: string; minimumConfidence?: number; kagiFallbackEnabled?: boolean };
type Generated = { payload: unknown; inputHash: string; model: string; promptVersion: string };
type Generator = { generateArticle: (material: ArticleMaterial) => Promise<Generated & { provider: ArticleSummaryProvider }>; generateDiscussion: (comments: Array<{ hnCommentId: number; bodyText: string }>) => Promise<Generated> };
export type DailyStore = {
  startRun(date: string): Promise<{ id: string }>; finishRun(id: string, status: "COMPLETED" | "PARTIAL_FAILURE" | "FAILED", metrics: Record<string, number>, error?: string): Promise<void>; upsertDigest(date: string, url: string): Promise<{ id: string }>;
  upsertStory(values: { digestId: string; rank: number; title: string; articleUrl: string; sourceDomain: string; hnItemId: number; hnDiscussionUrl: string; articleFetchStatus: string; articleContent: string | null; articleContentHash: string | null; articleExtractor: string | null; articleExtractionConfidence: number | null }): Promise<{ id: string }>;
  replaceComments(storyId: string, comments: CollectedHnComment[]): Promise<void>; savePublished(values: { storyId: string; kind: string; payloadJson: unknown; model: string; promptVersion: string; inputHash: string }): Promise<void>; saveFailure(storyId: string, kind: string, error: string): Promise<void>;
};
export type DailyDependencies = { fetchRss(url: string): Promise<string>; resolveArticle(url: string, title: string): Promise<ArticleMaterial>; collectComments(id: number): Promise<{ comments: CollectedHnComment[] }>; createGenerator(): Generator };

const PROVIDER_METRIC: Record<ArticleSummaryProvider, "articleSummariesOpenAi" | "articleSummariesKagi" | "articleSummariesCached"> = { openai: "articleSummariesOpenAi", kagi: "articleSummariesKagi", cache: "articleSummariesCached" };

/** Each story costs a fetch, a comment crawl, and two provider calls, so a few run at once without flooding any upstream. */
const STORY_CONCURRENCY = 3;

type DiscussableStory = RssStory & { hnItemId: number; hnDiscussionUrl: string };
function isDiscussable(entry: RssStory): entry is DiscussableStory { return Boolean(entry.hnItemId && entry.hnDiscussionUrl); }

async function fetchRss(url: string) { const response = await fetch(url, { signal: AbortSignal.timeout(10_000) }); if (!response.ok) throw new Error("RSS feed could not be fetched."); return response.text(); }
function safeError(error: unknown) { return error instanceof Error ? error.message.slice(0, 200) : "Unknown ingestion failure."; }

export async function runDailyIngestionWith(store: DailyStore, config: DailyConfig, dependencies: DailyDependencies) {
  const run = await store.startRun(config.digestDate); const metrics = { storiesProcessed: 0, storyFailures: 0, summaryFailures: 0, articleSummariesOpenAi: 0, articleSummariesKagi: 0, articleSummariesCached: 0 };
  try {
    const digest = await store.upsertDigest(config.digestDate, config.rssUrl); const generator = dependencies.createGenerator();
    const ingestStory = async (entry: DiscussableStory) => {
      try {
        const material = await dependencies.resolveArticle(entry.articleUrl, entry.title);
        const story = await store.upsertStory({ digestId: digest.id, rank: entry.rank, title: entry.title, articleUrl: entry.articleUrl, sourceDomain: new URL(entry.articleUrl).hostname, hnItemId: entry.hnItemId, hnDiscussionUrl: entry.hnDiscussionUrl, articleFetchStatus: material.articleFetchStatus, articleContent: material.articleContent, articleContentHash: material.articleContentHash, articleExtractor: material.articleExtractor, articleExtractionConfidence: material.articleExtractionConfidence });
        const collected = await dependencies.collectComments(entry.hnItemId); await store.replaceComments(story.id, collected.comments);
        const jobs: Array<{ kind: string; run: () => Promise<Generated> }> = [
          { kind: "DISCUSSION", run: () => generator.generateDiscussion(collected.comments) },
          { kind: "ARTICLE", run: async () => { const output = await generator.generateArticle(material); metrics[PROVIDER_METRIC[output.provider]] += 1; return output; } },
        ];
        await Promise.all(jobs.map(async (job) => { try { const output = await job.run(); await store.savePublished({ storyId: story.id, kind: job.kind, payloadJson: output.payload, model: output.model, promptVersion: output.promptVersion, inputHash: output.inputHash }); } catch (error) { metrics.summaryFailures += 1; await store.saveFailure(story.id, job.kind, safeError(error)); } }));
        metrics.storiesProcessed += 1;
      } catch { metrics.storyFailures += 1; }
    };
    const limit = pLimit(STORY_CONCURRENCY);
    await Promise.all(parseDailyRss(await dependencies.fetchRss(config.rssUrl)).filter(isDiscussable).map((entry) => limit(() => ingestStory(entry))));
    const status = metrics.storyFailures || metrics.summaryFailures ? "PARTIAL_FAILURE" : "COMPLETED"; await store.finishRun(run.id, status, metrics); return { status, metrics };
  } catch (error) { await store.finishRun(run.id, "FAILED", metrics, safeError(error)); throw error; }
}

/** Builds the provider-routing generator shared by daily ingestion and single-story reruns. */
export function createRoutedGenerator(config: DailyConfig, findCachedSummary?: (inputHash: string) => Promise<GeneratedSummary<ArticleSummary> | null>): Generator {
  const client = config.openAiApiKey ? new OpenAI({ apiKey: config.openAiApiKey }) : undefined;
  const articleModel = config.openAiArticleModel ?? config.openAiModel;
  const router = createArticleSummaryRouter({
    openAi: client && articleModel ? { client, model: articleModel } : undefined,
    kagi: config.kagiApiKey && config.kagiSummarizerEngine ? { apiKey: config.kagiApiKey, engine: config.kagiSummarizerEngine } : undefined,
    minimumConfidence: config.minimumConfidence,
    kagiFallbackEnabled: config.kagiFallbackEnabled,
    findCachedSummary,
  });
  const discussionGenerator = client && config.openAiModel ? createDiscussionSummaryGenerator({ client, model: config.openAiModel }) : undefined;
  return {
    generateArticle: (material) => router.generateArticle(material),
    generateDiscussion: (comments) => discussionGenerator ? discussionGenerator.generateDiscussion(comments) : Promise.reject(new Error("OpenAI discussion summarizer is not configured.")),
  };
}

export async function runDailyIngestion(db: Database, config: DailyConfig) {
  const store: DailyStore = { startRun: (date) => startIngestionRun(db, date), finishRun: (id, status, metrics, error) => finishIngestionRun(db, id, status, metrics, error), upsertDigest: (date, url) => upsertDigest(db, date, url), upsertStory: (values) => upsertStory(db, values), replaceComments: (id, values) => replaceStoryComments(db, id, values), savePublished: (values) => savePublishedSummary(db, values), saveFailure: (id, kind, error) => saveSummaryJob(db, { storyId: id, kind, status: "RETRYABLE_FAILURE", errorSummary: error }) };
  return runDailyIngestionWith(store, config, {
    fetchRss,
    resolveArticle: (url, title) => resolveArticleMaterial(url, title),
    collectComments: collectHnComments,
    createGenerator: () => createRoutedGenerator(config, (inputHash) => findCachedArticleSummary(db, inputHash)),
  });
}

/** Reuses an already published ARTICLE summary whose source text hashes identically. */
export async function findCachedArticleSummary(db: Database, inputHash: string): Promise<GeneratedSummary<ArticleSummary> | null> {
  const existing = await findSummaryByInputHash(db, "ARTICLE", inputHash);
  if (!existing) return null;
  return { payload: existing.payloadJson as ArticleSummary, inputHash: existing.inputHash, model: existing.model, promptVersion: existing.promptVersion };
}
