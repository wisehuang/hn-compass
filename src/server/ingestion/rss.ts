import { XMLParser } from "fast-xml-parser";
import { load } from "cheerio";
import { z } from "zod";

const RssSchema = z.object({ rss: z.object({ channel: z.object({ item: z.union([z.array(z.object({ description: z.string() })), z.object({ description: z.string() })]) }) }) });

export type RssStory = { rank: number; title: string; articleUrl: string; hnDiscussionUrl?: string; hnItemId?: number };

export function extractCanonicalHnItemId(value: string): number | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "news.ycombinator.com" || url.pathname !== "/item") return undefined;
    const id = url.searchParams.get("id");
    if (!id || !/^[1-9]\d*$/.test(id)) return undefined;
    const parsed = Number(id);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
  } catch { return undefined; }
}

function parseDescription(description: string): RssStory[] {
  const $ = load(description);
  const discussions = $(".postlink a").map((_, element) => {
    const href = $(element).attr("href");
    const hnItemId = href ? extractCanonicalHnItemId(href) : undefined;
    return hnItemId && href ? { href, hnItemId } : undefined;
  }).get();
  return $(".storylink a").map((index, element) => {
    const articleUrl = $(element).attr("href");
    const title = $(element).text().trim();
    if (!articleUrl || !title) return undefined;
    const discussion = discussions[index];
    return { rank: index + 1, title, articleUrl, hnDiscussionUrl: discussion?.href, hnItemId: discussion?.hnItemId };
  }).get();
}

export function parseDailyRss(xml: string): RssStory[] {
  const parsed = RssSchema.parse(new XMLParser({ ignoreAttributes: false, trimValues: true }).parse(xml));
  const items = Array.isArray(parsed.rss.channel.item) ? parsed.rss.channel.item : [parsed.rss.channel.item];
  const description = items[0]?.description;
  if (!description) throw new Error("RSS feed does not contain a daily story description.");
  const stories = parseDescription(description);
  if (!stories.length) throw new Error("RSS daily description contains no stories.");
  return stories;
}
