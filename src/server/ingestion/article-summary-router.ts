import { createHash } from "node:crypto";
import type { ArticleMaterial } from "@/server/ingestion/article-material";
import { createArticleSummaryGenerator, createOpenAiArticleSummarizer, type ArticleSummary, type GeneratedSummary, type ParsedResponsesClient } from "@/server/ingestion/summaries";

export const DEFAULT_MINIMUM_CONFIDENCE = 0.6;

export type ArticleSummaryProvider = "openai" | "kagi" | "cache";
export type RoutedArticleSummary = GeneratedSummary<ArticleSummary> & { provider: ArticleSummaryProvider };

export type ArticleSummaryRouterOptions = {
  openAi?: { client: ParsedResponsesClient; model: string };
  kagi?: { apiKey: string; engine: string; fetchFn?: typeof fetch };
  minimumConfidence?: number;
  kagiFallbackEnabled?: boolean;
  findCachedSummary?: (inputHash: string) => Promise<GeneratedSummary<ArticleSummary> | null>;
};

function hashOf(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Chooses between the cheap OpenAI path and the Kagi fallback per story.
 *
 * OpenAI summarizes text this pipeline already extracted, so it is only trusted when the
 * extraction scored well. Kagi re-fetches the URL with its own extraction, which is what makes
 * it worth its price for pages we could not read: bot challenges, paywalls, JS-only rendering.
 */
export function createArticleSummaryRouter(options: ArticleSummaryRouterOptions) {
  const { minimumConfidence = DEFAULT_MINIMUM_CONFIDENCE, kagiFallbackEnabled = true, findCachedSummary } = options;
  const openAi = options.openAi ? createOpenAiArticleSummarizer(options.openAi) : undefined;
  const kagi = options.kagi && kagiFallbackEnabled ? createArticleSummaryGenerator(options.kagi) : undefined;

  async function cached(inputHash: string): Promise<RoutedArticleSummary | null> {
    if (!findCachedSummary) return null;
    const hit = await findCachedSummary(inputHash).catch(() => null);
    return hit ? { ...hit, provider: "cache" } : null;
  }

  return {
    async generateArticle(material: ArticleMaterial): Promise<RoutedArticleSummary> {
      const summaryInput = material.articleFetchStatus === "SUCCESS" ? material.articleSummaryInput : null;
      const confidence = material.articleExtractionConfidence ?? 0;

      if (openAi && summaryInput && confidence >= minimumConfidence) {
        const hit = await cached(hashOf(summaryInput));
        if (hit) return hit;
        try {
          return { ...(await openAi.generateArticle(summaryInput)), provider: "openai" };
        } catch (error) {
          if (!kagi) throw error;
        }
      }

      if (!kagi) {
        throw new Error(openAi ? "Article summarization failed and no Kagi fallback is configured." : "No article summarizer is configured.");
      }

      const hit = await cached(hashOf(material.sourceUrl));
      if (hit) return hit;
      return { ...(await kagi.generateArticleFromUrl(material.sourceUrl)), provider: "kagi" };
    },
  };
}
