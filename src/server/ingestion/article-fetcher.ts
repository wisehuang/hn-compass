import { lookup as dnsLookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";
import { load } from "cheerio";
import { Agent } from "undici";
import { extractStructuredSource } from "@/server/ingestion/extractors";
import { extractPdfText, isPdfSource } from "@/server/ingestion/extractors/pdf";
import { extractWithReadability } from "@/server/ingestion/extractors/readability";
import type { ArticleExtractor, ExtractorFetch } from "@/server/ingestion/extractors/types";
import { isPublicIp } from "@/server/ingestion/ip-safety";

const MAX_REDIRECTS = 3;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const ACCEPT_HEADER = "text/html,application/xhtml+xml,application/pdf";

export type FetchFailure = "UNSAFE_URL" | "TOO_LARGE" | "TIMEOUT" | "UNAVAILABLE";
export type ArticleFetchSuccess = { ok: true; url: string; content: string; extractor: ArticleExtractor; html: string | null; title: string | null };
export type ArticleFetchResult = ArticleFetchSuccess | { ok: false; status: FetchFailure };
type Resolver = (host: string) => Promise<string[]>;
type Dependencies = { fetcher?: typeof fetch; resolve?: Resolver };
type SafeUrl = { url: URL; addresses: string[] };

async function defaultResolve(host: string) { return (await dnsLookup(host, { all: true })).map(({ address }) => address); }

async function assertSafeUrl(value: string, resolve: Resolver): Promise<SafeUrl> {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("UNSAFE_URL");
  const addresses = isIP(url.hostname) ? [url.hostname] : await resolve(url.hostname);
  if (!addresses.length || addresses.some((address) => !isPublicIp(address))) throw new Error("UNSAFE_URL");
  return { url, addresses };
}

/**
 * Pins the connection to the addresses `assertSafeUrl` already vetted.
 *
 * Without this the socket would resolve the hostname a second time, letting a hostile
 * DNS server answer the check with a public address and the connection with a private one.
 */
export function createPinnedLookup(pinned: { addresses: string[] }): LookupFunction {
  return (_hostname, options, callback) => {
    const records = pinned.addresses.filter(isPublicIp).map((address) => ({ address, family: isIP(address) }));
    if (!records.length) { callback(new Error("UNSAFE_URL"), []); return; }
    if (options.all) callback(null, records);
    else callback(null, records[0].address, records[0].family);
  };
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
  const pinned = { addresses: [] as string[] };
  const dispatcher = new Agent({ connect: { lookup: createPinnedLookup(pinned) } });
  let current = initialUrl;
  try {
    const structured = await extractStructuredSource((await assertSafeUrl(current, resolve)).url, fetcher as ExtractorFetch);
    if (structured) return { ok: true, url: current, content: structured.text, extractor: structured.extractor, html: null, title: structured.title };

    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      const { url, addresses } = await assertSafeUrl(current, resolve);
      pinned.addresses = addresses;
      const response = await fetcher(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: ACCEPT_HEADER }, dispatcher } as RequestInit);
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
  } finally {
    await dispatcher.destroy();
  }
}
