/**
 * Deterministic insider classification for a collected Hacker News comment.
 *
 * `SUBMITTER` is derived from Hacker News data and asserts a verified identity. The two
 * self-identified values are unverified claims the commenter made in prose, so readers must
 * see them attributed as claims rather than as verified attribution.
 */
export type InsiderSignal = "SUBMITTER" | "SELF_IDENTIFIED_AUTHOR" | "SELF_IDENTIFIED_INSIDER";

type SignalInput = { bodyText: string; author: string | null; submitter: string | null };

/** Claims of having produced the linked work. */
const AUTHOR_CLAIMS = ["i'm the author", "i am the author", "author here", "i wrote this", "i wrote the", "i built this", "i made this", "i created this", "disclosure: i wrote"] as const;

/** Claims of direct affiliation with the subject rather than authorship of it. */
const INSIDER_CLAIMS = ["i work at", "i worked at", "i work on", "i worked on", "i used to work at", "i'm on the team", "i am on the team", "former employee"] as const;

/** Comment HTML routinely carries curly apostrophes, so they are folded before matching. */
function normalizeBody(bodyText: string): string {
  return bodyText.replace(/[‘’ʼ]/g, "'").toLowerCase();
}

/**
 * Returns the highest-precedence signal a comment satisfies, or null when it satisfies none.
 * Author names are compared exactly because Hacker News usernames are case-sensitive.
 */
export function deriveInsiderSignal({ bodyText, author, submitter }: SignalInput): InsiderSignal | null {
  if (author && submitter && author === submitter) return "SUBMITTER";
  const normalized = normalizeBody(bodyText);
  if (AUTHOR_CLAIMS.some((claim) => normalized.includes(claim))) return "SELF_IDENTIFIED_AUTHOR";
  if (INSIDER_CLAIMS.some((claim) => normalized.includes(claim))) return "SELF_IDENTIFIED_INSIDER";
  return null;
}
