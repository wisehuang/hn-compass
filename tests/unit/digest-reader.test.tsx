import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DigestReader, StoryReader } from "@/components/digest-reader";
import type { PublicDigest, PublicStory } from "@/server/queries/public-digest";

const story: PublicStory = { id: "story-1", rank: 1, title: "Persisted story", articleUrl: "https://example.test/article", sourceDomain: "example.test", hnDiscussionUrl: "https://news.ycombinator.com/item?id=1", hnItemId: 1, articleFetchStatus: "UNAVAILABLE", comments: [{ hnCommentId: 9, parentHnCommentId: null, author: "ada", score: 1, bodyText: "Sanitized representative comment.", position: 0 }], summaries: [{ kind: "DISCUSSION", payloadJson: { overview: "有價值的討論。", consensus: null, practicalTakeaways: ["先驗證。"], unresolvedQuestions: [] }, model: "test", promptVersion: "v1", generatedAt: new Date("2026-08-24") }] };

describe("persisted digest readers", () => {
  it("renders digest links, previews, and a keyboard-focusable detail path", () => {
    const html = renderToStaticMarkup(<DigestReader digest={{ id: "digest-1", digestDate: "2026-08-24", sourceRssUrl: "https://example.test/rss", stories: [story] } satisfies PublicDigest} />);
    expect(html).toContain('href="/stories/story-1"');
    expect(html).toContain("閱讀原文（在新分頁開啟）");
    expect(html).toContain("focus-ring");
    expect(html).toContain("jelly-card");
    expect(html).toContain("jelly-badge");
    expect(html).toContain("jelly-breadcrumbs");
  });

  it("renders unavailable material, provenance, comments, and safe external links", () => {
    const html = renderToStaticMarkup(<StoryReader story={story} />);
    expect(html).toContain("原文內容目前無法安全取得");
    expect(html).toContain("Sanitized representative comment.");
    expect(html).toContain("test · v1");
    expect(html).toContain('rel="noreferrer"');
    expect(html).toContain("jelly-card");
    expect(html).toContain("jelly-breadcrumbs");
  });

  it("renders the faithful Kagi article summary without retired synthetic sections", () => {
    const kagiStory: PublicStory = { ...story, articleFetchStatus: "SUCCESS", summaries: [{ kind: "ARTICLE", payloadJson: { summary: "Kagi 文章摘要。", tokens: 240, targetLanguage: "ZH-HANT" }, model: "kagi:agnes", promptVersion: "kagi-v1", generatedAt: new Date("2026-08-24") }] };
    const html = renderToStaticMarkup(<StoryReader story={kagiStory} />);

    expect(html).toContain("Kagi 文章摘要。");
    expect(html).toContain("kagi:agnes · kagi-v1");
    expect(html).not.toContain("讀者價值");
  });
});
