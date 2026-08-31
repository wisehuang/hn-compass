import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DigestReader, StoryReader } from "@/components/digest-reader";
import type { PublicDigest, PublicStory } from "@/server/queries/public-digest";

const story: PublicStory = { id: "story-1", rank: 1, title: "Persisted story", articleUrl: "https://example.test/article", sourceDomain: "example.test", hnDiscussionUrl: "https://news.ycombinator.com/item?id=1", hnItemId: 1, articleFetchStatus: "UNAVAILABLE", comments: [{ hnCommentId: 9, parentHnCommentId: null, author: "ada", score: 1, bodyText: "Sanitized representative comment.", position: 0 }], summaries: [{ kind: "DISCUSSION", payloadJson: { overview: "有價值的討論。", consensus: null, practicalTakeaways: ["先驗證。"], unresolvedQuestions: [] }, model: "test", promptVersion: "v1", generatedAt: new Date("2026-08-24") }] };

function withDiscussion(payload: Record<string, unknown>, overrides: Partial<PublicStory> = {}): PublicStory {
  return { ...story, ...overrides, summaries: [{ kind: "DISCUSSION", payloadJson: payload, model: "test", promptVersion: "v1", generatedAt: new Date("2026-08-24") }] };
}

function viewpoints(count: number) {
  return Array.from({ length: count }, (_unused, index) => ({ claim: `觀點 ${index}`, commentIds: [9] }));
}

const digestOf = (subject: PublicStory): PublicDigest => ({ id: "digest-1", digestDate: "2026-08-24", sourceRssUrl: "https://example.test/rss", stories: [subject] });

