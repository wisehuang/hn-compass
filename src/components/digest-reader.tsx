import type { PublicDigest, PublicStory } from "@/server/queries/public-digest";
import { deriveDiscussionTone, type DiscussionTone } from "@/server/discussion-tone";
import { JellyNavigationButton } from "@/components/jelly-navigation-button";
import Link from "next/link";
import type { CSSProperties } from "react";

type BadgeVariant = "rose" | "amber" | "azure" | "mint" | "platinum";

/** Shared between the digest cards and the story header so one story reads the same in both places. */
const TONE_BADGES: Record<DiscussionTone, { label: string; variant: BadgeVariant }> = {
  BROAD_AGREEMENT: { label: "共識明確", variant: "mint" },
  CONTESTED: { label: "爭論激烈", variant: "rose" },
  MIXED: { label: "各有主張", variant: "azure" },
};

function discussionSummary(story: PublicStory) {
  return story.summaries.find((summary) => summary.kind === "DISCUSSION");
}

function ConsensusBadge({ story }: { story: PublicStory }) {
  const tone = deriveDiscussionTone(discussionSummary(story)?.payloadJson);
  if (!tone) return null;
  return <jelly-badge variant={TONE_BADGES[tone].variant} size="small">{TONE_BADGES[tone].label}</jelly-badge>;
}

const jellyCardStyle = {
  "--jelly-card-padding-block": "0",
  "--jelly-card-padding-inline": "0",
} as CSSProperties;

function SummaryPreview({ story }: { story: PublicStory }) {
  const article = story.summaries.find((summary) => summary.kind === "ARTICLE")?.payloadJson as { summary?: string } | undefined;
  const discussion = discussionSummary(story)?.payloadJson as { overview?: string } | undefined;
  return <div className="reader-muted space-y-2 text-sm leading-6">
    <p><strong>文章重點：</strong>{article?.summary ?? "原文內容目前無法安全取得。"}</p>
    <p><strong>社群討論：</strong>{discussion?.overview ?? "尚無可用的討論摘要。"}</p>
  </div>;
}

/**
 * `SUBMITTER` is verified from Hacker News data and is stated as fact. The self-identified values
 * are unverified claims made in the comment body, so their labels attribute the identity to the
 * commenter rather than asserting it.
 */
const INSIDER_BADGES: Record<string, { label: string; variant: BadgeVariant }> = {
  SUBMITTER: { label: "投稿者", variant: "amber" },
  SELF_IDENTIFIED_AUTHOR: { label: "自稱作者", variant: "platinum" },
  SELF_IDENTIFIED_INSIDER: { label: "自稱內部人士", variant: "platinum" },
};

function InsiderBadge({ signal }: { signal: string | null }) {
  const badge = signal ? INSIDER_BADGES[signal] : undefined;
  if (!badge) return null;
  return <> <jelly-badge variant={badge.variant} size="small">{badge.label}</jelly-badge></>;
}

type Viewpoint = { claim: string; commentIds: number[] };

/** Stored payloads predate the viewpoint arrays, so every field is read defensively rather than cast. */
function readViewpoints(payload: unknown, key: "supportingViewpoints" | "dissentingViewpoints"): Viewpoint[] {
  const value = (payload as Record<string, unknown> | null | undefined)?.[key];
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const viewpoint = entry as { claim?: unknown; commentIds?: unknown };
    if (typeof viewpoint.claim !== "string" || !Array.isArray(viewpoint.commentIds)) return [];
    return [{ claim: viewpoint.claim, commentIds: viewpoint.commentIds.filter((id): id is number => typeof id === "number") }];
  });
}

function hnCommentUrl(hnCommentId: number) {
  return `https://news.ycombinator.com/item?id=${hnCommentId}`;
}

/**
 * Renders each viewpoint claim next to the persisted comments it cites, so a reader can check any
 * summary sentence against its source. Citations that do not resolve are dropped rather than shown
 * as dangling references; persisted payloads are validated at ingestion, so this is a render guard.
 */
