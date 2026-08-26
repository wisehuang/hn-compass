import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { load } from "cheerio";
import { extractStructuredSource } from "@/server/ingestion/extractors";
import { extractPdfText, isPdfSource } from "@/server/ingestion/extractors/pdf";
import { extractWithReadability } from "@/server/ingestion/extractors/readability";
import type { ArticleExtractor, ExtractorFetch } from "@/server/ingestion/extractors/types";

const MAX_REDIRECTS = 3;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const ACCEPT_HEADER = "text/html,application/xhtml+xml,application/pdf";

export type FetchFailure = "UNSAFE_URL" | "TOO_LARGE" | "TIMEOUT" | "UNAVAILABLE";
export type ArticleFetchSuccess = { ok: true; url: string; content: string; extractor: ArticleExtractor; html: string | null; title: string | null };
export type ArticleFetchResult = ArticleFetchSuccess | { ok: false; status: FetchFailure };
type Resolver = (host: string) => Promise<string[]>;
type Dependencies = { fetcher?: typeof fetch; resolve?: Resolver };

function isPublicIp(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168));
  }
  const normalized = address.toLowerCase();
  return !(normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb") || normalized.startsWith("ff"));
}

async function defaultResolve(host: string) { return (await dnsLookup(host, { all: true })).map(({ address }) => address); }

async function assertSafeUrl(value: string, resolve: Resolver): Promise<URL> {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("UNSAFE_URL");
  const addresses = isIP(url.hostname) ? [url.hostname] : await resolve(url.hostname);
  if (!addresses.length || addresses.some((address) => !isPublicIp(address))) throw new Error("UNSAFE_URL");
  return url;
}

async function readLimited(response: Response): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BYTES) throw new Error("TOO_LARGE");
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(0);
  let size = 0; const chunks: Uint8Array[] = [];
  for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_BYTES) throw new Error("TOO_LARGE"); chunks.push(value); }
  const output = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output;
}

export function htmlToPlainText(html: string) {
  const $ = load(html); $("script,style,noscript,template,svg,iframe").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}

/** Readability first, falling back to whole-body text when it cannot isolate an article. */
function extractFromHtml(html: string): { content: string; extractor: ArticleExtractor; title: string | null } {
  const readable = extractWithReadability(html);
  if (readable) return { content: readable.text, extractor: "readability", title: readable.title };
  return { content: htmlToPlainText(html), extractor: "plaintext", title: null };
}

export async function fetchPublicArticle(initialUrl: string, dependencies: Dependencies = {}): Promise<ArticleFetchResult> {
  const fetcher = dependencies.fetcher ?? fetch; const resolve = dependencies.resolve ?? defaultResolve;
  let current = initialUrl;
  try {
    const structured = await extractStructuredSource(await assertSafeUrl(current, resolve), fetcher as ExtractorFetch);
    if (structured) return { ok: true, url: current, content: structured.text, extractor: structured.extractor, html: null, title: structured.title };

    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      const url = await assertSafeUrl(current, resolve);
      const response = await fetcher(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: ACCEPT_HEADER } });
      if (response.status >= 300 && response.status < 400) { const location = response.headers.get("location"); if (!location || redirects === MAX_REDIRECTS) return { ok: false, status: "UNAVAILABLE" }; current = new URL(location, url).toString(); continue; }
      if (!response.ok) return { ok: false, status: "UNAVAILABLE" };

      const contentType = response.headers.get("content-type");
      const bytes = await readLimited(response);
      if (isPdfSource(url, contentType)) {
        const text = await extractPdfText(bytes);
        if (!text) return { ok: false, status: "UNAVAILABLE" };
        return { ok: true, url: url.toString(), content: text, extractor: "pdf", html: null, title: null };
      }

      const html = new TextDecoder().decode(bytes);
      const extracted = extractFromHtml(html);
      return { ok: true, url: url.toString(), content: extracted.content, extractor: extracted.extractor, html, title: extracted.title };
    }
    return { ok: false, status: "UNAVAILABLE" };
  } catch (error) {
    if (error instanceof Error && error.message === "UNSAFE_URL") return { ok: false, status: "UNSAFE_URL" };
    if (error instanceof Error && error.message === "TOO_LARGE") return { ok: false, status: "TOO_LARGE" };
    if (error instanceof DOMException && error.name === "TimeoutError") return { ok: false, status: "TIMEOUT" };
    return { ok: false, status: "UNAVAILABLE" };
  }
}
