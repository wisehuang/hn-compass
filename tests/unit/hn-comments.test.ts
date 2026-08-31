import { describe, expect, it } from "vitest";
import { collectHnComments } from "@/server/ingestion/hn-comments";

const items: Record<number, unknown> = {
  100: { id: 100, type: "story", by: "pg", kids: [1, 2, 3] },
  1: { id: 1, type: "comment", by: "pg", parent: 100, text: "Happy to answer questions about this." },
  2: { id: 2, type: "comment", by: "dang", parent: 100, text: "I wrote this over a weekend in 2019." },
  3: { id: 3, type: "comment", by: "ada", parent: 100, text: "This benchmark looks unrealistic to me." },
  200: { id: 200, type: "story", kids: [1] },
};

async function collect(storyId: number) {
  return collectHnComments(storyId, { fetchItem: async (itemId) => items[itemId] });
}

describe("insider signals during comment collection", () => {
  it("marks the story submitter and leaves other authors to the body rules", async () => {
    const { comments } = await collect(100);

    expect(comments.map((comment) => [comment.hnCommentId, comment.insiderSignal])).toEqual([
      [1, "SUBMITTER"],
      [2, "SELF_IDENTIFIED_AUTHOR"],
      [3, null],
    ]);
  });

  it("derives no submitter signal when the story item omits its author", async () => {
    const { comments } = await collect(200);

    expect(comments[0].insiderSignal).toBeNull();
  });
});
