import { and, desc, eq, sql } from "drizzle-orm";
import { createDatabase } from "@/db/client";
import { comments, digests, ingestionRuns, stories, summaries, summaryJobs } from "@/db/schema";

export type Database = ReturnType<typeof createDatabase>["db"];

export async function upsertDigest(db: Database, digestDate: string, sourceRssUrl: string) {
  const [digest] = await db
    .insert(digests)
    .values({ digestDate, sourceRssUrl })
    .onConflictDoUpdate({ target: digests.digestDate, set: { sourceRssUrl, updatedAt: new Date() } })
    .returning();
  return digest;
}

export async function upsertStory(db: Database, values: { digestId: string; rank: number; title: string; articleUrl: string; sourceDomain: string; hnItemId: number; hnDiscussionUrl: string; articleFetchStatus: string; articleContent: string | null; articleContentHash: string | null; articleExtractor: string | null; articleExtractionConfidence: number | null }) {
  const [story] = await db.insert(stories).values(values).onConflictDoUpdate({ target: [stories.digestId, stories.rank], set: { ...values, updatedAt: new Date() } }).returning();
  return story;
}

export async function replaceStoryComments(db: Database, storyId: string, values: Array<{ hnCommentId: number; parentHnCommentId: number | null; author: string | null; score: number | null; bodyText: string; position: number; fetchedAt: Date }>) {
  await db.delete(comments).where(eq(comments.storyId, storyId));
  if (values.length) await db.insert(comments).values(values.map((comment) => ({ ...comment, storyId, isDeleted: false })));
}

export async function getLatestDigest(db: Database) {
  return db.query.digests.findFirst({ orderBy: [desc(digests.digestDate)] });
}

export async function getStoryProjection(db: Database, storyId: string) {
  return db.query.stories.findFirst({
    where: eq(stories.id, storyId),
    with: { comments: true, summaries: true },
  });
}

export const summaryKinds = summaries.kind;

export async function saveSummaryJob(db: Database, values: { storyId: string; kind: string; status: "PUBLISHED" | "RETRYABLE_FAILURE"; errorSummary?: string | null }) {
  await db.insert(summaryJobs).values({ ...values, attempts: 1 }).onConflictDoUpdate({
    target: [summaryJobs.storyId, summaryJobs.kind],
    set: { status: values.status, errorSummary: values.errorSummary ?? null, attempts: sql`${summaryJobs.attempts} + 1`, updatedAt: new Date() },
  });
}

export async function savePublishedSummary(db: Database, values: { storyId: string; kind: string; payloadJson: unknown; model: string; promptVersion: string; inputHash: string }) {
  await db.insert(summaries).values(values).onConflictDoUpdate({ target: [summaries.storyId, summaries.kind], set: { ...values, generatedAt: new Date() } });
  await saveSummaryJob(db, { storyId: values.storyId, kind: values.kind, status: "PUBLISHED" });
}

/** Lets a repeated article reuse a published summary instead of paying a provider again. */
export async function findSummaryByInputHash(db: Database, kind: string, inputHash: string) {
  return db.query.summaries.findFirst({ where: and(eq(summaries.kind, kind), eq(summaries.inputHash, inputHash)) });
}

export async function startIngestionRun(db: Database, digestDate: string) {
  const [run] = await db.insert(ingestionRuns).values({ digestDate, status: "RUNNING" }).returning();
  return run;
}

export async function finishIngestionRun(db: Database, runId: string, status: "COMPLETED" | "PARTIAL_FAILURE" | "FAILED", metricsJson: Record<string, number>, errorSummary?: string) {
  await db.update(ingestionRuns).set({ status, metricsJson, errorSummary: errorSummary ?? null, completedAt: new Date() }).where(eq(ingestionRuns.id, runId));
}
