import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "@/db/client";
import { comments, digests, stories, summaries } from "@/db/schema";
import { createPublicDigestQueries } from "@/server/queries/public-digest";

const url = process.env.TEST_DATABASE_URL;
const database = url ? createDatabase(url) : null;

if (!database) {
  describe.skip("public digest queries", () => {});
} else describe("public digest queries", () => {
  const db = database!.db;
  const queries = createPublicDigestQueries(db);
  let storyId = "";

  beforeAll(async () => {
    await db.delete(comments); await db.delete(summaries); await db.delete(stories); await db.delete(digests);
    const [digest] = await db.insert(digests).values({ digestDate: "2026-08-24", sourceRssUrl: "https://example.test/rss" }).returning();
    const [story] = await db.insert(stories).values({ digestId: digest.id, rank: 1, title: "Stored story", articleUrl: "https://example.test/article", sourceDomain: "example.test", hnItemId: 12345, hnDiscussionUrl: "https://news.ycombinator.com/item?id=12345", articleFetchStatus: "SUCCESS", articleContent: "private article body", articleContentHash: "private-hash" }).returning();
    storyId = story.id;
    await db.insert(comments).values({ storyId, hnCommentId: 99, author: "alice", score: 12, bodyText: "Useful comment", position: 1, insiderSignal: "SELF_IDENTIFIED_INSIDER", isDeleted: false });
    await db.insert(comments).values({ storyId, hnCommentId: 100, author: "bob", score: 3, bodyText: "Comment stored before signals existed", position: 2, isDeleted: false });
    await db.insert(summaries).values({ storyId, kind: "ARTICLE", payloadJson: { tldr: "摘要" }, model: "test", promptVersion: "v1", inputHash: "private-input-hash" });
  });

  afterAll(async () => { await database!.close(); });

  it("projects persisted latest, date, story, and missing resources without private inputs", async () => {
    expect((await queries.latest())?.stories[0].title).toBe("Stored story");
    expect((await queries.byDate("2026-08-24"))?.id).toBeTruthy();
    const story = await queries.story(storyId);
    expect(story?.comments).toHaveLength(2);
    expect(JSON.stringify(story)).not.toContain("private article body");
    expect(JSON.stringify(story)).not.toContain("private-input-hash");
    expect(await queries.byDate("2026-08-23")).toBeNull();
    expect(await queries.story("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("projects the persisted insider signal and leaves pre-existing comments unsignalled", async () => {
    const story = await queries.story(storyId);

    expect(story?.comments.map((comment) => [comment.hnCommentId, comment.insiderSignal])).toEqual([[99, "SELF_IDENTIFIED_INSIDER"], [100, null]]);
  });

  it("projects an unavailable persisted story with its source links and no article summary", async () => {
    const digest = await queries.byDate("2026-08-24");
    const [unavailableStory] = await db.insert(stories).values({
      digestId: digest!.id,
      rank: 2,
      title: "Unavailable source story",
      articleUrl: "https://example.test/unavailable",
      sourceDomain: "example.test",
      hnItemId: 54321,
      hnDiscussionUrl: "https://news.ycombinator.com/item?id=54321",
      articleFetchStatus: "TOO_LARGE",
      articleContent: null,
      articleContentHash: null,
    }).returning();

    expect(await queries.story(unavailableStory.id)).toMatchObject({
      articleUrl: "https://example.test/unavailable",
      hnDiscussionUrl: "https://news.ycombinator.com/item?id=54321",
      articleFetchStatus: "TOO_LARGE",
      summaries: [],
    });
  });
});
