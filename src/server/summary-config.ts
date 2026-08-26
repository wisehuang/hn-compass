/** Shared parsing for the summarization environment used by the CLI and the internal routes. */
export type SummaryEnvConfig = {
  openAiApiKey?: string;
  openAiModel?: string;
  openAiArticleModel?: string;
  kagiApiKey?: string;
  kagiSummarizerEngine?: string;
  minimumConfidence?: number;
  kagiFallbackEnabled?: boolean;
};

const DISABLED_VALUES = new Set(["false", "0", "no", "off"]);

function parseConfidence(value: string | undefined) {
  // Number("") is 0, which would silently route every story to OpenAI.
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : undefined;
}

export function readSummaryEnv(env: Record<string, string | undefined> = process.env): SummaryEnvConfig {
  return {
    openAiApiKey: env.OPENAI_API_KEY,
    openAiModel: env.OPENAI_MODEL,
    openAiArticleModel: env.OPENAI_ARTICLE_MODEL,
    kagiApiKey: env.KAGI_API_KEY,
    kagiSummarizerEngine: env.KAGI_SUMMARIZER_ENGINE,
    minimumConfidence: parseConfidence(env.ARTICLE_EXTRACTION_MIN_CONFIDENCE),
    kagiFallbackEnabled: DISABLED_VALUES.has(env.KAGI_FALLBACK_ENABLED?.trim().toLowerCase() ?? "") ? false : undefined,
  };
}
