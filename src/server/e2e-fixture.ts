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
  comments: [{ hnCommentId: 1, parentHnCommentId: null, author: "reader", score: 1, bodyText: "A persisted representative comment.", position: 0, insiderSignal: "SELF_IDENTIFIED_AUTHOR" }],
  summaries: [
    { kind: "ARTICLE", payloadJson: { summary: "已保存的 Kagi 文章摘要。", tokens: 240, targetLanguage: "ZH-HANT" }, model: "kagi:agnes", promptVersion: "kagi-v1", generatedAt: new Date("2026-08-24") },
    { kind: "DISCUSSION", payloadJson: { overview: "已保存的討論摘要。", consensus: "先驗證假設。", practicalTakeaways: ["驗證假設。"], unresolvedQuestions: [] }, model: "fixture-model", promptVersion: "v1", generatedAt: new Date("2026-08-24") },
  ],
};

/** Carries the viewpoint arrays and an insider signal; the story above deliberately stays on the legacy payload shape. */
const evidencedStory: PublicStory = {
  id: "e2e-evidenced-story",
  rank: 2,
  title: "Seeded evidenced story",
  articleUrl: "https://example.test/evidenced",
  sourceDomain: "example.test",
  hnDiscussionUrl: "https://news.ycombinator.com/item?id=54321",
  hnItemId: 54321,
  articleFetchStatus: "SUCCESS",
  comments: [
    { hnCommentId: 21, parentHnCommentId: null, author: "pg", score: null, bodyText: "Submitter answering questions in the thread.", position: 0, insiderSignal: "SUBMITTER" },
    { hnCommentId: 22, parentHnCommentId: null, author: "ada", score: null, bodyText: "Cost grows faster than the post suggests.", position: 1, insiderSignal: null },
  ],
  summaries: [
    { kind: "ARTICLE", payloadJson: { summary: "已保存的文章摘要。", tokens: 180, targetLanguage: "ZH-HANT" }, model: "kagi:agnes", promptVersion: "kagi-v1", generatedAt: new Date("2026-08-24") },
    { kind: "DISCUSSION", payloadJson: { overview: "討論分成兩派。", consensus: null, supportingViewpoints: [{ claim: "小規模導入確實有效。", commentIds: [21] }], dissentingViewpoints: [{ claim: "規模一大成本就失控。", commentIds: [22] }], practicalTakeaways: ["先小規模試行。"], unresolvedQuestions: ["長期成本如何變化？"] }, model: "fixture-model", promptVersion: "v2", generatedAt: new Date("2026-08-24") },
  ],
};

const stories = [story, evidencedStory];

const digest: PublicDigest = {
  id: "e2e-digest",
  digestDate: "2026-08-24",
  sourceRssUrl: "https://example.test/rss",
  stories,
};

export function createE2EFixtureQueries() {
  return {
    async latest(): Promise<PublicDigest> { return digest; },
    async byDate(digestDate: string): Promise<PublicDigest | null> { return digestDate === digest.digestDate ? digest : null; },
    async story(storyId: string): Promise<PublicStory | null> { return stories.find((candidate) => candidate.id === storyId) ?? null; },
  };
}
