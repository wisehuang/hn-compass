import { Readability } from "@mozilla/readability";
import { load } from "cheerio";
import { parseHTML } from "linkedom";

export const MINIMUM_EXTRACTED_LENGTH = 200;

const STRIPPED_SELECTOR = "script,style,noscript,template,svg,iframe";
const BLOCK_SELECTOR = "p,div,li,h1,h2,h3,h4,h5,h6,br,tr,section,article,blockquote,pre,figcaption";

/** Collapses runs of spaces while keeping block boundaries as newlines. */
export function normalizeExtractedText(value: string) {
  return value.replace(/[^\S\n]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Plain text that preserves block separation, unlike htmlToPlainText which concatenates blocks. */
export function htmlToBlockText(html: string) {
  const $ = load(html);
  $(STRIPPED_SELECTOR).remove();
  $(BLOCK_SELECTOR).after("\n");
  return normalizeExtractedText($("body").text());
}

export type ReadabilityExtraction = { text: string; title: string | null };

/** Returns null when Readability cannot isolate an article body worth summarizing. */
export function extractWithReadability(html: string): ReadabilityExtraction | null {
  try {
    const { document } = parseHTML(html);
    const parsed = new Readability(document).parse();
    if (!parsed?.content) return null;
    const text = htmlToBlockText(parsed.content);
    if (text.length < MINIMUM_EXTRACTED_LENGTH) return null;
    return { text, title: parsed.title?.trim() || null };
  } catch {
    return null;
  }
}
