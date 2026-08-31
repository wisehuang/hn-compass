import { describe, expect, it } from "vitest";
import { deriveInsiderSignal, type InsiderSignal } from "@/server/ingestion/insider-signals";

/** Every row of the signal derivation example table in the daily-digest-ingestion spec. */
const specExamples: Array<{ submitter: string | null; author: string | null; bodyText: string; signal: InsiderSignal | null }> = [
  { submitter: "pg", author: "pg", bodyText: "Happy to answer questions about this.", signal: "SUBMITTER" },
  { submitter: "pg", author: "pg", bodyText: "I'm the author, happy to answer questions.", signal: "SUBMITTER" },
  { submitter: "pg", author: "dang", bodyText: "I'm the author of the paper this links to.", signal: "SELF_IDENTIFIED_AUTHOR" },
  { submitter: "pg", author: "dang", bodyText: "I wrote this over a weekend in 2019.", signal: "SELF_IDENTIFIED_AUTHOR" },
  { submitter: "pg", author: "dang", bodyText: "I work at the company that ships this.", signal: "SELF_IDENTIFIED_INSIDER" },
  { submitter: "pg", author: "dang", bodyText: "I worked on the storage layer there.", signal: "SELF_IDENTIFIED_INSIDER" },
  { submitter: "pg", author: "dang", bodyText: "I’m the author of the linked post.", signal: "SELF_IDENTIFIED_AUTHOR" },
  { submitter: "pg", author: "dang", bodyText: "This benchmark looks unrealistic to me.", signal: null },
  { submitter: null, author: "dang", bodyText: "I wrote this over a weekend in 2019.", signal: "SELF_IDENTIFIED_AUTHOR" },
];

describe("insider signal derivation", () => {
  it.each(specExamples)("classifies $bodyText from $author as $signal", ({ submitter, author, bodyText, signal }) => {
    expect(deriveInsiderSignal({ bodyText, author, submitter })).toBe(signal);
  });

  it("keeps the verified submitter signal when the body also claims authorship", () => {
    expect(deriveInsiderSignal({ bodyText: "I'm the author and I work at the vendor.", author: "pg", submitter: "pg" })).toBe("SUBMITTER");
  });

  it("prefers an authorship claim over an affiliation claim in the same body", () => {
    expect(deriveInsiderSignal({ bodyText: "I wrote this while I worked on the platform team.", author: "dang", submitter: "pg" })).toBe("SELF_IDENTIFIED_AUTHOR");
  });

  it("matches claims regardless of letter case", () => {
    expect(deriveInsiderSignal({ bodyText: "I WORK AT the company that ships this.", author: "dang", submitter: "pg" })).toBe("SELF_IDENTIFIED_INSIDER");
  });

  it("returns no signal when the comment has no author", () => {
    expect(deriveInsiderSignal({ bodyText: "A comment with no attributed author.", author: null, submitter: "pg" })).toBeNull();
  });

  it("still reads claims from the body when the comment has no author", () => {
    expect(deriveInsiderSignal({ bodyText: "I built this in a weekend.", author: null, submitter: "pg" })).toBe("SELF_IDENTIFIED_AUTHOR");
  });
});
