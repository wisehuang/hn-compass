import { describe, expect, it } from "vitest";
import { collectHnComments } from "@/server/ingestion/hn-comments";
import { extractCanonicalHnItemId, parseDailyRss } from "@/server/ingestion/rss";

describe("canonical HN item IDs", () => {
  it.each([["https://news.ycombinator.com/item?id=12345", 12345], ["https://news.ycombinator.com/item?id=0", undefined], ["http://news.ycombinator.com/item?id=12345", undefined], ["https://example.com/item?id=12345", undefined]])("parses %s", (url, result) => expect(extractCanonicalHnItemId(url)).toBe(result));
});

describe("daily RSS", () => {
  it("pairs story and canonical HN discussion links by source order", () => {
    const stories = parseDailyRss("<rss><channel><item><description><![CDATA[<span class='storylink'><a href='https://example.test/a'>Article A</a></span><span class='postlink'><a href='https://news.ycombinator.com/item?id=42'>comments</a></span>]]></description></item></channel></rss>");
    expect(stories).toEqual([{ rank: 1, title: "Article A", articleUrl: "https://example.test/a", hnDiscussionUrl: "https://news.ycombinator.com/item?id=42", hnItemId: 42 }]);
  });

  it("drops stories whose link is not an HTTP URL, since the link is rendered and opened directly", () => {
    const description = "<span class='storylink'><a href='javascript:alert(1)'>Hostile</a></span><span class='postlink'><a href='https://news.ycombinator.com/item?id=42'>comments</a></span><span class='storylink'><a href='https://example.test/a'>Article A</a></span><span class='postlink'><a href='https://news.ycombinator.com/item?id=43'>comments</a></span>";
    const stories = parseDailyRss(`<rss><channel><item><description><![CDATA[${description}]]></description></item></channel></rss>`);

    expect(stories.map((story) => story.articleUrl)).toEqual(["https://example.test/a"]);
  });
});

describe("Hacker News comment collection", () => {
  it("keeps valid comments in source order with bounded direct replies and sanitized text", async () => {
    const items: Record<number, unknown> = {
      1: { id: 1, type: "story", kids: [10, 11, 12, 13, 14] },
      10: { id: 10, type: "comment", by: "alice", score: 12, text: "<p>A useful top-level comment.</p>", kids: [20, 21, 22] },
      11: { id: 11, type: "comment", deleted: true, text: "This must not be included." },
      12: { id: 12, type: "comment", text: "too short" },
      13: { id: 13, type: "comment", by: "bob", text: "<p>Another valuable top-level comment.</p>" },
      14: { id: 14, type: "comment", by: "eve", text: "<p>   </p>" },
      20: { id: 20, type: "comment", parent: 10, by: "carol", text: "<em>First direct reply with useful detail.</em>" },
      21: { id: 21, type: "comment", parent: 10, dead: true, text: "This must not be included either." },
      22: { id: 22, type: "comment", parent: 10, by: "dave", text: "Second direct reply with useful detail." },
    };

    const result = await collectHnComments(1, { fetchItem: async (id) => items[id] });

    expect(result.comments.map(({ hnCommentId, parentHnCommentId, position, bodyText }) => ({ hnCommentId, parentHnCommentId, position, bodyText }))).toEqual([
      { hnCommentId: 10, parentHnCommentId: null, position: 0, bodyText: "A useful top-level comment." },
      { hnCommentId: 20, parentHnCommentId: 10, position: 0, bodyText: "First direct reply with useful detail." },
      { hnCommentId: 22, parentHnCommentId: 10, position: 2, bodyText: "Second direct reply with useful detail." },
      { hnCommentId: 13, parentHnCommentId: null, position: 3, bodyText: "Another valuable top-level comment." },
    ]);
    expect(result.comments[0]).toMatchObject({ author: "alice", score: 12, fetchedAt: expect.any(Date) });
  });

  it("caps valid top-level comments and never exceeds five Firebase requests in flight", async () => {
    const topLevelIds = Array.from({ length: 45 }, (_, index) => index + 10);
    let inFlight = 0;
    let peakInFlight = 0;
    const result = await collectHnComments(1, {
      fetchItem: async (id) => {
        inFlight += 1;
        peakInFlight = Math.max(peakInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight -= 1;
        return id === 1
          ? { id, type: "story", kids: topLevelIds }
          : { id, type: "comment", parent: 1, text: `A valid comment body number ${id}.` };
      },
    });

    expect(result.comments).toHaveLength(40);
    expect(result.comments.at(-1)?.hnCommentId).toBe(49);
    expect(peakInFlight).toBeLessThanOrEqual(5);
  });
});
