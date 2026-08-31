import { notFound } from "next/navigation";
import { StoryReader } from "@/components/digest-reader";

export const dynamic = "force-dynamic";

export default function ReaderFixturePage() {
  if (process.env.E2E_FIXTURE !== "1") notFound();
  return <StoryReader story={{ id: "fixture-story", rank: 1, title: "Seeded reader fixture", articleUrl: "https://example.test/article", sourceDomain: "example.test", hnDiscussionUrl: "https://news.ycombinator.com/item?id=1", hnItemId: 1, articleFetchStatus: "UNAVAILABLE", comments: [{ hnCommentId: 1, parentHnCommentId: null, author: "reader", score: 1, bodyText: "A persisted representative comment.", position: 0, insiderSignal: null }], summaries: [{ kind: "DISCUSSION", payloadJson: { overview: "已保存的討論摘要。", consensus: null, practicalTakeaways: ["驗證假設。"], unresolvedQuestions: [] }, model: "fixture-model", promptVersion: "v1", generatedAt: new Date("2026-08-24") }] }} />;
}