function DiscussionEvidence({ story }: { story: PublicStory }) {
  const payload = discussionSummary(story)?.payloadJson;
  const groups = [
    { label: "支持觀點", viewpoints: readViewpoints(payload, "supportingViewpoints") },
    { label: "反對觀點", viewpoints: readViewpoints(payload, "dissentingViewpoints") },
  ].filter((group) => group.viewpoints.length > 0);
  if (groups.length === 0) return null;

  const byHnCommentId = new Map(story.comments.map((comment) => [comment.hnCommentId, comment]));
  return <jelly-card className="reader-card" style={jellyCardStyle}><section className="reader-section">
    <h2>討論證據</h2>
    <p className="reader-muted text-sm">每則主張都附上它引用的原始留言，可直接回 HN 核對。</p>
    {groups.map((group) => <div key={group.label}>
      <h3 className="mt-5 text-base font-semibold">{group.label}</h3>
      <ol className="mt-2 space-y-4">{group.viewpoints.map((viewpoint) => <li key={viewpoint.claim}>
        <p className="font-medium">{viewpoint.claim}</p>
        <ul className="mt-2 space-y-3">{viewpoint.commentIds.flatMap((hnCommentId) => {
          const comment = byHnCommentId.get(hnCommentId);
          if (!comment) return [];
          return [<li key={hnCommentId} className="reader-comment border-s-2 ps-4">
            <p>{comment.bodyText}</p>
            <p className="reader-muted mt-1 text-sm">{comment.author ?? "匿名"}<InsiderBadge signal={comment.insiderSignal} /> · <a className="focus-ring underline" href={hnCommentUrl(hnCommentId)} target="_blank" rel="noreferrer">HN #{hnCommentId}（在新分頁開啟）</a></p>
          </li>];
        })}</ul>
      </li>)}</ol>
    </div>)}
  </section></jelly-card>;
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
          <p className="reader-accent text-sm font-semibold"><jelly-badge variant="platinum" size="small">#{story.rank}</jelly-badge> <ConsensusBadge story={story} /> {story.sourceDomain} · {story.comments.length} 則留言</p>
          <h2 className="mt-1 text-2xl font-semibold"><a className="focus-ring" href={`/stories/${story.id}`}>{story.title}</a></h2>
          <div className="mt-3"><SummaryPreview story={story} /></div>
          <div className="mt-4 flex flex-wrap gap-2"><JellyNavigationButton href={story.articleUrl} newTab variant="azure">閱讀原文</JellyNavigationButton><JellyNavigationButton href={story.hnDiscussionUrl} newTab>查看 HN 討論</JellyNavigationButton><JellyNavigationButton href={`/stories/${story.id}`} variant="amber">閱讀完整解析</JellyNavigationButton></div>
        </article>
        </jelly-card>
      </li>)}
    </ol>
  </main>;
}

export function StoryReader({ story }: { story: PublicStory }) {
  const article = story.summaries.find((summary) => summary.kind === "ARTICLE");
  const discussion = discussionSummary(story);
  const articlePayload = article?.payloadJson as { summary?: string; tokens?: number; targetLanguage?: "ZH-HANT" } | undefined;
  const discussionPayload = discussion?.payloadJson as { overview?: string; consensus?: string | null; practicalTakeaways?: string[]; unresolvedQuestions?: string[] } | undefined;
  return <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
    <jelly-breadcrumbs size="small" aria-label="頁面導覽"><Link className="focus-ring" href="/">← 回到最新日報</Link><span>完整解析</span></jelly-breadcrumbs>
    <header className="reader-divider mt-7 border-b pb-7"><p className="reader-accent text-sm font-semibold"><jelly-badge variant="platinum" size="small">#{story.rank}</jelly-badge> <ConsensusBadge story={story} /> {story.sourceDomain}</p><h1 className="mt-2 text-4xl font-bold tracking-tight">{story.title}</h1><p className="mt-4 flex flex-wrap gap-4 text-sm"><a className="focus-ring underline" href={story.articleUrl} target="_blank" rel="noreferrer">原文連結（在新分頁開啟）</a><a className="focus-ring underline" href={story.hnDiscussionUrl} target="_blank" rel="noreferrer">HN 討論（在新分頁開啟）</a></p></header>
    <jelly-card className="reader-card" style={jellyCardStyle}><section className="reader-section"><h2>文章洞見</h2>{articlePayload?.summary ? <p>{articlePayload.summary}</p> : <p role="status">原文內容目前無法安全取得，因此未產生文章摘要。</p>}</section></jelly-card>
    <jelly-card className="reader-card" style={jellyCardStyle}><section className="reader-section"><h2>討論洞見</h2>{discussionPayload ? <><p>{discussionPayload.overview}</p><p><strong>共識：</strong>{discussionPayload.consensus ?? "證據不足或意見分歧，未下定論。"}</p><List items={discussionPayload.practicalTakeaways} label="實務建議" /><List items={discussionPayload.unresolvedQuestions} label="待釐清問題" /></> : <p role="status">尚無可用的討論摘要。</p>}</section></jelly-card>
    <DiscussionEvidence story={story} />
    <jelly-card className="reader-card" style={jellyCardStyle}><section className="reader-section"><h2>代表性留言</h2><ol className="space-y-4">{story.comments.map((comment) => <li key={comment.hnCommentId} className="reader-comment border-s-2 ps-4"><p>{comment.bodyText}</p><p className="reader-muted mt-1 text-sm">{comment.author ?? "匿名"}<InsiderBadge signal={comment.insiderSignal} /> · <a className="focus-ring underline" href={hnCommentUrl(comment.hnCommentId)} target="_blank" rel="noreferrer">HN #{comment.hnCommentId}（在新分頁開啟）</a></p></li>)}</ol></section></jelly-card>
    <footer className="reader-muted reader-section text-sm"><p>本頁摘要由 AI 生成，請回到原始來源核對脈絡。</p>{[article, discussion].filter(Boolean).map((summary) => <p key={summary!.kind}>{summary!.kind}：{summary!.model} · {summary!.promptVersion} · {summary!.generatedAt.toLocaleDateString("zh-TW")}</p>)}</footer>
  </main>;
}

function List({ items, label }: { items?: string[]; label?: string }) {
  if (!items?.length) return null;
  return <><h3 className="mt-5 text-base font-semibold">{label}</h3><ul className="mt-2 list-disc space-y-1 ps-5">{items.map((item) => <li key={item}>{item}</li>)}</ul></>;
}
