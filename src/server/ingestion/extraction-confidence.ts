import { load } from "cheerio";
import { STRUCTURED_EXTRACTORS, type ArticleExtractor } from "@/server/ingestion/extractors/types";

/** Markers of an interstitial, paywall, or bot challenge served in place of the article. */
const BLOCKER_PATTERNS: readonly RegExp[] = [
  /just a moment/i,
  /enable javascript and cookies/i,
  /checking your browser/i,
  /verify (?:that )?you are (?:a )?human/i,
  /attention required/i,
  /subscribe to (?:continue )?read/i,
  /create a free account/i,
  /(?:403 forbidden|access denied)/i,
];

const BLOCKER_PENALTY = 0.5;
const LEAD_MINIMUM_CHARS = 500;
const LEAD_RATIO = 0.2;

export type ExtractionSignals = {
  text: string;
  html: string | null;
  title: string;
  extractor: ArticleExtractor;
};

/** Ratio of anchor text to overall body text; high values indicate a navigation or index page. */
export function linkDensity(html: string): number {
  const $ = load(html);
  $("script,style,noscript,template,svg,iframe").remove();
  const bodyLength = $("body").text().replace(/\s+/g, " ").trim().length;
  if (!bodyLength) return 1;
  const linkLength = $("a").text().replace(/\s+/g, " ").trim().length;
  return Math.min(1, linkLength / bodyLength);
}

function paragraphCount(text: string) {
  return text.split(/\n+/).filter((line) => line.trim().length > 0).length;
}

function titleAppearsInLead(title: string, text: string) {
  const tokens = title.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu);
  if (!tokens?.length) return false;
  const lead = text.slice(0, Math.max(LEAD_MINIMUM_CHARS, Math.floor(text.length * LEAD_RATIO))).toLowerCase();
  return tokens.filter((token) => lead.includes(token)).length / tokens.length >= 0.5;
}

/**
 * Heuristic 0..1 confidence that the extracted text is the article body rather than
 * boilerplate, an index page, or a bot challenge. Structured sources bypass scoring.
 */
export function scoreExtraction({ text, html, title, extractor }: ExtractionSignals): number {
  if (STRUCTURED_EXTRACTORS.has(extractor)) return 1;

  let score = 0;
  if (text.length >= 1200) score += 0.35;
  else if (text.length >= 500) score += 0.2;

  // A missing document is anomalous for HTML extractors, so score it as the middle bucket.
  const density = html === null ? 0.2 : linkDensity(html);
  if (density < 0.15) score += 0.25;
  else if (density <= 0.3) score += 0.1;

  if (paragraphCount(text) >= 4) score += 0.2;
  if (titleAppearsInLead(title, text)) score += 0.2;
  if (BLOCKER_PATTERNS.some((pattern) => pattern.test(text))) score -= BLOCKER_PENALTY;

  return Math.min(1, Math.max(0, Number(score.toFixed(4))));
}
