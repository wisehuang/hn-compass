import { describe, expect, it, vi } from "vitest";
import { resolveArticleMaterial } from "@/server/ingestion/article-material";
import { fetchPublicArticle, htmlToPlainText } from "@/server/ingestion/article-fetcher";

const publicDns = async () => ["93.184.216.34"];

describe("article fetch safety", () => {
  it("rejects a private redirect before requesting it", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } }));
    expect(await fetchPublicArticle("https://example.test", { fetcher, resolve: async (host) => host === "example.test" ? ["93.184.216.34"] : ["127.0.0.1"] })).toEqual({ ok: false, status: "UNSAFE_URL" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects loopback and private sources", async () => expect(await fetchPublicArticle("http://127.0.0.1", { resolve: publicDns })).toEqual({ ok: false, status: "UNSAFE_URL" }));
  it("enforces response size and sanitizes HTML", async () => {
    expect(await fetchPublicArticle("https://example.test", { resolve: publicDns, fetcher: vi.fn().mockResolvedValue(new Response("<script>bad()</script><main>Hello <b>world</b></main>")) })).toMatchObject({ ok: true, content: "Hello world" });
    expect(await fetchPublicArticle("https://example.test", { resolve: publicDns, fetcher: vi.fn().mockResolvedValue(new Response("x", { headers: { "content-length": String(2 * 1024 * 1024 + 1) } })) })).toEqual({ ok: false, status: "TOO_LARGE" });
  });
  it("converts HTML to plain text", () => expect(htmlToPlainText("<p>A</p><style>x</style><p>B</p>")).toBe("AB"));
});

describe("article material", () => {
  it("keeps an unavailable article's source URL while withholding persistence content and summary input", async () => {
    const material = await resolveArticleMaterial("https://example.test/article", {
      fetchArticle: async () => ({ ok: false, status: "UNAVAILABLE" }),
    });

    expect(material).toEqual({
      sourceUrl: "https://example.test/article",
      articleFetchStatus: "UNAVAILABLE",
      articleContent: null,
      articleContentHash: null,
      articleSummaryInput: null,
    });
  });

  it.each(["UNSAFE_URL", "TOO_LARGE", "TIMEOUT"] as const)("maps %s to an explicit unavailable state", async (status) => {
    const material = await resolveArticleMaterial("https://example.test/article", {
      fetchArticle: async () => ({ ok: false, status }),
    });

    expect(material).toMatchObject({
      sourceUrl: "https://example.test/article",
      articleFetchStatus: status,
      articleContent: null,
      articleSummaryInput: null,
    });
  });

  it("marks short successful fetches unavailable and never exposes them to article generation", async () => {
    const material = await resolveArticleMaterial("https://example.test/article", {
      fetchArticle: async () => ({ ok: true, url: "https://example.test/article", content: "Too short for a grounded article summary." }),
    });

    expect(material).toMatchObject({
      sourceUrl: "https://example.test/article",
      articleFetchStatus: "TOO_SHORT",
      articleContent: null,
      articleContentHash: null,
      articleSummaryInput: null,
    });
  });

  it("provides sanitized material only when it is long enough for a grounded summary", async () => {
    const content = "A".repeat(200);
    const material = await resolveArticleMaterial("https://example.test/article", {
      fetchArticle: async () => ({ ok: true, url: "https://example.test/article", content }),
    });

    expect(material).toMatchObject({
      sourceUrl: "https://example.test/article",
      articleFetchStatus: "SUCCESS",
      articleContent: content,
      articleSummaryInput: content,
      articleContentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });
});
