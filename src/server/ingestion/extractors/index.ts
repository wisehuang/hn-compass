import { extractArxivAbstract } from "@/server/ingestion/extractors/arxiv";
import { extractGithubReadme } from "@/server/ingestion/extractors/github";
import type { ExtractorFetch, StructuredExtraction, StructuredExtractorHandler } from "@/server/ingestion/extractors/types";

/** Ordered: the first handler that recognizes the URL and succeeds wins. */
const HANDLERS: readonly StructuredExtractorHandler[] = [extractGithubReadme, extractArxivAbstract];

/** Resolves URLs that have a dedicated API worth using instead of scraping the rendered page. */
export async function extractStructuredSource(url: URL, fetchFn: ExtractorFetch): Promise<StructuredExtraction | null> {
  for (const handler of HANDLERS) {
    const extraction = await handler(url, fetchFn);
    if (extraction) return extraction;
  }
  return null;
}

export { extractArxivAbstract, parseArxivId } from "@/server/ingestion/extractors/arxiv";
export { extractGithubReadme, parseGithubRepo } from "@/server/ingestion/extractors/github";
export { extractPdfText, isPdfSource } from "@/server/ingestion/extractors/pdf";
export { extractWithReadability, htmlToBlockText, normalizeExtractedText } from "@/server/ingestion/extractors/readability";
export { STRUCTURED_EXTRACTORS, type ArticleExtractor } from "@/server/ingestion/extractors/types";
