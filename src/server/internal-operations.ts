import OpenAI from "openai";
import { eq } from "drizzle-orm";
import type { Database } from "@/db/repositories";
import { savePublishedSummary, saveSummaryJob } from "@/db/repositories";
import { stories } from "@/db/schema";
import { runDailyIngestion } from "@/server/ingestion/daily";
import { createArticleSummaryGenerator, createDiscussionSummaryGenerator } from "@/server/ingestion/summaries";

function taipeiDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function configuration() {
  const { RSS_URL: rssUrl, OPENAI_API_KEY: openAiApiKey, OPENAI_MODEL: openAiModel, KAGI_API_KEY: kagiApiKey, KAGI_SUMMARIZER_ENGINE: kagiSummarizerEngine } = process.env;
  if (!rssUrl) throw new Error("Internal operation is not configured.");
  return { rssUrl, openAiApiKey, openAiModel, kagiApiKey, kagiSummarizerEngine };
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
  const articleGenerator = config.kagiApiKey && config.kagiSummarizerEngine ? createArticleSummaryGenerator({ apiKey: config.kagiApiKey, engine: config.kagiSummarizerEngine }) : undefined;
  const discussionGenerator = config.openAiApiKey && config.openAiModel ? createDiscussionSummaryGenerator({ client: new OpenAI({ apiKey: config.openAiApiKey }), model: config.openAiModel }) : undefined;
  const jobs = [
    { kind: "ARTICLE", generate: () => articleGenerator ? articleGenerator.generateArticleFromUrl(story.articleUrl) : Promise.reject(new Error("Kagi article summarizer is not configured.")) },
    { kind: "DISCUSSION", generate: () => discussionGenerator ? discussionGenerator.generateDiscussion(story.comments.map(({ hnCommentId, bodyText }) => ({ hnCommentId, bodyText }))) : Promise.reject(new Error("OpenAI discussion summarizer is not configured.")) },
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
