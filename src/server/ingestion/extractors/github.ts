import { normalizeExtractedText } from "@/server/ingestion/extractors/readability";
import type { StructuredExtractorHandler } from "@/server/ingestion/extractors/types";

const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);
const GITHUB_TIMEOUT_MS = 10_000;

/** First path segments that are GitHub product pages rather than repository owners. */
const RESERVED_OWNERS = new Set([
  "about", "apps", "collections", "contact", "customer-stories", "enterprise", "events", "explore",
  "features", "login", "marketplace", "new", "notifications", "orgs", "pricing", "pulls", "search",
  "security", "settings", "sponsors", "topics", "trending", "users",
]);

/** Matches only a repository root; /blob/, /issues/, /pull/ and friends have extra segments. */
export function parseGithubRepo(url: URL): { owner: string; repo: string } | null {
  if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 2) return null;
  const [owner, rawRepo] = segments;
  if (RESERVED_OWNERS.has(owner.toLowerCase())) return null;
  const repo = rawRepo.replace(/\.git$/i, "");
  if (!owner || !repo) return null;
  return { owner, repo };
}

export const extractGithubReadme: StructuredExtractorHandler = async (url, fetchFn) => {
  const repository = parseGithubRepo(url);
  if (!repository) return null;

  const headers: Record<string, string> = {
    accept: "application/vnd.github.raw",
    "user-agent": "hn-compass",
    "x-github-api-version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) headers.authorization = `Bearer ${token}`;

  try {
    const response = await fetchFn(`https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/readme`, {
      headers,
      signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const text = normalizeExtractedText(await response.text());
    if (!text) return null;
    return { text, title: `${repository.owner}/${repository.repo}`, extractor: "github-readme" };
  } catch {
    return null;
  }
};
