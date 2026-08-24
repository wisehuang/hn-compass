import { describe, expect, it } from "vitest";
import { ArticleSummarySchema, createArticleSummaryGenerator, DiscussionSummarySchema, validateDiscussionSummary } from "@/server/ingestion/summaries";

describe("summary schemas", () => {
  it("accepts Kagi article output without fabricating structured fields", () => {
    expect(ArticleSummarySchema.safeParse({ summary: "本文說明安全取得資料的邊界。", tokens: 240, targetLanguage: "ZH-HANT" }).success).toBe(true);
  });

  it("rejects retired fabricated article fields", () => {
    expect(ArticleSummarySchema.safeParse({ tldr: "摘要", keyPoints: [], caveats: [], readerValue: "價值", sourceLanguage: "EN" }).success).toBe(false);
  });

  it("records Kagi engine provenance for faithful article output", async () => {
    const generator = createArticleSummaryGenerator({
      apiKey: "kagi-test",
      engine: "agnes",
      fetchFn: async () => new Response(JSON.stringify({ data: { output: "本文說明安全取得資料的邊界。", tokens: 240 } }), { status: 200 }),
    });

    await expect(generator.generateArticle("clean article text")).resolves.toMatchObject({
      payload: { summary: "本文說明安全取得資料的邊界。", tokens: 240, targetLanguage: "ZH-HANT" },
      model: "kagi:agnes",
      promptVersion: "kagi-v1",
    });
  });

  it("rejects discussion viewpoints that cite comments not persisted for the story", () => {
    const result = validateDiscussionSummary({
      overview: "討論出現相互衝突的看法。",
      consensus: null,
      supportingViewpoints: [{ claim: "支持觀點", commentIds: [101] }],
      dissentingViewpoints: [{ claim: "反對觀點", commentIds: [999] }],
      practicalTakeaways: ["先以小規模驗證。"],
      unresolvedQuestions: ["長期成本如何變化？"],
    }, new Set([101]));

    expect(result.success).toBe(false);
  });

  it("accepts mixed evidence only when consensus is null and all citations are persisted", () => {
    expect(validateDiscussionSummary({
      overview: "討論呈現兩種沒有明顯多數的觀點。",
      consensus: null,
      supportingViewpoints: [{ claim: "支持者重視可維護性。", commentIds: [101] }],
      dissentingViewpoints: [{ claim: "反對者擔心複雜度。", commentIds: [102] }],
      practicalTakeaways: ["先量測維護成本。"],
      unresolvedQuestions: ["是否能降低整合成本？"],
    }, new Set([101, 102])).success).toBe(true);
  });

  it("defines a strict discussion output contract", () => {
    expect(DiscussionSummarySchema.safeParse({ overview: "x", consensus: null, supportingViewpoints: [], dissentingViewpoints: [], practicalTakeaways: [], unresolvedQuestions: [], unexpected: true }).success).toBe(false);
  });
});