describe("persisted digest readers", () => {
  it("renders digest links, previews, and a keyboard-focusable detail path", () => {
    const html = renderToStaticMarkup(<DigestReader digest={{ id: "digest-1", digestDate: "2026-08-24", sourceRssUrl: "https://example.test/rss", stories: [story] } satisfies PublicDigest} />);
    expect(html).toContain('href="/stories/story-1"');
    expect(html).toContain("閱讀原文");
    expect(html).toContain("查看 HN 討論");
    expect(html).toContain("閱讀完整解析");
    expect(html).toContain("jelly-button");
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

  it("renders the consensus indicator on a digest card when the stored payload yields a tone", () => {
    const agreed = withDiscussion({ overview: "討論摘要。", consensus: "先驗證假設。", supportingViewpoints: viewpoints(3), dissentingViewpoints: [] });

    expect(renderToStaticMarkup(<DigestReader digest={digestOf(agreed)} />)).toContain("共識明確");
  });

  it("renders the contested indicator on both the digest card and the story header", () => {
    const contested = withDiscussion({ overview: "討論摘要。", consensus: null, supportingViewpoints: viewpoints(2), dissentingViewpoints: viewpoints(3) });

    expect(renderToStaticMarkup(<DigestReader digest={digestOf(contested)} />)).toContain("爭論激烈");
    expect(renderToStaticMarkup(<StoryReader story={contested} />)).toContain("爭論激烈");
  });

  it("renders no consensus indicator for a story without a discussion summary", () => {
    const withoutDiscussion: PublicStory = { ...story, summaries: [] };
    const html = renderToStaticMarkup(<DigestReader digest={digestOf(withoutDiscussion)} />);

    expect(html).not.toContain("共識明確");
    expect(html).not.toContain("爭論激烈");
    expect(html).not.toContain("各有主張");
    expect(html).toContain("example.test");
    expect(html).toContain("href=\"/stories/story-1\"");
  });

  it("renders each viewpoint claim next to the persisted comment it cites", () => {
    const evidenced = withDiscussion({
      overview: "討論摘要。",
      consensus: null,
      supportingViewpoints: [{ claim: "這個作法在小規模有效。", commentIds: [9] }],
      dissentingViewpoints: [{ claim: "大規模下成本會爆炸。", commentIds: [9] }],
      practicalTakeaways: [],
      unresolvedQuestions: [],
    });
    const html = renderToStaticMarkup(<StoryReader story={evidenced} />);

    expect(html).toContain("討論證據");
    expect(html).toContain("支持觀點");
    expect(html).toContain("反對觀點");
    expect(html).toContain("這個作法在小規模有效。");
    expect(html).toContain("大規模下成本會爆炸。");
    expect(html).toContain("Sanitized representative comment.");
    expect(html).toContain('href="https://news.ycombinator.com/item?id=9"');
  });

  it("omits a cited comment that does not resolve against the persisted comments", () => {
    const dangling = withDiscussion({
      overview: "討論摘要。",
      consensus: null,
      supportingViewpoints: [{ claim: "有解析的主張。", commentIds: [9, 404] }],
      dissentingViewpoints: [],
      practicalTakeaways: [],
      unresolvedQuestions: [],
    });
    const html = renderToStaticMarkup(<StoryReader story={dangling} />);

    expect(html).toContain("有解析的主張。");
    expect(html).toContain('href="https://news.ycombinator.com/item?id=9"');
    expect(html).not.toContain("item?id=404");
    expect(html).not.toContain("HN #404");
  });

  it("renders a payload persisted before viewpoints existed without the evidence section", () => {
    const legacy = withDiscussion({ overview: "已保存的討論摘要。", consensus: "先驗證假設。", practicalTakeaways: ["驗證假設。"], unresolvedQuestions: ["長期成本如何變化？"] });
    const html = renderToStaticMarkup(<StoryReader story={legacy} />);

    expect(html).not.toContain("討論證據");
    expect(html).not.toContain("支持觀點");
    expect(html).not.toContain("共識明確");
    expect(html).not.toContain("爭論激烈");
    expect(html).not.toContain("各有主張");

    expect(html).toContain("文章洞見");
    expect(html).toContain("討論洞見");
    expect(html).toContain("已保存的討論摘要。");
    expect(html).toContain("先驗證假設。");
    expect(html).toContain("實務建議");
    expect(html).toContain("待釐清問題");
    expect(html).toContain("代表性留言");
    expect(html).toContain("Sanitized representative comment.");
    expect(html).toContain("test · v1");
    expect(html).toContain("本頁摘要由 AI 生成");
  });

  it("states submitter identity as fact and self-identified identity as the commenter's claim", () => {
    const signalled: PublicStory = { ...story, comments: [
      { hnCommentId: 9, parentHnCommentId: null, author: "pg", score: null, bodyText: "Submitter comment.", position: 0, insiderSignal: "SUBMITTER" },
      { hnCommentId: 10, parentHnCommentId: null, author: "ada", score: null, bodyText: "Authorship claim comment.", position: 1, insiderSignal: "SELF_IDENTIFIED_AUTHOR" },
      { hnCommentId: 11, parentHnCommentId: null, author: "bob", score: null, bodyText: "Affiliation claim comment.", position: 2, insiderSignal: "SELF_IDENTIFIED_INSIDER" },
      { hnCommentId: 12, parentHnCommentId: null, author: "eve", score: null, bodyText: "Unsignalled comment.", position: 3, insiderSignal: null },
    ] };
    const html = renderToStaticMarkup(<StoryReader story={signalled} />);

    expect(html).toContain("投稿者");
    expect(html).toContain("自稱作者");
    expect(html).toContain("自稱內部人士");
    expect(html).toContain('href="https://news.ycombinator.com/item?id=12"');
  });

  it("renders no badge for a comment carrying no signal", () => {
    const unsignalled: PublicStory = { ...story, comments: [{ hnCommentId: 9, parentHnCommentId: null, author: "eve", score: null, bodyText: "Unsignalled comment.", position: 0, insiderSignal: null }] };
    const html = renderToStaticMarkup(<StoryReader story={unsignalled} />);

    expect(html).toContain("Unsignalled comment.");
    expect(html).not.toContain("投稿者");
    expect(html).not.toContain("自稱");
  });

  it("renders the faithful Kagi article summary without retired synthetic sections", () => {
    const kagiStory: PublicStory = { ...story, articleFetchStatus: "SUCCESS", summaries: [{ kind: "ARTICLE", payloadJson: { summary: "Kagi 文章摘要。", tokens: 240, targetLanguage: "ZH-HANT" }, model: "kagi:agnes", promptVersion: "kagi-v1", generatedAt: new Date("2026-08-24") }] };
    const html = renderToStaticMarkup(<StoryReader story={kagiStory} />);

    expect(html).toContain("Kagi 文章摘要。");
    expect(html).toContain("kagi:agnes · kagi-v1");
    expect(html).not.toContain("讀者價值");
  });
});
