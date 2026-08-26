import { describe, expect, it, vi } from "vitest";
import { extractArxivAbstract, extractGithubReadme, extractStructuredSource, parseArxivId, parseGithubRepo } from "@/server/ingestion/extractors";
import { extractPdfText, isPdfSource } from "@/server/ingestion/extractors/pdf";

const arxivFeed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Attention Is Not All You Need</title>
    <summary>We revisit the assumption that attention alone explains transformer performance.</summary>
  </entry>
</feed>`;

describe("GitHub README extractor", () => {
  it("recognizes a repository root and rejects deeper product paths", () => {
    expect(parseGithubRepo(new URL("https://github.com/openai/openai-node"))).toEqual({ owner: "openai", repo: "openai-node" });
    expect(parseGithubRepo(new URL("https://github.com/openai/openai-node.git"))).toEqual({ owner: "openai", repo: "openai-node" });
    expect(parseGithubRepo(new URL("https://github.com/openai/openai-node/blob/main/README.md"))).toBeNull();
    expect(parseGithubRepo(new URL("https://github.com/trending/typescript"))).toBeNull();
    expect(parseGithubRepo(new URL("https://gitlab.com/openai/openai-node"))).toBeNull();
  });

  it("returns the raw README for a repository root", async () => {
    const fetchFn = vi.fn(async () => new Response("# openai-node\n\nThe official TypeScript library."));
    const extraction = await extractGithubReadme(new URL("https://github.com/openai/openai-node"), fetchFn);

    expect(extraction).toMatchObject({ extractor: "github-readme", title: "openai/openai-node" });
    expect(extraction?.text).toContain("The official TypeScript library.");
    expect(fetchFn).toHaveBeenCalledWith("https://api.github.com/repos/openai/openai-node/readme", expect.objectContaining({ headers: expect.objectContaining({ accept: "application/vnd.github.raw" }) }));
  });

  it("returns null instead of throwing when GitHub rejects the request", async () => {
    await expect(extractGithubReadme(new URL("https://github.com/openai/openai-node"), async () => new Response("rate limited", { status: 403 }))).resolves.toBeNull();
    await expect(extractGithubReadme(new URL("https://github.com/openai/openai-node"), async () => { throw new Error("network down"); })).resolves.toBeNull();
  });
});

describe("arXiv abstract extractor", () => {
  it("recognizes both modern and legacy identifier forms", () => {
    expect(parseArxivId(new URL("https://arxiv.org/abs/2501.01234"))).toBe("2501.01234");
    expect(parseArxivId(new URL("https://arxiv.org/pdf/2501.01234.pdf"))).toBe("2501.01234");
    expect(parseArxivId(new URL("https://arxiv.org/abs/math/0309136"))).toBe("math/0309136");
    expect(parseArxivId(new URL("https://arxiv.org/list/cs.LG/recent"))).toBeNull();
    expect(parseArxivId(new URL("https://example.test/abs/2501.01234"))).toBeNull();
  });

  it("combines the title and abstract from the arXiv API", async () => {
    const fetchFn = vi.fn(async () => new Response(arxivFeed));
    const extraction = await extractArxivAbstract(new URL("https://arxiv.org/abs/2501.01234"), fetchFn);

    expect(extraction).toMatchObject({ extractor: "arxiv-abstract", title: "Attention Is Not All You Need" });
    expect(extraction?.text).toContain("We revisit the assumption");
    expect(fetchFn).toHaveBeenCalledWith("https://export.arxiv.org/api/query?id_list=2501.01234", expect.anything());
  });

  it("returns null instead of throwing when the arXiv API misbehaves", async () => {
    await expect(extractArxivAbstract(new URL("https://arxiv.org/abs/2501.01234"), async () => new Response("", { status: 503 }))).resolves.toBeNull();
    await expect(extractArxivAbstract(new URL("https://arxiv.org/abs/2501.01234"), async () => new Response("<feed></feed>"))).resolves.toBeNull();
  });
});

describe("PDF extractor", () => {
  it("recognizes PDFs by content type and by extension", () => {
    expect(isPdfSource(new URL("https://example.test/paper"), "application/pdf")).toBe(true);
    expect(isPdfSource(new URL("https://example.test/paper.pdf"), null)).toBe(true);
    expect(isPdfSource(new URL("https://example.test/paper"), "text/html; charset=utf-8")).toBe(false);
  });

  it("returns null instead of throwing for bytes that are not a PDF", async () => {
    await expect(extractPdfText(new TextEncoder().encode("not a pdf at all"))).resolves.toBeNull();
  });
});

describe("structured source selection", () => {
  it("skips URLs that no dedicated extractor recognizes without calling out", async () => {
    const fetchFn = vi.fn();

    await expect(extractStructuredSource(new URL("https://example.test/article"), fetchFn)).resolves.toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("prefers the arXiv abstract over downloading the PDF", async () => {
    const extraction = await extractStructuredSource(new URL("https://arxiv.org/pdf/2501.01234.pdf"), async () => new Response(arxivFeed));

    expect(extraction).toMatchObject({ extractor: "arxiv-abstract" });
  });
});
