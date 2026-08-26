import { describe, expect, it } from "vitest";
import { linkDensity, scoreExtraction } from "@/server/ingestion/extraction-confidence";

const paragraph = "Structured logging turns each log line into a queryable record instead of a sentence, which is what makes incident search tractable at all.";
const cleanText = Array.from({ length: 12 }, () => paragraph).join("\n");
const cleanHtml = `<html><body><article>${Array.from({ length: 12 }, () => `<p>${paragraph}</p>`).join("")}</article></body></html>`;

describe("link density", () => {
  it("reports a low ratio for prose and a high ratio for a link list", () => {
    expect(linkDensity(cleanHtml)).toBeLessThan(0.15);
    expect(linkDensity("<body><a href='/a'>Alpha story</a><a href='/b'>Beta story</a><a href='/c'>Gamma story</a></body>")).toBeGreaterThan(0.9);
  });

  it("treats an empty document as fully navigational rather than dividing by zero", () => {
    expect(linkDensity("<body></body>")).toBe(1);
  });
});

describe("extraction confidence", () => {
  it("scores a clean long-form article above the routing threshold", () => {
    const score = scoreExtraction({ text: cleanText, html: cleanHtml, title: "Structured logging in practice", extractor: "readability" });

    expect(score).toBeGreaterThanOrEqual(0.6);
  });

  it("scores a bot challenge page below the routing threshold", () => {
    const text = "Just a moment...\nEnable JavaScript and cookies to continue\nPlease wait while we verify your browser.";

    expect(scoreExtraction({ text, html: `<body>${text}</body>`, title: "Real article title", extractor: "plaintext" })).toBeLessThan(0.6);
  });

  it("scores a high link-density index page below the routing threshold", () => {
    const links = Array.from({ length: 60 }, (_, index) => `<a href="/story-${index}">Story number ${index} about distributed systems</a>`).join("");
    const html = `<body>${links}</body>`;

    expect(scoreExtraction({ text: "Story number 0 about distributed systems", html, title: "Story number 0", extractor: "plaintext" })).toBeLessThan(0.6);
  });

  it("trusts structured sources without heuristics", () => {
    for (const extractor of ["github-readme", "arxiv-abstract", "pdf"] as const) {
      expect(scoreExtraction({ text: "short", html: null, title: "irrelevant", extractor })).toBe(1);
    }
  });

  it("penalizes a paywall interstitial that would otherwise look like an article", () => {
    const withPaywall = `${cleanText}\nSubscribe to continue reading this article.`;
    const withoutPaywall = scoreExtraction({ text: cleanText, html: cleanHtml, title: "Structured logging in practice", extractor: "readability" });

    expect(scoreExtraction({ text: withPaywall, html: cleanHtml, title: "Structured logging in practice", extractor: "readability" })).toBeLessThan(withoutPaywall);
  });

  it("always produces a score inside the unit interval", () => {
    const cases = [
      { text: "", html: "<body></body>", title: "", extractor: "plaintext" as const },
      { text: cleanText, html: cleanHtml, title: "Structured logging in practice", extractor: "readability" as const },
      { text: "Just a moment... access denied", html: "<body>x</body>", title: "t", extractor: "plaintext" as const },
    ];

    for (const signals of cases) {
      const score = scoreExtraction(signals);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});
