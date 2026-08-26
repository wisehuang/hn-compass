import { describe, expect, it } from "vitest";
import { readSummaryEnv } from "@/server/summary-config";

const base = { OPENAI_API_KEY: "openai-test", OPENAI_MODEL: "gpt-5.6-luna", KAGI_API_KEY: "kagi-test", KAGI_SUMMARIZER_ENGINE: "agnes" };

describe("summary environment", () => {
  it("leaves the routing controls unset so the router applies its defaults", () => {
    expect(readSummaryEnv(base)).toMatchObject({ minimumConfidence: undefined, kagiFallbackEnabled: undefined, openAiArticleModel: undefined });
  });

  it("reads a confidence threshold inside the unit interval", () => {
    expect(readSummaryEnv({ ...base, ARTICLE_EXTRACTION_MIN_CONFIDENCE: "0.45" }).minimumConfidence).toBe(0.45);
    expect(readSummaryEnv({ ...base, ARTICLE_EXTRACTION_MIN_CONFIDENCE: "0" }).minimumConfidence).toBe(0);
  });

  it("ignores a threshold that is not a usable score rather than routing everything one way", () => {
    for (const value of ["", "high", "1.5", "-0.2", "NaN"]) {
      expect(readSummaryEnv({ ...base, ARTICLE_EXTRACTION_MIN_CONFIDENCE: value }).minimumConfidence).toBeUndefined();
    }
  });

  it("disables the Kagi fallback only for explicit negative values", () => {
    for (const value of ["false", "FALSE", "0", "no", "off", " off "]) {
      expect(readSummaryEnv({ ...base, KAGI_FALLBACK_ENABLED: value }).kagiFallbackEnabled).toBe(false);
    }
    for (const value of ["true", "1", "yes", ""]) {
      expect(readSummaryEnv({ ...base, KAGI_FALLBACK_ENABLED: value }).kagiFallbackEnabled).toBeUndefined();
    }
  });

  it("carries a dedicated article model when one is configured", () => {
    expect(readSummaryEnv({ ...base, OPENAI_ARTICLE_MODEL: "gpt-5.6-luna" }).openAiArticleModel).toBe("gpt-5.6-luna");
  });
});
