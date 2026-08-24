import { createHash } from "node:crypto";
import { fetchPublicArticle, type ArticleFetchResult, type FetchFailure } from "@/server/ingestion/article-fetcher";

export const MINIMUM_ARTICLE_CONTENT_LENGTH = 200;

export type ArticleFetchStatus = "SUCCESS" | "TOO_SHORT" | FetchFailure;

export type ArticleMaterial = {
  sourceUrl: string;
  articleFetchStatus: ArticleFetchStatus;
  articleContent: string | null;
  articleContentHash: string | null;
  articleSummaryInput: string | null;
};

type Dependencies = {
  fetchArticle?: (sourceUrl: string) => Promise<ArticleFetchResult>;
};

function unavailableMaterial(sourceUrl: string, articleFetchStatus: Exclude<ArticleFetchStatus, "SUCCESS">): ArticleMaterial {
  return {
    sourceUrl,
    articleFetchStatus,
    articleContent: null,
    articleContentHash: null,
    articleSummaryInput: null,
  };
}

export async function resolveArticleMaterial(sourceUrl: string, dependencies: Dependencies = {}): Promise<ArticleMaterial> {
  const result = await (dependencies.fetchArticle ?? fetchPublicArticle)(sourceUrl);
  if (!result.ok) return unavailableMaterial(sourceUrl, result.status);

  const content = result.content.trim();
  if (content.length < MINIMUM_ARTICLE_CONTENT_LENGTH) return unavailableMaterial(sourceUrl, "TOO_SHORT");

  return {
    sourceUrl,
    articleFetchStatus: "SUCCESS",
    articleContent: content,
    articleContentHash: createHash("sha256").update(content).digest("hex"),
    articleSummaryInput: content,
  };
}
