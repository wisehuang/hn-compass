import { load } from "cheerio";
import pLimit from "p-limit";
import { z } from "zod";
import { deriveInsiderSignal, type InsiderSignal } from "@/server/ingestion/insider-signals";

const FIREBASE_ITEM_URL = "https://hacker-news.firebaseio.com/v0/item";
const MAX_TOP_LEVEL_COMMENTS = 40;
const MAX_DIRECT_REPLIES = 2;
const MAX_CONCURRENCY = 5;
const MINIMUM_BODY_LENGTH = 20;
const FIREBASE_TIMEOUT_MS = 10_000;

const HnItemSchema = z.object({
  id: z.number().int().positive(),
  type: z.string().optional(),
  by: z.string().optional(),
  score: z.number().int().optional(),
  text: z.string().optional(),
  parent: z.number().int().positive().optional(),
  kids: z.array(z.number().int().positive()).optional(),
  deleted: z.boolean().optional(),
  dead: z.boolean().optional(),
});

export type CollectedHnComment = {
  hnCommentId: number;
  parentHnCommentId: number | null;
  author: string | null;
  score: number | null;
  bodyText: string;
  position: number;
  insiderSignal: InsiderSignal | null;
  fetchedAt: Date;
};

export type CommentCollection = {
  comments: CollectedHnComment[];
  skippedCount: number;
};

type Dependencies = {
  fetchItem?: (itemId: number) => Promise<unknown>;
};

function toPlainText(html: string): string {
  const $ = load(html);
  $("script,style,noscript,template,svg,iframe").remove();
  return $.text().replace(/\s+/g, " ").trim();
}

function toValidComment(item: unknown, parentHnCommentId: number | null, position: number, submitter: string | null): CollectedHnComment | undefined {
  const parsed = HnItemSchema.safeParse(item);
  if (!parsed.success || parsed.data.type !== "comment" || parsed.data.deleted || parsed.data.dead || !parsed.data.text) return undefined;

  const bodyText = toPlainText(parsed.data.text);
  if (bodyText.length < MINIMUM_BODY_LENGTH) return undefined;

  return {
    hnCommentId: parsed.data.id,
    parentHnCommentId,
    author: parsed.data.by ?? null,
    score: parsed.data.score ?? null,
    bodyText,
    position,
    insiderSignal: deriveInsiderSignal({ bodyText, author: parsed.data.by ?? null, submitter }),
    fetchedAt: new Date(),
  };
}

async function fetchFirebaseItem(itemId: number): Promise<unknown> {
  const response = await fetch(`${FIREBASE_ITEM_URL}/${itemId}.json`, { cache: "no-store", signal: AbortSignal.timeout(FIREBASE_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Firebase item ${itemId} could not be fetched.`);
  return response.json();
}

/** Results stay in request order; pLimit keeps the requests in flight bounded without batch barriers. */
async function fetchInBatches<T>(ids: number[], fetchItem: (itemId: number) => Promise<T>): Promise<Array<T | undefined>> {
  const limit = pLimit(MAX_CONCURRENCY);
  return Promise.all(ids.map((id) => limit(() => fetchItem(id).catch(() => undefined))));
}

export async function collectHnComments(storyHnItemId: number, dependencies: Dependencies = {}): Promise<CommentCollection> {
  const fetchItem = dependencies.fetchItem ?? fetchFirebaseItem;
  const story = HnItemSchema.safeParse(await fetchItem(storyHnItemId));
  if (!story.success) throw new Error("Firebase story record is malformed.");

  const submitter = story.data.by ?? null;
  const topLevelIds = story.data.kids ?? [];
  const topLevelItems = await fetchInBatches(topLevelIds, fetchItem);
  const comments: CollectedHnComment[] = [];
  let retainedTopLevelComments = 0;
  let skippedCount = 0;

  for (let topLevelIndex = 0; topLevelIndex < topLevelItems.length && retainedTopLevelComments < MAX_TOP_LEVEL_COMMENTS; topLevelIndex += 1) {
    const topLevelItem = topLevelItems[topLevelIndex];
    const topLevelComment = toValidComment(topLevelItem, null, topLevelIndex, submitter);
    if (!topLevelComment) {
      skippedCount += 1;
      continue;
    }

    comments.push(topLevelComment);
    retainedTopLevelComments += 1;
    const parsedTopLevel = HnItemSchema.safeParse(topLevelItem);
    const replyIds = parsedTopLevel.success ? parsedTopLevel.data.kids ?? [] : [];
    const replyItems = await fetchInBatches(replyIds, fetchItem);
    let retainedReplies = 0;

    for (let replyIndex = 0; replyIndex < replyItems.length && retainedReplies < MAX_DIRECT_REPLIES; replyIndex += 1) {
      const replyItem = replyItems[replyIndex];
      const parsedReply = HnItemSchema.safeParse(replyItem);
      if (!parsedReply.success || parsedReply.data.parent !== topLevelComment.hnCommentId) {
        skippedCount += 1;
        continue;
      }
      const reply = toValidComment(replyItem, topLevelComment.hnCommentId, replyIndex, submitter);
      if (!reply) {
        skippedCount += 1;
        continue;
      }
      comments.push(reply);
      retainedReplies += 1;
    }
  }

  return { comments, skippedCount };
}
