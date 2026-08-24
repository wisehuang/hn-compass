import { desc, eq, type SQL } from "drizzle-orm";
import type { Database } from "@/db/repositories";
import { digests, stories } from "@/db/schema";

export type PublicStory = {
  id: string;
  rank: number;
  title: string;
  articleUrl: string;
  sourceDomain: string;
  hnDiscussionUrl: string;
  hnItemId: number;
  articleFetchStatus: string;
  comments: Array<{ hnCommentId: number; parentHnCommentId: number | null; author: string | null; score: number | null; bodyText: string; position: number }>;
  summaries: Array<{ kind: string; payloadJson: unknown; model: string; promptVersion: string; generatedAt: Date }>;
};

export type PublicDigest = { id: string; digestDate: string; sourceRssUrl: string; stories: PublicStory[] };

type StoredComment = PublicStory["comments"][number] & { fetchedAt: Date; isDeleted: boolean };
type StoredSummary = PublicStory["summaries"][number] & { inputHash: string };
type StoredStory = Omit<PublicStory, "comments" | "summaries"> & { articleContent: string | null; articleContentHash: string | null; comments: StoredComment[]; summaries: StoredSummary[] };
type StoredDigest = Omit<PublicDigest, "stories"> & { stories: StoredStory[] };

function toPublicDigest(digest: StoredDigest | null): PublicDigest | null {
  if (!digest) return null;
  return { ...digest, stories: digest.stories.map((story) => ({
    ...story,
    articleContent: undefined,
    articleContentHash: undefined,
    comments: story.comments.filter((comment) => !comment.isDeleted).map((comment) => ({ hnCommentId: comment.hnCommentId, parentHnCommentId: comment.parentHnCommentId, author: comment.author, score: comment.score, bodyText: comment.bodyText, position: comment.position })),
    summaries: story.summaries.map((summary) => ({ kind: summary.kind, payloadJson: summary.payloadJson, model: summary.model, promptVersion: summary.promptVersion, generatedAt: summary.generatedAt })),
  })) };
}

export function createPublicDigestQueries(db: Database) {
  const loadDigest = async (where?: SQL) => db.query.digests.findFirst({
    where,
    orderBy: [desc(digests.digestDate)],
    with: { stories: { orderBy: [stories.rank], with: { comments: { orderBy: (comments, { asc }) => [asc(comments.position)] }, summaries: true } } },
  });

  return {
    async latest(): Promise<PublicDigest | null> { return toPublicDigest(await loadDigest() as StoredDigest | null); },
    async byDate(digestDate: string): Promise<PublicDigest | null> { return toPublicDigest(await loadDigest(eq(digests.digestDate, digestDate)) as StoredDigest | null); },
    async story(storyId: string): Promise<PublicStory | null> {
      const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId), with: { comments: true, summaries: true } });
      if (!story) return null;
      return toPublicDigest({ id: "", digestDate: "", sourceRssUrl: "", stories: [story as StoredStory] })?.stories[0] ?? null;
    },
  };
}
