import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { normalizeExtractedText } from "@/server/ingestion/extractors/readability";
import type { StructuredExtractorHandler } from "@/server/ingestion/extractors/types";

const ARXIV_HOSTS = new Set(["arxiv.org", "www.arxiv.org", "export.arxiv.org"]);
const ARXIV_TIMEOUT_MS = 10_000;

const entry = z.object({ title: z.string(), summary: z.string() });
const ArxivFeedSchema = z.object({ feed: z.object({ entry: z.union([z.array(entry), entry]).optional() }) });

/** Accepts both the modern 2501.01234 form and the legacy math/0309136 form. */
export function parseArxivId(url: URL): string | null {
  if (!ARXIV_HOSTS.has(url.hostname.toLowerCase())) return null;
  const match = /^\/(?:abs|pdf)\/(.+?)(?:\.pdf)?$/.exec(url.pathname);
  const id = match?.[1];
  if (!id || !/^[A-Za-z0-9.\-/]+$/.test(id)) return null;
  return id;
}

export const extractArxivAbstract: StructuredExtractorHandler = async (url, fetchFn) => {
  const id = parseArxivId(url);
  if (!id) return null;

  try {
    const response = await fetchFn(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`, {
      headers: { accept: "application/atom+xml" },
      signal: AbortSignal.timeout(ARXIV_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const parsed = ArxivFeedSchema.safeParse(new XMLParser({ ignoreAttributes: false, trimValues: true }).parse(await response.text()));
    if (!parsed.success) return null;
    const feedEntry = Array.isArray(parsed.data.feed.entry) ? parsed.data.feed.entry[0] : parsed.data.feed.entry;
    if (!feedEntry) return null;

    const title = normalizeExtractedText(feedEntry.title);
    const summary = normalizeExtractedText(feedEntry.summary);
    if (!summary) return null;
    return { text: title ? `${title}\n\n${summary}` : summary, title: title || null, extractor: "arxiv-abstract" };
  } catch {
    return null;
  }
};
