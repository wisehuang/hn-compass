export type ArticleExtractor = "readability" | "plaintext" | "github-readme" | "arxiv-abstract" | "pdf";

/** Extractors sourcing already-structured content bypass heuristic confidence scoring. */
export const STRUCTURED_EXTRACTORS: ReadonlySet<ArticleExtractor> = new Set<ArticleExtractor>(["github-readme", "arxiv-abstract", "pdf"]);

export type ExtractorFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type StructuredExtraction = { text: string; title: string | null; extractor: ArticleExtractor };

/** Resolves a source URL against a dedicated API. Returns null when the URL does not apply or the upstream fails. */
export type StructuredExtractorHandler = (url: URL, fetchFn: ExtractorFetch) => Promise<StructuredExtraction | null>;
