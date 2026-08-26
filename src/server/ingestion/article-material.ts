import { createHash } from "node:crypto";
import { fetchPublicArticle, type ArticleFetchResult, type FetchFailure } from "@/server/ingestion/article-fetcher";
import { scoreExtraction } from "@/server/ingestion/extraction-confidence";
import type { ArticleExtractor } from "@/server/ingestion/extractors/types";

export const MINIMUM_ARTICLE_CONTENT_LENGTH = 200;

/** Summaries do not improve past this much source text, and every extra character is billed. */
export const MAX_SUMMARY_INPUT_CHARS = 24_000;
const SUMMARY_INPUT_HEAD_CHARS = 20_000;
const SUMMARY_INPUT_TAIL_CHARS = 4_000;
const TRUNCATION_MARKER = "\n[...]\n";

export type ArticleFetchStatus = "SUCCESS" | "TOO_SHORT" | FetchFailure;

export type ArticleMaterial = {
  sourceUrl: string;
  articleFetchStatus: ArticleFetchStatus;
  articleContent: string | null;
  articleContentHash: string | null;
  articleSummaryInput: string | null;
  articleExtractor: ArticleExtractor | null;
  articleExtractionConfidence: number | null;
};

type Dependencies = {
  fetchArticle?: (sourceUrl: string) => Promise<ArticleFetchResult>;
};

/** Keeps the opening and the conclusion, which carry most of an article's summarizable signal. */
export function truncateSummaryInput(content: string): string {
  if (content.length <= MAX_SUMMARY_INPUT_CHARS) return content;
  return `${content.slice(0, SUMMARY_INPUT_HEAD_CHARS)}${TRUNCATION_MARKER}${content.slice(-SUMMARY_INPUT_TAIL_CHARS)}`;
}

function unavailableMaterial(sourceUrl: string, articleFetchStatus: Exclude<ArticleFetchStatus, "SUCCESS">): ArticleMaterial {
  return {
    sourceUrl,
    articleFetchStatus,
    articleContent: null,
    articleContentHash: null,
    articleSummaryInput: null,
    articleExtractor: null,
    articleExtractionConfidence: null,
  };
}

export async function resolveArticleMaterial(sourceUrl: string, title: string, dependencies: Dependencies = {}): Promise<ArticleMaterial> {
  const result = await (dependencies.fetchArticle ?? fetchPublicArticle)(sourceUrl);
  if (!result.ok) return unavailableMaterial(sourceUrl, result.status);

  const content = result.content.trim();
  if (content.length < MINIMUM_ARTICLE_CONTENT_LENGTH) return unavailableMaterial(sourceUrl, "TOO_SHORT");

  return {
    sourceUrl,
    articleFetchStatus: "SUCCESS",
    articleContent: content,
    articleContentHash: createHash("sha256").update(content).digest("hex"),
    articleSummaryInput: truncateSummaryInput(content),
    articleExtractor: result.extractor,
    articleExtractionConfidence: scoreExtraction({ text: content, html: result.html, title, extractor: result.extractor }),
  };
}
