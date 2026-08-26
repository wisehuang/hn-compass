import { describe, expect, it, vi } from "vitest";
import { MAX_SUMMARY_INPUT_CHARS, resolveArticleMaterial } from "@/server/ingestion/article-material";
import { fetchPublicArticle, htmlToPlainText } from "@/server/ingestion/article-fetcher";
import { extractWithReadability } from "@/server/ingestion/extractors/readability";

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
    const material = await resolveArticleMaterial("https://example.test/article", "Article title", {
      fetchArticle: async () => ({ ok: false, status: "UNAVAILABLE" }),
    });

    expect(material).toEqual({
      sourceUrl: "https://example.test/article",
      articleFetchStatus: "UNAVAILABLE",
      articleContent: null,
      articleContentHash: null,
      articleSummaryInput: null,
      articleExtractor: null,
      articleExtractionConfidence: null,
    });
  });

  it.each(["UNSAFE_URL", "TOO_LARGE", "TIMEOUT"] as const)("maps %s to an explicit unavailable state", async (status) => {
    const material = await resolveArticleMaterial("https://example.test/article", "Article title", {
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
    const material = await resolveArticleMaterial("https://example.test/article", "Article title", {
      fetchArticle: async () => ({ ok: true, url: "https://example.test/article", content: "Too short for a grounded article summary.", extractor: "readability", html: null, title: null }),
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
    const material = await resolveArticleMaterial("https://example.test/article", "Article title", {
      fetchArticle: async () => ({ ok: true, url: "https://example.test/article", content, extractor: "readability", html: null, title: null }),
    });

    expect(material).toMatchObject({
      sourceUrl: "https://example.test/article",
      articleFetchStatus: "SUCCESS",
      articleContent: content,
      articleSummaryInput: content,
      articleContentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      articleExtractor: "readability",
      articleExtractionConfidence: expect.any(Number),
    });
  });

  it("truncates oversized content for the summary input while persisting the full article", async () => {
    const content = "A".repeat(30_000);
    const material = await resolveArticleMaterial("https://example.test/article", "Article title", {
      fetchArticle: async () => ({ ok: true, url: "https://example.test/article", content, extractor: "readability", html: null, title: null }),
    });

    expect(material.articleContent).toHaveLength(30_000);
    expect(material.articleSummaryInput).toHaveLength(MAX_SUMMARY_INPUT_CHARS + "\n[...]\n".length);
    expect(material.articleSummaryInput).toContain("[...]");
  });
});

describe("Readability extraction", () => {
  const noisy = `<html><head><title>Doc</title></head><body>
    <nav><a href="/home">Home</a><a href="/about">About</a><a href="/jobs">Jobs</a></nav>
    <aside><a href="/related-one">Related one</a><a href="/related-two">Related two</a></aside>
    <article><h1>Structured logging in practice</h1>${"<p>Structured logging turns each log line into a queryable record instead of a sentence, which is what makes incident search tractable. </p>".repeat(8)}</article>
    <footer>Copyright 2026 Example Incorporated. All rights reserved.</footer>
  </body></html>`;

  it("keeps the article body and drops navigation, sidebar, and footer boilerplate", () => {
    const extracted = extractWithReadability(noisy);

    expect(extracted?.text).toContain("Structured logging turns each log line");
    expect(extracted?.text).not.toContain("Jobs");
    expect(extracted?.text).not.toContain("Related one");
    expect(extracted?.text).not.toContain("All rights reserved");
  });

  it("separates blocks with newlines instead of concatenating them", () => {
    const extracted = extractWithReadability(noisy);

    expect(extracted?.text).toContain("\n");
  });

  it("returns null when there is no article body worth summarizing", () => {
    expect(extractWithReadability("<html><body><nav><a href='/a'>A</a></nav></body></html>")).toBeNull();
  });

  it("falls back to whole-body plain text when Readability finds nothing", async () => {
    const html = "<html><body><div>Short body</div></body></html>";
    const result = await fetchPublicArticle("https://example.test", { resolve: publicDns, fetcher: vi.fn().mockResolvedValue(new Response(html)) });

    expect(result).toMatchObject({ ok: true, extractor: "plaintext", content: "Short body" });
  });

  it("marks a Readability-extracted page with the readability extractor", async () => {
    const result = await fetchPublicArticle("https://example.test", { resolve: publicDns, fetcher: vi.fn().mockResolvedValue(new Response(noisy)) });

    expect(result).toMatchObject({ ok: true, extractor: "readability" });
  });
});
