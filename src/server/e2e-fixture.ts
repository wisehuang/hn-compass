import type { PublicDigest, PublicStory } from "@/server/queries/public-digest";

const story: PublicStory = {
  id: "e2e-story",
  rank: 1,
  title: "Seeded persisted story",
  articleUrl: "https://example.test/article",
  sourceDomain: "example.test",
  hnDiscussionUrl: "https://news.ycombinator.com/item?id=12345",
  hnItemId: 12345,
  articleFetchStatus: "SUCCESS",
  comments: [{ hnCommentId: 1, parentHnCommentId: null, author: "reader", score: 1, bodyText: "A persisted representative comment.", position: 0 }],
  summaries: [
    { kind: "ARTICLE", payloadJson: { summary: "已保存的 Kagi 文章摘要。", tokens: 240, targetLanguage: "ZH-HANT" }, model: "kagi:agnes", promptVersion: "kagi-v1", generatedAt: new Date("2026-08-24") },
    { kind: "DISCUSSION", payloadJson: { overview: "已保存的討論摘要。", consensus: "先驗證假設。", practicalTakeaways: ["驗證假設。"], unresolvedQuestions: [] }, model: "fixture-model", promptVersion: "v1", generatedAt: new Date("2026-08-24") },
  ],
};

const digest: PublicDigest = {
  id: "e2e-digest",
  digestDate: "2026-08-24",
  sourceRssUrl: "https://example.test/rss",
  stories: [story],
};

export function createE2EFixtureQueries() {
  return {
    async latest(): Promise<PublicDigest> { return digest; },
    async byDate(digestDate: string): Promise<PublicDigest | null> { return digestDate === digest.digestDate ? digest : null; },
    async story(storyId: string): Promise<PublicStory | null> { return storyId === story.id ? story : null; },
  };
}
