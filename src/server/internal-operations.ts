import { eq } from "drizzle-orm";
import type { Database } from "@/db/repositories";
import { savePublishedSummary, saveSummaryJob } from "@/db/repositories";
import { stories } from "@/db/schema";
import { truncateSummaryInput, type ArticleFetchStatus, type ArticleMaterial } from "@/server/ingestion/article-material";
import { createRoutedGenerator, runDailyIngestion } from "@/server/ingestion/daily";
import type { ArticleExtractor } from "@/server/ingestion/extractors/types";
import { readSummaryEnv } from "@/server/summary-config";

function taipeiDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function configuration() {
  const rssUrl = process.env.RSS_URL;
  if (!rssUrl) throw new Error("Internal operation is not configured.");
  return { rssUrl, ...readSummaryEnv() };
}

/** Rebuilds summarization material from the persisted row so a rerun never refetches the article. */
function storedMaterial(story: { articleUrl: string; articleFetchStatus: string; articleContent: string | null; articleContentHash: string | null; articleExtractor: string | null; articleExtractionConfidence: number | null }): ArticleMaterial {
  return {
    sourceUrl: story.articleUrl,
    articleFetchStatus: story.articleFetchStatus as ArticleFetchStatus,
    articleContent: story.articleContent,
    articleContentHash: story.articleContentHash,
    articleSummaryInput: story.articleContent ? truncateSummaryInput(story.articleContent) : null,
    articleExtractor: story.articleExtractor as ArticleExtractor | null,
    articleExtractionConfidence: story.articleExtractionConfidence,
  };
}

export async function ingestDaily(db: Database) {
  const config = configuration();
  const result = await runDailyIngestion(db, { ...config, digestDate: taipeiDate() });
  return { status: result.status, metrics: result.metrics };
}

export async function regenerateStorySummaries(db: Database, storyId: string) {
  const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId), with: { comments: true } });
  if (!story) return { regenerated: false, reason: "not_found" };
  const config = configuration();
  const generator = createRoutedGenerator({ ...config, digestDate: "", rssUrl: config.rssUrl });
  const jobs = [
    { kind: "ARTICLE", generate: () => generator.generateArticle(storedMaterial(story)) },
    { kind: "DISCUSSION", generate: () => generator.generateDiscussion(story.comments.map(({ hnCommentId, bodyText }) => ({ hnCommentId, bodyText }))) },
  ];
  const results = await Promise.all(jobs.map(async (job) => {
    try {
      const summary = await job.generate();
      await savePublishedSummary(db, { storyId, kind: job.kind, payloadJson: summary.payload, model: summary.model, promptVersion: summary.promptVersion, inputHash: summary.inputHash });
      return true;
    } catch {
      await saveSummaryJob(db, { storyId, kind: job.kind, status: "RETRYABLE_FAILURE", errorSummary: "Summary regeneration failed." });
      return false;
    }
  }));
  return { regenerated: results.every(Boolean), summaryCount: results.length };
}
