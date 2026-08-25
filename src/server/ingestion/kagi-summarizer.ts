import { z } from "zod";

export const KAGI_MAX_TEXT_BYTES = 1_000_000;
const KAGI_SUMMARIZE_URL = "https://kagi.com/api/v0/summarize";
const KAGI_TIMEOUT_MS = 10_000;

const KagiResponseSchema = z.object({
  data: z.object({
    output: z.string().trim().min(1),
    tokens: z.number().int().positive(),
  }).strict(),
}).strict();

export type KagiArticleSummary = {
  summary: string;
  tokens: number;
  targetLanguage: "ZH-HANT";
};

export type KagiSummarizerInput = string | { text: string } | { url: string };

type KagiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type KagiArticleSummarizerOptions = { apiKey: string; engine: string; fetchFn?: KagiFetch };

export function createKagiArticleSummarizer({ apiKey, engine, fetchFn = fetch }: KagiArticleSummarizerOptions) {
  if (!apiKey.trim() || !engine.trim()) throw new Error("Kagi summarizer is not configured.");

  return async function summarize(input: KagiSummarizerInput): Promise<KagiArticleSummary> {
    const request = typeof input === "string" ? { text: input } : input;
    if ("url" in request) {
      try {
        const url = new URL(request.url);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
      } catch {
        throw new Error("Kagi article URL must use HTTP or HTTPS.");
      }
    }
    if ("text" in request && Buffer.byteLength(request.text, "utf8") > KAGI_MAX_TEXT_BYTES) {
      throw new Error("Kagi article text exceeds the 1 MB request limit.");
    }

    let response: Response;
    try {
      response = await fetchFn(KAGI_SUMMARIZE_URL, {
        method: "POST",
        headers: { Authorization: `Bot ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...request, engine, summary_type: "summary", target_language: "ZH-HANT", cache: false }),
        signal: AbortSignal.timeout(KAGI_TIMEOUT_MS),
      });
    } catch {
      throw new Error("Kagi summarization failed.");
    }

    if (!response.ok) throw new Error("Kagi summarization failed.");
    const parsed = KagiResponseSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new Error("Kagi summarization response was invalid.");
    return { summary: parsed.data.data.output, tokens: parsed.data.data.tokens, targetLanguage: "ZH-HANT" };
  };
}
