import { describe, expect, it } from "vitest";
import { deriveDiscussionTone, type DiscussionTone } from "@/server/discussion-tone";

function viewpoints(count: number) {
  return Array.from({ length: count }, (_unused, index) => ({ claim: `觀點 ${index}`, commentIds: [index + 1] }));
}

/** Every row of the tone derivation example table in the safe-ai-summarization spec. */
const specExamples: Array<{ consensus: string | null; supporting: number; dissenting: number; tone: DiscussionTone | null }> = [
  { consensus: "先驗證假設。", supporting: 3, dissenting: 0, tone: "BROAD_AGREEMENT" },
  { consensus: null, supporting: 2, dissenting: 3, tone: "CONTESTED" },
  { consensus: null, supporting: 2, dissenting: 2, tone: "CONTESTED" },
  { consensus: null, supporting: 3, dissenting: 1, tone: "MIXED" },
  { consensus: "先驗證假設。", supporting: 2, dissenting: 1, tone: "MIXED" },
  { consensus: null, supporting: 0, dissenting: 0, tone: null },
];

describe("discussion consensus tone derivation", () => {
  it.each(specExamples)("derives $tone from consensus $consensus with $supporting supporting and $dissenting dissenting", ({ consensus, supporting, dissenting, tone }) => {
    expect(deriveDiscussionTone({ overview: "討論摘要。", consensus, supportingViewpoints: viewpoints(supporting), dissentingViewpoints: viewpoints(dissenting), practicalTakeaways: [], unresolvedQuestions: [] })).toBe(tone);
  });

  it("derives no tone from a payload persisted before viewpoints were rendered", () => {
    expect(deriveDiscussionTone({ overview: "已保存的討論摘要。", consensus: "先驗證假設。", practicalTakeaways: ["驗證假設。"], unresolvedQuestions: [] })).toBeNull();
  });

  it("derives no tone from an absent or non-object payload", () => {
    expect(deriveDiscussionTone(undefined)).toBeNull();
    expect(deriveDiscussionTone(null)).toBeNull();
    expect(deriveDiscussionTone("討論摘要。")).toBeNull();
    expect(deriveDiscussionTone([])).toBeNull();
  });

  it("treats a blank consensus as no stated consensus", () => {
    expect(deriveDiscussionTone({ consensus: "   ", supportingViewpoints: viewpoints(2), dissentingViewpoints: [] })).toBe("MIXED");
  });
});
