import type { PublicDigest, PublicStory } from "@/server/queries/public-digest";
import Link from "next/link";
import type { CSSProperties } from "react";

const jellyCardStyle = {
  "--jelly-card-padding-block": "0",
  "--jelly-card-padding-inline": "0",
} as CSSProperties;

function SummaryPreview({ story }: { story: PublicStory }) {
  const article = story.summaries.find((summary) => summary.kind === "ARTICLE")?.payloadJson as { summary?: string } | undefined;
  const discussion = story.summaries.find((summary) => summary.kind === "DISCUSSION")?.payloadJson as { overview?: string } | undefined;
  return <div className="reader-muted space-y-2 text-sm leading-6">
    <p><strong>文章重點：</strong>{article?.summary ?? "原文內容目前無法安全取得。"}</p>
    <p><strong>社群討論：</strong>{discussion?.overview ?? "尚無可用的討論摘要。"}</p>
  </div>;
}

export function DigestReader({ digest }: { digest: PublicDigest }) {
  return <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
    <header className="reader-divider border-b pb-7">
      <p className="reader-accent text-sm font-semibold tracking-[0.18em]">HN COMPASS · 每日精選</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">{digest.digestDate}</h1>
      <jelly-breadcrumbs className="mt-5" size="small" aria-label="每日彙整導覽"><a className="focus-ring" href={`/daily/${digest.digestDate}`}>查看本日封存</a><span>{digest.digestDate}</span></jelly-breadcrumbs>
    </header>
    <ol className="mt-8 space-y-6" aria-label="本日文章">
      {digest.stories.map((story) => <li key={story.id}>
        <jelly-card className="digest-card" style={jellyCardStyle}>
        <article>
          <p className="reader-accent text-sm font-semibold"><jelly-badge variant="platinum" size="small">#{story.rank}</jelly-badge> {story.sourceDomain} · {story.comments.length} 則留言</p>
          <h2 className="mt-1 text-2xl font-semibold"><a className="focus-ring" href={`/stories/${story.id}`}>{story.title}</a></h2>
          <div className="mt-3"><SummaryPreview story={story} /></div>
          <p className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium"><a className="focus-ring underline" href={story.articleUrl} target="_blank" rel="noreferrer">閱讀原文（在新分頁開啟）</a><a className="focus-ring underline" href={story.hnDiscussionUrl} target="_blank" rel="noreferrer">查看 HN 討論（在新分頁開啟）</a><a className="focus-ring underline" href={`/stories/${story.id}`}>閱讀完整解析</a></p>
        </article>
        </jelly-card>
      </li>)}
    </ol>
  </main>;
}

export function StoryReader({ story }: { story: PublicStory }) {
  const article = story.summaries.find((summary) => summary.kind === "ARTICLE");
  const discussion = story.summaries.find((summary) => summary.kind === "DISCUSSION");
  const articlePayload = article?.payloadJson as { summary?: string; tokens?: number; targetLanguage?: "ZH-HANT" } | undefined;
  const discussionPayload = discussion?.payloadJson as { overview?: string; consensus?: string | null; practicalTakeaways?: string[]; unresolvedQuestions?: string[] } | undefined;
  return <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
    <jelly-breadcrumbs size="small" aria-label="頁面導覽"><Link className="focus-ring" href="/">← 回到最新日報</Link><span>完整解析</span></jelly-breadcrumbs>
    <header className="reader-divider mt-7 border-b pb-7"><p className="reader-accent text-sm font-semibold"><jelly-badge variant="platinum" size="small">#{story.rank}</jelly-badge> {story.sourceDomain}</p><h1 className="mt-2 text-4xl font-bold tracking-tight">{story.title}</h1><p className="mt-4 flex flex-wrap gap-4 text-sm"><a className="focus-ring underline" href={story.articleUrl} target="_blank" rel="noreferrer">原文連結（在新分頁開啟）</a><a className="focus-ring underline" href={story.hnDiscussionUrl} target="_blank" rel="noreferrer">HN 討論（在新分頁開啟）</a></p></header>
    <jelly-card className="reader-card" style={jellyCardStyle}><section className="reader-section"><h2>文章洞見</h2>{articlePayload?.summary ? <p>{articlePayload.summary}</p> : <p role="status">原文內容目前無法安全取得，因此未產生文章摘要。</p>}</section></jelly-card>
    <jelly-card className="reader-card" style={jellyCardStyle}><section className="reader-section"><h2>討論洞見</h2>{discussionPayload ? <><p>{discussionPayload.overview}</p><p><strong>共識：</strong>{discussionPayload.consensus ?? "證據不足或意見分歧，未下定論。"}</p><List items={discussionPayload.practicalTakeaways} label="實務建議" /><List items={discussionPayload.unresolvedQuestions} label="待釐清問題" /></> : <p role="status">尚無可用的討論摘要。</p>}</section></jelly-card>
    <jelly-card className="reader-card" style={jellyCardStyle}><section className="reader-section"><h2>代表性留言</h2><ol className="space-y-4">{story.comments.map((comment) => <li key={comment.hnCommentId} className="reader-comment border-s-2 ps-4"><p>{comment.bodyText}</p><p className="reader-muted mt-1 text-sm">{comment.author ?? "匿名"} · HN #{comment.hnCommentId}</p></li>)}</ol></section></jelly-card>
    <footer className="reader-muted reader-section text-sm"><p>本頁摘要由 AI 生成，請回到原始來源核對脈絡。</p>{[article, discussion].filter(Boolean).map((summary) => <p key={summary!.kind}>{summary!.kind}：{summary!.model} · {summary!.promptVersion} · {summary!.generatedAt.toLocaleDateString("zh-TW")}</p>)}</footer>
  </main>;
}

function List({ items, label }: { items?: string[]; label?: string }) {
  if (!items?.length) return null;
  return <><h3 className="mt-5 text-base font-semibold">{label}</h3><ul className="mt-2 list-disc space-y-1 ps-5">{items.map((item) => <li key={item}>{item}</li>)}</ul></>;
}
